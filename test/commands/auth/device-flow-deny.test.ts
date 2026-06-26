// device-flow：状态轮询的终态语义
//
// 新设备授权设计基于「状态轮询」，不再有 OAuth 的 access_denied 错误码；
// 终态拒绝的等价物是 status === 'expired'（设备码过期 → 立即停止并报错）。
// 本文件覆盖：expired 报错并停止轮询、authorized 直接成功、snake_case 字段容错。
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { runDeviceFlow } from '../../../src/commands/auth/device-flow.ts';

const FAKE_DEVICE_CODE_RESPONSE = {
  deviceCode: 'dev-code-xyz',
  userCode: 'ABCD-1234',
  verificationUri: 'http://fake-host/device',
  verificationUriComplete: 'http://fake-host/device?code=ABCD-1234',
  interval: 0.001, // 1ms，避免触发 5s fallback 拖慢测试
  expiresIn: 10,
};

type TokenResponder = () => Response;

function installFetchMock(tokenResponder: TokenResponder): {
  getCounts: () => { code: number; token: number };
} {
  let codeCount = 0;
  let tokenCount = 0;
  globalThis.fetch = async (input: RequestInfo | URL): Promise<Response> => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : (input as Request).url;
    if (url.includes('/api/auth/device/code')) {
      codeCount++;
      return new Response(JSON.stringify(FAKE_DEVICE_CODE_RESPONSE), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    tokenCount++;
    return tokenResponder();
  };
  return { getCounts: () => ({ code: codeCount, token: tokenCount }) };
}

describe('device-flow - 状态轮询终态', () => {
  let originalFetch: typeof globalThis.fetch;
  let originalStderrWrite: typeof process.stderr.write;
  let originalNoBrowser: string | undefined;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    originalStderrWrite = process.stderr.write.bind(process.stderr);
    originalNoBrowser = process.env.SUPSUB_NO_BROWSER;
    process.env.SUPSUB_NO_BROWSER = '1';
    process.stderr.write = (() => true) as typeof process.stderr.write;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.stderr.write = originalStderrWrite;
    if (originalNoBrowser === undefined) {
      delete process.env.SUPSUB_NO_BROWSER;
    } else {
      process.env.SUPSUB_NO_BROWSER = originalNoBrowser;
    }
  });

  test('status=expired 触发 code=EXPIRED_TOKEN 的 reject', async () => {
    installFetchMock(
      () =>
        new Response(JSON.stringify({ status: 'expired' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    );

    let caughtError: unknown;
    try {
      await runDeviceFlow();
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).toBeDefined();
    expect((caughtError as { code: string }).code).toBe('EXPIRED_TOKEN');
    expect((caughtError as { message: string }).message).toContain('设备码已过期');
  });

  test('status=expired 后不再发起第二次 token 轮询', async () => {
    const mock = installFetchMock(
      () =>
        new Response(JSON.stringify({ status: 'expired' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    );

    try {
      await runDeviceFlow();
    } catch {
      // 预期抛出
    }

    // 1 次 device/code + 1 次 token 轮询（expired 立即停止）
    expect(mock.getCounts()).toEqual({ code: 1, token: 1 });
  });

  test('status=authorized 直接返回 access_token / refresh_token', async () => {
    installFetchMock(
      () =>
        new Response(
          JSON.stringify({
            status: 'authorized',
            accessToken: 'acc-1',
            refreshToken: 'ref-1',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
    );

    const result = await runDeviceFlow();
    expect(result.access_token).toBe('acc-1');
    expect(result.refresh_token).toBe('ref-1');
  });

  test('authorized 响应使用 snake_case 字段时同样兼容', async () => {
    installFetchMock(
      () =>
        new Response(
          JSON.stringify({
            status: 'authorized',
            access_token: 'snake-acc',
            refresh_token: 'snake-ref',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
    );

    const result = await runDeviceFlow();
    expect(result.access_token).toBe('snake-acc');
    expect(result.refresh_token).toBe('snake-ref');
  });
});
