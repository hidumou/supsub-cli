# output-formats spec delta

## ADDED Requirements

### Requirement: `-o table` 是默认且面向人

未指定 `-o` 时 SHALL 输出渲染过的 ASCII 表格，使用 `cli-table3` + 自实现的 CJK 字宽截断。列表末尾打印 `(N items)` 计数。空列表打印 `(empty)`。

#### Scenario: 中文字段不会撕裂表格

- **GIVEN** 一行数据中含 `name: "歸藏的AI工具箱"`，列宽设定为 12 字符
- **WHEN** `printTable` 渲染
- **THEN** 该列内容按 CJK 字符 2 列宽计算后在第 12 列右边截断并补 `…`，不破坏边框对齐

#### Scenario: 空数组打印 `(empty)`

- **GIVEN** 命令返回的 data 数组长度为 0
- **WHEN** `-o table` 渲染
- **THEN** 输出仅含表头分隔线与 `(empty)` 占位，不出现 `(0 items)` 这类副标

### Requirement: `-o json` 是机器可消费且 jq-friendly

`-o json` 时所有输出 MUST 严格符合：

- 成功：`{ "success": true, "data": <api-response 透传> }`
- 失败：`{ "success": false, "error": { "code", "message", "status", "data"? } }`

输出经 `JSON.stringify(_, null, 2)` 缩进，写到 stdout（**不**写 stderr）。失败仍然要让 `jq` 能解析（即「失败也是合法 JSON」），调用方靠 `success` 与退出码联合判断。

#### Scenario: 成功响应原样透传

- **GIVEN** 用户运行 `supsub sub list -o json`
- **WHEN** 后端返回数组
- **THEN** stdout 输出 `{"success": true, "data": [...]}`，`data` 字段值与后端原样一致（不重命名、不丢字段）

#### Scenario: 失败仍输出合法 JSON 到 stdout

- **GIVEN** 用户运行 `supsub auth status -o json`，`api_key` 已过期
- **WHEN** 收到 401
- **THEN** stdout 输出 `{"success": false, "error": {"code": "UNAUTHORIZED", "message": "...", "status": 401}}`，stderr 不打印任何文本，退出码为 2，`jq '.success'` 输出 `false`

### Requirement: 进度提示禁止污染 stdout

任何 spinner、轮询提示、登录提示文案，MUST 写到 stderr；stdout 仅承载最终结果。`-o json` 时 stderr 也保持静默（除非用户主动按 Ctrl-C 等导致 fatal abort 的情况）。

#### Scenario: 同步轮询的 `…` 不破坏 jq

- **GIVEN** 用户运行 `supsub mp search "晚点 LatePost" -o json`
- **WHEN** 轮询 mock server 期间
- **THEN** stdout 仅在最终 finished 时输出一次 JSON；中间过程的等待提示一律走 stderr 或干脆静默
