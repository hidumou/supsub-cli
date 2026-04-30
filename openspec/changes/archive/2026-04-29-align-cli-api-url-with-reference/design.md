# Design: align-cli-api-url-with-reference

## 关键决策

### 1. 为什么用 env，不用配置文件？

`~/.supsub/config.json` 已被认证字段独占，加一个 `api_url` 进去会让"切换环境"变成"改文件"——不如 env 一行 `SUPSUB_API_URL=...` 临时覆盖来得轻量。env 的语义也更符合"运行时环境，不持久化"的边界。

参考实现 getnote-cli 也是 env-only（`GETNOTE_API_URL`），不读 config。

### 2. `getApiUrl()` 为什么是函数而非常量？

如果在模块加载时执行 `process.env["SUPSUB_API_URL"] ?? DEFAULT_API_URL`，那么测试代码后续修改 `process.env["SUPSUB_API_URL"]` 无法影响后续 `getApiUrl()` 的返回——因为常量已经在 import 时 freeze。

函数化保证每次调用都是"当前 env 的快照"，便于：
- 测试中先写 `process.env["SUPSUB_API_URL"] = "http://fake-host"` 再调命令
- 同进程内不同命令链可能跑在不同 env 下（罕见但合法）

`getnote-cli` 的 `client.New(envTarget)` 也是函数，每次新建 Client 时重新读 env，同样原因。

### 3. dev URL 字面量分支要不要带过来？

不带。getnote-cli 的 `client.New(envTarget)` 里有一段：

```go
} else if envTarget == "dev" {
    baseURL = "https://openapi-dev.biji.com"
}
```

这是 getnote-cli 的 update 命令在升级前查 dev 渠道用的，是个内部约定。supsub-cli 目前没有 dev 镜像基础设施，把 stub 留着只会变成死代码。**保持 YAGNI**。

### 4. globalOpts 类型字面量要不要全删 `apiUrl: string`？

要。每个命令 action 都有：

```ts
const globalOpts = parent.parent!.opts() as {
  apiUrl: string;
  apiKey?: string;
  output?: string;
};
```

移除 commander option 后，`globalOpts.apiUrl` 实际值是 `undefined`，但类型断言为 `string` 会让 TS 误以为存在。即便此处不读，留着是潜在陷阱（未来某人误用）。统一删干净。

### 5. 用户的 mock 验证流如何变？

**改动前**：
```bash
bun run packages/cli/src/index.ts --api-url http://localhost:8787 sub list
```

**改动后**：
```bash
SUPSUB_API_URL=http://localhost:8787 bun run packages/cli/src/index.ts sub list
```

dev 工程师可以在 shell rc 中长期 export，避免重复输入；CI 中通过 job env 注入；手动调试时 `env SUPSUB_API_URL=... cmd` 一次性即可。

## 边界

- 不读 config.json 里的 api_url（保持单一来源：env > 常量）
- 不再支持 flag（破坏性变更）
- 不引入 dev/prod 字面量切换（YAGNI）
- 不变更测试形态（测试都直接调内部函数，传 apiUrl 参数即可）
