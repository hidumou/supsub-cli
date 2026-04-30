# Proposal: align-cli-api-url-with-reference

## Why

参考实现 `getnote-cli` 不存在 `--api-url` flag。它的 URL 解析仅两条路径（`internal/client/client.go:37-43`）：

```go
baseURL := config.DefaultAPIBaseURL                  // 1. 硬编码常量
if v := os.Getenv("GETNOTE_API_URL"); v != "" {
    baseURL = v                                       // 2. env 覆盖
}
```

理由：

- **生产 URL 是固定基础设施**，每次输入 `--api-url https://supsub.com` 是噪音
- **mock / 调试场景用环境变量** 更符合工具习惯（`SUPSUB_API_URL=http://localhost:8787 supsub sub list`）
- **CLI 接口面更小**：少一个 flag 等于少一个误用路径（用户不会再写 `--api-url htt://typo` 然后困惑）

supsub-cli 当前在 `cli/index.ts:39-43` 注册了 `--api-url` flag（默认 `process.env["SUPSUB_API_URL"] ?? "https://supsub.com"`）。本 change **移除该 flag**，改为仅常量 + env 覆盖，对齐参考实现。

## What Changes

1. **新增 `packages/cli/src/lib/api-url.ts`**
   - 导出常量 `DEFAULT_API_URL = "https://supsub.com"`
   - 导出函数 `getApiUrl()`：`SUPSUB_API_URL` env 优先，否则常量
2. **`packages/cli/src/cli/index.ts`**：移除 `--api-url <url>` option 声明
3. **`packages/cli/src/api/_ctx.ts`**：`buildCtx(globalOpts)` 内部调 `getApiUrl()` 填 `ctx.apiUrl`，不再从 globalOpts 读
4. **`packages/cli/src/commands/auth/login.ts`**：`runDeviceFlow(getApiUrl())`
5. **`packages/cli/src/commands/auth/status.ts`**：`getUserInfo({ apiUrl: getApiUrl(), ... })`
6. **`packages/cli/src/commands/**.ts`**：删除 `globalOpts` 类型字面量里的 `apiUrl: string` 字段（cosmetic，不再读）
7. **architecture spec**：MODIFIED 现有 Requirement「全局 CLI 标志由根命令统一注入」中关于 `--api-url` 的 Scenario，改为「`SUPSUB_API_URL` 环境变量在所有命令中生效」

## Impact

- **修改**：1 个 spec、1 个 root、1 个 _ctx、2 个 auth 命令、9 个命令的 globalOpts 类型（cosmetic）
- **新增**：1 个 lib 文件
- **测试影响**：**零**——现有测试都直接调内部函数（`runDeviceFlow("http://fake-host")` / `request({ apiUrl: "..." })`），不通过 commander argv 注入 apiUrl
- **依赖**：无新增
- **破坏性**：是（CLI 用户接口面变化）。具体迁移：
  - 旧：`supsub --api-url http://localhost:8787 sub list`
  - 新：`SUPSUB_API_URL=http://localhost:8787 supsub sub list`
- **回退**：本 change 完成后，若需要恢复 flag 形式，重写 commander option 即可，不涉及配置/数据层
