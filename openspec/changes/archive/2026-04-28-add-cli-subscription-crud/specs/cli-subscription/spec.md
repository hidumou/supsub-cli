# cli-subscription spec delta

## ADDED Requirements

### Requirement: `supsub sub list` 列出全部订阅源

`supsub sub list [--type MP|WEBSITE]` SHALL 调 `GET /api/subscriptions`，可选 `sourceType` query 过滤。表格按 design.md §3 列定义渲染；JSON 透传。

#### Scenario: 不带过滤列出全部

- **GIVEN** mock server 已起、用户已登录
- **WHEN** 执行 `supsub sub list -o json`
- **THEN** stdout 输出 `{"success":true,"data":[...]}`，data 数组长度 ≥ 8（5 MP + 3 WEBSITE），每项包含 sourceId/sourceType/name/img/description/unreadCount

#### Scenario: --type 过滤

- **GIVEN** 同上
- **WHEN** 执行 `supsub sub list --type MP -o json`
- **THEN** data 数组所有项 `sourceType === "MP"`

#### Scenario: --type 大小写不敏感但拒绝非法值

- **GIVEN** 用户输入 `--type mp`
- **WHEN** 执行
- **THEN** 内部归一为 `MP` 后请求成功；输入 `--type foo` 时退出码 64，stderr 含 `--type 仅支持 MP 或 WEBSITE`

### Requirement: `supsub sub add/remove` 完成订阅 CRUD 写

`sub add` MUST 调 `POST /api/subscriptions`；`sub remove` 调 `DELETE /api/subscriptions`。两者均必填 `--source-id` 与 `--type`。`sub add --source-id <id> --type <T> [--group <gid>...]` 支持可选分组。

#### Scenario: 添加新订阅

- **GIVEN** mp_42 当前未被订阅
- **WHEN** 执行 `supsub sub add --source-id mp_42 --type MP -o json`
- **THEN** stdout 输出 `{"success":true,"data":{"message":"订阅成功"}}`，退出码 0

#### Scenario: 重复订阅返回业务错误

- **GIVEN** mp_42 已经在 fixture 里被订阅
- **WHEN** 再次执行 `supsub sub add --source-id mp_42 --type MP`
- **THEN** mock 返回 400 `{ code: "ALREADY_SUBSCRIBED" }`；cli 退出码 1，stderr 显示 message

#### Scenario: remove 缺失参数

- **GIVEN** 用户漏掉 `--type`
- **WHEN** 执行 `supsub sub remove --source-id mp_42`
- **THEN** commander 自动报错并退出，退出码 64

### Requirement: `supsub sub contents` 默认 unread，--all/--unread 互斥

`supsub sub contents` SHALL 调 `GET /api/subscriptions/contents`，分页固定 pageSize=20，`--page` 默认 1。`--all` 与 `--unread` MUST 互斥。

#### Scenario: 默认拉未读

- **GIVEN** mp_42 有 4 篇未读、3 篇已读
- **WHEN** 执行 `supsub sub contents --source-id mp_42 --type MP -o json`
- **THEN** data 数组长度 ≥ 4，且每篇 `isRead === false`

#### Scenario: --all 拉全部

- **GIVEN** 同上
- **WHEN** 执行 `... --all -o json`
- **THEN** data 数组长度 ≥ 7（含 isRead 既有 true 也有 false 的项）

#### Scenario: 互斥校验

- **GIVEN** 用户同时给 `--all` 与 `--unread`
- **WHEN** 执行
- **THEN** 退出码 64，stderr 含 `--all 与 --unread 互斥`，未发起 HTTP 请求

### Requirement: `supsub sub mark-read` 二选一标记

`--content-id <cid>` 标记单篇；`--all` 标记整源。两者 MUST 二选一，缺失则以退出码 64 报错。

#### Scenario: 单篇标记后 unread 减一

- **GIVEN** mp_42 unreadCount=4，未读文章 art_mp_42_001
- **WHEN** 执行 `supsub sub mark-read --source-id mp_42 --type MP --content-id art_mp_42_001`
- **THEN** 退出码 0，再次 `sub list --type MP -o json | jq '.data[] | select(.sourceId=="mp_42") | .unreadCount'` 输出 3

#### Scenario: --all 标记后 unread 归零

- **GIVEN** mp_42 unreadCount=4
- **WHEN** 执行 `supsub sub mark-read --source-id mp_42 --type MP --all`
- **THEN** 再次 list 时 mp_42 的 unreadCount === 0

#### Scenario: 既不传 --content-id 也不传 --all

- **GIVEN** 用户仅给 `--source-id` 与 `--type`
- **WHEN** 执行
- **THEN** 退出码 64，stderr 含 `--content-id <id> 与 --all 必须二选一`

### Requirement: 输出严格符合输出格式 spec

所有订阅命令输出 MUST 严格符合输出格式 spec：`-o table` 渲染走 `printTable`，CJK 字段按 2 列宽截断；`-o json` 严格 `{success,data}`，失败 `{success,error}`。表格末尾打印 `(N items)` 或 `(empty)`，分页时打印 `(N items, page <p>)`。

#### Scenario: 空列表

- **GIVEN** 某 source 下 `--unread` 列表为空
- **WHEN** 执行 `supsub sub contents --source-id mp_108 --type MP --unread`
- **THEN** 表头与 `(empty)` 占位齐全，退出码 0；`-o json` 输出 `{"success":true,"data":[]}`

#### Scenario: 401 时按 cli-auth.401-handling 处理

- **GIVEN** 配置文件 api_key 已失效
- **WHEN** 执行 `supsub sub list`
- **THEN** 退出码 2，配置文件 api_key/client_id 被清空，stderr 提示重新登录
