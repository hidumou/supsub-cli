// commands/task：覆盖 finished=false / finished=true+mp / finished=true 无 mp 三个分支
import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { Command } from "commander";
import { registerTask } from "../../src/commands/task.ts";

const CONFIG_DIR = path.join(os.homedir(), ".supsub");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

async function cleanupAuthFields(): Promise<void> {
  try {
    const content = await fs.readFile(CONFIG_FILE, "utf-8");
    const parsed = JSON.parse(content) as Record<string, unknown>;
    const { api_key: _a, client_id: _c, bearer_token: _b, ...rest } = parsed;
    await fs.writeFile(CONFIG_FILE, JSON.stringify(rest, null, 2), "utf-8");
  } catch {
    /* ignore */
  }
}

function buildProgram(): Command {
  const program = new Command();
  program
    .name("supsub")
    .option("-o, --output <fmt>", "输出格式：table|json", "table")
    .exitOverride();
  registerTask(program);
  return program;
}

describe("commands/task - 查询搜索任务", () => {
  let originalFetch: typeof globalThis.fetch;
  let originalApiUrl: string | undefined;
  let originalExit: typeof process.exit;
  let originalStdout: typeof process.stdout.write;
  let originalStderr: typeof process.stderr.write;
  let exitCode: number | undefined;
  let stdoutOutput: string;
  let stderrOutput: string;

  beforeEach(async () => {
    originalFetch = globalThis.fetch;
    originalApiUrl = process.env["SUPSUB_API_URL"];
    originalExit = process.exit;
    originalStdout = process.stdout.write.bind(process.stdout);
    originalStderr = process.stderr.write.bind(process.stderr);
    process.env["SUPSUB_API_URL"] = "http://fake-host";
    exitCode = undefined;
    stdoutOutput = "";
    stderrOutput = "";

    process.stdout.write = ((c: string | Uint8Array): boolean => {
      stdoutOutput += typeof c === "string" ? c : new TextDecoder().decode(c);
      return true;
    }) as typeof process.stdout.write;
    process.stderr.write = ((c: string | Uint8Array): boolean => {
      stderrOutput += typeof c === "string" ? c : new TextDecoder().decode(c);
      return true;
    }) as typeof process.stderr.write;

    // 拦截 process.exit 防止测试进程真的退出
    process.exit = ((code?: number): never => {
      exitCode = code ?? 0;
      throw new Error(`__exit_${code ?? 0}__`);
    }) as typeof process.exit;

    await fs.mkdir(CONFIG_DIR, { recursive: true });
    await fs.writeFile(
      CONFIG_FILE,
      JSON.stringify({ api_key: "sk_task", client_id: "supsub-cli" }, null, 2),
      "utf-8",
    );
  });

  afterEach(async () => {
    globalThis.fetch = originalFetch;
    process.exit = originalExit;
    process.stdout.write = originalStdout;
    process.stderr.write = originalStderr;
    if (originalApiUrl === undefined) delete process.env["SUPSUB_API_URL"];
    else process.env["SUPSUB_API_URL"] = originalApiUrl;
    await cleanupAuthFields();
  });

  test("finished=false：JSON 输出 finished:false 且不调 exit", async () => {
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ finished: false, message: "搜索中..." }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    const program = buildProgram();
    await program.parseAsync([
      "node",
      "supsub",
      "--output",
      "json",
      "task",
      "search-id-001",
    ]);

    expect(exitCode).toBeUndefined();
    const parsed = JSON.parse(stdoutOutput);
    expect(parsed.success).toBe(true);
    expect(parsed.data.finished).toBe(false);
    expect(parsed.data.mp).toBeNull();
  });

  test("finished=true 且 mp 命中：输出 mp 信息且不调 exit", async () => {
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          finished: true,
          message: "完成",
          mp: { mpId: "MP_42", name: "OpenAI", description: "AI lab" },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );

    const program = buildProgram();
    await program.parseAsync([
      "node",
      "supsub",
      "--output",
      "json",
      "task",
      "search-id-002",
    ]);

    expect(exitCode).toBeUndefined();
    const parsed = JSON.parse(stdoutOutput);
    expect(parsed.data.finished).toBe(true);
    expect(parsed.data.mp.mpId).toBe("MP_42");
    expect(parsed.data.mp.name).toBe("OpenAI");
  });

  test("finished=true 但 mp 缺失：dieWith MP_NOT_FOUND 业务退出码", async () => {
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({ finished: true, message: "未找到" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );

    const program = buildProgram();
    let thrown: unknown;
    try {
      await program.parseAsync([
        "node",
        "supsub",
        "--output",
        "json",
        "task",
        "search-id-003",
      ]);
    } catch (e) {
      thrown = e;
    }

    expect(thrown).toBeDefined();
    expect(exitCode).toBeDefined();
    expect(exitCode).not.toBe(0);
    // dieWith 在 json 模式下把 ErrorEnvelope 写到 stdout
    const parsed = JSON.parse(stdoutOutput);
    expect(parsed.success).toBe(false);
    expect(parsed.error.code).toBe("MP_NOT_FOUND");
  });
});
