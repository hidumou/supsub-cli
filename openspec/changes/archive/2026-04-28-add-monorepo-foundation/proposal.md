# add-monorepo-foundation

## Why

supsub-cli 立项时同时选定 Bun + TypeScript + commander.js + pnpm 工作区 + Hono mock 的技术栈。骨架已经搭好（`packages/cli`、`packages/mock`、根 `tsconfig.base.json`、`pnpm-workspace.yaml`），但还没把约束**写下来**。后续 4 个 change（mock server、auth、subscription、search）都依赖于以下共识：

- 哪个 package 放哪类代码、文件命名怎么写、TS 配置以哪份 `tsconfig.base.json` 为准
- CLI 的全局标志（`--api-url`、`-o table|json`）如何统一注入
- 错误响应（含本地错误）如何归一为单一 ErrorEnvelope，以便 `-o json` 给 jq 食用
- 退出码表（PRD §「错误处理」）如何在代码层面落地为常量，避免字面量四散
- 表格输出的 CJK 字宽截断模式如何在 `packages/cli/src/ui` 中沉淀

本 change 把这些「先于业务存在」的约束固化成 spec，并把骨架已完成项标记为 `[x]`，剩下 3 件未完成（commander 根命令树、错误处理 helper、UI table helper）保持 `[ ]` 等 cli-dev 启动 add-cli-auth-device-flow 时一并完成。

## What Changes

- 把现有 pnpm + Bun + TypeScript monorepo 骨架编进 architecture spec
- 固化 ErrorEnvelope / 退出码表 / `code` 常量集合
- 固化 `-o table` / `-o json` 输出约束
- 留 3 项 `[ ]` 任务作为 cli-dev 入口（commander root、err helper、ui table helper）

## Impact

- Affected specs: architecture, error-handling, output-formats（**首次新增**，无 modified）
- Affected code:
  - `package.json` / `pnpm-workspace.yaml` / `tsconfig.base.json`（已落地）
  - `packages/cli/src/index.ts`（待补 commander 根树）
  - `packages/cli/src/lib/errors.ts`（待新建）
  - `packages/cli/src/ui/table.ts`（待新建）
- Breaking? no（首版）
