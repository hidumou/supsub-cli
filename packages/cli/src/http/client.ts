// packages/cli/src/http/client.ts
import { clearAuth } from "../config/store.ts";
import { getApiUrl } from "../lib/api-url.ts";
import { resolveApiKey } from "./credentials.ts";
import type { ErrorEnvelope } from "../lib/errors.ts";

type RequestOpts = {
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
};

/**
 * 统一 HTTP 请求客户端
 * - apiUrl / apiKey / clientId 等鉴权与基地址在内部解析
 *   （来源优先级：CLI flag > env > 配置文件），调用方无需透传
 * - 自动拼 query string（undefined 字段跳过）
 * - 自动注入 Authorization / X-Client-ID / Content-Type 头
 * - 401 → clearAuth() + 抛 UNAUTHORIZED
 * - 4xx/5xx → 尝试解析 ErrorResponse，失败则包装
 * - fetch 抛错 → 包装为 NETWORK_ERROR
 */
export async function request<T>(opts: RequestOpts): Promise<T> {
  const { method, path, query, body } = opts;

  const apiUrl = getApiUrl();
  const { key: apiKey, clientId } = await resolveApiKey();

  // 构建 URL + query string
  const url = new URL(path, apiUrl);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined) {
        url.searchParams.set(k, String(v));
      }
    }
  }

  // 构建请求头
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Client-ID": clientId ?? "supsub-cli",
  };
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  // 发送请求
  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    throw {
      code: "NETWORK_ERROR",
      message: "网络异常，请稍后重试",
      status: 0,
      data: String(err),
    } satisfies ErrorEnvelope;
  }

  // 处理 401
  if (response.status === 401) {
    await clearAuth();
    throw {
      code: "UNAUTHORIZED",
      message: "请运行 supsub auth login 重新登录",
      status: 401,
    } satisfies ErrorEnvelope;
  }

  // 处理 2xx
  if (response.ok) {
    // 204 No Content
    if (response.status === 204) {
      return undefined as T;
    }
    const text = await response.text();
    if (!text) return undefined as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      return text as T;
    }
  }

  // 处理 4xx/5xx
  const text = await response.text().catch(() => "");
  let errEnvelope: ErrorEnvelope;
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    if (typeof parsed["code"] === "string" && typeof parsed["message"] === "string") {
      errEnvelope = {
        code: parsed["code"],
        message: parsed["message"],
        status: response.status,
        data: parsed["data"],
      };
    } else {
      errEnvelope = {
        code: "SERVER_ERROR",
        message: text || response.statusText,
        status: response.status,
      };
    }
  } catch {
    errEnvelope = {
      code: "SERVER_ERROR",
      message: text || response.statusText,
      status: response.status,
    };
  }
  throw errEnvelope;
}
