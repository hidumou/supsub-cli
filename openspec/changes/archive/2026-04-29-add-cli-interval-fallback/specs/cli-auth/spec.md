# cli-auth spec (interval fallback delta)

## MODIFIED Requirements

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
