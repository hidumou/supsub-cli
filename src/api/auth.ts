// packages/cli/src/api/auth.ts
import { request } from '../http/client.ts';
import { getApiUrl } from '../lib/api-url.ts';
import type { ErrorEnvelope } from '../lib/errors.ts';
import type { UserInfo } from '../lib/types.ts';

/** GET /api/user/info — 获取当前登录用户信息 */
export async function getUserInfo(): Promise<UserInfo> {
  return request<UserInfo>({
    method: 'GET',
    path: '/api/user/info',
  });
}

// ─── OAuth Device Flow 相关 ────────────────────────────────
// 这两个端点不走统一 request()：响应错误体是 OAuth 标准
// `{ error, error_description }`，与 supsub `{ code, message }`
// ErrorEnvelope 不兼容；并且端点本身处于"未登录"态、不应触发
// 401 → clearAuth 的统一行为。所以保留独立 fetch 实现，但
// 集中存放在 api 层以保持工程一致性。

export type DeviceCodeResponse = {
  code: string;
  verification_uri: string;
  user_code: string;
  expires_in: number;
  interval: number;
};

export type DeviceTokenResponse = {
  api_key: string;
  client_id: string;
};

export type DeviceTokenErrorBody = {
  error?: string;
  error_description?: string;
  code?: string;
  message?: string;
  data?: { error?: string };
};

export type DeviceTokenPollResult =
  | { ok: true; data: DeviceTokenResponse }
  | { ok: false; status: number; error: DeviceTokenErrorBody };

/** POST /open/api/v1/oauth/device/code — 申请设备码 */
export async function requestDeviceCode(): Promise<DeviceCodeResponse> {
  const apiUrl = getApiUrl();
  const res = await fetch(`${apiUrl}/open/api/v1/oauth/device/code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_name: 'supsub-cli' }),
  });
  if (!res.ok) {
    throw {
      code: 'SERVER_ERROR',
      message: '无法获取设备码，请稍后重试',
      status: res.status,
    } satisfies ErrorEnvelope;
  }
  return (await res.json()) as DeviceCodeResponse;
}

/**
 * POST /open/api/v1/oauth/token — 轮询授权 token
 *
 * - 网络异常 → 抛出（调用方一般 catch 后继续重试）
 * - 200      → { ok: true, data }
 * - 4xx      → { ok: false, status, error }，由调用方解析 OAuth 错误码
 *              （authorization_pending / slow_down / expired_token / access_denied）
 */
export async function pollDeviceToken(code: string): Promise<DeviceTokenPollResult> {
  const apiUrl = getApiUrl();
  const res = await fetch(`${apiUrl}/open/api/v1/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'device_code',
      client_id: 'supsub-cli',
      code,
    }),
  });
  if (res.ok) {
    return { ok: true, data: (await res.json()) as DeviceTokenResponse };
  }
  const error = (await res.json().catch(() => ({}))) as DeviceTokenErrorBody;
  return { ok: false, status: res.status, error };
}
