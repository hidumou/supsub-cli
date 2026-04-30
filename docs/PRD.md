# supsub-cli 需求文档（v1）

## Context

supsub 是一个面向中文知识工作者的微信公众号 RSS 化与 AI 信息流聚合平台（详见 `/Users/han/Code/supsub-website`）。当前产品仅有 Web 端，所有订阅管理、关注点查阅、Feed 获取等操作都需要打开浏览器。

随着 AI agent（Claude Code、Cursor 等）逐渐成为知识工作者的日常工具，"让 agent 直接代为查阅订阅、整理关注点"是一个高价值场景。**supsub-cli 的核心目标是让命令行用户与 AI agent 都能脚本化地访问 supsub 的核心能力**，而无需打开浏览器或调用裸 API。

参考实现 `/Users/han/coding-agent-workspace/getnote-cli` 已经验证了"Go 二进制 + npm 分发"的成熟模式，supsub-cli 直接复用这套架构。

---

## 范围与约束

### v1 包含
- 认证（登录 / 登出 / 状态查询）
- 订阅管理（列表 / 订阅 / 取消订阅 / 内容流）
- 分组管理（完整 CRUD：列表 / 创建 / 重命名 / 删除 / 成员查询 / 成员管理）
- 关注点（列表 / 详情 / 创建 / 修改 / 删除 / 内容流）
- 微信公众号（列表 / 添加 / 关键词搜索 — 内部同步轮询 30s，超时兜底 `supsub task <searchId>` 带外查询）
- 全量搜索
- 用户信息 / 当前订阅计划查询
- OPML 导出（一条命令拿到/下载所有订阅源的 OPML 文件）
- Feed Token 轮换
- 版本与静默自更新（启动 24h 缓存对比 npm registry，发现新版 detached 后台执行 `npm i -g`，前台命令照常返回，下次启动已是新版）
- npm 分发（optionalDependencies 平台子包方案，5 个平台）

### v1 不包含（基于"AI agent + 命令行用户场景"的取舍）

**复杂交互/UI 主战场**
- AI 关注点对话（focus-sessions 含 SSE 流式生成）— 复杂度高，UX 不适合命令行
- 支付与订单（创建订单 / 优惠券 / 查询订单状态）— 留在 web UI 完成
- 引导流程（onboarding）— 一次性、强 UI 体验
- 推荐（recommend）— UI 探索型，agent 场景下用户已明确想要什么走 search 即可
- 单条 Feed URL 命令（sub feed / focus feed / group feed）— agent 不消费 RSS，命令行用户用 web 复制更快；批量场景被 `supsub opml` 覆盖


**低频账户管理**
- 改邮箱 / 改密码 / 注册 / 重置密码 — 引导到 web 端
- `user set-name` / `user plans`(计费历史) / `settings feed`(查看 Feed Token) — 低频

**v1 一律不加场景型组合命令**：保持与 API 一对一映射，agent 自己组合多个原子命令 + jq 满足复杂场景。

### 关键约束（必须在文档中明示）
1. **认证采用 OAuth Device Flow + API Key 双模式**（与 getnote-cli 一致）。
2. **此方案需要后端配合新增接口**（详见下方 §「后端依赖」），supsub-cli v1 的交付前置依赖于这些后端接口上线。
3. **API Key 存在时效性，过期统一走 401**：后端签发的 API Key 不是永久有效，过期或被吊销后调用受保护接口会返回 401。CLI 不做任何本地过期预判，也不缓存过期时间戳——**所有失效检测都由服务端 401 响应触发**，避免本地时钟/字段与服务端状态不一致。CLI 同样 **不实现自动 refresh 链路**（不复刻 web 端 `src/lib/request.ts` 的 accessToken/refreshToken 机制）：任一接口返回 401，按 §「401 处理」执行——清空配置中的 `api_key` / `client_id`，提示 `请运行 supsub auth login 重新登录`，退出码 2。
4. **后端 API base URL** 用环境变量 `SUPSUB_API_URL` 覆盖，缺省指向生产 URL。
5. **响应错误结构**（严格对齐 `/Users/han/Code/supsub-website/api.json` 中的 `ErrorResponse`）：
   ```json
   {
     "code": "SUBSCRIPTION_PLAN_EXPIRED",   // string：错误编码（非 HTTP 数字码），如 NotFound、SUBSCRIPTION_PLAN_EXPIRED
     "message": "当前计划已过期",             // string：错误描述，面向用户
     "status": 403,                          // integer：与 HTTP status code 相同
     "data": { }                             // object（可选）：默认不返回，特殊情况携带数据
   }
   ```
   - `code`、`message`、`status` 为必返字段；`data` 仅特殊情况下携带。
   - CLI 需要识别 `code === "SUBSCRIPTION_PLAN_EXPIRED"`（通常伴随 `status: 403`）给出升级订阅的友好提示，详见 §「错误处理」。

