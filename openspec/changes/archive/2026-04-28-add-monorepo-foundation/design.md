# Design: add-monorepo-foundation

## 1. monorepo 布局

```
supsub-cli/
  package.json                   # root，packageManager: pnpm@10.29.2
  pnpm-workspace.yaml            # packages/*
  tsconfig.base.json             # 单一 TS 真相
  packages/
    cli/                         # @supsub/cli — 命令行
      src/
        index.ts                 # commander 根命令注册
        config/                  # ~/.supsub/config.json 单例
        http/                    # fetch 包装（鉴权头、重试、错误归一）
        commands/                # 一个文件一个 leaf 命令
          auth/{login,logout,status}.ts
          sub/{list,add,remove,contents,mark-read}.ts
          mp/{search,search-cancel}.ts
          search.ts
          task.ts
        ui/                      # 表格、CJK 宽字符、kleur 配色
        lib/                     # errors、exit-code、constants
      package.json               # bin: supsub
    mock/                        # @supsub/mock — Hono 后端 mock
      src/
        index.ts                 # Bun.serve 入口（port 8787）
        routes/                  # 一个文件一个域路由
        fixtures/                # 内存数据
        store/                   # 内存状态机
        middleware/              # auth、error envelope
```

**为什么不把 cli/mock 拆 repo？** mock fixture 与 cli 的字段假设强耦合，同一 PR 改两端可大幅降低联调摩擦。两包通过 pnpm workspace 解析，无 npm 发布关系。

## 2. TypeScript 配置（已落地，写进 spec 是为了「不许擅自改」）

`tsconfig.base.json`：
- `target: ES2022`、`module: ESNext`、`moduleResolution: Bundler`
- `strict: true`、`noUncheckedIndexedAccess: true`、`noImplicitOverride: true`
- `verbatimModuleSyntax: true`：禁止 `import` 与 `import type` 混用，类型用 `import type`
- `allowImportingTsExtensions: true`、`noEmit: true`：源码内部互引 `.ts`，由 Bun 直接执行；`tsc` 仅做 typecheck
- `types: ["bun-types"]`：拿到 `Bun.serve`、`Bun.spawn` 等类型

子包 `tsconfig.json` 仅 `extends` 并指定 `include: ["src/**/*.ts"]`。

## 3. 全局标志

所有命令统一来自 commander 根：

| 标志 | 默认 | 优先级 |
|------|------|--------|
| `--api-url <url>` | `process.env.SUPSUB_API_URL ?? "https://supsub.com"` | 命令行 > env > 内置 |
| `-o, --output <fmt>` | `table` | 仅命令行 |
| `--api-key <key>` | — | 命令行 > `SUPSUB_API_KEY` env > 配置文件 |

实现方式：commander 的 `program.opts()` 在 action 里读，**不要**用 `getActiveCommand()`。

## 4. ErrorEnvelope（CLI 内部错误归一）

后端响应天然遵循 api.json 的 `ErrorResponse-62`：`{ code, message, status, data? }`。本地错误（fetch 失败、本地 key 失效、参数校验）需要 CLI 合成同形态的对象。

```ts
// packages/cli/src/lib/errors.ts
export type ErrorEnvelope = {
  code: string;        // 后端 code 透传 / 本地约定值
  message: string;
  status: number;      // 后端 status 透传 / 本地: 0
  data?: unknown;
};

export const LOCAL_CODES = {
  NETWORK_ERROR: "NETWORK_ERROR",
  UNAUTHORIZED: "UNAUTHORIZED",
  INVALID_ARGS: "INVALID_ARGS",
  PLAN_EXPIRED: "SUBSCRIPTION_PLAN_EXPIRED", // 与后端一致
} as const;
```

`-o json` 时输出 `{ success: false, error: ErrorEnvelope }`；`-o table` 时把 `message` 打到 stderr。

## 5. 退出码常量

```ts
// packages/cli/src/lib/exit-code.ts
export const EXIT = {
  OK: 0,
  BUSINESS: 1,
  UNAUTHORIZED: 2,
  PLAN_EXPIRED: 3,
  NETWORK: 10,
  SERVER: 11,
  INVALID_ARGS: 64,
} as const;
```

唯一允许调 `process.exit(n)` 的位置：`src/lib/errors.ts` 的 `dieWith(envelope, exitCode)` helper。其他地方一律 `throw` 让顶层捕获。

## 6. 表格输出（UI）

`packages/cli/src/ui/table.ts`：
- 基于 `cli-table3`
- 把 CJK 字符按 2 列宽计算（参考 getnote-cli `internal/ui/ui.go` 的 width 表）
- 提供 `printTable({ headers, rows, columnWidths? })` 与 `truncate(s, width)` 两个 export
- 颜色用 `kleur`（已在依赖里），仅给表头用 `kleur.cyan().bold()`

## 7. 与 api.json 的字段差异

PRD 与 api.json 已在「订阅源列表」上发现一处字段类型出入：
- PRD 写 `sourceId: number`，api.json 是 `string`
- PRD 写 `sourceType: 'MP' | 'WEBSITE'`，api.json 在 `GET /api/subscriptions` 返回的 schema 写 `integer`，但响应 example 用字符串

**约定**：以 api.json 的 example 为准（example 是 mock-server 实测能对上的形态），即 `sourceType: string ('MP'|'WEBSITE')`、`sourceId: string`。所有 CLI 类型定义在 `packages/cli/src/lib/types.ts` 集中维护，**禁止**散落 inline。
