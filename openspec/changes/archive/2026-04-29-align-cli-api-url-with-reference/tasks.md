# Tasks: align-cli-api-url-with-reference

## 1. OpenSpec 文档

- [x] 1.1 创建 `.openspec.yaml`
- [x] 1.2 撰写 `proposal.md`（Why / What Changes / Impact）
- [x] 1.3 撰写 `design.md`（5 个决策 + 用户迁移说明）
- [x] 1.4 撰写 `tasks.md`（本文件）
- [x] 1.5 撰写 `specs/architecture/spec.md`（MODIFIED Requirements，含 SHALL/MUST）

## 2. 实现

- [x] 2.1 新建 `packages/cli/src/lib/api-url.ts`：`DEFAULT_API_URL` 常量 + `getApiUrl()` 函数
- [x] 2.2 `packages/cli/src/cli/index.ts`：删除 `--api-url <url>` option 声明
- [x] 2.3 `packages/cli/src/api/_ctx.ts`：`buildCtx` 内部调 `getApiUrl()`，参数签名移除 apiUrl
- [x] 2.4 `packages/cli/src/commands/auth/login.ts`：`runDeviceFlow(getApiUrl())`
- [x] 2.5 `packages/cli/src/commands/auth/status.ts`：`getUserInfo({ apiUrl: getApiUrl(), ... })`
- [x] 2.6 删除所有命令文件 globalOpts 类型字面量里的 `apiUrl: string` 字段

## 3. 测试

- [x] 3.1 grep 确认无测试断言依赖 `--api-url` flag 或 `globalOpts.apiUrl`（应该为 0 命中）
- [x] 3.2 跑 `pnpm --filter @supsub/cli test`，全绿（既有 18 个 case 不受影响）

## 4. 验证

- [x] 4.1 `pnpm --filter @supsub/cli typecheck` 通过
- [x] 4.2 `pnpm dlx @fission-ai/openspec@1.3.1 validate align-cli-api-url-with-reference --strict` 通过
- [x] 4.3 grep `globalOpts\.apiUrl` 命令源码全无（全部走 `getApiUrl()`）

## 5. 归档

- [x] 5.1 将 architecture delta 合并入 `openspec/specs/architecture/spec.md`（MODIFIED Requirement 替换原文）
- [x] 5.2 `mv` 至 `openspec/changes/archive/2026-04-29-align-cli-api-url-with-reference`
- [x] 5.3 `pnpm dlx openspec validate --all --strict` 全仓通过