---

## 后端依赖（CLI 上线前置）

supsub 后端需新增以下接口，CLI v1 的交付节奏跟随这部分后端工作：

### 1. OAuth Device Flow

**`POST /open/api/v1/oauth/device/code`** — 申请设备码
- Body：`{ client_name: "supsub-cli" }`
- Response 200：
  ```json
  {
    "code": "device-code-string",
    "verification_uri": "https://supsub.com/device",
    "user_code": "ABCD-EFGH",
    "expires_in": 600,
    "interval": 2
  }
  ```

**`POST /open/api/v1/oauth/token`** — 轮询换 API Key
- Body：`{ grant_type: "device_code", client_id: "supsub-cli", code: "<device-code>" }`
- 用户尚未授权：`428` 或 `400 + { error: "authorization_pending" }`
- 轮询过快：`400 + { error: "slow_down" }`
- 设备码过期：`400 + { error: "expired_token" }`
- 用户授权完成：`200 + { api_key, client_id }`
  - `api_key` 形如 `sk_live_xxx`，**存在时效**（具体有效期由后端决定，建议 90 天左右），可在 web 端「设置」中查看与吊销；到期或被吊销后调用受保护接口会返回 401
  - `client_id` 为本次授权设备的标识，便于后端审计与吊销
  - CLI 不缓存过期时间，也不做自动续期；所有失效检测通过 401 响应触发

### 2. 用户授权页

**`GET /device`**（web 端新增页面）

支持 query string `?user_code=ABCD-EFGH` 预填，也支持空参访问后让用户手动输入 user_code。

**完整页面状态机**（必须覆盖未登录场景）：

| 当前状态 | 行为 |
|---------|------|
| **未登录** | 重定向到 `/login?redirect=/device?user_code=<原值>`。用户在登录页可选任意已支持登录方式（邮箱+密码、Google OAuth、未来新方式），登录成功后回到 `/device?user_code=<原值>` |
| **已登录，user_code 缺失** | 显示输入框让用户填写 user_code，提交后进入下一状态 |
| **已登录，user_code 无效或已过期** | 显示"授权码无效或已过期，请回到 CLI 重新执行 supsub auth login" |
| **已登录，user_code 有效** | 显示授权确认页：客户端名称（supsub-cli）、设备 UA、申请的权限范围、[拒绝] [允许并授权] 按钮 |
| **用户点"允许"** | 后端把 user_code 与当前用户绑定，生成 API Key，标记为 authorized；页面提示"授权完成，可关闭此页面回到 CLI" |
| **用户点"拒绝"** | 后端把 user_code 标记为 denied；CLI 端轮询时 `POST /open/api/v1/oauth/token` 返回 `400 + { error: "access_denied" }`，CLI 显示"用户拒绝授权"并退出 |

**关键设计点**：
- Device Flow 把"凭据获取"完全转移到浏览器，所以**任何 web 端支持的登录方式自动可用于 CLI**（邮箱、Google、未来 SSO），CLI 端无需任何适配
- 已登录态可被复用：用户在 web 已登录时再次 `supsub auth login` 跳过登录直接进授权确认页

### 3. API Key 管理（web 端补充）

**`GET /api/settings/api-keys`** — 列出当前用户的所有 API Key（含 client_id、创建时间、最后使用时间）

**`DELETE /api/settings/api-keys/{client_id}`** — 吊销某个 Key

> 这两个接口是为了让用户在 web 端能看到/管理已发放的 CLI Key，CLI v1 不必直接调用，但属于产品完整性必需。

### 4. 现有 API 兼容性

- 现有所有 `/api/*` 接口需要支持 `Authorization: Bearer <api_key>` 鉴权（与现有 accessToken 鉴权并存即可）
- 后端识别 `X-Client-ID` 头用于审计日志（非鉴权必需）

