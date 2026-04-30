# Proposal: add-cli-bearer-token-auth

## Why

真实后端目前**未实现 api_key 鉴权**，但已支持浏览器登录后的 `Authorization: Bearer <token>` 会话鉴权。当前 CLI 只有两条鉴权路径：

1. **Device Flow** → 写 `api_key` 到 `~/.supsub/config.json`（依赖后端实现）
2. **`--api-key` flag / `SUPSUB_API_KEY` env** → 直接当 api_key 用（同样依赖后端实现）

这意味着在后端 api_key 上线之前，CLI 无法对真实环境的订阅管理、搜索等功能做端到端验证——只能挂在 mock 上空跑。

我们需要一条临时通路：用户登录 supsub web，从浏览器 DevTools 复制 `Authorization` 头里的 Bearer token，手动粘贴到本地 config，CLI 即可拿这个 token 命中真实后端。

## What Changes

新增第三种鉴权来源：`~/.supsub/config.json` 的 `bearer_token` 字段。

```json
{
  "bearer_token": "<paste-from-browser-devtools>",
  "client_id": "supsub-cli"
}
```

**API Key 解析优先级**（从高到低）：

1. `--api-key <k>` 命令行 flag
2. `SUPSUB_API_KEY` 环境变量
3. `config.api_key`（Device Flow / `--api-key` 写入）
4. `config.bearer_token`（手动从浏览器粘贴）← **新增**

具体改动：

1. `packages/cli/src/config/store.ts`
   - `Config` 类型加 `bearer_token?: string`
   - `clearAuth()` 在剥除 `api_key`、`client_id` 的同时**也剥除 `bearer_token`**（401 也应该清掉浏览器会话 token）
2. `packages/cli/src/http/credentials.ts`
   - `resolveApiKey` 在 `cfg.api_key` 缺失时回落到 `cfg.bearer_token`
   - 返回值新增 `source: "flag" | "env" | "config" | "session"` 字段，方便 status/log 区分
3. `packages/cli/src/commands/auth/status.ts`
   - `api_key_source` 输出从原来的 `flag/env/config` 扩展到 `flag/env/config/session`
   - 直接用 `resolveApiKey` 返回的 `source`，删除本地 `getApiKeySource` 辅助
4. `packages/cli/test/bearer-token-auth.test.ts`
   - 新增：覆盖优先级、`clearAuth` 同步清除 `bearer_token`

## Impact

- **新增**：1 个测试文件
- **修改**：3 个源文件（store / credentials / status）
- **不变**：`auth login` 命令、Device Flow、`--api-key` 路径
- **依赖**：无新增
- **兼容性**：完全向后兼容——已写 `api_key` 的用户行为不变；不写 `bearer_token` 的用户感知不到此 change
- **临时性**：后端 api_key 上线后，此 change 不必撤销——`bearer_token` 作为开发/调试通路继续存在
