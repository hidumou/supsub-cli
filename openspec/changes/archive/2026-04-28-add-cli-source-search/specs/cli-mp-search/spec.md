# cli-mp-search spec delta

## ADDED Requirements

### Requirement: 同步模式 30 秒上限轮询

`supsub mp search <name>` 不带 `--async` 时，SHALL 先 `POST /api/mps/search-tasks` 拿 `searchId`，按 2 秒间隔轮询 `GET /api/mps/search-tasks/:searchId`，最多轮询 15 次（30 秒上限）。轮询期间 stdout MUST 静默；最终结果或超时时一次性输出。

#### Scenario: 命中关键词 finished 在 ≤7 秒

- **GIVEN** mock fixture 含 `晚点 LatePost`
- **WHEN** 执行 `time supsub mp search 晚点 -o json`
- **THEN** ≤7 秒内退出码 0，stdout 输出 `{"success":true,"data":{"mpId":"mp_999","name":"晚点 LatePost",...}}`，轮询期间 stdout 无任何其他字节

#### Scenario: 未命中

- **GIVEN** 关键词 `xyz_no_match`
- **WHEN** 执行 `supsub mp search xyz_no_match`
- **THEN** mock 在 ≤6 秒内返回 `finished:true, mp:null`；cli 退出码 1，stderr 含 `未找到`

#### Scenario: 30 秒超时

- **GIVEN** mock 被人为改成 60 秒后才返回 finished（或 cli 把上限调到 1 秒做测试）
- **WHEN** cli 同步等待
- **THEN** 退出码 1；`-o json` 输出 `{"success":false,"error":{"code":"MP_SEARCH_TIMEOUT","status":0,"message":"30 秒内未完成，可继续查询: supsub task <searchId>","data":{"searchId":"..."}}}`；表格模式向 stderr 写同等信息

### Requirement: 异步模式立即返回 searchId

带 `--async` 时 SHALL 只发 `POST /api/mps/search-tasks`，MUST 不轮询，立即返回 searchId。

#### Scenario: --async 立即退出

- **GIVEN** 任意 name
- **WHEN** 执行 `supsub mp search 晚点 --async -o json`
- **THEN** ≤1 秒内退出码 0，输出 `{"success":true,"data":{"searchId":"<uuid>"}}`，不发起 GET 请求

### Requirement: `supsub task <searchId>` 单次查询任务

`supsub task <searchId>` SHALL 做单次查询，MUST 不轮询、不重试。

#### Scenario: 任务未完成

- **GIVEN** 刚创建的 searchId
- **WHEN** 立即执行 `supsub task <id> -o json`
- **THEN** 退出码 0，stdout 输出 `{"success":true,"data":{"finished":false,"message":"搜索中","mp":null}}`

#### Scenario: 任务已 finished + mp

- **GIVEN** 4 秒后查询命中关键词的 task
- **WHEN** 执行 `supsub task <id> -o json`
- **THEN** 退出码 0，data 含 `finished:true` 与 mp 完整字段

#### Scenario: 任务 finished + 未找到

- **GIVEN** 6 秒后查询未命中关键词的 task
- **WHEN** 执行 `supsub task <id>`
- **THEN** 退出码 1，stderr 含 `未找到`

### Requirement: `supsub mp search-cancel <searchId>` 取消任务

`supsub mp search-cancel <searchId>` SHALL 调 `DELETE /api/mps/search-tasks/:searchId` 取消任务。

#### Scenario: 取消进行中的任务

- **GIVEN** 刚创建未 finished 的 searchId
- **WHEN** 执行 `supsub mp search-cancel <id>`
- **THEN** 退出码 0，stdout/-o json 输出 `{"success":true,"data":{"message":"已取消"}}`

#### Scenario: 取消不存在或已取消的任务

- **GIVEN** 无效 searchId 或已取消的 id
- **WHEN** 执行
- **THEN** 退出码 1，stderr 含 `任务不存在或已取消`；`-o json` 输出 `{"success":false,"error":{"code":"NotFound",...}}`

### Requirement: 同步模式 -o json 期间 stdout 严格静默

轮询过程的等待提示、loading dots 等 MUST 一律走 stderr 或不打印。`-o json` 模式下 stderr SHALL 也保持静默，避免 jq 处理时出现噪音 EOF。

#### Scenario: jq 流式可消费

- **GIVEN** `supsub mp search 晚点 -o json` 在管道里
- **WHEN** 执行 `supsub mp search 晚点 -o json | jq -e '.success'`
- **THEN** jq 退出码 0，输出 `true`；不会因为中间字符（如 `…`、ANSI escape）报 parse error
