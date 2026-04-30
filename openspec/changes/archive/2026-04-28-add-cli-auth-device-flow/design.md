# Design: add-cli-auth-device-flow

## 1. 配置文件

```ts
// packages/cli/src/config/store.ts
type Config = {
  api_key?: string;
  client_id?: string;
};

const CONFIG_DIR = path.join(os.homedir(), ".supsub");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

export async function readConfig(): Promise<Config> { ... }
export async function writeConfig(patch: Partial<Config>): Promise<void> { ... }
export async function clearAuth(): Promise<void> { /* 删除 api_key、client_id */ }
```

- 写入前：`mkdir -p ~/.supsub` 且 `chmod 0700`；写文件后 `chmod 0600`（Windows 无 chmod，跳过即可，但仍写文件）
- `readConfig` 文件不存在返回 `{}`
- `writeConfig` 是 patch（合并），不要整体覆盖

## 2. API Key 优先级链

```ts
// packages/cli/src/http/credentials.ts
export async function resolveApiKey(globalOpts: { apiKey?: string }): Promise<{ key?: string; clientId?: string }> {
  if (globalOpts.apiKey) return { key: globalOpts.apiKey, clientId: "supsub-cli" };
  if (process.env.SUPSUB_API_KEY) return { key: process.env.SUPSUB_API_KEY, clientId: "supsub-cli" };
  const cfg = await readConfig();
  return { key: cfg.api_key, clientId: cfg.client_id ?? "supsub-cli" };
}
```

注意：`auth login` 命令本身**不需要** key（它是为了拿 key），所以走 device flow 的代码路径不调 `resolveApiKey`。

## 3. HTTP 客户端

```ts
// packages/cli/src/http/client.ts
export async function request<T>(opts: {
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;                 // "/api/user/info"
  apiUrl: string;               // 来自 program.opts().apiUrl
  apiKey?: string;              // 已 resolve；undefined 表示无 key（仅 oauth 路径用）
  clientId?: string;
  query?: Record<string, string | number | undefined>;
  body?: unknown;
}): Promise<T>;
```

- 自动拼 query string（undefined 字段跳过）
- 默认头：`Authorization: Bearer <apiKey>`（仅 apiKey 存在时）、`X-Client-ID: <clientId ?? "supsub-cli">`、`Content-Type: application/json`
- 解析响应：
  - HTTP 2xx 且 body 非空 → JSON parse 后返回
  - HTTP 2xx 且 body 空（204）→ 返回 `undefined as T`
  - HTTP 401 → 调 `clearAuth()`、抛 `{ code: "UNAUTHORIZED", message: "请运行 supsub auth login 重新登录", status: 401 }`
  - HTTP 4xx/5xx 且 body 是 ErrorResponse 形态 → 透传 `throw envelope`
  - HTTP 4xx/5xx 且 body 不可解析 → `throw { code: "SERVER_ERROR", message: <text>, status }`
  - fetch 抛 → `throw { code: "NETWORK_ERROR", message: "网络异常，请稍后重试", status: 0 }`

## 4. Device flow 轮询

```ts
// packages/cli/src/commands/auth/device-flow.ts
export async function runDeviceFlow(apiUrl: string): Promise<{ api_key: string; client_id: string }> {
  // 1. POST /open/api/v1/oauth/device/code body {client_name:"supsub-cli"}
  // 2. 打印提示并尝试 open verification_uri (附 user_code 作为 query)
  // 3. setInterval(interval*1000) 轮询 POST /open/api/v1/oauth/token
  //    body { grant_type:"device_code", client_id:"supsub-cli", code: device_code }
  //    分支：
  //      - 200 → resolve(api_key, client_id)
  //      - 400 + data.error in {"authorization_pending","slow_down"} → 继续；slow_down 把 interval 增加 1s
  //      - 400 + data.error === "expired_token" → reject (code: EXPIRED_TOKEN)
  //      - 400 + data.error === "access_denied" → reject (code: ACCESS_DENIED)
  // 4. 总耗时上限 = expires_in 秒；超时 reject
}
```

打开浏览器：

```ts
function openBrowser(url: string) {
  const cmd = process.platform === "darwin" ? ["open", url]
            : process.platform === "win32" ? ["rundll32", "url.dll,FileProtocolHandler", url]
            : ["xdg-open", url];
  try { Bun.spawn(cmd, { stdout: "ignore", stderr: "ignore" }); } catch {}
  // 不 await、不抛
}
```

提示文案（写到 stderr，避免污染 `-o json`）：
```
请在浏览器打开 <verification_uri>?user_code=<user_code>
授权码: <user_code>
等待授权中...
```

## 5. 命令实现

### auth login

```
supsub auth login                 → runDeviceFlow → writeConfig({ api_key, client_id }) → 打印 ✅ 登录成功 (stderr)
supsub auth login --api-key <k>   → 直接 writeConfig({ api_key: k, client_id: "supsub-cli" })
                                    （不验证 key 有效性，让后续命令在 401 时回到登录路径）
```

### auth logout

调 `clearAuth()`，stderr 打印 `已登出`。

### auth status

```
const { key, clientId } = await resolveApiKey(opts);
if (!key) → throw { code: "UNAUTHORIZED", message: "尚未登录", status: 0 } → exit 2
const info = await request<UserInfo>({ method:"GET", path:"/api/user/info", apiUrl, apiKey: key, clientId });
-o table → 打印 email、name、client_id、api 来源（cli flag / env / config）
-o json  → { success: true, data: { email, name, client_id, api_key_source: "config|env|flag" } }
```

注意：auth status 输出的 `api_key` 字段一律打码为 `sk_live_***<最后 4 位>`，避免日志泄漏。

## 6. 401 处理与本 change 的协作点

http 客户端在 401 时直接 `clearAuth()`，所以**任何**命令命中 401 都会清空配置。`auth status` 收到 401 后展示「请运行 supsub auth login 重新登录」并退出 2。
