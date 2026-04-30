# architecture Specification

## Purpose
TBD - created by archiving change add-monorepo-foundation. Update Purpose after archive.
## Requirements
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

所有子命令 MUST 通过 commander 根 program 读取 `-o, --output <fmt>` 与 `--api-key <key>` 两个全局 flag，子命令自身**不许**重复声明同名 option。**API 基地址不再通过 CLI flag 传递**——参照 `getnote-cli` 的实现习惯，supsub-cli MUST 用硬编码常量 + `SUPSUB_API_URL` 环境变量两级回落机制：

1. `SUPSUB_API_URL` 环境变量（优先）
2. `packages/cli/src/lib/api-url.ts` 中的 `DEFAULT_API_URL` 常量

读取入口 SHALL 是 `getApiUrl()` 函数（每次调用动态读 env，便于测试与运行期切换），命令文件**不许**直接读 `process.env["SUPSUB_API_URL"]`，也**不许**保留 `--api-url` 这类 commander option。

#### Scenario: `SUPSUB_API_URL` 在子命令中生效

- **GIVEN** 用户运行 `SUPSUB_API_URL=http://localhost:8787 supsub sub list`
- **WHEN** `sub list` 的 action 调用 `getApiUrl()`
- **THEN** 拿到 `http://localhost:8787` 而非 `https://supsub.com`

#### Scenario: 未设置 env 时使用 DEFAULT_API_URL

- **GIVEN** 进程启动时 `process.env.SUPSUB_API_URL` 未设置
- **WHEN** 任意命令调用 `getApiUrl()`
- **THEN** 返回 `DEFAULT_API_URL`（即 `https://supsub.com`）

#### Scenario: `-o` 默认 table

- **GIVEN** 用户运行 `supsub auth status`（不带 `-o`）
- **WHEN** action 内读取 `program.opts().output`
- **THEN** 返回 `"table"`（commander 默认值）

#### Scenario: 不存在 `--api-url` flag

- **GIVEN** 用户运行 `supsub --api-url http://localhost:8787 sub list`
- **WHEN** commander 解析 argv
- **THEN** 触发 `error: unknown option '--api-url'`，退出码非 0；提示用户改用 `SUPSUB_API_URL` 环境变量

### Requirement: TypeScript 配置由单一 base 控制

`tsconfig.base.json` SHALL 是真相。子包 tsconfig 仅 `extends` + `include`，禁止覆盖严格模式或目标版本。

#### Scenario: 子包不许削弱 strict

- **GIVEN** 任一子包的 `tsconfig.json`
- **WHEN** code review 检查
- **THEN** 不存在 `"strict": false`、`"noUncheckedIndexedAccess": false` 之类的 override

### Requirement: 业务 endpoint 通过 api/ 模块统一封装

`packages/cli/src/commands/` 下的命令文件 SHALL NOT 直接 import `packages/cli/src/http/client.ts`。所有针对 supsub 后端业务 endpoint（`/api/...`）的请求 MUST 经由 `packages/cli/src/api/<domain>.ts` 模块导出的函数发起，命令文件只负责拼装参数与渲染输出。

`api/<domain>.ts` 模块内部 SHALL 通过 `http/client.ts` 的 `request<T>()` 发起 HTTP 调用，从而继承统一的 401 处理、`ErrorEnvelope` 解析、网络异常包装等行为；命令文件继续允许 import `http/credentials.ts`（用于解析 apiKey）以及 `http/client.ts` 中的非 `request` 工具，但**不得**直接调用 `request<T>()`。

OAuth Device Flow（`packages/cli/src/commands/auth/device-flow.ts`）属于认证基础设施而非业务 endpoint，可继续直接使用 `fetch` 与 `http/client.ts` 工具，不受此 Requirement 约束。

#### Scenario: 业务命令通过 api 模块发起请求

- **GIVEN** 用户运行 `supsub sub list`
- **WHEN** `commands/sub/list.ts` 的 action 执行
- **THEN** 命令文件 import `listSubs` from `../../api/subscription.ts`，并调用 `await listSubs(ctx)`，而不是 `await request<Subscription[]>({ method: "GET", path: "/api/subscriptions", ... })`

#### Scenario: api 模块继承统一的 401 处理

- **GIVEN** `~/.supsub/config.json` 中的 api_key 已失效
- **WHEN** 命令侧调用 `await listSubs(ctx)`，后端返回 401
- **THEN** `api/subscription.ts` 内部的 `request<T>()` 调用触发 `clearAuth()` 并抛出 `code: "UNAUTHORIZED"` 的 `ErrorEnvelope`，行为与重构前完全一致

#### Scenario: 命令文件不得直接 import http/client

- **GIVEN** 仓库 `packages/cli/src/commands/` 任一 `.ts` 文件
- **WHEN** 静态扫描其 import 列表
- **THEN** 不存在 `from "../http/client.ts"` 或 `from "../../http/client.ts"` 这类路径；唯一例外是 `auth/device-flow.ts`（OAuth 基础设施层）
