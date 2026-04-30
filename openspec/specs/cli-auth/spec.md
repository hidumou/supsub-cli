# cli-auth Specification

## Purpose
TBD - created by archiving change add-cli-auth-device-flow. Update Purpose after archive.
## Requirements
### Requirement: `supsub auth login` 走 OAuth Device Flow

不带参数的 `supsub auth login` SHALL 通过 `POST /open/api/v1/oauth/device/code` 拿设备码，按返回的 `interval` 秒轮询 `POST /open/api/v1/oauth/token`，直到拿到 `api_key + client_id` 写入 `~/.supsub/config.json`。

#### Scenario: 端到端登录闭环

- **GIVEN** mock server 已起，用户首次执行 `supsub --api-url http://localhost:8787 auth login`
- **WHEN** cli 打印 verification_uri 与 user_code，用户在浏览器点[自动授权]
- **THEN** cli 在 ≤ 4 秒内退出码 0，stderr 输出 `✅ 登录成功`；`~/.supsub/config.json` 包含 `api_key` 与 `client_id` 字段且文件权限为 0600

#### Scenario: 用户在浏览器拒绝

- **GIVEN** mock 用户授权页点击[拒绝]
- **WHEN** cli 轮询拿到 `data.error: "access_denied"`
- **THEN** cli 进程结束，stderr 输出 `用户拒绝授权`，退出码 1，配置文件不被修改

#### Scenario: 设备码超时

- **GIVEN** 用户离开浏览器超过 `expires_in` 秒未授权
- **WHEN** cli 轮询拿到 `data.error: "expired_token"`，或 `now - start_at >= expires_in*1000`
- **THEN** cli 退出，stderr 输出 `设备码已过期，请重新运行 supsub auth login`，退出码 1

#### Scenario: slow_down 时主动放慢

- **GIVEN** 服务端返回 `data.error: "slow_down"`
- **WHEN** cli 收到该响应
- **THEN** cli 把当前轮询间隔 `+1` 秒，继续轮询；不退出

### Requirement: `supsub auth login --api-key <k>` 跳过 OAuth

带 `--api-key` 时 SHALL 不发任何 HTTP 请求，直接把 key 与 `client_id: "supsub-cli"` 写入配置；不验证有效性。

#### Scenario: CI 脚本路径

- **GIVEN** CI 环境
- **WHEN** 执行 `supsub auth login --api-key sk_live_demo_token_for_dev`
- **THEN** 命令立即返回 0，配置文件包含该 key；后续命令在 401 时按 `cli-auth.401-handling` 处理

#### Scenario: 错误 key 不报错

- **GIVEN** 用户输入了一个明显格式不对的 key
- **WHEN** 执行 `supsub auth login --api-key abc`
- **THEN** 命令仍然成功写入并返回 0（不做本地校验，留给后续命令的 401 触发清理）

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
- **THEN** 退出码 0，stderr 仍输出 `已登出`，不抛异常

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

#### Scenario: api_key 来源标识

- **GIVEN** 通过 `--api-key sk_live_xxx` 临时调用
- **WHEN** 执行 `supsub --api-key sk_live_demo_token_for_dev auth status -o json`
- **THEN** `data.api_key_source === "flag"`；通过 env 时为 `"env"`；通过配置文件 api_key 时为 `"config"`；通过配置文件 bearer_token 时为 `"session"`

### Requirement: API Key 优先级 flag > env > config

任何命令在解析 api key 时 MUST 严格按照命令行 `--api-key` → `SUPSUB_API_KEY` → `~/.supsub/config.json.api_key` 顺序，命中即停。

#### Scenario: env 与 config 同时存在以 env 为准

- **GIVEN** 配置文件 api_key=A，环境变量 SUPSUB_API_KEY=B
- **WHEN** 执行任一受保护命令
- **THEN** 请求 Authorization 头使用 B；config 中 api_key=A 不被覆盖

#### Scenario: --api-key 覆盖一切

- **GIVEN** 配置文件 api_key=A，env=B，命令带 --api-key C
- **WHEN** 执行
- **THEN** 请求使用 C；本次执行不写回配置文件

### Requirement: 401 触发清理与提示（cli-auth.401-handling）

任一受保护命令收到 HTTP 401 时，cli MUST 立即从 `~/.supsub/config.json` 中移除 `api_key` 与 `client_id`，向 stderr 输出 `请运行 supsub auth login 重新登录`，退出码 2。`-o json` 时按 ErrorEnvelope 输出到 stdout。

#### Scenario: 普通命令 401 后配置被清空

- **GIVEN** 配置中 api_key 已失效
- **WHEN** 执行 `supsub sub list` 收到 401
- **THEN** 配置文件中两字段被删除；stderr 提示重新登录；退出码 2

#### Scenario: -o json 时 stderr 静默

- **GIVEN** 同上场景，命令带 `-o json`
- **WHEN** 收到 401
- **THEN** stdout 输出 `{"success":false,"error":{"code":"UNAUTHORIZED","message":"请运行 supsub auth login 重新登录","status":401}}`；stderr 无输出；退出码 2

### Requirement: 设备码轮询间隔的 fallback 行为

`packages/cli/src/commands/auth/device-flow.ts` 中的 `runDeviceFlow()` 在执行 OAuth Device Flow 轮询时，SHALL 使用服务端 Device Authorization Response 中的 `interval` 字段（秒）作为两次轮询之间的最短等待时间。当服务端未返回 `interval` 字段、或该字段的值 ≤ 0 时，实现 MUST 回落到 5 秒（5000 ms）默认间隔，以符合 RFC 8628 §3.5 的推荐行为，防止对服务端造成请求风暴。

#### Scenario: 服务端返回有效正整数 interval，使用服务端值

**GIVEN** Device Authorization Response 包含 `interval: 3`

**WHEN** `runDeviceFlow()` 开始轮询 token 端点

**THEN** 每次轮询前等待约 3000 ms（`sleep(3000)`），使用服务端指定值，不触发 fallback

#### Scenario: 服务端返回 interval = 0，触发 5 秒 fallback

**GIVEN** Device Authorization Response 包含 `interval: 0`（或 `interval` 字段缺失）

**WHEN** `runDeviceFlow()` 开始轮询 token 端点

**THEN** 每次轮询前等待约 5000 ms（`sleep(5000)`），而非 0 ms；CLI 不出现无限 spin，服务端不承受请求风暴

#### Scenario: 服务端返回负数 interval，触发 5 秒 fallback

**GIVEN** Device Authorization Response 包含 `interval: -1`

**WHEN** `runDeviceFlow()` 开始轮询 token 端点

**THEN** 每次轮询前等待约 5000 ms（`sleep(5000)`）；负数被视为无效值，行为与 `interval = 0` 一致

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
