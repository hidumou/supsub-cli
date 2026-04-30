# Tasks: refactor-cli-api-modules

## 1. OpenSpec 文档

- [x] 1.1 创建 `.openspec.yaml`（schema: spec-driven, created: 2026-04-29）
- [x] 1.2 撰写 `proposal.md`（Why / What Changes / Impact）
- [x] 1.3 撰写 `design.md`（函数式 vs class、ApiCtx、类型归属、路径常量、测试影响）
- [x] 1.4 撰写 `tasks.md`（本文件）
- [x] 1.5 撰写 `specs/architecture/spec.md`（ADDED Requirement，含 SHALL/MUST）

## 2. 新增 api/ 模块

- [x] 2.1 `packages/cli/src/api/_ctx.ts`：`ApiCtx` 类型 + `buildCtx(globalOpts)` 辅助
- [x] 2.2 `packages/cli/src/api/auth.ts`：`getUserInfo(ctx)` + `UserInfo` 类型
- [x] 2.3 `packages/cli/src/api/search.ts`：`searchAll(ctx, params)`
- [x] 2.4 `packages/cli/src/api/subscription.ts`：`listSubs / addSub / removeSub / getContents / markAsRead`
- [x] 2.5 `packages/cli/src/api/mp.ts`：`createSearchTask / getSearchTask / cancelSearchTask`

## 3. 改写命令文件

- [x] 3.1 `commands/search.ts` → 用 `searchAll`
- [x] 3.2 `commands/task.ts` → 用 `getSearchTask`
- [x] 3.3 `commands/auth/status.ts` → 用 `getUserInfo`
- [x] 3.4 `commands/sub/list.ts` → 用 `listSubs`
- [x] 3.5 `commands/sub/add.ts` → 用 `addSub`
- [x] 3.6 `commands/sub/remove.ts` → 用 `removeSub`
- [x] 3.7 `commands/sub/contents.ts` → 用 `getContents`
- [x] 3.8 `commands/sub/mark-read.ts` → 用 `markAsRead`
- [x] 3.9 `commands/mp/search.ts` → 用 `createSearchTask` + `getSearchTask`
- [x] 3.10 `commands/mp/search-cancel.ts` → 用 `cancelSearchTask`

## 4. 验证

- [x] 4.1 `pnpm --filter @supsub/cli typecheck` 通过（0 errors）
- [x] 4.2 `pnpm --filter @supsub/cli test` 全绿（无 case 修改）
- [x] 4.3 `pnpm dlx @fission-ai/openspec@1.3.1 validate refactor-cli-api-modules --strict` 通过
- [x] 4.4 grep 命令文件确认无 `from.*http/client` 直引（除 `http/credentials.ts` 外）

## 5. 归档

- [x] 5.1 将 architecture delta 合并入 `openspec/specs/architecture/spec.md`
- [x] 5.2 `mv openspec/changes/refactor-cli-api-modules openspec/changes/archive/2026-04-29-refactor-cli-api-modules`
- [x] 5.3 `pnpm dlx @fission-ai/openspec@1.3.1 validate --strict` 全仓 validate 通过
