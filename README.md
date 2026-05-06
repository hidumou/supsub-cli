# SupSub CLI

[![npm version](https://img.shields.io/npm/v/@supsub/cli.svg)](https://www.npmjs.com/package/@supsub/cli)
[![npm downloads](https://img.shields.io/npm/dm/@supsub/cli.svg)](https://www.npmjs.com/package/@supsub/cli)
[![license](https://img.shields.io/npm/l/@supsub/cli.svg)](https://github.com/hidumou/supsub-cli/blob/master/LICENSE)
[![node](https://img.shields.io/node/v/@supsub/cli.svg)](https://www.npmjs.com/package/@supsub/cli)

[SupSub](https://supsub.net) 的命令行工具，让你在终端里直接管理订阅源、搜索内容、追踪公众号、网站。

---

## 安装

```bash
npm i -g @supsub/cli
```

支持 macOS / Linux / Windows（x64 / arm64）。

---

## 三步开始用

**第一步：安装**（如上）

**第二步：登录**
```bash
supsub auth login
```
会自动打开浏览器走 OAuth Device Flow 完成授权。也可以直接用 API Key：
```bash
supsub auth login --api-key sk_live_xxx
```

**第三步：开始用**
```bash
# 看看自己的订阅源
supsub sub list

# 搜一个公众号订上
supsub mp search "阮一峰"

# 搜全站内容
supsub search "RAG"
```

---

## 使用场景

**场景 1：订阅一个公众号**
```bash
# 先搜公众号，拿到 mpId（base64 字符串，例如 MzkyNTYzODk0NQ==）
supsub mp search "阮一峰的网络日志"

# 用 --mp-id 添加订阅（不需要 --type，默认 MP）
supsub sub add --mp-id "MzkyNTYzODk0NQ=="

# 之后想看这个公众号的未读文章，从 sub list 拿到内部 sourceId 即可
supsub sub list --type MP
supsub sub contents --source-id 12345 --type MP
```

**场景 2：搜索内容**
```bash
# 全量搜索（源 + 文章）
supsub search "AI"

# 仅搜公众号
supsub search "Agent" --type MP

# 仅搜文章正文
supsub search "Claude" --type CONTENT
```

**场景 3：管理订阅**
```bash
# 列出所有订阅源
supsub sub list

# 仅看已订阅的网站
supsub sub list --type WEBSITE

# 取消订阅
supsub sub remove --source-id 12345 --type MP
```

---

## 完整命令参考

### 认证

```
supsub auth login                   OAuth 登录（浏览器授权）
supsub auth login --api-key <key>   直接用 API Key 登录
supsub auth status                  查看当前登录状态
supsub auth logout                  退出登录（清除本地凭证）
```

### 订阅源

```
supsub sub list                     列出全部订阅源
  --type <MP|WEBSITE>               按类型过滤

supsub sub add                      添加订阅（--source-id 与 --mp-id 二选一）
  --source-id <id>                  内部信息源 ID（正整数，来自 search / sub list）
  --mp-id <mpId>                    公众号 mpId（base64，来自 mp search）
  --type <MP|WEBSITE>               --source-id 模式必填；--mp-id 模式可省，默认 MP
  --group <gid>                     分组 ID（可重复指定）

supsub sub remove                   取消订阅
  --source-id <id>                  必填
  --type <MP|WEBSITE>               必填

supsub sub contents                 查看订阅源内的文章
  --source-id <id>                  必填
  --type <MP|WEBSITE>               必填
  --unread                          仅未读（默认）
  --all                             全部文章（与 --unread 互斥）
```

### 搜索

```
supsub search <keyword>             全量搜索（订阅源 + 文章）
  --type <ALL|MP|WEBSITE|CONTENT>   搜索范围，默认 ALL
```

### 公众号

```
supsub mp search <name>             搜索公众号（异步，自动轮询 30s）
supsub mp search-cancel <searchId>  取消正在执行的搜索任务
```

---

## 全局参数

| 参数 | 说明 |
|------|------|
| `--api-key <key>` | 指定 API Key |
| `-o, --output table\|json` | 输出格式，默认 `table` |

## 环境变量

| 变量 | 说明 |
|------|------|
| `SUPSUB_API_KEY` | API Key（同 `--api-key`，命令行 flag 优先级更高） |
---

## Skills（AI agent 集成）

`skills/` 遵循 [Agent Skills 规范](https://agentskills.io)，可在 Claude Code、Cursor、Gemini CLI、Codex、Copilot 等兼容 agent 中使用。

| Skill | 覆盖命令 |
|-------|----------|
| supsub-auth | `auth login` / `auth status` / `auth logout` |
| supsub-sub | `sub list` / `sub add` / `sub remove` / `sub contents` |
| supsub-search | `search <keyword>` |
| supsub-mp | `mp search` / `mp search-cancel` |

### 安装

Claude Code（推荐）：

```shell
/plugin marketplace add hidumou/supsub-cli
/plugin install supsub-cli@supsub
```

其他 agent，用 [`skills` CLI](https://github.com/vercel-labs/skills)：

```bash
npx skills add hidumou/supsub-cli
```

### 使用

装完后直接用自然语言即可，agent 会自动调用对应的 skill：

> 帮我订阅「阮一峰的网络日志」这个公众号

> 搜一下最近关于 RAG 的文章，挑 3 条给我

---

## License

MIT
