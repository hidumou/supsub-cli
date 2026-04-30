// packages/cli/src/http/credentials.ts
import { readConfig } from '../config/store.ts';

/**
 * CLI 全局 `--api-key` flag 的进程级覆写值。
 * 在 commander preAction hook 中由 setCliApiKey 写入，resolveApiKey 读取。
 * 这样 request/api 层就无需把 apiKey 顺着函数参数一路传递。
 */
let cliApiKey: string | undefined;

export function setCliApiKey(key: string | undefined): void {
  cliApiKey = key;
}

export type CredentialSource = 'flag' | 'env' | 'config' | 'session';

type ResolvedCredentials = {
  key?: string;
  clientId?: string;
  /**
   * 当前 key 的来源：
   * - flag    → `--api-key` 命令行 flag
   * - env     → `SUPSUB_API_KEY` 环境变量
   * - config  → `~/.supsub/config.json` 中的 `api_key`
   * - session → `~/.supsub/config.json` 中的 `bearer_token`（手动从浏览器粘贴）
   * - 未登录态时为 undefined
   */
  source?: CredentialSource;
};

/**
 * 解析 API Key，优先级（从高到低）：
 * 1. CLI flag `--api-key`（由 setCliApiKey 注入）
 * 2. 环境变量 SUPSUB_API_KEY
 * 3. ~/.supsub/config.json 的 api_key
 * 4. ~/.supsub/config.json 的 bearer_token（临时浏览器会话 token）
 */
export async function resolveApiKey(): Promise<ResolvedCredentials> {
  if (cliApiKey) {
    return { key: cliApiKey, clientId: 'supsub-cli', source: 'flag' };
  }
  if (process.env.SUPSUB_API_KEY) {
    return {
      key: process.env.SUPSUB_API_KEY,
      clientId: 'supsub-cli',
      source: 'env',
    };
  }
  const cfg = await readConfig();
  if (cfg.api_key) {
    return {
      key: cfg.api_key,
      clientId: cfg.client_id ?? 'supsub-cli',
      source: 'config',
    };
  }
  if (cfg.bearer_token) {
    return {
      key: cfg.bearer_token,
      clientId: cfg.client_id ?? 'supsub-cli',
      source: 'session',
    };
  }
  return { clientId: cfg.client_id ?? 'supsub-cli' };
}
