# architecture spec (api modules delta)

## ADDED Requirements

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
