# Tasks: add-cli-source-search

> 前置：add-cli-auth-device-flow 完成、mock server 起着。

## 1. 类型 & helper
- [x] 1.1 在 `packages/cli/src/lib/types.ts` 新增 `SearchResultItem`、`SearchResponse`、`MpSearchTaskResult`、`SourceBasic`、`ContentBasic`
- [x] 1.2 新建 `packages/cli/src/lib/sleep.ts`：`export const sleep = (ms) => new Promise(r => setTimeout(r, ms))`

## 2. supsub search
- [x] 2.1 新建 `packages/cli/src/commands/search.ts`：参数 `<keyword>`，可选 `--type <T>` 默认 `ALL`、`--page <n>` 默认 1
- [x] 2.2 校验 `--type` ∈ {ALL, MP, WEBSITE, CONTENT}（大写归一），不合法 → INVALID_ARGS
- [x] 2.3 调 `GET /api/search?type=&keywords=&page=&pageSize=10`
- [x] 2.4 表格输出按 design.md §7：`Results` 表 + 若有则 `Recommendations` 表；`-o json` 透传整个响应
- [x] 2.5 注册到 program 根：`program.command("search <keyword>").description("全量搜索")`

## 3. supsub mp search（同步）
- [x] 3.1 新建 `packages/cli/src/commands/mp/search.ts`：参数 `<name>`，可选 `--async`
- [x] 3.2 不带 `--async`：先 POST 拿 searchId，进入轮询循环（2s interval × ≤15 次）；finished+mp → 渲染；finished+!mp → 退出码 1 提示未找到；超时 → 退出码 1 提示「可继续 supsub task <id>」
- [x] 3.3 带 `--async`：仅 POST 创建，输出 `{searchId, hint}`；退出码 0
- [x] 3.4 在每轮 GET 之前 `sleep(intervalMs)`，避免在创建后立即 200ms 内查询触发后端 not-yet-ready 抖动
- [x] 3.5 -o json 模式下，轮询期间**禁止**向 stdout 写任何中间状态

## 4. supsub mp search-cancel
- [x] 4.1 新建 `packages/cli/src/commands/mp/search-cancel.ts`：参数 `<searchId>`
- [x] 4.2 调 DELETE；204 → success；404 → 退出码 1 + stderr `任务不存在或已取消`

## 5. supsub task
- [x] 5.1 新建 `packages/cli/src/commands/task.ts`：参数 `<searchId>`
- [x] 5.2 调 GET 单次；按 design.md §6 三分支输出
- [x] 5.3 finished:false 时退出码仍为 0（任务状态合法）

## 6. 注册命令树
- [x] 6.1 在 `packages/cli/src/index.ts`：
  - `program.command("search <keyword>").action(...)` → registerSearch
  - `const mp = program.command("mp")`，挂 `mp search`、`mp search-cancel`
  - `program.command("task <searchId>")` → registerTask

## 7. 验收（mock server 起着）
- [x] 7.1 `supsub --api-url http://localhost:8787 search Anthropic -o json | jq '.data.results | length'` ≥ 1
- [x] 7.2 `supsub --api-url http://localhost:8787 search Anthropic --type FOO` → 退出码 64
- [x] 7.3 `time supsub --api-url http://localhost:8787 mp search 晚点` 在 3-7 秒内返回，`-o json` 输出 `{"success":true,"data":{"mpId":"mp_999",...}}`
- [x] 7.4 `supsub --api-url http://localhost:8787 mp search xyz_no_match` → 退出码 1，stderr 含 `未找到`
- [x] 7.5 `supsub --api-url http://localhost:8787 mp search 晚点 --async -o json | jq -r '.data.searchId'` 拿到 searchId；立即 `supsub task <id>` 显示 `finished:false`；4 秒后再查 `finished:true` 含 mp
- [x] 7.6 `supsub --api-url http://localhost:8787 mp search-cancel <已 finished 的 searchId>` 第二次返回退出码 1
- [x] 7.7 把 mock server 杀掉再跑 `supsub search foo` → 退出码 10，stderr `网络异常，请稍后重试`
- [x] 7.8 `pnpm --filter @supsub/cli typecheck` 通过

## 8. e2e 修复（2026-04-28）

> team-lead e2e 联调发现 `supsub task` 输出 schema 偏离 spec，本节记录修复条目。

- [x] 8.1 修复 `task.ts` finished:false 路径：data 补全 `mp:null`，输出 `{finished:false, message, mp:null}`，与 spec line 45 对齐
- [x] 8.2 修复 `task.ts` finished:true + mp 路径：`output()` data 由 `r.mp` 平铺改为 `{finished:true, message, mp:r.mp}`，与 spec line 51 对齐
- [x] 8.3 验证 finished:true + 无 mp 路径（-o json 吐 error envelope）与 design.md §8 Open Question 决策一致；追加决策说明到 design.md
- [x] 8.4 `pnpm --filter @supsub/cli typecheck` 通过（修复后）
- [x] 8.5 mock 联调验证三个 Scenario 均通过（finished:false schema / finished:true+mp schema / finished:no-mp exit 1）
