# mock-server spec delta

## ADDED Requirements

### Requirement: Hono mock 监听 8787 且仅本地可达

mock server SHALL 通过 `Bun.serve({ port: 8787, fetch: app.fetch })` 启动，绑定 `127.0.0.1`。启动时 stdout 打印监听 URL 与预置 demo api key（**仅 dev 用**）。

#### Scenario: 默认端口与监听地址

- **GIVEN** 仓库根
- **WHEN** 执行 `pnpm dev:mock`
- **THEN** stdout 出现 `mock server listening on http://localhost:8787`，其他机器访问宿主机 8787 端口被拒绝（仅 loopback 接受）

#### Scenario: 端口被占用时的错误足够直白

- **GIVEN** 8787 已被另一进程占用
- **WHEN** 执行 `pnpm dev:mock`
- **THEN** 进程退出码非 0，stderr 包含字面量 `EADDRINUSE` 或 `port 8787` 关键字（便于 cli-dev 排错）

### Requirement: Bearer 鉴权保护所有 `/api/*`

Bearer 鉴权 SHALL 保护所有 `/api/*` 路由。预置 demo api key `sk_live_demo_token_for_dev` 是唯一合法凭证。`/open/api/v1/oauth/*` 与 `/device` 不受保护。

#### Scenario: 缺失 Authorization 返回 401

- **GIVEN** mock server 已启动
- **WHEN** `curl http://localhost:8787/api/user/info`（不带 header）
- **THEN** HTTP 401 + body `{ "code": "UNAUTHORIZED", "message": "Invalid api key", "status": 401 }`

#### Scenario: 错误 token 返回 401（不泄露差异）

- **GIVEN** Authorization 头为 `Bearer sk_live_wrong`
- **WHEN** 请求任一 `/api/*`
- **THEN** 同样的 401 响应；不区分「头格式错」与「token 错」（避免给攻击者额外信息）

#### Scenario: oauth 与 device 路径不需 token

- **GIVEN** 没有 Authorization 头
- **WHEN** 请求 `POST /open/api/v1/oauth/device/code` 或 `GET /device`
- **THEN** 正常处理，不返回 401

### Requirement: Device Flow 状态机覆盖 4 种轮询响应

`POST /open/api/v1/oauth/token` MUST 按 device 状态返回 `pending / authorized / denied / expired / slow_down` 五种结果，错误体形态为 `{ code, message, status: 400, data: { error: "..." } }`，其中 `data.error` 取值为 `authorization_pending | slow_down | expired_token | access_denied`。`POST /open/api/v1/oauth/device/code` 申请设备码。

#### Scenario: 未授权时返回 authorization_pending

- **GIVEN** 刚通过 `/device/code` 拿到的设备码
- **WHEN** `POST /open/api/v1/oauth/token`
- **THEN** 响应 400 + `{ code: "AUTHORIZATION_PENDING", message: "用户尚未授权", status: 400, data: { error: "authorization_pending" } }`

#### Scenario: 授权后返回 api_key

- **GIVEN** 用户在 `/device` 页面点击「自动授权」后
- **WHEN** cli 再次 `POST /open/api/v1/oauth/token`
- **THEN** 响应 200 + `{ api_key: "sk_live_demo_token_for_dev", client_id: "cli_demo_client" }`

#### Scenario: 用户拒绝返回 access_denied

- **GIVEN** 用户在 `/device` 页面点击「拒绝」
- **WHEN** cli 轮询 token
- **THEN** 响应 400 + `{ code: "ACCESS_DENIED", ..., data: { error: "access_denied" } }`

#### Scenario: 设备码超时返回 expired_token

- **GIVEN** 设备码创建时间已超过 `expires_in`（默认 600s；测试时可在 store 内手动改 expires_at）
- **WHEN** cli 轮询 token
- **THEN** 响应 400 + `data.error: "expired_token"`

#### Scenario: 轮询过快返回 slow_down

- **GIVEN** 上一次轮询发生在 `now - 500ms`，interval 是 2s
- **WHEN** cli 立刻再次轮询
- **THEN** 响应 400 + `data.error: "slow_down"`，且 store 内 last_poll_at 仍按 server 收到本次请求的时间更新

### Requirement: `/device` 授权页提供最简交互

`GET /device` SHALL 返回 HTML，包含 user_code 显示与三个动作链接：自动授权、拒绝、模拟过期。无需 cookie / session。

#### Scenario: 带 user_code 显示授权确认

- **GIVEN** mock 内 user_code `ABCD-EFGH` 处于 pending
- **WHEN** 浏览器访问 `GET /device?user_code=ABCD-EFGH`
- **THEN** 页面渲染该 user_code 与三个 a 链接（href 指向 `/device/_action?op=authorize|deny|expire&user_code=ABCD-EFGH`）

#### Scenario: 缺 user_code 显示输入框

- **GIVEN** 用户访问 `/device`
- **WHEN** 无 query
- **THEN** 页面渲染 `<input name="user_code">` + 提交按钮，提交后跳回 `/device?user_code=...`

#### Scenario: 操作后状态被持久化到 store

