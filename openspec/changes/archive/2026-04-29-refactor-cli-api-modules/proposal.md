# Proposal: refactor-cli-api-modules

## Why

当前 9 个命令文件（`commands/search.ts`、`commands/task.ts`、`commands/auth/status.ts`、`commands/sub/{list,add,remove,contents,mark-read}.ts`、`commands/mp/{search,search-cancel}.ts`）都直接 `import { request } from "../http/client.ts"`，并各自写出 10 行左右的 inline `request<T>({ method, path, apiUrl, apiKey, clientId, query, body })` 调用。

这种写法有三个问题：

1. **路径与命令耦合**：`/api/subscriptions`、`/api/mps/search-tasks/{id}` 这些 endpoint 字面量散在 commands 各处，后端改路径必须 grep 全仓库改多处。
2. **响应类型分散**：`SearchResponse`、`MpSearchTaskResult`、`Subscription[]` 这些类型由各命令自己 import + 自己作为 `request<T>` 的泛型参数，没有一个权威的"这个 endpoint 返回什么"的来源。
3. **参考实现是相反的**：`getnote-cli/internal/client/client.go` 把全部 endpoint 集中在 `Client` struct 上，命令侧只调 `client.NoteList(params)` 一行；supsub-cli 当前等于跳过了这层封装。

## What Changes

新增 `packages/cli/src/api/` 目录，按 domain 拆分薄封装：

```
src/api/
├── _ctx.ts          # ApiCtx 类型 + buildCtx(globalOpts) 辅助
├── auth.ts          # getUserInfo(ctx)
├── search.ts        # searchAll(ctx, params)
├── subscription.ts  # listSubs / addSub / removeSub / getContents / markAsRead
└── mp.ts            # createSearchTask / getSearchTask / cancelSearchTask
```

- 每个函数内部仍调用 `http/client.ts` 的 `request<T>()`，所以 401/网络异常/ErrorEnvelope 解析全部继承不变
- 9 个命令文件改为 `import { listSubs } from "../api/subscription.ts"` 等，删除 inline `request<T>` 调用
- 类型从 `lib/types.ts` 移到对应 api 模块（subscription 类型住进 `api/subscription.ts`），就近收敛
- `http/client.ts`、`http/credentials.ts` 不动（`request<T>` 是 `doRequest` 等价物，继续作为底层）

新增一条 architecture Requirement："命令文件 SHALL NOT 直接 import `http/client.ts`；所有业务 endpoint MUST 通过 `api/<domain>.ts` 模块发起"。

## Impact

- **新增**：5 个 api/ 文件
- **修改**：9 个命令文件（删 inline request、改 import）
- **不变**：`http/client.ts`、`http/credentials.ts`、所有测试（HTTP 层接口未变，fetch mock 仍生效）
- **依赖**：无新增
- **兼容性**：完全向后兼容——CLI 对外 UX、对后端的请求签名 0 改动
