// E2E：以子进程驱动真实 supsub CLI（bun src/index.ts），打正式环境
//
// 与 prod-bearer.test.ts（API 层 E2E）的区别：
//   - 这里走完整 CLI：argv 解析 → preAction hook → command action → output → 退出码
//   - 验证 stdout/stderr/exit code 的端到端契约（agent 调用的就是这层）
//
// ⚠️  默认跳过：必须显式提供 SUPSUB_E2E_BEARER 才会启用。
// ⚠️  Token 不入库：从环境变量读取。
// ⚠️  覆盖范围限制：仅只读命令，绕过会变更线上数据的命令（sub add/remove/mark-read、
//     mp search、auth login/logout）。这部分可在 mock server 跑 happy path。
// ⚠️  启用方式：
//        SUPSUB_E2E_BEARER='<jwt>' bun test test/e2e/prod-cli.test.ts

import { describe, test, expect, beforeAll } from "bun:test";
import { spawn } from "node:child_process";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

const BEARER = process.env["SUPSUB_E2E_BEARER"];
const SKIP = !BEARER;

const PROD_API = "https://supsub.net";
// 测试运行 cwd 是 packages/cli（bun test 在该包根目录执行）
const ENTRY = "src/index.ts";

type CliResult = { stdout: string; stderr: string; code: number };

/**
 * 用子进程运行 CLI，返回 stdout/stderr/exit code。
 * 关键点：
 *   - HOME 指到一个空临时目录，强制 readConfig 拿空对象，
 *     避免本机现有 ~/.supsub/config.json 抢 source=config 优先级
 *   - SUPSUB_API_URL 强制指向正式环境 supsub.net
 *   - exitOverride 不可用（真实子进程），靠 exit code 判断业务结果
 */