---

## 技术栈与设计原则

| 项 | 选择 | 理由 |
|----|------|------|
| 语言 | TypeScript 5+ | 类型安全；npm 生态丰富，复用现成库的成本低 |
| 运行时 | Bun 1.x | 自带 TS 转译、原生 fetch、`bun build --compile` 直接产出单二进制（覆盖 5 个平台），免去 Node + tsc + esbuild + pkg 组合 |
| CLI 框架 | commander.js | npm 生态最成熟的 CLI 框架，TS 类型完整，命令树 / flag / 子命令组织等价于 cobra |
| 表格渲染 | cli-table3 + 自定义 CJK 宽字符工具 | cli-table3 是 npm 生态最稳的 ASCII 表格库；CJK 字宽逻辑参考 getnote-cli 的 `internal/ui` 模式后用 TS 重写 |
| HTTP | 原生 fetch（Bun 内置） | 无需 axios/got；自封装薄客户端处理鉴权头、重试、错误归一 |
| 包管理 | Bun（`bun install`，锁文件 `bun.lock`） | 与运行时对齐；开发体验显著优于 npm/pnpm |
| 分发 | npm `@supsub/cli` + optionalDependencies 平台子包（5 个），子包内放 `bun build --compile` 产出的单二进制 | 与 esbuild、prettier、turbo 同模式；用户用 pnpm/npm/bun 安装时只下载匹配平台子包；**用户机器无需安装 Bun 运行时** |
| 全局标志 | `--api-url`、`-o table\|json`（默认 table）| 与 getnote-cli 一致 |
| 设计原则 | AI-Ready：所有命令支持 `-o json`，错误信息结构化，无交互式 prompt（除登录） | — |

---

## 命令清单

> 命名规范：单数名词（`note`/`sub`）= 单实体操作；复数名词（`notes`/`subs`）= 列表。但因 supsub 资源较多，本版统一用单数 + 子命令的层级结构（`supsub <resource> <action>`），更易扩展。

### auth — 认证
| 命令 | API | 说明 |
|------|-----|------|
| `supsub auth login` | `POST /open/api/v1/oauth/device/code` + 轮询 `POST /open/api/v1/oauth/token` | OAuth Device Flow：拿设备码 → 尝试用 `open`/`xdg-open`/`rundll32` 打开 verification URI → 显示 user_code 提示用户在浏览器授权 → 客户端按 `interval` 轮询直到拿到 `api_key` 与 `client_id`，写入配置 |
| `supsub auth login --api-key <key>` | 本地（仅写入配置） | 直接保存 API Key，跳过 OAuth（CI/脚本场景） |
| `supsub auth logout` | 本地 | 清空配置文件中的 api_key 与 client_id |
| `supsub auth status` | `GET /api/user/info` | 测试 API Key 有效性，显示当前邮箱与 client_id |

### sub — 订阅源
| 命令 | API | 说明 |
|------|-----|------|
| `supsub sub list [--type MP\|WEBSITE]` | `GET /api/subscriptions` | 列出我订阅的所有信息源（响应已含 unreadCount） |
| `supsub sub add --source-id <id> --type <MP\|WEBSITE> [--group <gid>...]` | `POST /api/subscriptions` | 订阅信息源（可指定分组） |
| `supsub sub remove --source-id <id> --type <MP\|WEBSITE>` | `DELETE /api/subscriptions` | 取消订阅 |
| `supsub sub contents --source-id <id> --type <MP\|WEBSITE> [--all\|--unread] [--page N]` | `GET /api/subscriptions/contents` | 列出某信息源的文章 |
| `supsub sub mark-read --source-id <id> --type <T> [--content-id <cid>\|--all]` | `POST /api/subscriptions/contents/mark-as-read` | 标记已读，不传 content-id 则标记全部 |

### group — 分组（完整 CRUD）
| 命令 | API | 说明 |
|------|-----|------|
| `supsub group list` | `GET /api/groups` | 列出所有分组 |
| `supsub group get <id>` | `GET /api/groups/{id}` | 分组详情 |
| `supsub group create <name>` | `POST /api/groups` | 创建分组 |
| `supsub group rename <id> <new-name>` | `PUT /api/groups/{id}` | 重命名 |
| `supsub group delete <id>` | `DELETE /api/groups/{id}` | 删除分组 |
| `supsub group reorder <id1>,<id2>,...` | `POST /api/groups/reorder` | 排序 |
| `supsub group subs <id> [--source-type <T>] [--group-only]` | `GET /api/groups/{id}/subscriptions` | 分组内订阅源 |
| `supsub group set-subs <id> --subs <type:id,type:id...>` | `POST /api/groups/{id}/subscriptions` | 批量更新分组成员 |

