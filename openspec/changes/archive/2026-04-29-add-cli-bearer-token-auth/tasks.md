# Tasks: add-cli-bearer-token-auth

## 1. OpenSpec 文档

- [x] 1.1 创建 `.openspec.yaml`（schema: spec-driven, created: 2026-04-29）
- [x] 1.2 撰写 `proposal.md`（Why / What Changes / Impact）
- [x] 1.3 撰写 `design.md`（5 个决策 + 操作流）
- [x] 1.4 撰写 `tasks.md`（本文件）
- [x] 1.5 撰写 `specs/cli-auth/spec.md`（ADDED + MODIFIED Requirements，含 SHALL/MUST）

## 2. 实现

- [x] 2.1 `config/store.ts`：`Config` 类型加 `bearer_token?: string`
- [x] 2.2 `config/store.ts`：`clearAuth()` 同步剥除 `bearer_token`
- [x] 2.3 `http/credentials.ts`：`resolveApiKey` 在 api_key 缺失时回落 `bearer_token`
- [x] 2.4 `http/credentials.ts`：返回值加 `source: "flag" | "env" | "config" | "session"`
- [x] 2.5 `commands/auth/status.ts`：使用 `resolveApiKey` 返回的 source，删除本地 `getApiKeySource`

## 3. 测试

- [x] 3.1 新建 `packages/cli/test/bearer-token-auth.test.ts`
- [x] 3.2 用例：仅 `bearer_token` 时 → key 取 bearer_token，source = "session"
- [x] 3.3 用例：`api_key` + `bearer_token` 都有时 → api_key 胜出，source = "config"
- [x] 3.4 用例：`SUPSUB_API_KEY` + `bearer_token` 都有时 → env 胜出，source = "env"
- [x] 3.5 用例：`clearAuth()` 后 `bearer_token` 也被清除

## 4. 验证

- [x] 4.1 `pnpm --filter @supsub/cli typecheck` 通过
- [x] 4.2 `pnpm --filter @supsub/cli test` 全绿（既有测试不受影响）
- [x] 4.3 `pnpm dlx @fission-ai/openspec@1.3.1 validate add-cli-bearer-token-auth --strict` 通过

## 5. 归档

- [x] 5.1 将 cli-auth delta 合并入 `openspec/specs/cli-auth/spec.md`
- [x] 5.2 `mv` 至 `openspec/changes/archive/2026-04-29-add-cli-bearer-token-auth`
- [x] 5.3 `pnpm dlx @fission-ai/openspec@1.3.1 validate --all --strict` 全仓通过
