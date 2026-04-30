---
name: supsub-sub
version: 0.1.0
description: Manage subscription sources (公众号 / 网站) and browse their articles via the SupSub CLI
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

```
supsub sub add --source-id <id> --type <MP|WEBSITE> [--group <gid>]...
```

| Flag | Required | Description |
|------|----------|-------------|
| `--source-id` | yes | 信息源 ID（正整数） |
| `--type` | yes | `MP` 或 `WEBSITE`（大小写不敏感） |
| `--group` | no | 分组 ID（数字，可重复指定多个） |

```bash
# 订阅一个公众号
supsub sub add --source-id 12345 --type MP

# 订阅网站，并放进 2 个分组
supsub sub add --source-id 67890 --type WEBSITE --group 1 --group 2

# JSON 输出
supsub sub add --source-id 12345 --type MP -o json
```

JSON shape: `{"success":true,"data":{"message":"..."}}`

> `--source-id` 必须是正整数，`--group` 接受多个数字 ID。两者都校验非数字会报 `INVALID_ARGS` (exit 64)。

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
supsub sub contents --source-id <id> --type <MP|WEBSITE> [--unread | --all] [--page <n>]
```

| Flag | Default | Description |
|------|---------|-------------|
| `--source-id` | required | 信息源 ID（正整数） |
| `--type` | required | `MP` 或 `WEBSITE` |
| `--unread` | (default) | 仅返回未读文章 |
| `--all` | — | 返回全部文章（已读 + 未读） |
| `--page` | `1` | 页码（每页 20 条） |

> ⚠️ `--unread` 与 `--all` **互斥**：同时指定会抛 `INVALID_ARGS`。不传任何一个时，默认行为等价于 `--unread`。

每行字段：`articleId`, `url`, `title`, `coverImage`, `tags[]`, `summary`, `publishedAt`, `isRead`。

```bash
# 默认（未读，第 1 页）
supsub sub contents --source-id 12345 --type MP

# 全部文章（含已读）
supsub sub contents --source-id 12345 --type MP --all

# 翻页
supsub sub contents --source-id 12345 --type MP --page 2

# 第 2 页所有文章 + JSON
supsub sub contents --source-id 12345 --type MP --all --page 2 -o json
```

JSON shape: `{"success":true,"data":[{"articleId":"...","url":"...","title":"...","coverImage":"...","tags":[...],"summary":"...","publishedAt":<timestamp 或字符串>,"isRead":false}, ...]}`

> 注意 `publishedAt` 可能是 Unix 秒级时间戳（数字）或 `"YYYY-MM-DD HH:mm:ss"` 字符串，取决于后端版本，调用方需兼容两种类型。

---

## Agent Usage Notes

- 解析数据时统一用 `-o json`；表格输出有截断、列宽限制，不适合做下游处理。
- 所有 JSON 响应都是 `{"success":true,"data":<payload>}` 结构（来自 `src/ui/output.ts`）。
- `--type` 取值是 `MP` 或 `WEBSITE`（CLI 内部会 `toUpperCase`）；常见错误是写成 `mp` 大小写虽允许，但写 `mp_account` / `wechat` / `rss` 会报 `INVALID_ARGS`。
- 添加订阅前要先确认 `sourceId`：公众号通过 `supsub mp search <name>` 获得 `mpId`，订阅源 / 文章可通过 `supsub search <keyword>` 搜出来。
- `sub contents` 默认只看未读 —— 如果用户问"这个公众号有哪些文章"通常意味着 `--all`。
- 列表是分页的（每页 20 条）；如果用户要全部历史，需要循环 `--page` 直到返回空数组。
- Exit codes：`0` OK，`2` UNAUTHORIZED，`64` INVALID_ARGS（`--type` / `--source-id` / `--group` 校验失败、`--all` 与 `--unread` 互斥），其他网络/服务端错误 `10` / `11`。
