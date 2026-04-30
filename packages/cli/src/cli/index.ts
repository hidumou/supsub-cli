// packages/cli/src/cli/index.ts
import { Command } from "commander";
import { dieWith, isErrorEnvelope, type ErrorEnvelope } from "../lib/errors.ts";
import { setCliApiKey } from "../http/credentials.ts";

// Auth commands
import { registerAuthLogin } from "../commands/auth/login.ts";
import { registerAuthLogout } from "../commands/auth/logout.ts";
import { registerAuthStatus } from "../commands/auth/status.ts";

// Sub commands
import { registerSubList } from "../commands/sub/list.ts";
import { registerSubAdd } from "../commands/sub/add.ts";
import { registerSubRemove } from "../commands/sub/remove.ts";
import { registerSubContents } from "../commands/sub/contents.ts";
import { registerSubMarkRead } from "../commands/sub/mark-read.ts";

// Search command
import { registerSearch } from "../commands/search.ts";

// MP commands
import { registerMpSearch } from "../commands/mp/search.ts";
import { registerMpSearchCancel } from "../commands/mp/search-cancel.ts";

// Task command
import { registerTask } from "../commands/task.ts";

// Read version from package.json
import pkg from "../../package.json" with { type: "json" };

function toErrorEnvelope(err: unknown): ErrorEnvelope {
  if (isErrorEnvelope(err)) return err;
  return {
    code: "UNKNOWN_ERROR",
    message: err instanceof Error ? err.message : String(err),
    status: 0,
  };
}

export async function run(): Promise<void> {
  const program = new Command();

  program
    .name("supsub")
    .description("supsub 命令行工具")
    .version(pkg.version)
    // 全局选项（API 基地址通过 SUPSUB_API_URL 环境变量配置，不走 flag）
    .option("-o, --output <fmt>", "输出格式：table|json", "table")
    .option("--api-key <key>", "API Key（优先级高于环境变量和配置文件）");

  // 把全局 --api-key flag 注入到凭证解析器，让 request/api 层无需透传 apiKey
  program.hook("preAction", () => {
    const opts = program.opts() as { apiKey?: string };
    setCliApiKey(opts.apiKey);
  });

  // ─── auth 子命令树 ────────────────────────────────────────
  const auth = program.command("auth").description("认证管理");
  registerAuthLogin(auth);
  registerAuthLogout(auth);
  registerAuthStatus(auth);

  // ─── sub 子命令树 ─────────────────────────────────────────
  const sub = program.command("sub").description("订阅源管理");
  registerSubList(sub);
  registerSubAdd(sub);
  registerSubRemove(sub);
  registerSubContents(sub);
  registerSubMarkRead(sub);

  // ─── search 命令 ──────────────────────────────────────────
  registerSearch(program);

  // ─── mp 子命令树 ──────────────────────────────────────────
  const mp = program.command("mp").description("公众号相关操作");
  registerMpSearch(mp);
  registerMpSearchCancel(mp);

  // ─── task 命令 ────────────────────────────────────────────
  registerTask(program);

  // 顶层 try/catch：捕获所有命令抛出的错误并统一处理（exit code 由 errors.ts 推导）
  try {
    await program.parseAsync(process.argv);
  } catch (err) {
    const fmt = program.opts()["output"] as string | undefined;
    dieWith(toErrorEnvelope(err), fmt);
  }
}
