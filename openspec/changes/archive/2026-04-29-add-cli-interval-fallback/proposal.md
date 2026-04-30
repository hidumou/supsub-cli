# Proposal: add-cli-interval-fallback

## Why

OAuth Device Flow（RFC 8628）规定服务端应在 Device Authorization Response 中下发 `interval` 字段，指示客户端最短轮询间隔（秒）。当前 CLI 实现中，`interval` 直接乘以 1000 用于 `sleep`——当服务端漏返该字段（`undefined`，JavaScript 计算为 `NaN * 1000 = NaN`）或返回 `0` / 负数时，`sleep(NaN)` / `sleep(0)` 会导致 CLI 立刻无限 spin，对服务端造成请求风暴，并使 CLI 进程 CPU 飙升至 100%。

参考实现（`getnote-cli` 第 103–106 行）约定：`interval` 缺失或非正数时，回落到 5 秒默认值，符合 RFC 8628 §3.5 精神（推荐 5 秒为默认间隔）。

## What Changes

1. **`packages/cli/src/commands/auth/device-flow.ts`**：将 `let intervalMs = interval * 1000` 改为带 guard 的三元表达式，`interval > 0` 时才使用服务端值，否则回落 `5_000` ms。
2. **新增测试**：`packages/cli/test/auth-interval-fallback.test.ts`，验证 `interval = 0` 时实际等待约为 5 秒（通过 mock sleep 或观察调用参数），作为防回归保障。
3. **OpenSpec change**：在 `specs/cli-auth/spec.md` 中以 `## MODIFIED Requirements` delta 形式重声「设备码轮询间隔」Requirement，补充 RFC 2119 关键字与 fallback Scenario。

## Impact

- **业务逻辑**：仅修改一行赋值逻辑，不影响正常路径（服务端正确返回正整数 interval 时行为不变）。
- **测试覆盖**：新增 1 个单元测试文件，`pnpm --filter @supsub/cli test` 增量绿色 case。
- **依赖**：无新依赖引入。
- **兼容性**：向后兼容，服务端若后续修复，CLI 自然使用服务端值。