- **GIVEN** user_code `ABCD-EFGH` 处于 pending
- **WHEN** 访问 `/device/_action?op=authorize&user_code=ABCD-EFGH`
- **THEN** store.devices 中该记录 status 变为 `authorized`，浏览器被 302 回 `/device?user_code=ABCD-EFGH&done=1`，cli 此时轮询能立即拿到 api_key

### Requirement: 订阅源 fixture 完备到能贯通 sub list/contents/mark-read

fixture MUST 预置 5 个 MP + 3 个 WEBSITE，每个源至少 3 篇文章，文章字段齐备。`unreadCount` 由内存 reads store 反算，`POST /mark-as-read` 后下次 `GET /api/subscriptions` 同源 `unreadCount` 必须减少。

#### Scenario: list 与 contents 字段一致

- **GIVEN** 已登录的 demo 用户
- **WHEN** 调 `GET /api/subscriptions`，再选其中一条 `sourceId/sourceType` 调 `GET /api/subscriptions/contents`
- **THEN** contents 返回的文章数组非空，每篇含 articleId/url/title/coverImage/tags/summary/publishedAt/isRead 全字段

#### Scenario: 标记单篇已读后 unreadCount 减一

- **GIVEN** `mp_42` 的 unreadCount 为 4，存在未读文章 `art_mp_42_001`
- **WHEN** `POST /api/subscriptions/contents/mark-as-read` body `{sourceType:"MP",sourceId:"mp_42",contentId:"art_mp_42_001"}`
- **THEN** 再调 `GET /api/subscriptions?sourceType=MP`，`mp_42` 的 unreadCount 变为 3，且 `GET /contents` 中该篇 `isRead:true`

#### Scenario: 全部标记已读后 unreadCount 归零

- **GIVEN** `mp_42` 的 unreadCount 为 4
- **WHEN** `POST /mark-as-read` body 仅含 `{sourceType,sourceId}`（不带 contentId）
- **THEN** 再调 list，`mp_42.unreadCount` 为 0；`GET /contents?type=unread` 返回空数组

### Requirement: mp 搜索任务在 3-6 秒内异步完成

`POST /api/mps/search-tasks` SHALL 立即返回 searchId；`GET /api/mps/search-tasks/:id` 在创建后 3 秒内返回 `finished:false`，3 秒后若 name 命中 fixture 公众号则 `finished:true` + 完整 mp，否则 5 秒后返回 `finished:true, mp:null`。

#### Scenario: 命中关键词

- **GIVEN** fixture 内含 `晚点 LatePost` 公众号
- **WHEN** `POST /api/mps/search-tasks {name:"晚点"}`，立即拿 searchId 后 4 秒后 `GET /api/mps/search-tasks/<id>`
- **THEN** 响应 `{ finished: true, message: "ok", mp: { mpId: "mp_999", name: "晚点 LatePost", img, description } }`

#### Scenario: 未命中关键词

- **GIVEN** 关键词 "xyz_no_match"
- **WHEN** 创建任务后 6 秒后查询
- **THEN** 响应 `{ finished: true, message: "未找到", mp: null }`

#### Scenario: 取消任务幂等

- **GIVEN** 已创建的 searchId
- **WHEN** 连续两次 `DELETE /api/mps/search-tasks/<id>`
- **THEN** 第一次 204，第二次 404 `{ code: "NotFound" }`（cli 容错处理）

### Requirement: 搜索接口在 fixture 内做子串匹配

搜索接口 SHALL 在 fixture 内做子串匹配，`GET /api/search?keywords=&type=&page=&pageSize=` 返回 `{ results: [{type, data}], recommendations: [], prompts: [] }`。`results` 来自 fixture sources / articles 的 name/title/summary/description 子串命中。

#### Scenario: 关键词命中信息源

- **GIVEN** fixture 内含 `Anthropic Blog`
- **WHEN** `GET /api/search?keywords=Anthropic&type=ALL&page=1&pageSize=10`
- **THEN** `results` 含至少一项 `{ type: "SOURCE", data: { sourceId: "web_1002", name: "Anthropic Blog", ... } }`

#### Scenario: 关键词命中文章

- **GIVEN** 某篇文章 title 含 "AI"
- **WHEN** `GET /api/search?keywords=AI&type=CONTENT&page=1&pageSize=10`
- **THEN** `results` 中至少一项 `type: "CONTENT"`，`data` 含 contentId/title/url 等内容字段

### Requirement: 错误响应严格符合 ErrorResponse-62

所有错误（鉴权、参数、404、5xx）MUST 通过 `app.onError` 序列化为 `{ code: string, message: string, status: integer, data?: object }`，HTTP 状态码与 `status` 字段一致。

#### Scenario: 字段类型固定

- **GIVEN** 任一错误返回
- **WHEN** 调用方反序列化
- **THEN** `code` 必为 string、`status` 必为 integer、`message` 必为 string，且 HTTP status 与 body.status 严格相等

#### Scenario: 未捕获异常被兜底

- **GIVEN** 路由实现内部抛出非 HTTPError 的 Error
- **WHEN** 请求进入
- **THEN** 响应 500 + `{ code: "INTERNAL_ERROR", message: <error.message>, status: 500 }`，进程不崩溃
