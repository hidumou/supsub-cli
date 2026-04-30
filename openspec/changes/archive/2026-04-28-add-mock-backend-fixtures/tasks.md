# Tasks: add-mock-backend-fixtures

> 目标：`pnpm dev:mock` 起服后，cli 用 `--api-url http://localhost:8787 --api-key sk_live_demo_token_for_dev` 能跑通 v1 全部命令。

## 1. 文件骨架（按 design.md §1 落地）
- [x] 1.1 新建 `packages/mock/src/app.ts`，构造 Hono 实例并挂 `cors()`、错误中间件、auth 中间件、各路由
- [x] 1.2 改造 `packages/mock/src/index.ts`：从 `app.ts` 引入 `app`，导出 `{ port: 8787, fetch: app.fetch }`，启动时 `console.log` 打印 demo api key
- [x] 1.3 新建 `lib/error.ts`：`HTTPError` 类 + `httpError(status, code, message, data?)` helper
- [x] 1.4 新建 `lib/id.ts`：包装 `crypto.randomUUID()`、user_code 生成器（4-4 大写字母数字）

## 2. Fixtures（按 design.md §5 落地）
- [x] 2.1 `fixtures/user.ts`：导出 `demoUser` `{ id: 1, email: "demo@supsub.local", name: "Demo", avatar: "", google: false, expired: false, endAt: <now+30d>, opml: "http://localhost:8787/feed/demo/opml.xml", onboardingCompleted: true, referralSourceSubmitted: true }`
- [x] 2.2 `fixtures/sources.ts`：导出 5 MP + 3 WEBSITE 数组（字段：sourceId, sourceType, name, img, description, unreadCount）
- [x] 2.3 `fixtures/articles.ts`：每个源 3-10 篇文章；按 `sourceType:sourceId` 索引；字段含 articleId/url/title/coverImage/tags/summary/publishedAt/isRead

## 3. Store（内存状态机）
- [x] 3.1 `store/devices.ts`：`Map<device_code, DeviceRecord>`，DeviceRecord = `{ user_code, status: "pending"|"authorized"|"denied"|"expired", created_at, expires_at, interval, last_poll_at }`，`createDevice()` / `findByDevice(code)` / `findByUserCode(uc)` / `updateStatus(uc, status)`
- [x] 3.2 `store/searches.ts`：`Map<searchId, SearchRecord>`，`SearchRecord = { name, createdAt, cancelled }`，`createSearch(name)` / `getSearch(id)` / `cancelSearch(id)`，evaluation 函数根据 createdAt 与 fixture 计算 finished/mp
- [x] 3.3 `store/reads.ts`：`Set<string>` 存 `${sourceType}:${sourceId}:${articleId}`；提供 `markRead(...)` / `markAllRead(sourceType, sourceId)` / `isRead(...)`，并能反算 unreadCount

## 4. Middleware
- [x] 4.1 `middleware/auth.ts`：仅 `/api/*` 生效；缺 `Authorization` 头或值 ≠ `Bearer sk_live_demo_token_for_dev` 抛 `httpError(401, "UNAUTHORIZED", "Invalid api key")`
- [x] 4.2 `middleware/error.ts`：app.onError 把 HTTPError 序列化为 `{ code, message, status, data? }`，HTTP 状态码与 status 一致；非 HTTPError 走 500 + `INTERNAL_ERROR`

## 5. OAuth Device Flow 路由
- [x] 5.1 `POST /open/api/v1/oauth/device/code`：忽略 body 字段，调 `createDevice()`，返回 `{ code, verification_uri: "http://localhost:8787/device", user_code, expires_in: 600, interval: 2 }`
- [x] 5.2 `POST /open/api/v1/oauth/token`：按 design.md §3 状态机分支返回；slow_down 通过对比 `now - last_poll_at < interval*1000` 触发；错误响应同时带 `data.error` 字段（authorization_pending/slow_down/expired_token/access_denied）

## 6. /device 授权页
- [x] 6.1 `GET /device`：返回内联 HTML 字符串。无 query → 输入框；有 user_code → 显示 + 三个 a 链接（authorize / deny / expire）
- [x] 6.2 `GET /device/_action?op=authorize|deny|expire&user_code=...`：内部端点，更新 store 状态后 302 回 `/device?user_code=...&done=1`
- [x] 6.3 user_code 不存在或不在 pending 状态时返回提示 HTML（不报 500）

## 7. 业务路由
- [x] 7.1 `GET /api/user/info` → 返回 `demoUser`
- [x] 7.2 `GET /api/subscriptions?sourceType=` → 过滤 fixture sources，每条带 `unreadCount`（从 reads store 反算）
- [x] 7.3 `POST /api/subscriptions` body `{sourceType, sourceId, groupIds?}` → 201 `{ message: "订阅成功" }`；若已订阅返回 400 `{ code: "ALREADY_SUBSCRIBED" }`
- [x] 7.4 `DELETE /api/subscriptions` body `{sourceType, sourceId}` → 201 `{ message: "取消订阅成功" }`
- [x] 7.5 `GET /api/subscriptions/contents?sourceType=&sourceId=&type=unread|all&page=&pageSize=` → 返回文章数组，按 `isRead` 与 reads store 计算
- [x] 7.6 `POST /api/subscriptions/contents/mark-as-read` body `{sourceType, sourceId, contentId?}` → 缺 contentId 即标整源已读，204
- [x] 7.7 `GET /api/search?type=ALL|MP|WEBSITE|CONTENT&keywords=&page=&pageSize=` → 在 fixture sources 与 articles 中按子串匹配，返回 `{ results: [{type, data}], recommendations: [], prompts: [] }`
- [x] 7.8 `POST /api/mps/search-tasks` → `createSearch()` 返回 `{ searchId }`
- [x] 7.9 `GET /api/mps/search-tasks/:id` → 按 design.md §4 计算 `{ finished, message, mp }`
- [x] 7.10 `DELETE /api/mps/search-tasks/:id` → cancelSearch，204；id 不存在 404 `{ code: "NotFound" }`

## 8. 验收
- [x] 8.1 `pnpm dev:mock` 启动后访问 `http://localhost:8787/` 可见 stub 文本；`curl /api/user/info -H 'Authorization: Bearer sk_live_demo_token_for_dev'` 返回 demoUser
- [x] 8.2 `curl -X POST http://localhost:8787/open/api/v1/oauth/device/code -H 'Content-Type: application/json' -d '{"client_name":"supsub-cli"}'` 返回完整字段；浏览器打开 `verification_uri?user_code=<返回的 user_code>` 显示授权页；点[自动授权]后再 `POST /open/api/v1/oauth/token` 立即返回 `{ api_key, client_id }`
- [x] 8.3 `curl /api/mps/search-tasks -X POST -H 'Authorization: Bearer ...' -H 'Content-Type: application/json' -d '{"name":"晚点"}'` 返回 searchId；3-6 秒后 `GET /api/mps/search-tasks/<id>` 返回 `finished:true` + 含 `mp_999` 的 mp
- [x] 8.4 `curl /api/subscriptions/contents?...` 返回的某文章 `articleId` 可被 `POST /mark-as-read` 标记，再次拉取该文章 `isRead:true`
- [x] 8.5 缺失 / 错误 api key 时所有 `/api/*` 返回 `status:401, code:UNAUTHORIZED`
- [x] 8.6 `pnpm --filter @supsub/mock typecheck` 通过
