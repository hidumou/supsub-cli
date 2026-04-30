# Design: add-cli-interval-fallback

## 决策：5 秒 Fallback

### Fallback 值选择

选择 **5 秒**作为 fallback 间隔，原因如下：

1. **RFC 8628 §3.5** 明确指出，若 Device Authorization Response 未包含 `interval` 字段，客户端应默认使用 5 秒间隔（"If no interval is returned by the authorization server, the client MUST use 5 as the default"）。
2. **getnote-cli 参考实现**（`cmd/auth/auth.go:103-106`）使用相同的 5 秒 fallback，保持生态一致性。
3. 5 秒在 UX 和服务端压力之间取得平衡：用户等待感知可接受，同时不对服务端造成风暴。

### 触发条件

Fallback 在以下情况下触发：

- `interval` 字段**缺失**（服务端漏返，JavaScript 解构为 `undefined`，`undefined > 0` 为 `false`）
- `interval === 0`（服务端返回零，可能是 bug 或 non-compliant 实现）
- `interval < 0`（服务端返回负数，无效值）

统一判断：`interval > 0` 为真时使用服务端值，否则使用 5 秒 fallback。

### 与 RFC 8628 的关系

RFC 8628 §3.5（Token Request）要求：

> "the client MUST NOT poll for access tokens faster than its allowed rate"

本变更通过以下方式合规：

- 当服务端正确下发正整数 `interval` 时，CLI 严格遵守该值（不改变现有行为）。
- 当服务端未正确下发时，CLI 回落到 RFC 推荐的 5 秒默认值，而非以 0ms 间隔 spin，确保不违反速率限制精神。
- `slow_down` 错误码处理（`intervalMs += 1000`）保留不变，在 fallback 基础上叠加。

## 实现

```ts
// RFC 8628 fallback: 服务端漏返或非正数时回落到 5 秒
let intervalMs = interval > 0 ? interval * 1000 : 5_000;
```

单行变更，影响面极小，无需新增接口或修改调用方。

## 测试策略

使用 `Bun.spyOn` 拦截 `sleep` 函数，捕获实际传入的毫秒数，断言 `interval = 0` 时 `sleep` 被调用时传入值为 `5000`，不真实等待 5 秒。

## 实现侧的小补充：sleepFn 依赖注入

为了让 `auth-interval-fallback.test.ts` 不真的等 5 秒，`runDeviceFlow(apiUrl)` 增加可选第二参数 `options.sleepFn`：

```ts
export async function runDeviceFlow(
  apiUrl: string,
  options: { sleepFn?: (ms: number) => Promise<void> } = {},
): Promise<{ api_key: string; client_id: string }>
```

- 默认 `options.sleepFn = sleep`，**生产路径行为零变化**（`commands/auth/login.ts` 调用未改）
- 测试通过传入 fake sleep 收集传入的 ms，断言 fallback 触发时为 5000、未触发时为服务端值
- 不暴露给 cli 用户（不是命令行 flag）；只是模块内部测试 hook
