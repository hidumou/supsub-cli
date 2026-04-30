---
name: supsub-auth
version: 0.1.0
description: Manage authentication for the SupSub CLI
---

# supsub-auth Skill

Log in, log out, and check authentication status for the SupSub CLI.

## Prerequisites

- 安装：`pnpm add -g @supsub/cli`（或 `npm i -g @supsub/cli`）
- 凭证保存在 `~/.supsub/config.json`（目录权限 0700，文件权限 0600）。也可通过 `SUPSUB_API_KEY` 环境变量或全局 `--api-key` flag 临时覆盖；优先级：`--api-key` > `SUPSUB_API_KEY` > 配置文件 `api_key` > 配置文件 `bearer_token`。

## Commands

### Log in

```
supsub auth login
supsub --api-key <key> auth login
```

| Mode | Command | Description |
|------|---------|-------------|
| OAuth (recommended) | `supsub auth login` | Opens the browser to run OAuth Device Flow; saves credentials automatically |
| API Key | `supsub --api-key <key> auth login` | Saves the provided key directly, no browser needed |

```bash
# OAuth flow（默认，自动打开浏览器）
supsub auth login

# 用 API Key 直接登录（注意：--api-key 是全局 flag，写在 auth login 之前）
supsub --api-key sk_live_xxx auth login
```

> 说明：`--api-key` 是顶层全局 flag。直接 `supsub auth login --api-key ...` 在某些 commander 版本下会被解析，但官方推荐顺序是 `supsub --api-key ... auth login`。
>
> JSON 模式 (`-o json`) 下，登录成功 stdout 输出 `{"success":true,"data":{"client_id":"supsub-cli"}}`；提示信息走 stderr。

---

### Check status

```
supsub auth status
```

Shows the current logged-in user, masked API key, and the source of credentials (cli / env / config).

```bash
supsub auth status
supsub auth status -o json
```

JSON shape:

```json
{
  "success": true,
  "data": {
    "email": "...",
    "name": "...",
    "client_id": "supsub-cli",
    "api_key_source": "config",
    "api_key": "sk_live_***xxxx"
  }
}
```

If unauthenticated, exits with code `2` (`UNAUTHORIZED`) and a message asking the user to run `supsub auth login`.

---

### Log out

```
supsub auth logout
```

Removes saved credentials from `~/.supsub/config.json`.

```bash
supsub auth logout
supsub auth logout -o json
```

JSON 模式下输出 `{"success":true,"data":{}}`。

---

## Agent Usage Notes

- 在调用其他 supsub 子命令之前先跑 `supsub auth status`，确认凭证有效；未登录时引导用户 `supsub auth login`。
- `--api-key` 是 **全局** flag（注册在顶层 `program` 上），传一次即可临时覆盖整个调用链的凭证；它不会写入配置文件，只对本次 invocation 生效。
- 优先级（高 → 低）：CLI `--api-key` > `SUPSUB_API_KEY` env > 配置文件 `api_key` > 配置文件 `bearer_token`。
- 401 响应会自动清除本地存储的 API Key（见 `src/http/credentials.ts`）；遇到 exit code `2` 时通常需要重新登录。
- 解析 JSON 时使用 `-o json`；常见 exit code：`0` OK，`2` UNAUTHORIZED，`3` PLAN_EXPIRED，`10` NETWORK，`11` SERVER，`64` INVALID_ARGS。
- 自定义 API base URL：设置 `SUPSUB_API_URL`（默认 `https://supsub.net`），用于本地或测试环境。
