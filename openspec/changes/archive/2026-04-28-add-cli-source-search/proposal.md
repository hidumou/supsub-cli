# add-cli-source-search

## Why

Search 是 cli 的另一类核心读场景，对应 PRD §「search」与「mp」表。两条命令风格不同：

- `supsub search` 是同步的全量搜索（一次 HTTP 拿结果）
- `supsub mp search` 是异步任务（创建 → 轮询 → 拿结果），需要在 cli 内做 30s 同步轮询的封装，并提供 `--async` 与 `task` 命令把异步外露给 agent 自行编排

把这两条命令合在一个 change 里，是因为它们共享同一个搜索心智，但实现路径不同；通过两个独立 capability spec（cli-search、cli-mp-search）划分边界。

## What Changes

新增命令：

| 命令 | API | 模式 |
|---|---|---|
| `supsub search <keyword> [--type <T>] [--page N]` | `GET /api/search` | 同步 |
| `supsub mp search <name>` | `POST /api/mps/search-tasks` + `GET /api/mps/search-tasks/:id`（cli 内轮询） | 同步包装异步，30s 上限 |
| `supsub mp search <name> --async` | `POST /api/mps/search-tasks` | 立即返回 searchId |
| `supsub mp search-cancel <searchId>` | `DELETE /api/mps/search-tasks/:id` | — |
| `supsub task <searchId>` | `GET /api/mps/search-tasks/:id` | — |

约束：
- `supsub search` 的 `--type` 取值 `ALL | MP | WEBSITE | CONTENT`（默认 ALL），归一为大写
- 同步模式轮询：固定 2s interval、最长 30s（即 ≤ 15 次 GET）；超时打印 searchId 与下一步指引
- `task` 命令仅查询；不重试、不轮询

## Impact

- Affected specs: cli-search、cli-mp-search（首次新增）
- Affected code:
  - `packages/cli/src/commands/search.ts`
  - `packages/cli/src/commands/mp/{search,search-cancel}.ts`
  - `packages/cli/src/commands/task.ts`
  - `packages/cli/src/index.ts` 注册命令
  - `packages/cli/src/lib/types.ts` 新增 `SearchResultItem`、`MpSearchTaskResult` 类型
- Breaking? no
