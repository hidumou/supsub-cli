// commands/sub/mark-read：参数互斥与必填校验，以及成功路径的请求体
import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { Command } from "commander";
import { registerSubMarkRead } from "../../../src/commands/sub/mark-read.ts";

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
  const sub = program.command("sub");
  registerSubMarkRead(sub);
  return program;
}

describe("commands/sub/mark-read - 参数校验", () => {
  let originalFetch: typeof globalThis.fetch;
  let originalApiUrl: string | undefined;
  let originalStdout: typeof process.stdout.write;
  let stdoutOutput: string;
  let receivedBody: string;

  beforeEach(async () => {
    originalFetch = globalThis.fetch;
    originalApiUrl = process.env["SUPSUB_API_URL"];
    originalStdout = process.stdout.write.bind(process.stdout);
    process.env["SUPSUB_API_URL"] = "http://fake-host";
    stdoutOutput = "";
    receivedBody = "";

    process.stdout.write = ((c: string | Uint8Array): boolean => {
      stdoutOutput += typeof c === "string" ? c : new TextDecoder().decode(c);
      return true;
    }) as typeof process.stdout.write;

    await fs.mkdir(CONFIG_DIR, { recursive: true });
    await fs.writeFile(
      CONFIG_FILE,
      JSON.stringify({ api_key: "sk_mark", client_id: "supsub-cli" }, null, 2),
      "utf-8",
    );

    globalThis.fetch = async (
      _input: RequestInfo | URL,
      init?: RequestInit,
    ): Promise<Response> => {
      receivedBody = (init?.body as string) ?? "";
      return new Response(null, { status: 204 });
    };
  });

  afterEach(async () => {
    globalThis.fetch = originalFetch;
    process.stdout.write = originalStdout;
    if (originalApiUrl === undefined) delete process.env["SUPSUB_API_URL"];
    else process.env["SUPSUB_API_URL"] = originalApiUrl;
    await cleanupAuthFields();
  });

  test("--content-id 与 --all 同时给出：抛 INVALID_ARGS", async () => {
    const program = buildProgram();
    let caught: unknown;
    try {
      await program.parseAsync([
        "node",
        "supsub",
        "sub",
        "mark-read",
        "--source-id",
        "1",
        "--type",
        "MP",
        "--content-id",
        "c1",
        "--all",
      ]);
    } catch (e) {
      caught = e;
    }
    expect((caught as { code: string }).code).toBe("INVALID_ARGS");
    expect((caught as { message: string }).message).toContain("互斥");
  });

  test("--content-id 与 --all 都未给出：抛 INVALID_ARGS（二选一）", async () => {
    const program = buildProgram();
    let caught: unknown;
    try {
      await program.parseAsync([
        "node",
        "supsub",
        "sub",
        "mark-read",
        "--source-id",
        "1",
        "--type",
        "MP",
      ]);
    } catch (e) {
      caught = e;
    }
    expect((caught as { code: string }).code).toBe("INVALID_ARGS");
    expect((caught as { message: string }).message).toContain("二选一");
  });

  test("--all 模式：请求体含 sourceType/sourceId 不含 contentId", async () => {
    const program = buildProgram();
    await program.parseAsync([
      "node",
      "supsub",
      "--output",
      "json",
      "sub",
      "mark-read",
      "--source-id",
      "7",
      "--type",
      "MP",
      "--all",
    ]);
    const body = JSON.parse(receivedBody);
    expect(body.sourceType).toBe("MP");
    expect(body.sourceId).toBe(7);
    expect("contentId" in body).toBe(false);

    const out = JSON.parse(stdoutOutput);
    expect(out.success).toBe(true);
    expect(out.data.message).toBe("已标记为已读");
  });

  test("--content-id 模式：请求体携带 contentId", async () => {
    const program = buildProgram();
    await program.parseAsync([
      "node",
      "supsub",
      "--output",
      "json",
      "sub",
      "mark-read",
      "--source-id",
      "9",
      "--type",
      "WEBSITE",
      "--content-id",
      "art-123",
    ]);
    const body = JSON.parse(receivedBody);
    expect(body.sourceType).toBe("WEBSITE");
    expect(body.sourceId).toBe(9);
    expect(body.contentId).toBe("art-123");
  });

  test("非法 --source-id（小数）抛 INVALID_ARGS", async () => {
    const program = buildProgram();
    let caught: unknown;
    try {
      await program.parseAsync([
        "node",
        "supsub",
        "sub",
        "mark-read",
        "--source-id",
        "1.5",
        "--type",
        "MP",
        "--all",
      ]);
    } catch (e) {
      caught = e;
    }
    expect((caught as { code: string }).code).toBe("INVALID_ARGS");
  });
});
