# SupSub CLI

SupSub 的命令行工具，让你在终端里直接管理订阅源、搜索内容、追踪公众号、网站。

---

## 安装

```bash
pnpm add -g @supsub/cli
# 或
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

## 典型使用场景

**场景 1：订阅一个公众号**
```bash
# 先搜公众号，拿到 mpId
supsub mp search "阮一峰的网络日志"

# 拿到结果后用 mpId 添加订阅（type 必须指明 MP）
supsub sub add --source-id 12345 --type MP

# 查看这个公众号最近的未读文章
supsub sub contents --source-id 12345 --type MP
```

**场景 2：搜索内容**
```bash
# 全量搜索（源 + 文章）
supsub search "RAG"

# 仅搜公众号
supsub search "阮一峰" --type MP

# 仅搜文章正文
supsub search "向量数据库" --type CONTENT
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

**场景 4：脚本批处理**
```bash
# 导出全部订阅为 JSON，喂给后续脚本
supsub sub list -o json > subs.json

# 拉取某订阅源的全部内容（包含已读）
supsub sub contents --source-id 12345 --type MP --all -o json

# 在脚本里取搜索结果
supsub search "MCP 协议" -o json | jq '.data.results[].data.title'
```

`mp search` 是异步任务，CLI 默认同步等待结果（最长 30 秒）；超时会返回 `searchId`，可用 `supsub mp search-cancel <searchId>` 取消那个任务后再重试。

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

supsub sub add                      添加订阅
  --source-id <id>                  信息源 ID（必填，正整数）
  --type <MP|WEBSITE>               信息源类型（必填）
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
