# Tasks: add-mock-tunable-constants

> 目标：三个硬编码常量抽入 `config.ts`，支持环境变量注入，默认行为不变，typecheck 通过，两路 curl 验证均返回预期 `expires_in`。

## 1. OpenSpec 文档

- [x] 1.1 新建 `openspec/changes/add-mock-tunable-constants/.openspec.yaml`（schema: spec-driven，created: 2026-04-28）
- [x] 1.2 新建 `proposal.md`（Why / What Changes / Impact，列出三个常量及其环境变量名）
- [x] 1.3 新建 `design.md`（决策：默认值不变；Number()/isFinite 校验；?? 兜底；re-export 向后兼容；不用 dotenv）
- [x] 1.4 新建 `tasks.md`（本文件，6–10 项带编号 checklist）
- [x] 1.5 新建 `specs/mock-server/spec.md`（MODIFIED Requirements，含 SHALL/MUST，覆盖 TTL/interval/api-key 三个可调常量场景）

## 2. 实现：config.ts

- [x] 2.1 新建 `packages/mock/src/config.ts`，实现 `readPositiveInt()` 辅助函数与三个导出常量（`DEVICE_CODE_TTL_SECONDS`、`DEVICE_CODE_INTERVAL_SECONDS`、`DEMO_API_KEY`）

## 3. 实现：store/devices.ts

- [x] 3.1 在 `createDevice()` 中，将 `expires_at: now + 600 * 1000` 改为 `expires_at: now + DEVICE_CODE_TTL_SECONDS * 1000`
- [x] 3.2 将 `interval: 2` 改为 `interval: DEVICE_CODE_INTERVAL_SECONDS`
- [x] 3.3 在文件顶部 import 两个常量自 `../config.js`

## 4. 实现：routes/oauth.ts

- [x] 4.1 将 `expires_in: 600` 改为 `expires_in: DEVICE_CODE_TTL_SECONDS`
- [x] 4.2 确认 `interval: record.interval`（已读 store，无需单独改；store 已从 config 读取）
- [x] 4.3 在文件顶部 import `DEVICE_CODE_TTL_SECONDS` 自 `../config.js`

## 5. 实现：middleware/auth.ts

- [x] 5.1 将 `export const DEMO_API_KEY = "sk_live_demo_token_for_dev"` 改为 `export { DEMO_API_KEY } from "../config.js"`
- [x] 5.2 确认 `index.ts` 与 `routes/oauth.ts` 的既有 import 路径无需改动

## 6. 验证

- [x] 6.1 `pnpm --filter @supsub/mock typecheck` 通过（零错误）
- [x] 6.2 默认值验证：`expires_in:600` curl 断言成功（✅ default 600 ok）
- [x] 6.3 env 注入验证：`MOCK_DEVICE_TTL=10` 后 `expires_in:10` curl 断言成功（✅ MOCK_DEVICE_TTL works）
- [x] 6.4 `pnpm dlx @fission-ai/openspec@1.3.1 validate add-mock-tunable-constants` 通过