### focus — 关注点
| 命令 | API | 说明 |
|------|-----|------|
| `supsub focus list` | `GET /api/focuses` | 列出关注点（响应已含 unreadCount） |
| `supsub focus get <id>` | `GET /api/focuses/{id}` | 详情（含 rawContent） |
| `supsub focus create --title <t> [--raw-content <md>] [--icon <emoji>]` | `POST /api/focuses` | 直接创建（**非 SSE 对话路径**，传 title + 可选 rawContent） |
| `supsub focus update <id> [--title <t>] [--raw-content <md>] [--icon <e>] [--similarity 0.4-0.85]` | `PUT /api/focuses/{id}` | 修改 |
| `supsub focus delete <id>` | `DELETE /api/focuses/{id}` | 删除 |
| `supsub focus contents <id> [--all\|--unread] [--page N]` | `GET /api/focuses/{id}/contents` | 关注点聚合内容 |
| `supsub focus mark-read <id> [--source-type <T> --content-id <cid>]` | `POST /api/focuses/{id}/mark-as-read` | 标记已读 |

### mp — 微信公众号
| 命令 | API | 说明 |
|------|-----|------|
| `supsub mp list [--keywords <kw>] [--page N] [--page-size N]` | `GET /api/mps` | 列出我已添加的公众号 |
| `supsub mp add <mpId> [--group <gid>...]` | `POST /api/mps` | 添加公众号 |
| `supsub mp search <name>` | `POST /api/mps/search-tasks` + `GET /api/mps/search-tasks/{searchId}` | 发起任务后内部以 2s 间隔轮询，最长 30s。命中（finished:true 且有 mp）打印结果；超时则打印 searchId 并提示用 `supsub task <searchId>` 继续查询 |
| `supsub mp search-cancel <searchId>` | `DELETE /api/mps/search-tasks/{searchId}` | 取消任务 |
| `supsub task <searchId>` | `GET /api/mps/search-tasks/{searchId}` | 通用任务查询（v1 仅 mp 用），同时承担 `mp search` 30s 超时后的带外查询入口 |

**轮询超时硬上限 30s**（getnote-cli 是 80s，但 supsub 公众号搜索经验上更快；超时后明确告诉用户/agent 用 `supsub task <searchId>` 继续，避免无界等待）。对齐 getnote-cli：CLI 不暴露"立即返回 searchId"的异步模式，所有异步语义都收敛到带外的 `task` 命令。

### search — 全量搜索
| 命令 | API | 说明 |
|------|-----|------|
| `supsub search <keyword> [--type <MP\|WEBSITE>] [--page N]` | `GET /api/search` | 全量搜索信息源/内容 |

### user — 用户与计划
| 命令 | API | 说明 |
|------|-----|------|
| `supsub user info` | `GET /api/user/info` | 用户信息（响应含 opml URL，被 `supsub opml` 使用） |
| `supsub user plan` | `GET /api/user/plan` | 当前订阅计划 |

### opml — OPML 导出（取代所有单条 feed 命令）
| 命令 | API | 说明 |
|------|-----|------|
| `supsub opml [--output <file>] [--print-url]` | `GET /api/user/info` 拿 `opml` URL → HTTP GET 下载 | 默认下载 OPML 到 `supsub.opml`；`--output -` 输出到 stdout；`--print-url` 仅打印链接，不下载 |

> **后端无需新增接口**：`opml` 字段已在 `IUserInfo` 中（参见 `src/service/user.ts:50`、`src/components/nav-user.tsx:204`），下载触发参数 `?download=true` 也已支持。

### settings — 设置
| 命令 | API | 说明 |
|------|-----|------|
| `supsub settings feed-rotate` | `PUT /api/settings/feed` | 轮换 Feed Token（安全场景，唯一保留的 settings 命令） |

