# architecture spec delta

## ADDED Requirements

### Requirement: Monorepo 工作区采用 pnpm + Bun + TypeScript

仓库 MUST 以 pnpm 工作区组织两个 package：`@supsub/cli`（命令行）与 `@supsub/mock`（开发态后端 mock）。运行时统一使用 Bun 1.x，TypeScript 共享 `tsconfig.base.json`。

#### Scenario: 全新克隆后能直接安装与 typecheck

- **GIVEN** 一台已安装 Bun 1.x、Node ≥ 20、pnpm ≥ 10 的机器
- **WHEN** 执行 `pnpm install` 后跑 `pnpm -r typecheck`
- **THEN** 两个 package 均通过 typecheck，无需任何额外脚本

#### Scenario: 拒绝使用 npm/yarn 安装

- **GIVEN** 仓库根 `package.json` 中 `packageManager` 字段被锁定为 `pnpm@10.29.2`
- **WHEN** 用户错把 `npm install` 跑在仓库根
- **THEN** 由 corepack 拒绝执行（错误提示 `This project is configured to use pnpm`），保护 lockfile 一致性

### Requirement: cli 与 mock 通过 workspace 协议互相不感知发布

`@supsub/cli` SHALL NOT 依赖 `@supsub/mock`；`@supsub/mock` 只用 Hono；两者只在「开发期 cli 通过 `--api-url http://localhost:8787` 命中 mock」这一层耦合。

#### Scenario: cli 发布产物不携带 mock 代码

- **GIVEN** 已对 `packages/cli` 跑过 `bun build --compile`
- **WHEN** 检查产物 `packages/cli/dist/supsub`
- **THEN** 产物体积内不包含 `packages/mock` 任何源文件，也不在运行时尝试加载

#### Scenario: mock 单独可启动

- **GIVEN** 仓库根
- **WHEN** 执行 `pnpm dev:mock`
- **THEN** Bun 启动 mock server 并监听 `127.0.0.1:8787`，cli 此时不需要在线

### Requirement: 全局 CLI 标志由根命令统一注入

所有子命令 MUST 通过 commander 根 program 读取 `--api-url`、`-o, --output <fmt>`、`--api-key`，子命令自身**不许**重复声明同名 option。

#### Scenario: `--api-url` 在子命令中可见

- **GIVEN** 用户运行 `supsub --api-url http://localhost:8787 sub list`
- **WHEN** `sub list` 的 action 函数调用 `program.opts().apiUrl`
- **THEN** 拿到 `http://localhost:8787` 而非生产 URL

#### Scenario: `-o` 默认 table

- **GIVEN** 用户运行 `supsub auth status`（不带 `-o`）
- **WHEN** action 内读取 `program.opts().output`
- **THEN** 返回 `"table"`（commander 默认值）

### Requirement: TypeScript 配置由单一 base 控制

`tsconfig.base.json` SHALL 是真相。子包 tsconfig 仅 `extends` + `include`，禁止覆盖严格模式或目标版本。

#### Scenario: 子包不许削弱 strict

- **GIVEN** 任一子包的 `tsconfig.json`
- **WHEN** code review 检查
- **THEN** 不存在 `"strict": false`、`"noUncheckedIndexedAccess": false` 之类的 override
