// packages/cli/test/auth-deny.test.ts
// 任务 5.8：device flow 收到 access_denied 时立即 reject 并携带正确 message
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

const FAKE_DEVICE_CODE_RESPONSE = {
  code: 'test-device-code',
  verification_uri: 'http://fake-host/device',
  user_code: 'ABCD-1234',
  expires_in: 10,
  interval: 0.001, // 1ms 间隔，加 add-cli-interval-fallback 后避免触发 5s fallback
};

describe('device-flow - access_denied 立即停止并抛出', () => {
  let callCount: number;
  let originalFetch: typeof globalThis.fetch;
  let originalStderrWrite: typeof process.stderr.write;

  beforeEach(() => {
    callCount = 0;
    originalFetch = globalThis.fetch;
    originalStderrWrite = process.stderr.write.bind(process.stderr);

    // 静默 stderr 输出，避免测试中打印干扰
    process.stderr.write = (() => true) as typeof process.stderr.write;

    // mock fetch 序列
    globalThis.fetch = async (input: RequestInfo | URL, _init?: RequestInit): Promise<Response> => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : (input as Request).url;
      callCount++;

      if (url.includes('/oauth/device/code')) {
        // 第 1 次：返回 device code
        return new Response(JSON.stringify(FAKE_DEVICE_CODE_RESPONSE), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // 第 2 次（token 轮询）：返回 access_denied
      return new Response(
        JSON.stringify({ error: 'access_denied', error_description: '用户拒绝了授权' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    };
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.stderr.write = originalStderrWrite;
  });

  test('5.8.a access_denied 触发 code=ACCESS_DENIED 的 reject', async () => {
    const { runDeviceFlow } = await import('../../../src/commands/auth/device-flow.ts');

    let caughtError: unknown;
    try {
      await runDeviceFlow();
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).toBeDefined();
    expect((caughtError as { code: string }).code).toBe('ACCESS_DENIED');
  });

  test('5.8.b access_denied 时 error.message 含「用户拒绝授权」', async () => {
    const { runDeviceFlow } = await import('../../../src/commands/auth/device-flow.ts');

    let caughtError: unknown;
    try {
      await runDeviceFlow();
    } catch (err) {
      caughtError = err;
    }

    expect((caughtError as { message: string }).message).toContain('用户拒绝授权');
  });

  test('5.8.c access_denied 后不再发起第 3 次 token 请求', async () => {
    const { runDeviceFlow } = await import('../../../src/commands/auth/device-flow.ts');

    try {
      await runDeviceFlow();
    } catch {
      // 预期抛出
    }

    // 只有 2 次：1 次 device/code + 1 次 token 轮询
    expect(callCount).toBe(2);
  });
});
