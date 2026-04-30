// packages/cli/src/lib/api-url.ts
// API 基地址解析：env > 硬编码常量。对齐 getnote-cli 实现习惯。

export const DEFAULT_API_URL = "https://supsub.net";

/**
 * 解析当前 API 基地址。
 *
 * 优先级（从高到低）：
 * 1. `SUPSUB_API_URL` 环境变量
 * 2. `DEFAULT_API_URL` 常量
 *
 * 函数化是为了测试时能动态切 env；不要把返回值缓存到模块顶层。
 */
export function getApiUrl(): string {
  return process.env["SUPSUB_API_URL"] ?? DEFAULT_API_URL;
}