### 通用
| 命令 | 说明 |
|------|------|
| `supsub version [--check-update]` | 版本与更新检查（与 getnote-cli 一致） |
| `supsub --api-url <url>` | 全局标志：覆盖 API base URL（也可用 `SUPSUB_API_URL` 环境变量） |
| `supsub -o json\|table` | 全局标志：输出格式 |

---

## 认证与配置

### 配置文件
- 路径：`~/.supsub/config.json`
- 权限：文件 0600，目录 0700
- 格式：
  ```json
  {
    "api_key": "sk_live_xxx",
    "client_id": "cli_a1b2c3d4..."
  }
  ```
- 不缓存过期时间戳：API Key 到期/被吊销的情况由后端 401 响应驱动处理，本地无需维护额外状态

### API Key 优先级链（高到低）
1. `--api-key <key>` 命令行标志（仅本次调用，不持久化）
2. 环境变量 `SUPSUB_API_KEY`
3. `~/.supsub/config.json` 中的 `api_key`

### 请求头规范
```
Authorization: Bearer <api_key>
X-Client-ID: <client_id>          # 不存在时回落 "supsub-cli"
Content-Type: application/json
```

### 401 处理
API Key 具备时效性，401 统一视为 **Key 已过期 / 被吊销 / 无效**：
1. 清空配置中的 `api_key`、`client_id`（`~/.supsub/config.json` 其他字段保留）
2. 向 stderr 打印 `请运行 supsub auth login 重新登录`，`-o json` 模式按 §「输出格式」包装为 `{ code: "UNAUTHORIZED", message: "..." }`
3. 退出码 2

### OAuth Device Flow 实现要点
- 设备码请求：`POST /open/api/v1/oauth/device/code`，body 含 `client_name: "supsub-cli"`、`scope`（按后端约定）
- 响应字段：`code`（设备码）、`verification_uri`（用户授权页 URL）、`user_code`（人类可读，建议带分隔符如 `ABCD-EFGH`）、`expires_in`（设备码有效期，秒）、`interval`（轮询间隔，秒）
- 用户提示：终端打印 `请在浏览器打开 <verification_uri> 并输入授权码：<user_code>`，并尝试自动打开浏览器（失败不阻塞）
- 轮询：每 `interval` 秒调一次 `POST /open/api/v1/oauth/token`，body `{ grant_type: "device_code", client_id: "supsub-cli", code }`，直到：
  - `200 + { api_key, client_id }`：成功；把 `api_key` 与 `client_id` 写入配置；登录成功仅提示 `✅ 登录成功`，不展示/缓存过期时间
  - `pending`/`slow_down`：继续等
  - 超过 `expires_in`：报错 `设备码已过期，请重新运行 supsub auth login`

---

## 输出格式

完全沿用 getnote-cli 的两种模式：

### `-o table`（默认）
- 用 `internal/ui` 工具自定义渲染（支持 CJK 宽字符截断、`PrintHeader`、`PrintRow`、`DividerLine`）
- 列宽固定，超长字段以 `…` 截断
- 列表末尾打印 `(N items)` 计数

### `-o json`
- 包装 `{ "success": true, "data": <api-response> }`
- 出错时 `{ "success": false, "error": { "code": "<string>", "message": "...", "status": <int> } }`
  - `code`、`message`、`status` 透传后端 `ErrorResponse`
  - 本地错误（网络超时、本地 Key 过期等无 HTTP 响应的情形）由 CLI 合成，`code` 使用约定值：`NETWORK_ERROR`、`UNAUTHORIZED`、`INVALID_ARGS`
- 缩进 2 空格，便于 jq 处理

---

## 错误处理

所有响应错误体均遵循 api.json 中的 `ErrorResponse` 结构：`{ code: string, message: string, status: integer, data?: object }`。CLI 依据 `status` 与 `code` 做路由：

| 场景 | 识别条件 | 退出码 | 行为 |
|------|---------|--------|------|
| 成功 | HTTP 2xx | 0 | — |
| 一般业务失败 | HTTP 4xx（排除 401/403-plan-expired） | 1 | 打印 `message` |
| 认证失效 | HTTP 401 | 2 | 清空 `api_key` / `client_id`，提示 `请运行 supsub auth login` |
| 订阅计划过期 | `code === "SUBSCRIPTION_PLAN_EXPIRED"`（通常 `status: 403`） | 3 | 提示 `当前操作需要更高订阅计划，前往 https://supsub.com/order 升级` |
| 网络/超时 | 本地连接错误或 http client 超时 | 10 | 提示稍后重试 |
| 5xx 服务端错误 | HTTP 5xx | 11 | 打印 `message`（若后端未返回结构化错误则打印 `服务器错误，请稍后再试`） |
| 无效参数 | cobra 校验失败 | 64 | cobra 自动处理 |

