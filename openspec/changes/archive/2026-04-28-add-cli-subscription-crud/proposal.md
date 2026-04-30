# add-cli-subscription-crud

## Why

订阅管理是 cli 的核心读写场景，对应 PRD §「sub」表与 api.json 的 `/api/subscriptions` 系列。完成 auth 之后，cli-dev 需要落地 5 条命令，使「列出订阅 → 看文章 → 标已读」的闭环能在 mock 上跑通，并且字段、参数完全对得上后端。

## What Changes

新增 5 条命令，全部对一对一映射 api.json：

| 命令 | API |
|---|---|
| `supsub sub list [--type MP\|WEBSITE]` | `GET /api/subscriptions` |
| `supsub sub add --source-id <id> --type <T> [--group <gid>...]` | `POST /api/subscriptions` |
| `supsub sub remove --source-id <id> --type <T>` | `DELETE /api/subscriptions` |
| `supsub sub contents --source-id <id> --type <T> [--all\|--unread] [--page N]` | `GET /api/subscriptions/contents` |
| `supsub sub mark-read --source-id <id> --type <T> [--content-id <cid>\|--all]` | `POST /api/subscriptions/contents/mark-as-read` |

约束：
- `--type` 仅接 `MP` / `WEBSITE`（大写），不一致拒绝并 `INVALID_ARGS`
- `--source-id` 当作字符串透传（与 api.json example 一致，不强制 number）
- `sub contents` 默认 `--unread`，`--all` 与 `--unread` 互斥
- `sub mark-read` 二选一：`--content-id <cid>` 单篇标记 / `--all` 全源标记；都不给报 INVALID_ARGS
- `--page` 默认 1，pageSize 固定 20

## Impact

- Affected specs: cli-subscription（首次新增）
- Affected code:
  - `packages/cli/src/commands/sub/{list,add,remove,contents,mark-read}.ts`（新建）
  - `packages/cli/src/index.ts`（注册 `sub` 子命令树）
  - `packages/cli/src/lib/types.ts`（新增 `Subscription`、`Article` 类型）
- Breaking? no
