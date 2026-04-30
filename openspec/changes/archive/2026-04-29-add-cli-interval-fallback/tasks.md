# Tasks: add-cli-interval-fallback

## 1. OpenSpec 文档

- [x] 1.1 创建 `.openspec.yaml`（schema: spec-driven, created: 2026-04-28）
- [x] 1.2 撰写 `proposal.md`（Why / What Changes / Impact）
- [x] 1.3 撰写 `design.md`（5s fallback 决策 / 触发条件 / RFC 8628 关系 / 实现方式）
- [x] 1.4 撰写 `tasks.md`（本文件，checklist）
- [x] 1.5 撰写 `specs/cli-auth/spec.md`（MODIFIED Requirements + Scenarios，含 SHALL/MUST）

## 2. 实现

- [x] 2.1 修改 `packages/cli/src/commands/auth/device-flow.ts`：将 `let intervalMs = interval * 1000` 替换为带 fallback 的三元表达式

## 3. 测试

- [x] 3.1 新建 `packages/cli/test/auth-interval-fallback.test.ts`
- [x] 3.2 实现 `interval = 0` fallback 测试：mock sleep，断言传入值为 5000

## 4. 验证

- [x] 4.1 运行 `pnpm --filter @supsub/cli typecheck` 通过（0 errors）
- [x] 4.2 运行 `pnpm --filter @supsub/cli test` 通过（所有 case 绿色）
- [x] 4.3 运行 `pnpm dlx @fission-ai/openspec@1.3.1 validate add-cli-interval-fallback` 通过
