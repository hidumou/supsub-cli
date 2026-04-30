# cli-auth-tests Specification

## Purpose
TBD - created by archiving change add-cli-auth-tests. Update Purpose after archive.
## Requirements
### Requirement: `config/store` 的配置读写与清理行为（单元级）

`packages/cli/src/config/store.ts` 导出的 `readConfig()` / `writeConfig(patch)` / `clearAuth()` MUST 满足：写入后可读、patch 合并不覆盖旧字段、clearAuth 只移除认证字段、文件不存在时返回空对象。

#### Scenario: writeConfig 写入后 readConfig 可取回

- **GIVEN** 配置目录为空（无 config.json）
- **WHEN** 调用 `writeConfig({ api_key: "sk_test" })`
- **THEN** `readConfig()` 返回包含 `api_key: "sk_test"` 的对象

#### Scenario: writeConfig patch 合并保留旧字段

- **GIVEN** 配置已有 `{ api_key: "k1" }`
- **WHEN** 调用 `writeConfig({ client_id: "c1" })`
- **THEN** `readConfig()` 返回 `{ api_key: "k1", client_id: "c1" }`，旧字段未被覆盖

#### Scenario: clearAuth 仅移除认证字段

- **GIVEN** 配置已有 `{ api_key: "k", client_id: "c" }`
- **WHEN** 调用 `clearAuth()`
- **THEN** `readConfig()` 返回不含 `api_key` 和 `client_id` 的对象；其他非认证字段（如有）保留

#### Scenario: 文件不存在时 readConfig 返回空对象

- **GIVEN** 配置文件不存在
- **WHEN** 调用 `readConfig()`
- **THEN** 返回 `{}`，不抛出异常

---

### Requirement: HTTP 客户端收到 401 时清空配置并抛出 UNAUTHORIZED（单元级）

`packages/cli/src/http/client.ts` 的 `request()` 在后端返回 HTTP 401 时，MUST 调用 `clearAuth()` 清除本地配置中的认证字段，并向调用方抛出 `{ code: "UNAUTHORIZED" }` 形态的 ErrorEnvelope。

#### Scenario: fetch 返回 401 触发 clearAuth

- **GIVEN** `fetch` 被 mock 为始终返回 `{ status: 401, ok: false }`
- **WHEN** 调用 `request({ method: "GET", path: "/api/user/info", apiUrl: "http://fake", apiKey: "sk_test" })`
- **THEN** `clearAuth` 被调用恰好 1 次

#### Scenario: fetch 返回 401 抛出 UNAUTHORIZED ErrorEnvelope

- **GIVEN** 同上
- **WHEN** 调用 `request()`
- **THEN** Promise 以包含 `code: "UNAUTHORIZED"` 的对象 reject；调用方无需额外处理 HTTP 状态码

---

### Requirement: Device Flow 收到 access_denied 立即停止并抛出（单元级）

`packages/cli/src/commands/auth/device-flow.ts` 的 `runDeviceFlow()` 在轮询 token 端点时收到 `{ error: "access_denied" }` 响应，MUST 立即停止轮询（不再等 interval）并以 `{ code: "ACCESS_DENIED", message: "用户拒绝授权" }` reject 当前 Promise。

#### Scenario: access_denied 触发立即 reject

- **GIVEN** `fetch` mock 序列：第 1 次（device/code）返回 200 + 合法 DeviceCodeResponse（`interval: 0, expires_in: 10`）；第 2 次（token 轮询）返回 400 + `{ error: "access_denied" }`
- **WHEN** 调用 `runDeviceFlow("http://fake")`
- **THEN** Promise reject，error.code === "ACCESS_DENIED"

#### Scenario: access_denied 时 error.message 含正确文案

- **GIVEN** 同上
- **WHEN** Promise reject
- **THEN** error.message 包含 `用户拒绝授权`；轮询不继续（第 2 次 fetch 后不再有第 3 次 token 请求）

