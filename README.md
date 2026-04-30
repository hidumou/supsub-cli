# SupSub CLI

SupSub 的命令行工具，让你在终端里直接管理订阅源、搜索内容、追踪公众号。

订公众号、订网站、搜文章、查动态——一条命令搞定，并且每条命令都支持 `-o json` 输出，便于在脚本里做后续处理。

---

## 安装

**推荐：从 npm 安装**

```bash
pnpm add -g @supsub/cli
# 或
npm i -g @supsub/cli
```

安装时会自动从 GitHub Release 下载对应平台（macOS / Linux / Windows，x64 / arm64）的预编译二进制，装好就能 `supsub --help`。

**从源码构建**（需要 [Bun](https://bun.sh/) 1.1+ 和 pnpm 10+）：

```bash
git clone https://github.com/hidumou/supsub-cli.git
cd supsub-cli
pnpm install
pnpm build
# 产物在 dist/supsub，软链到 PATH 即可使用
ln -sf "$PWD/dist/supsub" /usr/local/bin/supsub
```

或者直接用 `pnpm dev` 运行未编译版本：

```bash
pnpm dev auth status
```

---

## 三步开始用

**第一步：安装**
```bash
# 已完成，如上
```

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

# 翻页
supsub search "RAG" --page 2
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
  --page <n>                        页码，默认 1
```

### 搜索

```
supsub search <keyword>             全量搜索（订阅源 + 文章）
  --type <ALL|MP|WEBSITE|CONTENT>   搜索范围，默认 ALL
  --page <n>                        页码，默认 1
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
| `--api-key <key>` | 临时覆盖 API Key（优先级高于 env 和配置文件） |
| `-o, --output table\|json` | 输出格式，默认 `table` |

---

## 配置

凭证保存在 `~/.supsub/config.json`（目录权限 0700，文件权限 0600）：

```json
{
  "api_key": "sk_live_xxx",
  "client_id": "supsub-cli"
}
```

也支持环境变量（优先级高于配置文件）：

| 变量 | 说明 |
|------|------|
| `SUPSUB_API_KEY` | API Key |
| `SUPSUB_API_URL` | 覆盖 API 地址（默认 `https://supsub.net`） |

凭证解析优先级（高 → 低）：CLI flag `--api-key` > 环境变量 `SUPSUB_API_KEY` > 配置文件 `api_key` > 配置文件 `bearer_token`（手动从浏览器 DevTools 粘贴的临时会话 token）。

---

## 开发

项目结构：

```
src/        # 命令入口、API 客户端、UI 输出（Bun 运行时）
test/       # bun test 用例
```

常用脚本：

```bash
pnpm dev              # 直接运行 CLI（bun run src/index.ts）
pnpm build            # 编译为独立可执行文件（dist/supsub）
pnpm typecheck        # tsc --noEmit
pnpm test             # bun test
```

---

## Skills（AI agent 集成）

`skills/` 下每个子目录包含一份 `SKILL.md`，描述对应命令组的签名、参数、示例与 JSON 输出形态，专门给 Claude Code、Claude API 等 AI agent 阅读，使其能正确调用 `supsub`。npm 包也会一并分发这些文件。

| Skill | 路径 | 覆盖命令 |
|-------|------|----------|
| supsub-auth | `skills/supsub-auth/SKILL.md` | `auth login` / `auth status` / `auth logout` |
| supsub-sub | `skills/supsub-sub/SKILL.md` | `sub list` / `sub add` / `sub remove` / `sub contents` |
| supsub-search | `skills/supsub-search/SKILL.md` | `search <keyword>` 全量搜索 |
| supsub-mp | `skills/supsub-mp/SKILL.md` | `mp search`（异步） / `mp search-cancel` |

每份 skill 的 Prerequisites 都是同一句：`pnpm add -g @supsub/cli` 后 `supsub auth login`。Agent 在正式调用前先读 SKILL.md 即可拿到全部上下文。

---

## 自动化发布

`master` 分支打 `v*` tag 后，`.github/workflows/release.yml` 会：

1. 用 Bun 跨平台编译 5 份二进制（darwin / linux / windows × x64 / arm64，windows 仅 x64），打包成 `tar.gz` 或 `zip`。
2. 自动建一个 GitHub Release，附上各平台压缩包并由 `generate_release_notes` 自动生成变更说明。
3. 调用 `npm publish` 把 `@supsub/cli` 推到 npm 公共仓库（需要在 GitHub 仓库 Secrets 里配置 `NPM_TOKEN`）。

发版示例：

```bash
# 把版本写入 package.json，提交，再打 tag
pnpm version patch -m "release: v%s"
git push origin master
git push origin v$(node -p "require('./package.json').version")
```

---

## License

MIT