---

## 分发与安装

**约束**：源码非开源，但 CLI 需通过 npm 公开分发。**采用 npm `optionalDependencies` + 平台子包方案**（与 esbuild、prettier 同模式），零自建基础设施、不暴露源码、用户体验顺畅。

### 构建与发布

1. **构建脚本** 用 `bun build --compile --target=<target> ./src/index.ts --outfile dist/<platform>/supsub` 交叉编译为 5 个平台单二进制：
   - `bun-darwin-x64`（darwin/amd64）
   - `bun-darwin-arm64`（darwin/arm64）
   - `bun-linux-x64`（linux/amd64）
   - `bun-linux-arm64`（linux/arm64）
   - `bun-windows-x64`（windows/amd64，输出 `supsub.exe`）
2. CI 同步发布 6 个 npm 包（1 主包 + 5 平台子包），版本号统一
3. 发布权限：仅维护者（用 npm token）

### 用户安装命令（README 首选 pnpm）

```bash
pnpm add -g @supsub/cli              # 用户偏好 pnpm
# 或
npm i -g @supsub/cli
```

---

## 自检与静默自更新

**核心原则**：用户感知不到升级动作。前台命令照常返回结果，更新动作完全在后台异步完成，下次启动已是新版。

### 检查源
`https://registry.npmjs.org/@supsub/cli/latest` — npm registry 公开元数据接口，无需鉴权、零成本。

### 流程
```
CLI 启动
  ↓
读取 ~/.supsub/update-check.json
  ↓
缓存内 checked_at 在 24h 内？
  ├─ 是 → 跳过更新逻辑，直接执行用户命令
  └─ 否 ↓
fork 一个 detached 子进程，主进程继续执行用户命令（不阻塞）
  ↓ (子进程内)
GET https://registry.npmjs.org/@supsub/cli/latest 拿 latest_version
  ├─ 与当前版本一致 → 写缓存（更新 checked_at），退出
  └─ 有新版 ↓
执行 `bun add -g` / `pnpm add -g` / `npm i -g` @supsub/cli@latest（自动检测 bun/pnpm/npm 顺序使用第一个可用的）
  ├─ 成功 → 写缓存，静默退出
  └─ 失败（无权限/无网/包管理器缺失）→ 静默退出（不写缓存，下次启动再试）
```

### 关键设计点
- **不阻塞前台命令**：detached 子进程，主流程不等待
- **失败完全静默**：所有错误都吞掉，stderr 也不打印
- **`-o json` 模式与无人值守场景同样适用**：不向 stdout/stderr 写任何升级相关内容
- **包管理器探测顺序**：`bun` → `pnpm` → `npm`（bun 与本项目运行时对齐优先；都没装则放弃自更新）
- **写权限失败不重试**：如果用户用 `sudo npm i -g` 装的，CLI 自更新会因权限拒绝；此时静默吞掉、下次启动重试是无害的；用户最终会手动升一次，之后就走顺了
- **环境变量逃生口**：`SUPSUB_NO_AUTO_UPDATE=1` 完全禁用自更新（CI/沙箱场景）

### 缓存文件
路径：`~/.supsub/update-check.json`
格式：
```json
{
  "checked_at": 1729400000,
  "current_version": "1.0.0",
  "latest_version": "1.0.0"
}
```

### 命令
| 命令 | 行为 |
|------|------|
| `supsub version` | 打印当前版本（含 git commit hash，编译时 ldflags 注入） |
| `supsub version --check-update` | 同步检查 npm registry，打印对比结果，**不触发自更新** |

---

## 关键文件参考（实施时需读取）

> getnote-cli 系列条目是 **架构与模式参考**（Go 实现），实现时按 TypeScript + Bun 重写：HTTP 客户端、配置单例、CJK 表格渲染、OAuth Device Flow 轮询、postinstall 平台子包选择等结构均可对照迁移。

