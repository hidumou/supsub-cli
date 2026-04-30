# add-mock-tunable-constants

## Why

`packages/mock/` 目前将三个关键常量硬编码并在多处重复出现：

- `600`（device code TTL，秒）—— 分别出现在 `store/devices.ts:30` 与 `routes/oauth.ts:19`
- `2`（轮询间隔，秒）—— 同样在上述两个文件各出现一次
- `sk_live_demo_token_for_dev`（demo api key）—— 定义在 `middleware/auth.ts`

这带来两个问题：

1. **重复来源**：`devices.ts` 的 `expires_at` 与 `oauth.ts` 的 `expires_in` 是同一语义，却各自写死 600，一旦改动必须两处同步，容易遗漏。
2. **测试可达性差**：开发者无法在不修改源码的情况下将 TTL 压缩到 10 秒来快速走通 `expired_token` 路径；每次手动改代码、改完还要还原，工作流摩擦大。

## What Changes

新增 `packages/mock/src/config.ts`，作为三个常量的**单一来源（single source of truth）**，并支持通过环境变量在运行时注入：

| 常量 | 默认值 | 环境变量 |
|---|---|---|
| `DEVICE_CODE_TTL_SECONDS` | `600` | `MOCK_DEVICE_TTL` |
| `DEVICE_CODE_INTERVAL_SECONDS` | `2` | `MOCK_DEVICE_INTERVAL` |
| `DEMO_API_KEY` | `sk_live_demo_token_for_dev` | `MOCK_DEMO_KEY` |

改动受影响的三个文件：

- `store/devices.ts` —— `expires_at` 与 `interval` 字段从 `config.ts` 读取
- `routes/oauth.ts` —— `expires_in` 与 `interval` 字段从 `config.ts` 读取
- `middleware/auth.ts` —— `DEMO_API_KEY` 改为 re-export 自 `config.ts`（保持向后兼容，`index.ts` 与其他 importer 无需改动）

## Impact

- Affected specs: mock-server（delta：修改 device code TTL 与 polling interval、demo api key 相关 Requirement）
- Affected code: `packages/mock/src/config.ts`（新建）、`packages/mock/src/store/devices.ts`、`packages/mock/src/routes/oauth.ts`、`packages/mock/src/middleware/auth.ts`
- Breaking? no —— 默认值不变，所有既有 importer 行为保持一致
