# Tasks: add-monorepo-foundation

> 大部分项已经在 CTO 搭骨架时完成（标 [x]）。三件未完成项是 cli-dev 启动 add-cli-auth-device-flow 时的入口物，按编号顺序做即可。

## 1. 仓库根
- [x] 1.1 `package.json` 设 `packageManager: pnpm@10.29.2`、`engines.node >= 20`、`engines.pnpm >= 10`，scripts 暴露 `dev:cli`/`dev:mock`/`build:cli`/`typecheck`
- [x] 1.2 `pnpm-workspace.yaml` 写 `packages: ["packages/*"]`
- [x] 1.3 `.gitignore` 排除 `node_modules/`、`dist/`、`.bun/`、`.env*`
- [x] 1.4 `.npmrc` 设 `auto-install-peers=true`、`strict-peer-dependencies=false`
- [x] 1.5 `tsconfig.base.json` 按 design.md §2 落地

## 2. packages/cli 骨架
- [x] 2.1 `packages/cli/package.json`：name `@supsub/cli`，`type: module`，`bin.supsub: ./src/index.ts`，依赖 `commander@^12`、`cli-table3@^0.6`、`kleur@^4`，devDep `bun-types`
- [x] 2.2 `packages/cli/tsconfig.json` 仅 extends 根并 `include: ["src/**/*.ts"]`
- [x] 2.3 `src/index.ts` 占位文件（含 shebang `#!/usr/bin/env bun`）
- [x] 2.4 在 `src/index.ts` 注册 commander 根程序：`program.name("supsub").version(pkg.version)`，挂载全局 `--api-url`、`-o, --output <fmt>`、`--api-key`，`program.parseAsync(process.argv)`，顶层 try/catch 调 `dieWith`
- [x] 2.5 新建 `src/lib/errors.ts`：导出 `ErrorEnvelope` 类型、`LOCAL_CODES` 常量、`dieWith(envelope, exitCode)` helper（按 `-o` 选择 stderr 文本 / stdout JSON）
- [x] 2.6 新建 `src/lib/exit-code.ts`：导出 `EXIT` 常量（见 design.md §5）
- [x] 2.7 新建 `src/ui/table.ts`：实现 `printTable`、`truncate`、`cjkWidth`，对中文/全角按 2 列宽计算

## 3. packages/mock 骨架
- [x] 3.1 `packages/mock/package.json`：name `@supsub/mock`，依赖 `hono@^4`，devDep `bun-types`，scripts 暴露 `dev`/`start`
- [x] 3.2 `packages/mock/tsconfig.json` 仅 extends 根
- [x] 3.3 `src/index.ts` 占位 Bun.serve（port 8787）

## 4. 验收
- [x] 4.1 `pnpm install` 在仓库根成功（lockfile 提交）
- [x] 4.2 `pnpm -r typecheck` 通过（task 2.4–2.7 完成后）
- [x] 4.3 `pnpm --filter @supsub/cli build` 产出 `packages/cli/dist/supsub`，`./packages/cli/dist/supsub --help` 打印命令树（commander 根注册完成后）
- [x] 4.4 `pnpm dev:cli -- --version` 直接打印 `0.0.0`（dev 模式 sanity）
