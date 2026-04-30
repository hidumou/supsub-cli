# Design: add-cli-bearer-token-auth

## 关键决策

### 1. 为什么不直接复用 `api_key` 字段？

技术上完全可以——`http/client.ts` 把 `apiKey` 拼成 `Authorization: Bearer <apiKey>`，而真实后端的浏览器会话 token 同样以 `Bearer` 模式被接受。所以理论上用户把浏览器 token 写进 `api_key` 字段也能工作。

但选择**新建 `bearer_token` 字段**，原因：

1. **语义自描述**：未来某人翻 `~/.supsub/config.json`，能立刻看出"这是从浏览器临时粘贴的会话 token，不是后端签发的长效 api_key"。混在 `api_key` 里会造成误解（甚至可能上传/分享时被当作长效凭证泄露）。
2. **`auth status` 区分来源**：source = `session` 时可以提示"临时凭证，可能在几小时后失效，失效后请重新粘贴"。
3. **未来差异化的扩展空间**：如果后端后续要求浏览器会话也带 cookie / CSRF / 不同 client_id，这层抽象已就位。

成本：增加一个可选字段 + 4 处代码改动。性价比合理。

### 2. 优先级顺序

`flag > env > config.api_key > config.bearer_token`

**`bearer_token` 排在最后**，因为：

- 它是临时凭证，期望寿命短（按浏览器会话的 token TTL，通常几小时）
- `api_key`（一旦后端上线）应该是长期、机器友好的形式，优先使用
- 用户调试时往往同时配着两种，让"长期凭证"自然胜出，避免误用临时 token

### 3. clearAuth 同步清除 `bearer_token`

401 触发的 `clearAuth()` 必须**同时**清除 `bearer_token`：

- 浏览器会话 token 一旦 401 几乎肯定是 TTL 过期，留着没意义
- 不清除会导致下次请求继续 401，陷入循环（CLI 在 401 时清 config 的目的就是让用户主动重 login）
- 用户重新粘贴成本极低（再去浏览器 DevTools 复制一次），不需要"保留以备调试"

### 4. resolveApiKey 返回 `source` 字段

原签名：
```ts
type ResolvedCredentials = { key?: string; clientId?: string };
```

新签名：
```ts
type ResolvedCredentials = {
  key?: string;
  clientId?: string;
  source?: "flag" | "env" | "config" | "session";
};
```

`source` 在 `key === undefined` 时也是 `undefined`（未登录态）。

`auth/status.ts` 原本用一个内部函数 `getApiKeySource(globalOpts)` 重新计算来源——但它无法区分 `config.api_key` 与 `config.bearer_token`，因为没读 config。改用 `resolveApiKey` 返回的 `source` 字段后，该辅助函数被删除（去重）。

### 5. 用户操作流（文档侧）

`bearer_token` 是显式手动操作，CLI 不提供 `auth set-bearer` 这类便捷子命令——避免引入"半自动化"的中间形态，保持明确「这是临时调试通路」的边界。

正确流程（写在 design.md 供后续参考，不强制嵌入 CLI 输出）：

1. 用浏览器登录 supsub web
2. 打开 DevTools → Network 面板
3. 找一个 supsub 后端请求，查看 `Authorization` 请求头
4. 复制 `Bearer ` 之后的 token
5. 编辑 `~/.supsub/config.json`，写入：
   ```json
   { "bearer_token": "<paste>", "client_id": "supsub-cli" }
   ```
6. `chmod 600 ~/.supsub/config.json`（如已存在则继承现有权限）
7. 跑 `supsub auth status` 验证：source 应显示 `session`

## 边界

- 不做 token 格式校验（JWT、opaque 都接受，CLI 不解码）
- 不做 token 自动刷新（浏览器会话过期就让 401 触发 `clearAuth` + 提示重新粘贴）
- 不做"双 token 并存时哪个生效"的自定义配置——靠固定优先级
- 不引入新的环境变量（`SUPSUB_BEARER_TOKEN` 不必要——env 路径用已有的 `SUPSUB_API_KEY` 即可）
