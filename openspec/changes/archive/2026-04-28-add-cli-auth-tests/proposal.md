# Proposal: add-cli-auth-tests

## Why

`add-cli-auth-device-flow` 的 tasks.md 中有 3 项未完成：

- **1.2**：`config/store.ts` 的单元自检（写、读、patch 合并、clearAuth）
- **2.4**：HTTP 客户端 401 触发清空 api_key 的单元自检
- **5.8**：用户浏览器拒绝授权后 cli 退出行为的单元自检

这 3 项均为「单元测试」性质，与业务逻辑实现分开管理更清晰。将其归入独立 change，由 test-author 角色负责，避免 cli-dev 的实现 PR 因测试缺失而阻塞合并。

## What Changes

1. 新增 `packages/cli/test/` 目录，放置 3 个 `bun test` 测试文件。
2. 覆盖 3 个残留验收场景（对应 spec Requirement 中的 Scenario），不修改任何业务代码。
3. 回填 `add-cli-auth-device-flow/tasks.md` 中 1.2、2.4、5.8 为已完成。

## Impact

- 仅写测试文件，零业务代码改动。
- `pnpm --filter @supsub/cli test` 新增 3 个绿色 case，typecheck 保持全过。
- 不引入任何新依赖。
