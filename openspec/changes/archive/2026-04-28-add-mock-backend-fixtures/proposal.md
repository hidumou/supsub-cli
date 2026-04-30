# add-mock-backend-fixtures

## Why

cli-dev 在 add-cli-auth-device-flow / add-cli-subscription-crud / add-cli-source-search 三个 change 里要落地命令实现，**没有真后端可对接**：

- 生产 supsub 后端的 OAuth Device Flow 接口尚未上线（PRD §「后端依赖」明确这是 CLI 的前置工作）
- 即便上线，cli-dev 也不应该用生产数据做端到端联调（污染、限流）
- 既要让 cli `auth login` 走完 device flow 闭环，又要让 `sub list` → `sub contents` → `sub mark-read` 这种链路能用真实数据跑

因此需要一个**只在开发态运行**的 Hono mock server，端口 8787，按 PRD 与 api.json 的字段约定提供完整 fixture，并实现两处状态机（device flow 授权、mp 搜索任务异步轮询）。

## What Changes

- 在 `packages/mock` 落地 Hono 路由，覆盖 v1 命令所需的所有后端接口
- 内存 fixture：5 个公众号、3 个网站订阅源、每个源 3-10 篇文章，单一 demo 用户
- Device flow 状态机：`pending → authorized | denied | expired`，`/device` 提供最简 HTML 授权页（自动授权链接 / 手动确认 / 拒绝按钮）
- mp 搜索任务状态机：创建后 3-6s 内由 `finished:false` 翻为 `finished:true`
- 错误响应严格符合 api.json `ErrorResponse-62`（`{ code, message, status, data? }`）
- 鉴权：`Authorization: Bearer <api_key>` 必须命中预置 demo key，否则 401

## Impact

- Affected specs: mock-server（首次新增）
- Affected code: `packages/mock/src/**`（全部新建）
- Breaking? no
