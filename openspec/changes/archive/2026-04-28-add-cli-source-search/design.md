# Design: add-cli-source-search

## 1. 类型

```ts
// packages/cli/src/lib/types.ts
export type SearchResultItem =
  | { type: "SOURCE"; data: SourceBasic }
  | { type: "CONTENT"; data: ContentBasic };

export type SearchResponse = {
  results: SearchResultItem[];
  recommendations: SourceBasic[];
  prompts: string[];
};

export type MpSearchTaskResult = {
  finished: boolean;
  message: string;
  mp: { mpId: string; name: string; img: string; description: string } | null;
};
```

`SourceBasic` 与 `ContentBasic` 取自 `信息源基本信息-1405` / `内容基本信息-1406`，已有定义则复用。

## 2. `supsub search`

```
supsub search <keyword> [--type ALL|MP|WEBSITE|CONTENT] [--page N]
```

- `--type` 默认 `ALL`；归一大写后校验集合
- `--page` 默认 1；pageSize 固定 10（与 api.json default 对齐）
- 调 `GET /api/search?type=&keywords=&page=&pageSize=10`
- `-o table` 输出两段：
  1. `Results (N items, page <p>)` 表，列 `type`/`sourceType`/`name|title`/`url`/`summary`(截断)
  2. 若 `recommendations.length > 0`：`Recommendations` 表
  - `prompts` 不打印到 table（agent 不消费）；`-o json` 透传
- `-o json` 透传整个响应

## 3. `supsub mp search` 同步模式

```
supsub mp search <name>
```

伪代码：

```ts
const { searchId } = await request<{searchId:string}>({
  method:"POST", path:"/api/mps/search-tasks", body:{ name }, ...
});
const start = Date.now();
const intervalMs = 2000;
while (Date.now() - start < 30_000) {
  await sleep(intervalMs);
  const r = await request<MpSearchTaskResult>({
    method:"GET", path:`/api/mps/search-tasks/${searchId}`, ...
  });
  if (r.finished) {
    if (r.mp) return output(r.mp, fmt, renderMpTable);
    else throw { code: "MP_NOT_FOUND", status: 0, message: r.message ?? "未找到" };
  }
}
// 超时
if (fmt === "json") {
  process.stdout.write(JSON.stringify({success:false, error:{code:"MP_SEARCH_TIMEOUT", status:0, message:`30 秒内未完成，可继续查询: supsub task ${searchId}`, data:{searchId}}}, null, 2)+"\n");
} else {
  process.stderr.write(`30 秒内未完成，可继续查询: supsub task ${searchId}\n`);
}
process.exit(EXIT.BUSINESS); // 1
```

> 注意：「未找到」与「超时」不算系统错误，但 cli-dev 把退出码定为 1（BUSINESS），让 agent 能用 `if [ $? -ne 0 ]` 简单分支。

## 4. `supsub mp search --async`

只发 `POST /api/mps/search-tasks`，立即输出 `{ searchId }` / 单行表格：
```
searchId: <uuid>
继续查询: supsub task <uuid>
```

## 5. `supsub mp search-cancel <searchId>`

调 `DELETE /api/mps/search-tasks/:searchId`。
- 后端 204 → 输出 `{success:true,data:{message:"已取消"}}`
- 后端 404 (`code:"NotFound"`) → 退出码 1，stderr 提示 `任务不存在或已取消`

## 6. `supsub task <searchId>`

调 `GET /api/mps/search-tasks/:searchId`，单次查询：
- `finished:true && mp` → 输出 mp 信息
- `finished:true && !mp` → 退出码 1，提示「未找到」
- `finished:false` → 输出 `{success:true,data:{finished:false,message}}` / 表格 `进行中…`，退出码 0（表示「查询本身成功」，task 状态自描述）

> 注意：v1 的 `task` 命令仅给 mp search 用。spec 写法上要避免约束未来其他领域的 task 接入。

## 7. 表格列

| 命令 | 列 |
|---|---|
| `search` results | type, sourceType, name(CJK), url(host), summary(40c CJK) |
| `mp search` 命中 mp | mpId, name(CJK), description(50c CJK) |
| `task` finished:true | mpId, name, description |
| `task` finished:false | searchId, status="进行中", message |

## 8. Open Question / Decision

**`supsub task <id>` finished:true + mp:null 时 `-o json` 输出格式**

spec Scenario "任务 finished + 未找到"（spec.md 行 53-57）仅规定：退出码 1 + stderr 含"未找到"，未明确 -o json 时是否输出 error envelope。

**决策（e2e 修复 2026-04-28）**：保留 error envelope 输出到 stdout：
```json
{"success":false,"error":{"code":"MP_NOT_FOUND","status":0,"message":"未找到"}}
```
理由：ai-ready 设计原则——agent 管道统一依赖 `.success` 字段做分支，`success:true` 时 data 保证有 mp 字段，`success:false` 时有 error 字段。若改成 `{success:true, data:{finished:true, mp:null}}` 反而要求 agent 做两次判断（`.success` 再判 `.data.mp`），增加出错概率。
