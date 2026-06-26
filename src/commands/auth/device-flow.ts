// packages/cli/src/commands/auth/device-flow.ts

import { pollDeviceToken, requestDeviceCode } from '../../api/auth.ts';
import type { ErrorEnvelope } from '../../lib/errors.ts';
import { sleep } from '../../lib/sleep.ts';
import { withSpinner } from '../../ui/spinner.ts';

function openBrowser(url: string): void {
  const cmd =
    process.platform === 'darwin'
      ? ['open', url]
      : process.platform === 'win32'
        ? ['rundll32', 'url.dll,FileProtocolHandler', url]
        : ['xdg-open', url];
  try {
    Bun.spawn(cmd, { stdout: 'ignore', stderr: 'ignore' });
  } catch {
    // 不阻塞、不抛
  }
}

/**
 * 判断环境变量是否为「真值」。
 * 用于 SUPSUB_NO_BROWSER 护栏：空串 / '0' / 'false' 视为假，其余非空字符串视为真。
 */
function isTruthyEnv(value: string | undefined): boolean {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  return v !== '' && v !== '0' && v !== 'false';
}

/**
 * 计算初始轮询间隔。
 * RFC 8628 fallback：服务端漏返或非正数时回落到 5 秒。
 */
export function pickInitialIntervalMs(serverInterval: number): number {
  return serverInterval > 0 ? serverInterval * 1000 : 5_000;
}

/**
 * 执行设备授权流程（状态轮询），返回 { access_token, refresh_token }。
 * apiUrl 由 api 层内部从 env/默认常量解析，不再走函数参数。
 */
export async function runDeviceFlow(): Promise<{
  access_token: string;
  refresh_token: string;
}> {
  // 1. 申请设备码
  const { deviceCode, userCode, verificationUri, verificationUriComplete, interval, expiresIn } =
    await requestDeviceCode();

  // 2. 拼接授权地址：优先使用带码的 verificationUriComplete（可直接打开），
  //    缺失时回落到 verificationUri + userCode。
  const verificationUrl =
    verificationUriComplete && verificationUriComplete.trim() !== ''
      ? verificationUriComplete
      : `${verificationUri}?user_code=${encodeURIComponent(userCode)}`;

  // 3. 打印提示，并按需打开浏览器
  process.stderr.write(`请在浏览器打开 ${verificationUrl}\n`);
  process.stderr.write(`授权码: ${userCode}\n`);
  // SUPSUB_NO_BROWSER 为真值时跳过自动打开浏览器（e2e / 无头环境）
  if (!isTruthyEnv(process.env.SUPSUB_NO_BROWSER)) {
    openBrowser(verificationUrl);
  }

  // 4. 轮询授权状态（用 spinner 避免「等待授权中」期间黑屏）
  const intervalMs = pickInitialIntervalMs(interval);
  const deadline = Date.now() + expiresIn * 1000;

  return withSpinner('等待浏览器授权中…', async () => {
    while (Date.now() < deadline) {
      await sleep(intervalMs);

      let result: Awaited<ReturnType<typeof pollDeviceToken>>;
      try {
        result = await pollDeviceToken(deviceCode);
      } catch {
        // 网络闪断 / 瞬时错误，继续重试
        continue;
      }

      if (result.status === 'authorized') {
        if (!result.accessToken || !result.refreshToken) {
          throw {
            code: 'SERVER_ERROR',
            message: '授权成功但未返回令牌，请重试',
            status: 0,
          } satisfies ErrorEnvelope;
        }
        return {
          access_token: result.accessToken,
          refresh_token: result.refreshToken,
        };
      }

      if (result.status === 'expired') {
        throw {
          code: 'EXPIRED_TOKEN',
          message: '设备码已过期，请重新运行 supsub auth login',
          status: 0,
        } satisfies ErrorEnvelope;
      }

      // status === 'pending' → 继续轮询
    }

    // 超过有效期仍未授权
    throw {
      code: 'EXPIRED_TOKEN',
      message: '设备码已过期，请重新运行 supsub auth login',
      status: 0,
    } satisfies ErrorEnvelope;
  });
}
