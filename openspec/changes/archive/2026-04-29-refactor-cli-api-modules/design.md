# Design: refactor-cli-api-modules

## 关键决策

### 1. 函数式模块 vs Class 封装

**选定：函数式 named export。**

参考 `getnote-cli/internal/client/client.go` 用 `Client` struct + 方法集，是因为 Go 缺乏跨文件的方法扩展机制——只能塞在一个大文件里。TypeScript 没有这个限制，更地道的做法是：

```ts
// api/subscription.ts
export async function listSubs(ctx: ApiCtx): Promise<Subscription[]> {
  return request<Subscription[]>({ method: "GET", path: "/api/subscriptions", ...ctx });
}
```

而不是：

```ts
// api/client.ts
export class ApiClient {
  constructor(private ctx: ApiCtx) {}
  listSubs() { ... }
}
// 调用方：const client = new ApiClient(ctx); await client.listSubs();
```

**理由**：tree-shaking 友好（命令只 import 它用的函数）、不需要在每个命令里 `new ApiClient(ctx)`、ESM 命名空间 import 也能写成 `import * as subApi from "../api/subscription.ts"` 满足 `subApi.list()` 的体感。

### 2. ApiCtx 形态

```ts
// api/_ctx.ts
export type ApiCtx = {
  apiUrl: string;
  apiKey?: string;
  clientId?: string;
};

export async function buildCtx(globalOpts: {
  apiUrl: string;
  apiKey?: string;
}): Promise<ApiCtx> {
  const { key, clientId } = await resolveApiKey(globalOpts);
  return { apiUrl: globalOpts.apiUrl, apiKey: key, clientId };
}
```

命令侧从原来的 4 行：

```ts
const { key, clientId } = await resolveApiKey(globalOpts);
const data = await request<Subscription[]>({
  method: "GET", path: "/api/subscriptions",
  apiUrl: globalOpts.apiUrl, apiKey: key, clientId,
});
```

变成 2 行：

```ts
const ctx = await buildCtx(globalOpts);
const data = await listSubs(ctx);
```

### 3. 类型归属

类型继续住在 `lib/types.ts`（已是仓库共识的"所有 CLI 类型集中维护，禁止散落 inline"），api 模块从那里 import，不做迁移。

**理由**：

- 当前 `lib/types.ts` 文件首行注释明确写"禁止散落 inline"，把它打散到 api 模块违反既有约定
- 类型迁移与 request 解耦是两件事，本 change 只做 request 拆分，避免 scope creep
- 命令侧若需要类型，直接 `import type { Subscription } from "../lib/types.ts"`，与 api 函数 import 路径并行

唯一新增类型：`api/_ctx.ts` 里的 `ApiCtx`（仅用于 api 模块间的参数透传，不属于业务类型）。

### 4. 路径常量是否抽出

不抽。`/api/subscriptions` 这种字符串只在对应 api 模块里出现 1–2 次（list + add 共用），抽常量反而多一层间接，不符合 PRD「don't add abstractions beyond what the task requires」。

### 5. 测试影响

零修改：

- `http-client-401.test.ts` 测的是 `request<T>` 行为，未涉及命令层 → 不动
- `auth-deny.test.ts`、`auth-interval-fallback.test.ts` 测 `runDeviceFlow`，不走业务 endpoint → 不动
- 命令层目前没有单元测试（依赖 e2e mock 验证），api 层迁移不引入新测试需求

后续若要给 api 模块加单测，可用 fetch mock，与现有 `auth-deny.test.ts` 模式一致。

## 边界

- 不做 retry / 拦截器扩展（已在 `request<T>` 层处理 401）
- 不做请求 schema 校验（zod 等）——属于另一个 change 的范畴
- 不抽 `ApiClient` 类——见决策 1
