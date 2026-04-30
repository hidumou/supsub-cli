# Design: add-mock-tunable-constants

## 决策

### 默认值保持不变

三个常量的默认值与现有硬编码保持一致，确保所有既有集成测试、文档截图、README 示例均无需变动：

| 常量 | 默认值 |
|---|---|
| `DEVICE_CODE_TTL_SECONDS` | `600` |
| `DEVICE_CODE_INTERVAL_SECONDS` | `2` |
| `DEMO_API_KEY` | `sk_live_demo_token_for_dev` |

### 环境变量注入策略

#### 数值型常量（TTL / interval）

使用 `Number()` 将环境变量字符串转换为数字，再通过 `Number.isFinite()` 与 `> 0` 双重校验：

- 若环境变量未定义（`undefined`）→ 使用默认值
- 若转换结果为有限正整数 → 使用注入值
- 若为非数字字符串（如 `"abc"`）、`NaN`、`0`、负数、`Infinity` → **回落到默认值**（silent fallback，不报错）

这样既避免了使用无意义的配置导致 mock server 行为异常（TTL=0 会导致所有 device code 立即过期），也不会因为拼写错误使进程崩溃。

```ts
function readPositiveInt(envVar: string, fallback: number): number {
  const raw = process.env[envVar];
  if (raw === undefined) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}
```

#### 字符串型常量（api key）

使用 `??` 空值合并运算符：

```ts
export const DEMO_API_KEY =
  process.env.MOCK_DEMO_KEY ?? "sk_live_demo_token_for_dev";
```

- `MOCK_DEMO_KEY` 未设置时使用默认值
- `MOCK_DEMO_KEY=""` 空字符串时会使用空字符串（`??` 只对 `null`/`undefined` 兜底），这是有意行为——明确设置空字符串意味着「禁用 api key 校验」，由运维决策

### 向后兼容策略

`middleware/auth.ts` 保留 `export const DEMO_API_KEY` 语法，但实现改为从 `config.ts` re-export：

```ts
export { DEMO_API_KEY } from "../config.js";
```

这样 `packages/mock/src/index.ts` 等已有的 `import { DEMO_API_KEY } from "./middleware/auth.js"` 语句无需任何改动。

### 为何不使用 dotenv

mock server 是纯 Bun 运行时进程，Bun 原生支持 `.env` 文件加载（Bun 1.x 自动读取项目根的 `.env`）。不需要额外引入 dotenv 库，保持依赖最小化。开发者可通过 `MOCK_DEVICE_TTL=10 pnpm --filter @supsub/mock dev` 一次性注入而不污染 `.env`。

### 模块加载时机

`config.ts` 中常量在模块初始化时即被计算（顶层代码），而非每次请求时重新读取。这意味着：

- 修改环境变量需重启 mock server 才能生效（符合 12-factor App 预期行为）
- 测试代码如需覆盖，可在 import 前设置 `process.env.*` 并清除模块缓存
