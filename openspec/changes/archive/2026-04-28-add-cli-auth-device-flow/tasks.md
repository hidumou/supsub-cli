# Tasks: add-cli-auth-device-flow

> 前置：add-monorepo-foundation 的 task 2.4–2.7 已完成（commander 根、错误 helper、UI table）。先跑 `pnpm dev:mock` 起 mock。

## 1. 配置存储
- [x] 1.1 新建 `packages/cli/src/config/store.ts`：`readConfig()` / `writeConfig(patch)` / `clearAuth()`，写入前 `mkdir 0700`、写后 `chmod 0600`（用 `node:fs/promises`，Windows 平台静默跳过 chmod）
- [x] 1.2 单元自检：`bun test packages/cli/src/config/store.test.ts`（写、读、patch 合并、clearAuth）（moved to add-cli-auth-tests #1.2）

## 2. HTTP 客户端
- [x] 2.1 新建 `packages/cli/src/http/credentials.ts`，导出 `resolveApiKey(globalOpts)` 按 design.md §2 实现
- [x] 2.2 新建 `packages/cli/src/http/client.ts`，导出 `request<T>(opts)` 按 design.md §3 实现；401 调 `clearAuth()` 并抛 ErrorEnvelope
- [x] 2.3 加 `packages/cli/src/lib/types.ts` 定义 `UserInfo`（id/email/name/avatar/google/expired/endAt/opml/onboardingCompleted/referralSourceSubmitted）等接口类型
- [x] 2.4 单元自检：mock fetch 返回 401 时验证 `~/.supsub/config.json` 中 `api_key` 被清空（moved to add-cli-auth-tests #2.4）

## 3. Device flow 轮询
- [x] 3.1 新建 `packages/cli/src/commands/auth/device-flow.ts`：导出 `runDeviceFlow(apiUrl): Promise<{ api_key, client_id }>`
- [x] 3.2 实现浏览器打开（`Bun.spawn` 跨平台，失败 swallow）；提示文案走 stderr
- [x] 3.3 轮询循环按 `interval` 秒一次；`slow_down` 时 `interval += 1`；总耗时上限 = `expires_in` 秒
- [x] 3.4 错误映射：`expired_token` → `{code:"EXPIRED_TOKEN",status:0,message:"设备码已过期，请重新运行 supsub auth login"}`；`access_denied` → `{code:"ACCESS_DENIED",status:0,message:"用户拒绝授权"}`

## 4. 命令实现
- [x] 4.1 新建 `packages/cli/src/commands/auth/login.ts`：
  - 默认走 device flow → writeConfig({api_key, client_id}) → stderr `✅ 登录成功`，stdout 仅在 `-o json` 时输出 `{success:true,data:{client_id}}`
  - `--api-key <k>` 直接 writeConfig，跳过 device flow
- [x] 4.2 新建 `packages/cli/src/commands/auth/logout.ts`：调 `clearAuth()`，stderr `已登出`，`-o json` 输出 `{success:true,data:{}}`
- [x] 4.3 新建 `packages/cli/src/commands/auth/status.ts`：resolveApiKey → 缺则抛 UNAUTHORIZED；调 `/api/user/info` 拉用户信息；输出表格或 JSON（含 api_key_source 字段，api_key 字段打码 `sk_live_***<last4>`）
- [x] 4.4 在 `packages/cli/src/index.ts` 注册 `auth` 子命令树（login / logout / status），login 接 `--api-key <key>` 子选项

## 5. 验收
- [x] 5.1 `pnpm dev:mock` 已起；运行 `pnpm dev:cli -- --api-url http://localhost:8787 auth login`，stderr 输出 verification_uri；浏览器打开 `http://localhost:8787/device?user_code=...`，点[自动授权]
- [x] 5.2 cli 在 ≤ 4 秒内打印 `✅ 登录成功`；`cat ~/.supsub/config.json` 包含 `api_key` 与 `client_id`，文件权限 0600
- [x] 5.3 `pnpm dev:cli -- --api-url http://localhost:8787 auth status` 表格显示 `email: demo@supsub.local`
- [x] 5.4 `pnpm dev:cli -- --api-url http://localhost:8787 auth status -o json | jq -e '.success == true'` 通过
- [x] 5.5 模拟过期：把 `~/.supsub/config.json` 的 `api_key` 改成 `sk_live_wrong`，再跑 `auth status` → 退出码 2、stderr 提示重新登录、配置文件中 `api_key/client_id` 被移除
- [x] 5.6 `pnpm dev:cli -- auth login --api-key sk_live_demo_token_for_dev`（不带 --api-url，应用默认）→ 文件被写入；再跑 `auth status --api-url http://localhost:8787` 成功
- [x] 5.7 `pnpm dev:cli -- auth logout` → 配置文件 `api_key` 字段被移除
- [x] 5.8 用户在浏览器点[拒绝]：cli 端 ≤ 4 秒内退出，stderr `用户拒绝授权`，退出码 1（moved to add-cli-auth-tests #5.8）
- [x] 5.9 `pnpm --filter @supsub/cli typecheck` 通过
