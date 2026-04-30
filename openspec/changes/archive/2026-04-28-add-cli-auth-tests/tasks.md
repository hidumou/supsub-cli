# Tasks: add-cli-auth-tests

> 前置：`add-cli-auth-device-flow` 已完成（业务代码已实现）。本 change 只写测试文件，不改业务代码。

## 1. config/store 单元测试（对应原 1.2）

- [x] 1.1 在 `packages/cli/test/config-store.test.ts` 创建测试文件骨架，import `describe/test/expect/afterEach` 来自 `bun:test`
- [x] 1.2 实现 `writeConfig` happy path：写入 `{ api_key: "sk_test" }`，再 `readConfig()` 断言返回值含该字段
- [x] 1.3 实现 `writeConfig` patch 合并：先写 `{ api_key: "k1" }`，再写 `{ client_id: "c1" }`，断言两个字段均存在
- [x] 1.4 实现 `clearAuth`：先写 `{ api_key: "k", client_id: "c" }`，调 `clearAuth()`，再 `readConfig()` 断言两字段不存在
- [x] 1.5 实现「文件不存在时 readConfig 返回 {}」的 edge case

## 2. HTTP 客户端 401 单元测试（对应原 2.4）

- [x] 2.1 在 `packages/cli/test/http-client-401.test.ts` 创建测试文件骨架
- [x] 2.2 实现 fake fetch：用 `globalThis.fetch` 替换为返回 `Response` status 401 的假函数
- [x] 2.3 验证 clearAuth 效果：通过文件系统状态（api_key 被移除）代替 spy（`mock.module` 在 Bun 多文件测试中污染全局，改为验证文件内容）
- [x] 2.4 断言 `request()` 在 401 时抛出 `{ code: "UNAUTHORIZED" }` 的 ErrorEnvelope
- [x] 2.5 断言 `clearAuth` 效果：config.json 中 api_key/client_id 字段均不存在

## 3. Device flow 用户拒绝单元测试（对应原 5.8）

- [x] 3.1 在 `packages/cli/test/auth-deny.test.ts` 创建测试文件骨架
- [x] 3.2 实现 fake fetch 序列：第 1 次返回 200 + DeviceCodeResponse（`interval: 0, expires_in: 10`）；第 2 次返回 400 + `{ error: "access_denied" }`
- [x] 3.3 调用 `runDeviceFlow("http://fake")` 并断言 Promise reject，error 含 `code: "ACCESS_DENIED"`
- [x] 3.4 断言 error.message 包含 `用户拒绝授权`
- [x] 3.5 运行 `pnpm --filter @supsub/cli test` 验证 3 个文件全绿（9 tests pass）
- [x] 3.6 运行 `pnpm --filter @supsub/cli typecheck` 验证 0 错误
