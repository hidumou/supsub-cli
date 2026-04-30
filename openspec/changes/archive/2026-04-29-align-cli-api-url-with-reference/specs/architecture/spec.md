# architecture spec (api-url alignment delta)

## MODIFIED Requirements

### Requirement: 全局 CLI 标志由根命令统一注入

所有子命令 MUST 通过 commander 根 program 读取 `-o, --output <fmt>` 与 `--api-key <key>` 两个全局 flag，子命令自身**不许**重复声明同名 option。**API 基地址不再通过 CLI flag 传递**——参照 `getnote-cli` 的实现习惯，supsub-cli MUST 用硬编码常量 + `SUPSUB_API_URL` 环境变量两级回落机制：

1. `SUPSUB_API_URL` 环境变量（优先）
2. `packages/cli/src/lib/api-url.ts` 中的 `DEFAULT_API_URL` 常量

读取入口 SHALL 是 `getApiUrl()` 函数（每次调用动态读 env，便于测试与运行期切换），命令文件**不许**直接读 `process.env["SUPSUB_API_URL"]`，也**不许**保留 `--api-url` 这类 commander option。

#### Scenario: `SUPSUB_API_URL` 在子命令中生效

- **GIVEN** 用户运行 `SUPSUB_API_URL=http://localhost:8787 supsub sub list`
- **WHEN** `sub list` 的 action 调用 `getApiUrl()`
- **THEN** 拿到 `http://localhost:8787` 而非 `https://supsub.com`

#### Scenario: 未设置 env 时使用 DEFAULT_API_URL

- **GIVEN** 进程启动时 `process.env.SUPSUB_API_URL` 未设置
- **WHEN** 任意命令调用 `getApiUrl()`
- **THEN** 返回 `DEFAULT_API_URL`（即 `https://supsub.com`）

#### Scenario: `-o` 默认 table

- **GIVEN** 用户运行 `supsub auth status`（不带 `-o`）
- **WHEN** action 内读取 `program.opts().output`
- **THEN** 返回 `"table"`（commander 默认值）

#### Scenario: 不存在 `--api-url` flag

- **GIVEN** 用户运行 `supsub --api-url http://localhost:8787 sub list`
- **WHEN** commander 解析 argv
- **THEN** 触发 `error: unknown option '--api-url'`，退出码非 0；提示用户改用 `SUPSUB_API_URL` 环境变量
