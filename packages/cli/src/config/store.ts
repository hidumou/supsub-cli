// packages/cli/src/config/store.ts
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

type Config = {
  api_key?: string;
  client_id?: string;
  /**
   * 临时鉴权来源：用户从浏览器 DevTools 复制的
   * `Authorization: Bearer <token>` 中的 token，手动写入。
   * 仅在 api_key 缺失时回落使用，401 时与 api_key 一同被清除。
   */
  bearer_token?: string;
};

const CONFIG_DIR = path.join(os.homedir(), ".supsub");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

/**
 * 读取配置文件；文件不存在返回 {}
 */
export async function readConfig(): Promise<Config> {
  try {
    const content = await fs.readFile(CONFIG_FILE, "utf-8");
    return JSON.parse(content) as Config;
  } catch {
    return {};
  }
}

/**
 * 合并写入配置（patch 方式，不整体覆盖）
 * 写入前确保目录存在（0700），写文件后设置权限 0600
 */
export async function writeConfig(patch: Partial<Config>): Promise<void> {
  // 确保目录存在
  await fs.mkdir(CONFIG_DIR, { recursive: true });
  // chmod 0700（非 Windows）
  if (process.platform !== "win32") {
    try {
      await fs.chmod(CONFIG_DIR, 0o700);
    } catch {
      // 静默忽略
    }
  }

  // 读取现有配置并合并
  const existing = await readConfig();
  const merged = { ...existing, ...patch };

  await fs.writeFile(CONFIG_FILE, JSON.stringify(merged, null, 2), "utf-8");

  // chmod 0600（非 Windows）
  if (process.platform !== "win32") {
    try {
      await fs.chmod(CONFIG_FILE, 0o600);
    } catch {
      // 静默忽略
    }
  }
}

/**
 * 清除认证信息（删除 api_key、client_id、bearer_token）
 */
export async function clearAuth(): Promise<void> {
  const existing = await readConfig();
  const { api_key: _a, client_id: _c, bearer_token: _b, ...rest } = existing;
  // 如果文件不存在或没有认证字段，直接返回
  await fs.mkdir(CONFIG_DIR, { recursive: true });
  await fs.writeFile(CONFIG_FILE, JSON.stringify(rest, null, 2), "utf-8");
  if (process.platform !== "win32") {
    try {
      await fs.chmod(CONFIG_FILE, 0o600);
    } catch {
      // 静默忽略
    }
  }
}
