# SupSub CLI 授权流程（OAuth Device Flow）

> 本文以 mermaid 图为主，描述 `supsub auth login` 的设备授权（Device Flow）端到端流程、令牌轮询状态机、凭证解析优先级与相关端点契约。
> 实现位置：`src/api/auth.ts`、`src/commands/auth/device-flow.ts`、`src/commands/auth/login.ts`、`src/http/credentials.ts`、`src/config/store.ts`、`src/http/client.ts`。

---

## 1. 角色与组件

```mermaid
flowchart LR
    User([用户]):::actor
    CLI["SupSub CLI<br/>(supsub auth login)"]:::cli
    Browser["浏览器<br/>网站 /device 授权页"]:::web
    API["SupSub 后端 API<br/>(默认 supsub.net)"]:::api

    User -->|运行命令| CLI
    User -->|输入/确认设备码| Browser
    CLI <-->|device/code · device/token| API
    Browser -->|device/approve（带登录态）| API

    classDef actor fill:#fde68a,stroke:#b45309,color:#111;
    classDef cli fill:#bfdbfe,stroke:#1d4ed8,color:#111;
    classDef web fill:#bbf7d0,stroke:#15803d,color:#111;
    classDef api fill:#e9d5ff,stroke:#7c3aed,color:#111;
```

- **CLI** 负责申请设备码、轮询授权状态、落地令牌。
- **浏览器 / 网站 `/device` 页** 负责让**已登录用户**确认短码并审批设备（携带网页登录态调用 `device/approve`）。
- **后端 API** 串联三个端点、签发令牌。CLI 默认基址为 `https://supsub.net`，可用 `--api-url` flag 或 `SUPSUB_API_URL` 环境变量覆盖（flag 优先级更高）。

---

## 2. 设备授权时序（主流程）

```mermaid
sequenceDiagram
    autonumber
    actor U as 用户
    participant C as CLI
    participant B as 浏览器(/device)
    participant A as 后端 API

    U->>C: supsub auth login
    C->>A: POST /api/auth/device/code （无 body）
    A-->>C: { deviceCode, userCode,<br/>verificationUri(Complete), interval, expiresIn }
    C-->>U: stderr 打印 授权地址 + 授权码(userCode)
    Note over C: 非 SUPSUB_NO_BROWSER 时<br/>自动打开 verificationUriComplete

    par CLI 轮询
        loop 每 interval 秒，直到 expiresIn 截止
            C->>A: POST /api/auth/device/token { deviceCode }
            A-->>C: { status, accessToken?, refreshToken? }
            Note over C: pending → 继续轮询<br/>authorized → 跳出<br/>expired → 报错停止
        end
    and 用户网页审批
        U->>B: 打开 /device?code=userCode（已登录）
        U->>B: 确认短码 → 点「授权设备」
        B->>A: POST /api/auth/device/approve { userCode }<br/>Authorization: Bearer <网页 accessToken>
        A-->>B: { message: "授权成功" }
    end

    A-->>C: status=authorized + accessToken/refreshToken
    C->>C: writeConfig({ access_token, refresh_token, client_id })
    C-->>U: ✅ 登录成功
```

要点：
- `device/code`、`device/token` **不需要鉴权**，且**不走统一 `request()`**（避免 401→clearAuth 误触发），在 `src/api/auth.ts` 内用独立 `fetch` 实现。
- 授权地址优先用带码的 `verificationUriComplete`；缺失时回落 `verificationUri?user_code=<userCode>`。
- `device/token` 响应字段对 camelCase（`accessToken`）与 snake_case（`access_token`）均兼容。

---

## 3. 令牌轮询状态机