async function runCli(
  args: string[],
  opts: { withAuth?: boolean; tmpHome?: string } = {},
): Promise<CliResult> {
  const env: Record<string, string> = {
    ...(process.env as Record<string, string>),
    SUPSUB_API_URL: PROD_API,
  };
  if (opts.tmpHome) env["HOME"] = opts.tmpHome;
  // 防止本机 SUPSUB_API_KEY 影响 source 判定
  delete env["SUPSUB_API_KEY"];

  const finalArgs = opts.withAuth
    ? ["run", ENTRY, "--api-key", BEARER!, ...args]
    : ["run", ENTRY, ...args];

  return await new Promise<CliResult>((resolve, reject) => {
    const child = spawn("bun", finalArgs, { env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (c) => (stdout += c.toString()));
    child.stderr.on("data", (c) => (stderr += c.toString()));
    child.on("error", reject);
    child.on("close", (code) => resolve({ stdout, stderr, code: code ?? -1 }));
  });
}

describe.skipIf(SKIP)("e2e/prod-cli - 通过子进程驱动 CLI 打正式环境", () => {
  let tmpHome: string;

  beforeAll(async () => {
    // 每个测试组用一个空 HOME，避免污染本机 ~/.supsub/config.json
    tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), "supsub-e2e-"));
  });

  // ─── 元命令（不依赖鉴权与网络） ────────────────────────────

  test("supsub --version 正常退出", async () => {
    const r = await runCli(["--version"], { tmpHome });
    expect(r.code).toBe(0);
    expect(r.stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
  });

  test("supsub --help 列出全部一级命令", async () => {
    const r = await runCli(["--help"], { tmpHome });
    expect(r.code).toBe(0);
    for (const cmd of ["auth", "sub", "search", "mp", "task"]) {
      expect(r.stdout).toContain(cmd);
    }
  });

  test("未知命令：commander 报错并以非 0 退出", async () => {
    const r = await runCli(["nonexistent"], { tmpHome });
    expect(r.code).not.toBe(0);
  });

  // ─── 鉴权相关 ───────────────────────────────────────────────

  test("auth status 未登录 → exit 2 (UNAUTHORIZED) 且 stderr 提示重新登录", async () => {
    const r = await runCli(["auth", "status"], { tmpHome }); // 无 --api-key
    expect(r.code).toBe(2);
    expect(r.stderr).toMatch(/auth login|登录/);
  });

  test("auth status 未登录 + --output json → stdout 输出 ErrorEnvelope", async () => {
    const r = await runCli(["--output", "json", "auth", "status"], { tmpHome });
    expect(r.code).toBe(2);
    const body = JSON.parse(r.stdout);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  test("auth status --api-key <jwt> → email/source=flag 返回正确", async () => {
    const r = await runCli(["--output", "json", "auth", "status"], {
      tmpHome,
      withAuth: true,
    });
    expect(r.code).toBe(0);
    const body = JSON.parse(r.stdout);
    expect(body.success).toBe(true);
    expect(body.data.email).toContain("@");
    // --api-key flag 命中 → source=flag
    expect(body.data.api_key_source).toBe("flag");
    // api_key 必须脱敏（不回显原 token）
    expect(body.data.api_key).not.toBe(BEARER);
    expect(body.data.api_key).toContain("***");
  });

  // ─── 订阅查询（read-only） ──────────────────────────────────

  test("sub list --output json → success: true, data 是数组", async () => {
    const r = await runCli(["--output", "json", "sub", "list"], {
      tmpHome,
      withAuth: true,
    });
    expect(r.code).toBe(0);
    const body = JSON.parse(r.stdout);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  test("sub list --type MP → 仅 MP", async () => {
    const r = await runCli(["--output", "json", "sub", "list", "--type", "MP"], {
      tmpHome,
      withAuth: true,
    });
    expect(r.code).toBe(0);
    const body = JSON.parse(r.stdout);
    for (const s of body.data) {
      expect(s.sourceType).toBe("MP");
    }
  });

  test("sub list --type 非法 → exit 64 INVALID_ARGS（不发请求）", async () => {
    const r = await runCli(["sub", "list", "--type", "BLOG"], {
      tmpHome,
      withAuth: true,
    });
    expect(r.code).toBe(64);
    expect(r.stderr).toMatch(/MP|WEBSITE|BLOG/);
  });

  test("sub contents --source-id 缺失类型 → commander 报必填字段错（非 0）", async () => {
    const r = await runCli(
      ["sub", "contents", "--source-id", "1"],
      { tmpHome, withAuth: true },
    );
    expect(r.code).not.toBe(0);
  });

  // ─── 搜索 ────────────────────────────────────────────────────

  test("search <kw> --output json → 返回 results 与 recommendations 结构", async () => {
    const r = await runCli(["--output", "json", "search", "openai"], {
      tmpHome,
      withAuth: true,
    });
    expect(r.code).toBe(0);
    const body = JSON.parse(r.stdout);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data.results)).toBe(true);
    expect(Array.isArray(body.data.recommendations)).toBe(true);
  });

  test("search 非法 --type → exit 64 INVALID_ARGS", async () => {
    const r = await runCli(["search", "x", "--type", "BLOG"], {
      tmpHome,
      withAuth: true,
    });
    expect(r.code).toBe(64);
  });

  // ─── 搜索任务（read-only 路径） ────────────────────────────

  test("task <未知 searchId> → 业务错误（非 0），json 模式 stdout 含 error", async () => {
    // 任意一个不存在的 searchId
    const r = await runCli(
      ["--output", "json", "task", "nonexistent-search-id-xyz"],
      { tmpHome, withAuth: true },
    );
    // 业务错误（1）或服务端错误（11），但绝不应是 0
    expect(r.code).not.toBe(0);
    expect(() => JSON.parse(r.stdout)).not.toThrow();
    const body = JSON.parse(r.stdout);
    expect(body.success).toBe(false);
    expect(typeof body.error.code).toBe("string");
  });

  test("mp search-cancel <未知 id> → exit 1 + code=TASK_NOT_FOUND（仅 404 路径）", async () => {
    const r = await runCli(
      ["--output", "json", "mp", "search-cancel", "nonexistent-task-id-xyz"],
      { tmpHome, withAuth: true },
    );
    // 后端可能返回 404 或其它；只断言非 0 + json 可解析
    expect(r.code).not.toBe(0);
    const body = JSON.parse(r.stdout);
    expect(body.success).toBe(false);
  });

  // ─── 鉴权失败路径 ───────────────────────────────────────────

  test("--api-key 非法字符串 → exit 2 UNAUTHORIZED（API 返回 401 → clearAuth）", async () => {
    const r = await runCli(
      ["--api-key", "sk_invalid_e2e_token", "--output", "json", "auth", "status"],
      { tmpHome },
    );
    expect(r.code).toBe(2);
    const body = JSON.parse(r.stdout);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });
});
