# Design: add-cli-subscription-crud

## 1. 字段类型对齐

api.json 的 `GET /api/subscriptions` 响应 schema：

```ts
type Subscription = {
  sourceType: "MP" | "WEBSITE";   // schema 写 integer，example 用字符串；以 example 为准
  sourceId: string;               // 同上
  name: string;
  img: string;
  description: string;
  unreadCount: number;
};
```

`GET /api/subscriptions/contents` 响应每篇文章：

```ts
type Article = {
  articleId: string;
  url: string;
  title: string;
  coverImage: string;
  tags: string[];
  summary: string;
  publishedAt: number | string;   // schema 写 integer 时间戳，example 是 "2025-06-18 11:49:46"；以后端实际为准，类型用 unknown 后输出层格式化为字符串
  isRead: boolean;
};
```

> **mock 约定（add-mock-backend-fixtures 已固化）**：mock 输出的 `publishedAt` 用 unix 秒（integer）；cli 在表格列里把它格式化成 `YYYY-MM-DD HH:mm`。`-o json` 透传后端原值不做转换。

## 2. 参数规范化

公共 helper（放 `packages/cli/src/commands/sub/_args.ts`）：

```ts
export function normalizeType(input: string): "MP" | "WEBSITE" {
  const v = input.trim().toUpperCase();
  if (v !== "MP" && v !== "WEBSITE") throw {
    code: "INVALID_ARGS", status: 0,
    message: `--type 仅支持 MP 或 WEBSITE，收到: ${input}`
  };
  return v;
}
```

## 3. 表格列定义

| 命令 | 列 | 列宽 |
|---|---|---|
| sub list | sourceId, type, name(CJK), unread, description(CJK 截断) | 12, 8, 24, 8, 40 |
| sub contents | publishedAt, isRead, title(CJK), articleId, url(短化) | 16, 6, 40, 18, 40 |

`isRead` 列 true 显示 `✓`、false 显示空白。

## 4. 命令骨架

```ts
// packages/cli/src/commands/sub/list.ts
export function registerSubList(parent: Command) {
  parent.command("list")
    .option("--type <type>", "MP|WEBSITE")
    .action(async (opts) => {
      const globalOpts = parent.parent!.opts();
      const apiUrl = globalOpts.apiUrl;
      const { key, clientId } = await resolveApiKey(globalOpts);
      const data = await request<Subscription[]>({
        method: "GET", path: "/api/subscriptions",
        apiUrl, apiKey: key, clientId,
        query: { sourceType: opts.type ? normalizeType(opts.type) : undefined },
      });
      output(data, globalOpts.output, /* renderer */);
    });
}
```

每条命令文件结构一致：解析参数 → resolveApiKey → request → output。

## 5. 输出 helper

```ts
// packages/cli/src/ui/output.ts
export function output<T>(data: T, format: "table" | "json", renderTable: (d: T) => void) {
  if (format === "json") {
    process.stdout.write(JSON.stringify({ success: true, data }, null, 2) + "\n");
  } else {
    renderTable(data);
  }
}
```

每条命令各自实现一个 `renderTable(data)`，把 data 喂给 `printTable({ headers, rows })`。

## 6. 二选一互斥校验

`sub contents` 的 `--all`/`--unread` 与 `sub mark-read` 的 `--all`/`--content-id`：

```ts
if (opts.all && opts.unread) throw INVALID_ARGS("--all 与 --unread 互斥");
if (!opts.all && !opts.contentId) throw INVALID_ARGS("--content-id <id> 与 --all 必须二选一");
```

## 7. 分页

cli 当前不暴露 `--page-size`，固定 20；只暴露 `--page <n>`，默认 1。后端要求 `page` / `pageSize` 都是 required，所以 query 总是带上。
