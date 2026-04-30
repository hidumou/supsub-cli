# error-handling Specification

## Purpose
TBD - created by archiving change add-monorepo-foundation. Update Purpose after archive.
## Requirements
### Requirement: 错误统一为 ErrorEnvelope 形态

所有错误（后端响应、本地异常、参数校验）MUST 在到达输出层之前归一为 `{ code, message, status, data? }` 形态。后端错误透传 `code/message/status`；本地错误使用约定 `code` 集合：`NETWORK_ERROR`、`UNAUTHORIZED`、`INVALID_ARGS`、`SUBSCRIPTION_PLAN_EXPIRED`，`status` 设为 0（无 HTTP 响应）或后端原值。

#### Scenario: 后端 ErrorResponse 透传

- **GIVEN** 后端返回 HTTP 403 + `{ code: "SUBSCRIPTION_PLAN_EXPIRED", message: "当前计划已过期", status: 403 }`
- **WHEN** http 客户端把它转成 ErrorEnvelope
- **THEN** envelope 的 `code/message/status` 与后端字面量完全一致，未做大小写/数值转换

#### Scenario: fetch 网络失败被合成本地错误

- **GIVEN** 用户网络断开
- **WHEN** 任一命令发起请求，fetch 抛 `TypeError: fetch failed`
- **THEN** http 客户端合成 `{ code: "NETWORK_ERROR", message: "网络异常，请稍后重试", status: 0 }`

### Requirement: 退出码与错误码一一映射

CLI SHALL 在 `src/lib/exit-code.ts` 中暴露 `EXIT` 常量，并由 `dieWith(envelope)` helper 唯一负责 `process.exit`。退出码表如下：

| 场景 | 识别条件 | EXIT 名 | 数值 |
|------|----------|---------|------|
| 成功 | 命令完成 | OK | 0 |
| 一般业务失败 | HTTP 4xx 且非 401/PLAN_EXPIRED | BUSINESS | 1 |
| 认证失效 | HTTP 401 或本地 UNAUTHORIZED | UNAUTHORIZED | 2 |
| 订阅计划过期 | code === SUBSCRIPTION_PLAN_EXPIRED | PLAN_EXPIRED | 3 |
| 网络/超时 | NETWORK_ERROR | NETWORK | 10 |
| 服务端错误 | HTTP 5xx | SERVER | 11 |
| 参数校验 | INVALID_ARGS | INVALID_ARGS | 64 |

#### Scenario: 401 退出码为 2 且清空配置

- **GIVEN** `~/.supsub/config.json` 中存有 `api_key`
- **WHEN** 任一受保护命令收到 HTTP 401
- **THEN** CLI 把 `api_key` 与 `client_id` 字段从 config 中移除（其他字段保留），向 stderr 打印 `请运行 supsub auth login 重新登录`，进程以退出码 2 结束

#### Scenario: PLAN_EXPIRED 退出码为 3 且不清空配置

- **GIVEN** 用户当前计划过期
- **WHEN** 命令收到 `{ code: "SUBSCRIPTION_PLAN_EXPIRED", status: 403 }`
- **THEN** 配置文件不被改动，stderr 提示 `当前操作需要更高订阅计划，前往 https://supsub.com/order 升级`，进程以退出码 3 结束

### Requirement: 命令实现禁止直接调用 process.exit

业务命令文件 MUST 只允许 `throw envelope`；唯一允许 `process.exit` 的位置是 `src/lib/errors.ts` 的 `dieWith` helper（被根命令的 `parseAsync` catch 调用）。

#### Scenario: code review grep 命中即拒绝

- **GIVEN** `packages/cli/src/commands/**/*.ts`
- **WHEN** review 阶段执行 `rg "process\\.exit" packages/cli/src/commands`
- **THEN** 不应有任何匹配