| 用途 | 路径 |
|------|------|
| getnote-cli 整体架构参考 | `/Users/han/coding-agent-workspace/getnote-cli/` |
| getnote-cli 根命令模板 | `/Users/han/coding-agent-workspace/getnote-cli/cmd/root.go` |
| getnote-cli 认证模板（OAuth Device Flow，supsub 不用，但 token 持久化部分可参考） | `/Users/han/coding-agent-workspace/getnote-cli/cmd/auth/auth.go` |
| getnote-cli HTTP 客户端封装（含重试、泛型 doGet/doPost） | `/Users/han/coding-agent-workspace/getnote-cli/internal/client/client.go` |
| getnote-cli 配置单例 | `/Users/han/coding-agent-workspace/getnote-cli/internal/config/config.go` |
| getnote-cli UI 工具（CJK 宽字符） | `/Users/han/coding-agent-workspace/getnote-cli/internal/ui/ui.go` |
| getnote-cli 异步任务轮询样例 | `/Users/han/coding-agent-workspace/getnote-cli/cmd/save/save.go`（`pollTask` 函数） |
| getnote-cli postinstall 脚本 | `/Users/han/coding-agent-workspace/getnote-cli/scripts/postinstall.js` |
| supsub OpenAPI 规范 | `/Users/han/Code/supsub-website/api.json` |
| supsub web 端 HTTP 客户端（请求路径与错误结构参考，**401 自动刷新逻辑不需要**） | `/Users/han/Code/supsub-website/src/lib/request.ts` |
| supsub 订阅 service（API 路径与参数结构） | `/Users/han/Code/supsub-website/src/service/subscriptions.ts` |
| supsub 关注点 service（API 路径与参数结构） | `/Users/han/Code/supsub-website/src/service/focus.ts` |
| supsub 公众号 service（含异步任务返回结构） | `/Users/han/Code/supsub-website/src/service/mp.ts` |
| supsub 用户 service（`opml` 字段位置） | `/Users/han/Code/supsub-website/src/service/user.ts` |
| supsub OPML 下载触发参数 `?download=true` 参考 | `/Users/han/Code/supsub-website/src/components/nav-user.tsx`（行 134-240） |

---

## 验证方式

1. **OAuth Device Flow 闭环**：`supsub auth login` 打印 user_code 与 verification_uri → 浏览器中授权 → CLI 自动跳出，`~/.supsub/config.json` 写入 api_key 与 client_id → `supsub auth status` 返回当前邮箱
2. **API Key 直接登录**：`supsub auth login --api-key sk_live_xxx` → `supsub auth status` 成功
3. **订阅闭环**：`supsub sub list` → 选一个 sourceId → `supsub sub contents` → `supsub sub mark-read --all`
4. **分组闭环**：`supsub group create "科技"` → `supsub group set-subs <gid> --subs MP:123,WEBSITE:456` → `supsub group subs <gid>` 看到成员 → `supsub group delete <gid>`
5. **关注点闭环**：`supsub focus create --title "AI" --raw-content "..."` → `supsub focus list` 看到新条目 → `supsub focus contents <id>` → `supsub focus delete <id>`
6. **公众号搜索**：
   - 常规：`supsub mp search "晚点 LatePost"` 在 30s 内返回 mp 信息
   - 超时兜底：超过 30s 时 CLI 输出 searchId 并退出，用 `supsub task <searchId>` 继续查询直到 finished
7. **OPML 导出**：`supsub opml` → 生成 `supsub.opml` → 用 newsboat / Feedly 等导入验证可读；`supsub opml --print-url` 输出链接
8. **API Key 失效处理**：手动把 `api_key` 改为无效值（或等待服务端过期/吊销）→ 任一命令返回退出码 2 + 提示重新登录，且 `~/.supsub/config.json` 中的 `api_key` / `client_id` 被清空
9. **`-o json` 可被 jq 解析**：`supsub sub list -o json | jq '.data[].name'`
10. **多平台安装链路**：分别在 macOS arm64 / macOS x64 / Linux x64 三台机器执行 `pnpm add -g @supsub/cli`，npm 仅下载匹配平台子包；执行 `supsub version` 输出预期版本
11. **静默自更新**：发布高版本 → 在装着低版本的机器上运行任一命令 → 主输出无任何升级痕迹 → 等待几秒后检查下次启动时已变成新版；24h 内重复执行不重复触发（确认缓存生效）；`SUPSUB_NO_AUTO_UPDATE=1` 时完全跳过
