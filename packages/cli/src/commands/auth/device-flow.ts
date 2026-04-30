// packages/cli/src/commands/auth/device-flow.ts
import { sleep } from "../../lib/sleep.ts";
import { requestDeviceCode, pollDeviceToken } from "../../api/auth.ts";
import type { ErrorEnvelope } from "../../lib/errors.ts";

function openBrowser(url: string): void {
  const cmd =
    process.platform === "darwin"
      ? ["open", url]
      : process.platform === "win32"
        ? ["rundll32", "url.dll,FileProtocolHandler", url]
        : ["xdg-open", url];
  try {
    Bun.spawn(cmd, { stdout: "ignore", stderr: "ignore" });
  } catch {
    // 不阻塞、不抛
  }
}

/**
 * 计算初始轮询间隔。
 * RFC 8628 fallback：服务端漏返或非正数时回落到 5 秒。
 */
export function pickInitialIntervalMs(serverInterval: number): number {
  return serverInterval > 0 ? serverInterval * 1000 : 5_000;
}

/**
 * 执行 OAuth Device Flow，返回 { api_key, client_id }
 * apiUrl 由 api 层内部从 env/默认常量解析，不再走函数参数。
 */
export async function runDeviceFlow(): Promise<{
  api_key: string;
  client_id: string;
}> {
  // 1. 申请设备码
  const { code, verification_uri, user_code, expires_in, interval } =
    await requestDeviceCode();

  // 2. 打印提示并尝试打开浏览器
  const verificationUrl = `${verification_uri}?user_code=${encodeURIComponent(user_code)}`;
  process.stderr.write(`请在浏览器打开 ${verificationUrl}\n`);
  process.stderr.write(`授权码: ${user_code}\n`);
  process.stderr.write(`等待授权中...\n`);
  openBrowser(verificationUrl);

  // 3. 轮询
  let intervalMs = pickInitialIntervalMs(interval);
  const deadline = Date.now() + expires_in * 1000;

  while (Date.now() < deadline) {
    await sleep(intervalMs);

    let result: Awaited<ReturnType<typeof pollDeviceToken>>;
    try {
      result = await pollDeviceToken(code);
    } catch {
      // 网络闪断，继续重试
      continue;
    }

    if (result.ok) {
      return {
        api_key: result.data.api_key,
        client_id: result.data.client_id,
      };
    }

    // 400 系列错误：兼容 OAuth2 标准（顶层 error）与 supsub ErrorEnvelope（data.error）
    const errCode = result.error.data?.error ?? result.error.error ?? "";

    if (errCode === "authorization_pending") {
      continue;
    } else if (errCode === "slow_down") {
      intervalMs += 1000;
      continue;
    } else if (errCode === "expired_token") {
      throw {
        code: "EXPIRED_TOKEN",
        message: "设备码已过期，请重新运行 supsub auth login",
        status: 0,
      } satisfies ErrorEnvelope;
    } else if (errCode === "access_denied") {
      throw {
        code: "ACCESS_DENIED",
        message: "用户拒绝授权",
        status: 0,
      } satisfies ErrorEnvelope;
    } else {
      throw {
        code: "SERVER_ERROR",
        message: result.error.error_description ?? "授权失败",
        status: result.status,
      } satisfies ErrorEnvelope;
    }
  }

  // 超时
  throw {
    code: "EXPIRED_TOKEN",
    message: "设备码已过期，请重新运行 supsub auth login",
    status: 0,
  } satisfies ErrorEnvelope;
}
