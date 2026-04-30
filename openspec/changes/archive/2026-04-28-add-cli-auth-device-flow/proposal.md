# add-cli-auth-device-flow

## Why

cli v1 必须先解决「我是谁」才能跑订阅 / 搜索。PRD §「认证与配置」已经定下双模式：

- 主路径：OAuth Device Flow（`auth login` → 浏览器授权 → 自动写 `~/.supsub/config.json`）
- 兜底：CI/脚本场景 `auth login --api-key sk_live_xxx` 跳过 OAuth

同时定下 401 单点处理（清空 api_key，提示重新登录，退出码 2）与 API key 三级优先级。

本 change 在 cli 落地：device flow 轮询循环、配置文件单例（含 0600 权限）、http 客户端默认头、`auth status` 反查 `/api/user/info`、`auth logout` 清空。

## What Changes

- 新增 `supsub auth login` / `supsub auth login --api-key <k>` / `supsub auth logout` / `supsub auth status`
- 配置文件 `~/.supsub/config.json`（目录 0700、文件 0600）
- API Key 优先级链：`--api-key` > `SUPSUB_API_KEY` > 配置文件
- HTTP 客户端：自动注入 `Authorization: Bearer <key>`、`X-Client-ID`、`Content-Type`，401 时触发清空 + 重新登录提示
- 跨平台 `open` 浏览器（macOS `open` / Linux `xdg-open` / Windows `rundll32`），失败仅打印 verification_uri 不阻塞

## Impact

- Affected specs: cli-auth（首次新增）
- Affected code:
  - `packages/cli/src/config/store.ts`（新建）
  - `packages/cli/src/http/client.ts`（新建）
  - `packages/cli/src/commands/auth/{login,logout,status}.ts`（新建）
  - `packages/cli/src/index.ts`（注册 `auth` 子命令树）
- Breaking? no
