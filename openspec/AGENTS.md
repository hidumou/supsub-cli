# supsub-cli OpenSpec 工作流（给 dev agents）

## 你是谁

- **cli-dev**：负责 `packages/cli`，认证、订阅 CRUD、搜索三个 change 都归你。
- **mockserver-dev**：负责 `packages/mock`，Hono mock 服务，给 cli-dev 提供可联调的后端。

## 工作前必读

1. **PRD**：`docs/PRD.md` — 产品视角的全貌（命令清单、错误码、配置文件、自更新等）。
2. **OpenAPI**：`api.json` — 所有 `/api/*` 接口字段的真相来源；如果 PRD 与 api.json 冲突，**以 api.json 为准**，并在你看到的 design.md 里有说明。
3. **本目录** `openspec/changes/<change-name>/`：
   - `proposal.md`：为什么要做、范围
   - `design.md`：技术决策、边界、踩坑提示（**必读**）
   - `tasks.md`：编号 checklist，颗粒度足够小，照做即可
   - `specs/<capability>/spec.md`：**验收的最小单元**。每个 Requirement 至少 2 个 Scenario（成功路径 + 边界/错误）

## 接到任务后

1. 找到 task lead 指给你的 change 目录，按顺序读 proposal → design → tasks → specs。
2. 实现某条 task 前，先把 spec 里对应的 Scenario 看一遍，确保你对验收标准有数。
3. 实现一条 task 后，把 `tasks.md` 中对应行的 `[ ]` 改成 `[x]`，附 commit 即可（**不要批量勾**，逐条勾保持可追溯）。
4. 遇到 spec 写得不清楚 / 与 api.json 矛盾 / 实施后才发现的边界问题：**不要自己拍板**，向 team-lead 提出，CTO 会更新 spec。

## 提交规范

- branch：`feat/<change-name>`（与 OpenSpec change 同名）
- commit message：以 `[<change-name>] <jq 短描述>` 起头，body 引用 task 编号，例如：
  ```
  [add-cli-auth-device-flow] 落地 device flow 轮询循环

  - tasks: 3.2, 3.3
  - 验收：mock server pending → finished，成功写入 ~/.supsub/config.json
  ```
- 一条 PR 通常关闭一个 change（也可以拆，但要在 PR 描述里写清覆盖了哪些 task）。

## 验证清单（每个 change 完成后）

- [ ] tasks.md 全勾或显式留白（留白要在 PR 描述里说明）
- [ ] `pnpm -r typecheck` 通过
- [ ] 该 change 涉及的 cli 命令在 mock server（`pnpm dev:mock`）下端到端跑通
- [ ] spec 中每个 Scenario 至少有一条手动验证记录或测试用例

## 不要做的事

- ❌ 自己加命令（即使你觉得「顺手做了更好」）— 跟 CTO 说，等 spec 更新
- ❌ 不读 api.json 凭直觉拼字段名
- ❌ 在 tasks.md 之外提交「重构」/「清理」commit（容易把 review 撕开）
- ❌ 跳过 mock server，直接打生产 API 联调

## 完成 change 之后

- 让 team-lead 触发 OpenSpec 的「archive」流程：把 `openspec/changes/<name>/specs/*` 合并进 `openspec/specs/`，change 目录归档。这一步由 CTO/lead 操作，dev 不用管。
