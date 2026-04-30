# Tasks: add-cli-subscription-crud

> 前置：add-cli-auth-device-flow 已完成（http client、resolveApiKey 可用）。本 change 全部针对 `packages/cli/src/commands/sub/` 与类型定义。

## 1. 类型 & helper
- [x] 1.1 在 `packages/cli/src/lib/types.ts` 新增 `Subscription`、`Article` 类型（按 design.md §1）
- [x] 1.2 新建 `packages/cli/src/commands/sub/_args.ts`：导出 `normalizeType(input)`、`requireExclusive(opts, keys)` helper
- [x] 1.3 新建 `packages/cli/src/ui/output.ts`：导出 `output<T>(data, format, renderTable)` helper

## 2. sub list
- [x] 2.1 新建 `packages/cli/src/commands/sub/list.ts`：注册 `list` 子命令，`--type <type>` 可选
- [x] 2.2 实现 action：调 `GET /api/subscriptions?sourceType=<可选>`
- [x] 2.3 表格渲染：列 `sourceId`/`type`/`name`/`unread`/`description`，CJK 截断
- [x] 2.4 末尾打印 `(N items)`，空数组打印 `(empty)`

## 3. sub add
- [x] 3.1 新建 `commands/sub/add.ts`：必选 `--source-id <id>`、`--type <type>`；可选 `--group <gid...>` 接受多次出现，归一为 string[]）
- [x] 3.2 调 `POST /api/subscriptions`，body `{ sourceType, sourceId, groupIds: gids?.map(Number) }`（groupIds 转 number 数组，符合 api.json schema）
- [x] 3.3 输出 `{ success: true, data: { message } }` / 表格仅打印 `message`

## 4. sub remove
- [x] 4.1 新建 `commands/sub/remove.ts`：必选 `--source-id`、`--type`
- [x] 4.2 调 `DELETE /api/subscriptions` body `{ sourceType, sourceId }`
- [x] 4.3 输出同 sub add

## 5. sub contents
- [x] 5.1 新建 `commands/sub/contents.ts`：必选 `--source-id`、`--type`；可选 `--all`、`--unread`（互斥，默认 unread）；可选 `--page <n>` 默认 1
- [x] 5.2 校验 `--all`/`--unread` 互斥
- [x] 5.3 调 `GET /api/subscriptions/contents?sourceType=&sourceId=&type=&page=&pageSize=20`
- [x] 5.4 表格列：`publishedAt`(格式化)/`isRead`(✓ or 空)/`title`/`articleId`/`url`(取 `https?://(.+?)/...` 主机名)
- [x] 5.5 末尾打印 `(N items, page <p>)`

## 6. sub mark-read
- [x] 6.1 新建 `commands/sub/mark-read.ts`：必选 `--source-id`、`--type`；二选一 `--content-id <cid>` / `--all`
- [x] 6.2 校验互斥与必填；缺则抛 INVALID_ARGS
- [x] 6.3 调 `POST /api/subscriptions/contents/mark-as-read` body `{ sourceType, sourceId, contentId? }`
- [x] 6.4 后端响应 204 → cli 输出 `{success:true,data:{message:"已标记为已读"}}` / 表格打印 `已标记为已读`

## 7. 注册子命令树
- [x] 7.1 在 `packages/cli/src/index.ts` 新建 `sub` 子命令组：`const sub = program.command("sub").description("订阅源管理")`，依次调 `registerSubList(sub)` 等

## 8. 验收（mock server 起着）
- [x] 8.1 `supsub --api-url http://localhost:8787 sub list -o json | jq -e 'length>=8'` 通过（5 MP + 3 WEBSITE）
- [x] 8.2 `supsub --api-url http://localhost:8787 sub list --type MP` 仅显示 5 条 MP
- [x] 8.3 `supsub --api-url http://localhost:8787 sub list --type FOO` → 退出码 64、stderr 提示 `仅支持 MP 或 WEBSITE`
- [x] 8.4 `supsub --api-url http://localhost:8787 sub contents --source-id mp_42 --type MP -o json | jq '.data | length'` ≥ 1
- [x] 8.5 `supsub --api-url http://localhost:8787 sub mark-read --source-id mp_42 --type MP --content-id <第一篇 articleId>` → 再次 `sub list --type MP` 显示 `mp_42` 的 unread 减 1
- [x] 8.6 `supsub --api-url http://localhost:8787 sub mark-read --source-id mp_42 --type MP --all` → `sub list --type MP` 显示 `mp_42.unread = 0`
- [x] 8.7 `supsub --api-url http://localhost:8787 sub contents --source-id mp_42 --type MP --all --unread` → 退出码 64
- [x] 8.8 `supsub --api-url http://localhost:8787 sub mark-read --source-id mp_42 --type MP`（未传 content-id 也未传 all） → 退出码 64
- [x] 8.9 把 api_key 改坏后跑 `sub list` → 退出码 2、配置文件 api_key 被清空
