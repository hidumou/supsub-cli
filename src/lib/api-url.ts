// packages/cli/src/lib/api-url.ts
// API 基地址解析：CLI flag > env > 硬编码常量。

export const DEFAULT_API_URL = 'https://supsub.net';

/**
 * CLI 全局 `--api-url` flag 的进程级覆写值。
 * 在 commander preAction hook 中由 setCliApiUrl 写入，getApiUrl 读取。
 * 这样 request/api 层就无需把 apiUrl 顺着函数参数一路传递（对齐 credentials.ts 的 cliApiKey）。
 */
let cliApiUrl: string | undefined;

export function setCliApiUrl(url: string | undefined): void {
  cliApiUrl = url;
}

/**
 * 解析当前 API 基地址。
 *
 * 优先级（从高到低）：
 * 1. `--api-url` 命令行 flag（由 setCliApiUrl 注入）
 * 2. `SUPSUB_API_URL` 环境变量
 * 3. `DEFAULT_API_URL` 常量
 *
 * 函数化是为了测试时能动态切 env；不要把返回值缓存到模块顶层。
 */
export function getApiUrl(): string {
  if (cliApiUrl && cliApiUrl.trim() !== '') {
    return cliApiUrl;
  }
  return process.env.SUPSUB_API_URL ?? DEFAULT_API_URL;
}
