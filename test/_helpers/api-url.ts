// E2E 统一基址来源（单一回落）：
//   SUPSUB_API_URL 环境变量 > 源码 DEFAULT_API_URL
//
// 设计取舍：不在仓库里写死任何具体的测试环境地址（尤其是临时部署域名，
// 如 Sealos 的随机子域），避免地址变更后散落各处难以维护。跑 e2e 时由
// 调用方通过 SUPSUB_API_URL 指向目标环境，并配套提供同环境的 SUPSUB_E2E_BEARER。
//
// 与 src/lib/api-url.ts#getApiUrl() 同语义、同优先级，只是供测试侧显式引用，
// 让所有 e2e 走同一处来源（prod-cli / prod-cli-mutate 让 CLI 子进程自行解析，
// prod-bearer / device-flow 在进程内直接调用本函数）。
import { DEFAULT_API_URL } from '../../src/lib/api-url.ts';

/**
 * 解析 e2e 基址。函数化（不在模块顶层缓存）是为了测试期间能动态切 env，
 * 对齐 getApiUrl() 的约定。
 */
export function e2eApiUrl(): string {
  return process.env.SUPSUB_API_URL ?? DEFAULT_API_URL;
}
