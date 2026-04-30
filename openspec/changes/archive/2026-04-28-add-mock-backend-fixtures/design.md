# Design: add-mock-backend-fixtures

## 1. 文件布局

```
packages/mock/src/
  index.ts                # Bun.serve 入口，组装 Hono app
  app.ts                  # Hono 实例 + 中间件链
  middleware/
    auth.ts               # Bearer 鉴权（仅作用于 /api/*）
    error.ts              # 把 throw 出来的 HTTPError 包成 ErrorResponse
  routes/
    oauth.ts              # /open/api/v1/oauth/*
    device.ts             # /device HTML 授权页
    user.ts               # /api/user/info
    subscriptions.ts      # /api/subscriptions, /contents, /mark-as-read
    search.ts             # /api/search
    mps.ts                # /api/mps/search-tasks (POST/GET/DELETE)
  store/
    devices.ts            # device_code -> {status, user_code, expires_at}
    searches.ts           # search_id -> {createdAt, finished, mp}
    reads.ts              # 已读集合：Set<`${sourceType}:${sourceId}:${articleId}`>
  fixtures/
    user.ts               # demo 用户
    sources.ts            # 5 MP + 3 WEBSITE
    articles.ts           # 每个源对应的文章
  lib/
    error.ts              # HTTPError 类 + helper
    id.ts                 # crypto.randomUUID 包装
```

## 2. 鉴权约定

- 预置 demo api key：`sk_live_demo_token_for_dev`
- 预置 demo client id：`cli_demo_client`
- 中间件 `auth.ts`：`/api/*` 路由必须带 `Authorization: Bearer sk_live_demo_token_for_dev`，否则 401（`{ code: "UNAUTHORIZED", message: "Invalid api key", status: 401 }`）
- `/open/api/v1/oauth/*`、`/device` 不走 auth 中间件

## 3. Device Flow 状态机

```
POST /open/api/v1/oauth/device/code
  → 生成 device_code (uuid) + user_code (8 字符 ABCD-EFGH 风格)
  → store.devices[device_code] = { user_code, status: "pending", expires_at: now+600s, interval: 2 }
  → 响应 { code: device_code, verification_uri: "http://localhost:8787/device", user_code, expires_in: 600, interval: 2 }

POST /open/api/v1/oauth/token { grant_type:"device_code", client_id, code }
  当前状态 → 响应
    pending → 400 { error: "authorization_pending" }（ErrorResponse 形态）
    authorized → 200 { api_key: "sk_live_demo_token_for_dev", client_id: "cli_demo_client" }
    denied → 400 { error: "access_denied" }
    expired (now > expires_at) → 400 { error: "expired_token" }
  额外：相邻两次轮询间隔 < interval 秒 → 400 { error: "slow_down" }（用 last_poll_at 记）
  注意：mock 的轮询错误体兼容两种形态——
    - 主体字段：`{ code: "AUTHORIZATION_PENDING", message, status: 400, data: { error: "authorization_pending" } }`
    - 这样 cli 既能 grep `error.data?.error === "authorization_pending"`，也能直接看 code

GET /device?user_code=XXXX-YYYY
  返回内嵌 HTML：
    - 标题 "supsub-cli 授权"
    - 显示 user_code（不存在则给输入框，提交后 reload）
    - 三个超链接（不是 form，避免 CSRF token 困扰）：
        [自动授权] → 后台 fetch `POST /device/_action?op=authorize&user_code=...`，刷新页面
        [拒绝]   → 同上，op=deny
        [模拟过期] → op=expire（仅供 cli-dev 测过期路径）
  POST 内部端点 /device/_action：
    更新 store.devices[device_code] 的 status，重定向回 /device?user_code=...&done=1
```

## 4. mp 搜索任务状态机

- `POST /api/mps/search-tasks` body `{ name }` → 生成 `searchId`（uuid），存 `{ createdAt: now, finished: false, name }`，响应 201 `{ searchId }`
- `GET /api/mps/search-tasks/:searchId`：
  - 若 `name` 命中 fixture 公众号（大小写不敏感包含匹配），且 `now - createdAt >= 3000ms`，则返回 `{ finished: true, message: "ok", mp: { mpId, name, img, description } }`
  - 若不命中 fixture，且 `>= 5000ms`，返回 `{ finished: true, message: "未找到", mp: null }`（注意：spec 中 `mp` 是 required，但 cli 期待 nullable；mock 此时输出 `mp: null` 即可，cli-dev 在反序列化时按 `mp ?? undefined` 处理）
  - 否则 `{ finished: false, message: "搜索中", mp: null }`
- `DELETE /api/mps/search-tasks/:searchId` → 删除任务，204；若已 finished 删除幂等
- 命中关键词：fixture 公众号 name 包含子串即算命中。Demo fixture 包含 `晚点 LatePost`、`歸藏的AI工具箱`、`PaperAgent`、`高可用架构`、`果粉俱乐部`，所以 `supsub mp search "晚点"` 必中 finished

## 5. 订阅源 fixture 与字段约定

**5 个 MP**（id 类型沿用 string 与 api.json example 一致）：

| sourceId | sourceType | name | description | unread |
|---|---|---|---|---|
| `mp_42` | MP | 歸藏的AI工具箱 | 产品设计师 / AI 画图工具操作员 | 4 |
| `mp_108` | MP | 果粉俱乐部 | 始于苹果，不止于苹果 | 0 |
| `mp_81` | MP | PaperAgent | 日更，解读 AI 前沿 paper | 7 |
| `mp_87` | MP | 高可用架构 | 高可用架构公众号 | 2 |
| `mp_999` | MP | 晚点 LatePost | 商业故事与商业逻辑 | 11 |

**3 个 WEBSITE**：

| sourceId | name | url | unread |
|---|---|---|---|
| `web_1001` | Hacker News | https://news.ycombinator.com | 23 |
| `web_1002` | Anthropic Blog | https://www.anthropic.com/news | 1 |
| `web_1003` | Bun Blog | https://bun.sh/blog | 0 |

每个源至少 3 篇 article，articleId 形如 `art_<sourceId>_001`，含 url / title / coverImage / tags / summary / publishedAt（unix 秒）/ isRead。

**关键差异**：api.json `GET /api/subscriptions` schema 把 `sourceType` 写成 `integer` 但 example 用字符串。**以 example 为准**（`sourceType: "MP" | "WEBSITE"`），mock 输出字符串。`sourceId` 同理用字符串。

## 6. 错误响应统一形态

封装 `lib/error.ts`：

```ts
export class HTTPError extends Error {
  constructor(public status: number, public code: string, message: string, public data?: unknown) {
    super(message);
  }
}
```

`middleware/error.ts`：catch 全局，把 `HTTPError` 转成
```json
{ "code": "...", "message": "...", "status": 400, "data": {...} }
```
HTTP 状态码与 `status` 字段一致。非 HTTPError 一律 500 + `code: "INTERNAL_ERROR"`。

## 7. 启动与端口

- `Bun.serve({ port: 8787, fetch: app.fetch })`
- 监听 `127.0.0.1`，不绑 `0.0.0.0`（避免暴露给同 LAN 的其他机器）
- 启动时 console.log `mock server listening on http://localhost:8787`，列出预置 demo api key 一行（**仅 dev 用，不要写进生产构建**）
