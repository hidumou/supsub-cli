---
name: supsub-sub
version: 0.1.0
description: SupSub 订阅管理 —— 列出 / 添加 / 删除订阅源（微信公众号 MP 或网站 WEBSITE），以及浏览某个已订阅源里的文章列表。匹配「列出我的订阅」「我订阅了哪些」「取消订阅 X」「订阅 X 这个公众号 / 网站」「看 X 订阅里有哪些文章」「X 公众号最近的未读文章」「添加 / 删除订阅源」。⚠️ 不用于跨订阅搜索文章关键词（走 supsub-search），也不用于「发现一个新的公众号」（走 supsub-mp）。
---

# supsub-sub Skill

List, add, remove subscription sources, and browse the articles inside each source. Sources are typed `MP` (微信公众号) or `WEBSITE`.

## Prerequisites

- 安装：`pnpm add -g @supsub/cli`（或 `npm i -g @supsub/cli`）
- 已登录：`supsub auth status` 显示 Authenticated（首次使用先 `supsub auth login`）

## Commands

### List subscriptions

```
supsub sub list [--type <MP|WEBSITE>]
```

| Flag | Default | Description |
|------|---------|-------------|
| `--type` | — (all) | Filter by source type, `MP` 或 `WEBSITE` |

Each row includes: `sourceId`, `sourceType`, `name`, `img`, `description`, `unreadCount`.

```bash
# 列出全部订阅
supsub sub list

# 仅看公众号
supsub sub list --type MP

# 仅看网站
supsub sub list --type WEBSITE

# 导出 JSON
supsub sub list -o json
```

JSON shape: `{"success":true,"data":[{"sourceType":"MP","sourceId":12345,"name":"...","img":"...","description":"...","unreadCount":3}, ...]}`

---

### Add a subscription

`sub add` 有两条互斥入口，对应两种"拿到的 ID 形态"：

```
# A) 全局搜索 / 已收录源 → 用内部正整数 sourceId
supsub sub add --source-id <id> --type <MP|WEBSITE> [--group <gid>]...

# B) mp search 发现的微信原生公众号 → 用 base64 字符串 mpId
supsub sub add --mp-id <mpId> [--type MP] [--group <gid>]...
```

| Flag | Required | Description |
|------|----------|-------------|
| `--source-id` | 二选一 | 信息源 ID（正整数）。来自 `supsub search` / `supsub sub list` 的 `sourceId` |
| `--mp-id` | 二选一 | 公众号 mpId（base64 字符串）。来自 `supsub mp search` 返回结果 |
| `--type` | 见说明 | `--source-id` 模式必填；`--mp-id` 模式可省，传了必须是 `MP` |
| `--group` | no | 分组 ID（数字，可重复指定多个） |

> **互斥**：`--source-id` 与 `--mp-id` 必须恰好二选一。同时给 / 都不给都会抛 `INVALID_ARGS`。
>
> 两条路径走的是不同 endpoint：`--source-id` → `POST /api/subscriptions`（已收录源订阅）；`--mp-id` → `POST /api/mps`（按微信原生 ID 把新公众号纳入并订阅）。

```bash
# 路径 A：sub list / search 看到的内部 sourceId
supsub sub add --source-id 12345 --type MP

# 路径 A：网站 + 多分组
supsub sub add --source-id 67890 --type WEBSITE --group 1 --group 2

# 路径 B：mp search 拿到的 mpId（base64）
supsub sub add --mp-id "MzkyNTYzODk0NQ=="

# 路径 B + 分组
supsub sub add --mp-id "MzkyNTYzODk0NQ==" --group 3

# JSON 输出
supsub sub add --source-id 12345 --type MP -o json
```

JSON shape: `{"success":true,"data":{"message":"..."}}`

> `--source-id` 必须是正整数（非数字 → `INVALID_ARGS`）；`--mp-id` 是字符串，不做格式校验，由后端裁决；`--group` 接受多个数字 ID，非数字会报 `INVALID_ARGS` (exit 64)。

---

### Remove a subscription

```
supsub sub remove --source-id <id> --type <MP|WEBSITE>
```

| Flag | Required | Description |
|------|----------|-------------|
| `--source-id` | yes | 信息源 ID（正整数） |
| `--type` | yes | `MP` 或 `WEBSITE` |

```bash
supsub sub remove --source-id 12345 --type MP
supsub sub remove --source-id 67890 --type WEBSITE -o json
```

JSON shape: `{"success":true,"data":{"message":"..."}}`

---

### Browse articles in a subscription

```
supsub sub contents --source-id <id> --type <MP|WEBSITE> [--unread | --all]
```

| Flag | Default | Description |
|------|---------|-------------|
| `--source-id` | required | 信息源 ID（正整数） |
| `--type` | required | `MP` 或 `WEBSITE` |
| `--unread` | (default) | 仅返回未读文章 |
| `--all` | — | 返回全部文章（已读 + 未读） |

> ⚠️ `--unread` 与 `--all` **互斥**：同时指定会抛 `INVALID_ARGS`。不传任何一个时，默认行为等价于 `--unread`。

每行字段：`articleId`, `url`, `title`, `coverImage`, `tags[]`, `summary`, `publishedAt`, `isRead`。

```bash
# 默认（未读）
supsub sub contents --source-id 12345 --type MP

# 全部文章（含已读）
supsub sub contents --source-id 12345 --type MP --all

# 全部文章 + JSON
supsub sub contents --source-id 12345 --type MP --all -o json
```

JSON shape: `{"success":true,"data":[{"articleId":"...","url":"...","title":"...","coverImage":"...","tags":[...],"summary":"...","publishedAt":<timestamp 或字符串>,"isRead":false}, ...]}`

> 注意 `publishedAt` 可能是 Unix 秒级时间戳（数字）或 `"YYYY-MM-DD HH:mm:ss"` 字符串，取决于后端版本，调用方需兼容两种类型。

---

## Agent Usage Notes

- 解析数据时统一用 `-o json`；表格输出有截断、列宽限制，不适合做下游处理。
- 所有 JSON 响应都是 `{"success":true,"data":<payload>}` 结构（来自 `src/ui/output.ts`）。
- `--type` 取值是 `MP` 或 `WEBSITE`（CLI 内部会 `toUpperCase`）；常见错误是写成 `mp` 大小写虽允许，但写 `mp_account` / `wechat` / `rss` 会报 `INVALID_ARGS`。
- 添加订阅前先想清楚 ID 来源：
  - 来自 `supsub search` / `sub list` 的 **内部正整数** `sourceId` → `sub add --source-id <id> --type ...`
  - 来自 `supsub mp search` 的 **base64 字符串** `mpId` → `sub add --mp-id <mpId>`（type 默认 MP，可省）
  - 不要把 `mp search` 的 `mpId` 强转成数字塞进 `--source-id` —— 那是不同 ID 空间，会被后端拒。
- `sub contents` 默认只看未读 —— 如果用户问"这个公众号有哪些文章"通常意味着 `--all`。
- `sub contents` 一次最多返回 20 条文章（后端默认 `pageSize=20`），CLI 不支持翻页；想看更早的历史目前没有 CLI 命令可达。
- Exit codes：`0` OK，`2` UNAUTHORIZED，`64` INVALID_ARGS（`--type` / `--source-id` / `--group` 校验失败、`--all` 与 `--unread` 互斥），其他网络/服务端错误 `10` / `11`。
