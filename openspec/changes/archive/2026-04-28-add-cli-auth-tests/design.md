# Design: add-cli-auth-tests

## 测试栈

- **Runner**：`bun test`（内置于 Bun 运行时，已在 `packages/cli` devDeps `bun-types` 中包含，无需新装）
- **执行命令**：`pnpm --filter @supsub/cli test`
- **文件位置**：`packages/cli/test/`（Bun 默认扫描 `test/` 与 `*.test.ts` 文件）

## 文件分组

| 文件 | 对应任务 |
|------|---------|
| `packages/cli/test/config-store.test.ts` | 1.2（config/store.ts 单元自检）|
| `packages/cli/test/http-client-401.test.ts` | 2.4（HTTP 客户端 401 清空逻辑）|
| `packages/cli/test/auth-deny.test.ts` | 5.8（device flow access_denied 退出行为）|

## Mock 策略

**原则：不起 mock server，保持单测纯净。**

### config-store.test.ts（任务 1.2）

- 使用临时目录（`os.tmpdir()` + 随机后缀）隔离 HOME，通过环境变量注入或直接 mock 模块路径，避免污染真实 `~/.supsub/config.json`。
- 由于 `store.ts` 硬编码了 `os.homedir()`，采用 `mock.module()` 拦截 `node:os` 的 `homedir()`，返回测试用临时目录。
- 每个 `describe` 块 `afterEach` 清理临时目录。

### http-client-401.test.ts（任务 2.4）

- 用 `mock.module()` 拦截全局 `fetch`，返回 `{ status: 401, ok: false }` 的假 Response。
- 用 `mock.module()` 拦截 `../../config/store` 的 `clearAuth`，记录调用次数。
- 断言：`clearAuth()` 被调用了 1 次；`request()` 抛出 `{ code: "UNAUTHORIZED" }` 的 ErrorEnvelope。

### auth-deny.test.ts（任务 5.8）

- 用 `mock.module()` 拦截全局 `fetch`：
  - 第 1 次调用（device/code）：返回 200 + 合法 DeviceCodeResponse（`interval: 0`，`expires_in: 10`）。
  - 第 2 次调用（token 轮询）：返回 400 + `{ error: "access_denied" }`。
- 直接调用 `runDeviceFlow()`，断言 Promise 以 `{ code: "ACCESS_DENIED", message: "用户拒绝授权" }` reject。
- **不测 stderr / process.exit**：那属于 `login.ts` 集成层，单测只验证 `runDeviceFlow()` 的抛出行为（`access_denied` 路径已在实现中映射好）。

## 注意事项

- `bun test` 的 `mock.module()` 使用 **静态 import 路径**，需与被测文件使用的 import 路径一致（带 `.ts` 后缀）。
- `sleep.ts` 中的 `setTimeout` 在 `bun test` 环境中正常运行，`interval: 0` 可让轮询几乎立刻触发（无需 fake timer）。
- config-store 测试需要在 mock `homedir` 之后 **动态 re-import** store 模块，否则 `CONFIG_FILE` 常量在模块加载时已固化为真实路径。

## Open Questions

- **store.ts 硬编码路径问题**：`CONFIG_DIR` 和 `CONFIG_FILE` 在模块顶层用 `os.homedir()` 计算，`mock.module("node:os", ...)` 需要在 `import store` 之前生效。Bun 的 `mock.module()` 支持在 `describe` 块外顶层调用，配合 `--preload` 或直接在 `test` 文件顶层调用均可，但需验证该模块的 re-import 机制。若 `mock.module()` 无法覆盖已解析的常量，备选方案是将 store 测试改为用真实临时目录直接写文件，通过 `fs.readFile` 验证结果，而不是依赖 `readConfig()`。此为已知实现 bug，不修改业务代码。
