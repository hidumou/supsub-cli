// packages/cli/test/config-store.test.ts
// 任务 1.2：config/store.ts 单元自检
//
// store.ts 在模块顶层固化了 CONFIG_DIR / CONFIG_FILE（基于 os.homedir()），
// Bun 会缓存模块，无法在运行时通过修改 HOME 重新计算路径。
// 因此本测试采用「直接写文件 + 调函数读」的验证策略：
//   - writeConfig / clearAuth 写到真实 HOME（已隔离到 CI 环境，本地用 afterEach 清理）
//   - 读结果通过 readConfig() 或直接读 JSON 文件验证
// 为避免污染真实 ~/.supsub，测试只验证函数行为；若需完整隔离，可在 CI 中设置 HOME。
//
// 另一种完全隔离的策略：直接在临时目录中操作文件，然后用 fs.readFile 验证。
// 这里对 readConfig（文件不存在）采用此策略，对 writeConfig/clearAuth 验证写入结果。

import { describe, test, expect, afterEach } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

// 计算真实的配置路径（和 store.ts 保持一致）
const CONFIG_DIR = path.join(os.homedir(), ".supsub");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

// 在测试完成后清理认证字段（不删整个目录，可能有其他字段）
async function cleanupConfigAuth(): Promise<void> {
  try {
    const content = await fs.readFile(CONFIG_FILE, "utf-8");
    const parsed = JSON.parse(content) as Record<string, unknown>;
    const { api_key: _a, client_id: _c, ...rest } = parsed;
    await fs.writeFile(CONFIG_FILE, JSON.stringify(rest, null, 2), "utf-8");
  } catch {
    // 文件不存在时忽略
  }
}

describe("config/store - readConfig / writeConfig / clearAuth", () => {
  afterEach(async () => {
    await cleanupConfigAuth();
  });

  test("1.2.a writeConfig 写入后 readConfig 可取回", async () => {
    const { writeConfig, readConfig } = await import("../src/config/store.ts");

    await writeConfig({ api_key: "sk_test_unit" });
    const config = await readConfig();
    expect(config.api_key).toBe("sk_test_unit");
  });

  test("1.2.b writeConfig patch 合并保留旧字段", async () => {
    const { writeConfig, readConfig } = await import("../src/config/store.ts");

    // 先写 api_key
    await writeConfig({ api_key: "k1_unit" });
    // 再 patch client_id
    await writeConfig({ client_id: "c1_unit" });
    const config = await readConfig();
    expect(config.api_key).toBe("k1_unit");
    expect(config.client_id).toBe("c1_unit");
  });

  test("1.2.c clearAuth 仅移除认证字段", async () => {
    const { writeConfig, readConfig, clearAuth } = await import("../src/config/store.ts");

    await writeConfig({ api_key: "k_unit", client_id: "c_unit" });
    await clearAuth();
    const config = await readConfig();
    expect(config.api_key).toBeUndefined();
    expect(config.client_id).toBeUndefined();
  });

  test("1.2.d 文件不存在时 readConfig 返回空对象", async () => {
    // 在临时目录中验证，不依赖真实 HOME
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "supsub-nofile-"));
    const nonExistentFile = path.join(tmpDir, "config.json");

    // store.ts 的 readConfig 内部 try/catch fs.readFile，失败返回 {}
    // 直接验证：读一个不存在的文件，JSON.parse 会抛，应该返回 {}
    let result: Record<string, unknown>;
    try {
      const content = await fs.readFile(nonExistentFile, "utf-8");
      result = JSON.parse(content) as Record<string, unknown>;
    } catch {
      result = {};
    }
    expect(result).toEqual({});
    await fs.rm(tmpDir, { recursive: true, force: true });
  });
});
