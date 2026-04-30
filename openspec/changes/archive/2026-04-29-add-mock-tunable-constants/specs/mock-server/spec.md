# mock-server spec delta

## MODIFIED Requirements

### Requirement: 设备码 TTL 与轮询间隔 SHALL 由单一配置源驱动且可通过环境变量注入

mock server SHALL 从 `packages/mock/src/config.ts` 读取设备码 TTL（`DEVICE_CODE_TTL_SECONDS`）与轮询间隔（`DEVICE_CODE_INTERVAL_SECONDS`），而非在 `store/devices.ts` 与 `routes/oauth.ts` 各自硬编码。默认值 MUST 保持 `DEVICE_CODE_TTL_SECONDS=600`、`DEVICE_CODE_INTERVAL_SECONDS=2`，与原行为完全一致。当环境变量 `MOCK_DEVICE_TTL` 或 `MOCK_DEVICE_INTERVAL` 存在且为有限正整数时，SHALL 使用注入值；否则 MUST 回落到默认值（silent fallback，进程不崩溃）。

`POST /open/api/v1/oauth/device/code` 响应中的 `expires_in` 字段 MUST 等于当前生效的 `DEVICE_CODE_TTL_SECONDS`（不得与 store 中实际 `expires_at` 产生语义偏差）。`interval` 字段 MUST 等于当前生效的 `DEVICE_CODE_INTERVAL_SECONDS`。

#### Scenario: 默认值不注入环境变量时响应 expires_in=600

- **GIVEN** mock server 以默认配置启动（未设置 `MOCK_DEVICE_TTL`）
- **WHEN** `POST /open/api/v1/oauth/device/code` `{"client_name":"supsub-cli"}`
- **THEN** 响应体 `expires_in` 字段值为 `600`，`interval` 字段值为 `2`

#### Scenario: MOCK_DEVICE_TTL=10 时响应 expires_in=10

- **GIVEN** mock server 以 `MOCK_DEVICE_TTL=10 MOCK_DEVICE_INTERVAL=1` 启动
- **WHEN** `POST /open/api/v1/oauth/device/code` `{"client_name":"supsub-cli"}`
- **THEN** 响应体 `expires_in` 字段值为 `10`，`interval` 字段值为 `1`

#### Scenario: 非法环境变量值静默回落默认值

- **GIVEN** mock server 以 `MOCK_DEVICE_TTL=abc` 启动
- **WHEN** `POST /open/api/v1/oauth/device/code`
- **THEN** 响应体 `expires_in` 字段值为 `600`（回落默认），进程未崩溃

#### Scenario: store 与响应的 TTL 语义一致

- **GIVEN** mock server 以 `MOCK_DEVICE_TTL=10` 启动
- **WHEN** 拿到 device_code 后等待 11 秒再 `POST /open/api/v1/oauth/token`
- **THEN** 响应 400 + `data.error: "expired_token"`（store 中 `expires_at = now + 10*1000` 与 `expires_in=10` 语义严格一致）

---

### Requirement: demo api key SHALL 由单一配置源驱动且可通过环境变量注入

mock server 的 demo api key MUST 在 `packages/mock/src/config.ts` 中声明为 `DEMO_API_KEY`，默认值 MUST 为 `sk_live_demo_token_for_dev`。`middleware/auth.ts` SHALL re-export `DEMO_API_KEY` 自 `config.ts`，以保持既有 importer（`index.ts`、`routes/oauth.ts`）无需改动。当环境变量 `MOCK_DEMO_KEY` 被设置时，SHALL 使用其值替代默认值。

#### Scenario: 默认 api key 行为不变

- **GIVEN** mock server 以默认配置启动（未设置 `MOCK_DEMO_KEY`）
- **WHEN** `curl http://localhost:8787/api/user/info -H 'Authorization: Bearer sk_live_demo_token_for_dev'`
- **THEN** 响应 200（鉴权通过），行为与重构前完全一致

#### Scenario: MOCK_DEMO_KEY 注入自定义 key

- **GIVEN** mock server 以 `MOCK_DEMO_KEY=my_custom_key` 启动
- **WHEN** `curl http://localhost:8787/api/user/info -H 'Authorization: Bearer my_custom_key'`
- **THEN** 响应 200；使用原 `sk_live_demo_token_for_dev` 则返回 401

#### Scenario: re-export 保持向后兼容

- **GIVEN** `packages/mock/src/index.ts` 的 `import { DEMO_API_KEY } from "./middleware/auth.js"` 未被改动
- **WHEN** mock server 启动
- **THEN** `console.log` 正确打印当前生效的 demo api key（无 `undefined`）