```mermaid
stateDiagram-v2
    [*] --> 申请设备码
    申请设备码 --> 轮询中: 拿到 deviceCode
    申请设备码 --> 失败: device/code 非 2xx<br/>(「无法获取设备码」)

    轮询中 --> 轮询中: status=pending<br/>(等待 interval)
    轮询中 --> 轮询中: 网络瞬时错误<br/>(忽略并重试)
    轮询中 --> 成功: status=authorized<br/>+ access/refresh token
    轮询中 --> 失败: status=expired<br/>(「设备码已过期」)
    轮询中 --> 失败: 超过 expiresIn 截止<br/>(「设备码已过期」)

    成功 --> [*]: 写入 config
    失败 --> [*]: 非 0 退出码
```

- `authorized` 但缺令牌 → 视为服务端异常，报「授权成功但未返回令牌」。
- 退出码遵循 `src/lib/exit-code.ts` 语义（`EXPIRED_TOKEN`/`SERVER_ERROR` 等映射为非 0）。

---

## 4. 凭证解析优先级（`resolveApiKey`）

每次请求由 `src/http/client.ts` 调 `resolveApiKey()` 解析出 Bearer 凭证，优先级从高到低：

```mermaid
flowchart TD
    A{--api-key flag?} -- 是 --> A1["key=flag 值<br/>source=flag"]
    A -- 否 --> B{env SUPSUB_API_KEY?}
    B -- 是 --> B1["source=env"]
    B -- 否 --> C{config.access_token?}
    C -- 是 --> C1["source=config<br/>（设备流登录写入）"]
    C -- 否 --> D{config.api_key?}
    D -- 是 --> D1["source=config<br/>（--api-key 登录写入）"]
    D -- 否 --> E{config.bearer_token?}
    E -- 是 --> E1["source=session<br/>（浏览器手动粘贴）"]
    E -- 否 --> F["未登录"]
```

- 设备流登录把令牌写入 `config.access_token` / `config.refresh_token`（见 `src/config/store.ts` 的 `Config`）。
- `--api-key` 快捷登录跳过设备流，直接写 `config.api_key`。
- 任意请求返回 401 → `client.ts` 调 `clearAuth()` 清除 `api_key`/`access_token`/`refresh_token`/`bearer_token`。

---

## 5. 两条登录路径

```mermaid
flowchart LR
    L["supsub auth login"] --> Q{带 --api-key?}
    Q -- 是 --> K["writeConfig(api_key, client_id)<br/>跳过设备流"]
    Q -- 否 --> DF["runDeviceFlow()<br/>设备授权"]
    DF --> S["writeConfig(access_token,<br/>refresh_token, client_id)"]
    K --> OK([✅ 登录成功])
    S --> OK
```

登录后 `supsub auth status` → `GET /api/user/info`（携带 Bearer）展示账号信息。

---

## 6. 端点契约（CLI 相关 3 个）

| 端点 | 方法 | 鉴权 | 请求 | 响应 |
|---|---|---|---|---|
| `/api/auth/device/code` | POST | 否 | 无 body | `{ deviceCode, userCode, verificationUri, verificationUriComplete, interval, expiresIn }` |
| `/api/auth/device/token` | POST | 否 | `{ deviceCode }` | `{ status: pending\|authorized\|expired, accessToken?, refreshToken? }` |
| `/api/auth/device/approve` | POST | 是（网页登录态） | `{ userCode }` | `{ message }` |

> 说明：`device/approve` 由**网站 `/device` 页**调用，CLI 不调用。基址 + path 拼接规则：CLI 请求 = `${SUPSUB_API_URL}` + 上述含 `/api` 前缀的 path。

---

## 7. 环境变量

| 变量 | 作用 | 默认 |
|---|---|---|
| `SUPSUB_API_URL` | 覆盖 API 基址（等价于 `--api-url` flag，但 flag 优先级更高） | `https://supsub.net` |
| `SUPSUB_API_KEY` | 注入 Bearer（source=env） | 无 |
| `SUPSUB_NO_BROWSER` | 真值时 `auth login` 不自动打开浏览器（e2e / 无头环境） | 未设 |
| `SUPSUB_CONFIG_DIR` | 覆盖配置目录（测试隔离用） | `~/.supsub` |
