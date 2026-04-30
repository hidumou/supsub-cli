# cli-auth spec (bearer token delta)

## ADDED Requirements

### Requirement: bearer_token 作为第三种鉴权来源

`~/.supsub/config.json` SHALL 支持可选字段 `bearer_token`，作为 Device Flow / `--api-key` 之外的临时鉴权来源。该字段供用户从浏览器 DevTools 提取 `Authorization: Bearer <token>` 头中的 token 并手动写入，目的是在后端 api_key 鉴权未上线前完成 CLI 对真实环境的功能验证。

`packages/cli/src/http/credentials.ts` 中的 `resolveApiKey()` MUST 按以下优先级（从高到低）解析鉴权凭证：

1. 命令行 `--api-key <k>` flag → source: `"flag"`
2. 环境变量 `SUPSUB_API_KEY` → source: `"env"`
3. `config.api_key` → source: `"config"`
4. `config.bearer_token` → source: `"session"`

`resolveApiKey()` 的返回值 SHALL 包含 `source` 字段（类型 `"flag" | "env" | "config" | "session" | undefined`），未登录态（4 个来源都为空）时 `source` 为 `undefined`。

#### Scenario: 仅有 bearer_token 时被识别为 session

- **GIVEN** `~/.supsub/config.json` 内容为 `{ "bearer_token": "abc.def.ghi", "client_id": "supsub-cli" }`，无 env、无 flag
- **WHEN** 任意命令调用 `resolveApiKey({})`
- **THEN** 返回 `{ key: "abc.def.ghi", clientId: "supsub-cli", source: "session" }`，且后续请求的 `Authorization: Bearer abc.def.ghi` 头与浏览器会话一致

#### Scenario: api_key 与 bearer_token 共存时 api_key 胜出

- **GIVEN** `~/.supsub/config.json` 同时含 `api_key: "sk_live_xxx"` 与 `bearer_token: "browser_token"`
- **WHEN** 调用 `resolveApiKey({})`
- **THEN** 返回 `{ key: "sk_live_xxx", ..., source: "config" }`，长效 api_key 优先于临时 bearer_token

#### Scenario: env 与 bearer_token 共存时 env 胜出

- **GIVEN** 设置 `SUPSUB_API_KEY=env_key`，`~/.supsub/config.json` 含 `bearer_token: "browser_token"`
- **WHEN** 调用 `resolveApiKey({})`
- **THEN** 返回 `{ key: "env_key", ..., source: "env" }`

## MODIFIED Requirements

### Requirement: `supsub auth logout` 清空认证字段

`supsub auth logout` MUST 清空 `~/.supsub/config.json` 中的 `api_key`、`client_id` 与 `bearer_token` 三个字段，其他字段保留。文件不存在时静默返回。该清空逻辑同样适用于任何命令收到 401 后触发的 `clearAuth()` 调用。

#### Scenario: 已登录后登出

- **GIVEN** 配置文件含 `api_key`、`client_id`
- **WHEN** 执行 `supsub auth logout`
- **THEN** 三个认证字段被全部移除（如文件因此变成空对象 `{}`，仍保留文件本身），退出码 0

#### Scenario: 仅有 bearer_token 时登出也清空

- **GIVEN** 配置文件含 `bearer_token: "abc"`、`client_id: "supsub-cli"`
- **WHEN** 执行 `supsub auth logout`（或任意命令收到 401）
- **THEN** `bearer_token` 与 `client_id` 都被剥除，文件仅保留其他无关字段

#### Scenario: 未登录态登出幂等

- **GIVEN** 配置文件不存在
- **WHEN** 执行 `supsub auth logout`
- **THEN** 退出码 0，不抛异常

### Requirement: `supsub auth status` 通过 `/api/user/info` 验真

`auth status` SHALL 用当前 API Key 调 `GET /api/user/info`：成功显示 email、name、client_id 与 api_key 来源（`flag` / `env` / `config` / `session`）；失败统一走 401 处理。`api_key` 在输出中 MUST 打码（仅显示后 4 位）。`api_key_source` 字段 MUST 直接取自 `resolveApiKey()` 返回的 `source` 字段，不允许在命令文件内重新推断。

#### Scenario: 已登录 -o table（来自 config.api_key）

- **GIVEN** 配置文件中是合法 api_key
- **WHEN** 执行 `supsub --api-url http://localhost:8787 auth status`
- **THEN** stdout 渲染表格至少含 `api_key_source: config`、`api_key: sk_live_***_dev`（仅尾 4 位明文）

#### Scenario: 已登录 -o table（来自 config.bearer_token）

- **GIVEN** 配置文件仅含 `bearer_token: "abc.def.ghijk"`，无 api_key
- **WHEN** 执行 `supsub auth status`
- **THEN** stdout 渲染表格中 `api_key_source: session`，`api_key` 列同样按尾 4 位规则打码

#### Scenario: 未登录 -o json

- **GIVEN** 配置文件无 api_key、无 bearer_token，且无 env、无 --api-key
- **WHEN** 执行 `supsub auth status -o json`
- **THEN** stdout 输出 `{"success":false,"error":{"code":"UNAUTHORIZED","message":"尚未登录","status":0}}`，退出码 2
