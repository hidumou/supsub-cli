# cli-search spec delta

## ADDED Requirements

### Requirement: `supsub search <keyword>` 同步全量搜索

`supsub search <keyword>` SHALL 调 `GET /api/search?type=&keywords=&page=&pageSize=10`。`--type` 默认 `ALL`，归一为大写后 MUST 限制在 `{ALL, MP, WEBSITE, CONTENT}`。`--page` 默认 1。`-o json` 透传整个响应（含 `results / recommendations / prompts`）。

#### Scenario: 默认 ALL 搜索

- **GIVEN** mock 内含 `Anthropic Blog`、`高可用架构` 等
- **WHEN** 执行 `supsub search Anthropic -o json`
- **THEN** stdout 输出 `{"success":true,"data":{"results":[...],"recommendations":[...],"prompts":[...]}}`，`results.length >= 1`，至少一条 `type === "SOURCE"` 且 `data.name` 含 `Anthropic`

#### Scenario: --type CONTENT 仅返回内容

- **GIVEN** 关键词命中文章 title
- **WHEN** 执行 `supsub search AI --type CONTENT -o json`
- **THEN** `data.results` 中所有项 `type === "CONTENT"`，每条 `data.contentId/title/url` 完整

#### Scenario: --type 非法值

- **GIVEN** 用户输入 `--type FOO`
- **WHEN** 执行
- **THEN** 退出码 64，stderr 含 `--type 仅支持 ALL/MP/WEBSITE/CONTENT`，未发起 HTTP 请求

#### Scenario: 表格模式分两段

- **GIVEN** 命中结果且 `recommendations` 非空
- **WHEN** 执行 `supsub search Anthropic`（不带 -o json）
- **THEN** stdout 先打印 `Results` 表（含 `(N items, page 1)` 计数），再打印 `Recommendations` 表；`prompts` 不出现在表格输出，仅 -o json 携带

### Requirement: 网络层错误归一为 NETWORK_ERROR

任意 fetch 抛错时 MUST 以退出码 10 退出，stderr 输出 `网络异常，请稍后重试`，`-o json` SHALL 输出 ErrorEnvelope。

#### Scenario: mock 离线

- **GIVEN** mock server 已关闭
- **WHEN** 执行 `supsub --api-url http://localhost:8787 search foo`
- **THEN** 退出码 10，stderr 含 `网络异常，请稍后重试`；`-o json` 输出 `{"success":false,"error":{"code":"NETWORK_ERROR","status":0,"message":"网络异常，请稍后重试"}}`
