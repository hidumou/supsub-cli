// device-flow：interval 回退 + 「pending 多轮后 authorized」状态轮询语义
//
// - pickInitialIntervalMs 为纯函数，覆盖 interval ≤ 0 / 缺失时回落 5000ms。
// - runDeviceFlow 通过 mock fetch 验证：pending 多轮后拿到 authorized 即返回 tokens，
//   且轮询间隔取自服务端 interval（pickInitialIntervalMs）。
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { pickInitialIntervalMs, runDeviceFlow } from '../../../src/commands/auth/device-flow.ts';

const FAKE_DEVICE_CODE_RESPONSE = {
  deviceCode: 'dev-code-xyz',
  userCode: 'XFpYRLVa',
  verificationUri: 'http://fake-host/device',
  verificationUriComplete: 'http://fake-host/device?code=XFpYRLVa',
  interval: 0.001, // 1ms：经 pickInitialIntervalMs 后仍是 1ms，避免触发 5s fallback 拖慢测试
  expiresIn: 10,
};

describe('device-flow - pickInitialIntervalMs', () => {
  test('interval=0 触发 5000ms fallback', () => {
    expect(pickInitialIntervalMs(0)).toBe(5000);
  });

  test('interval=-1 触发 5000ms fallback', () => {
    expect(pickInitialIntervalMs(-1)).toBe(5000);
  });

  test('interval=3 使用服务端 3000ms，不触发 fallback', () => {
    expect(pickInitialIntervalMs(3)).toBe(3000);
  });
});

describe('device-flow - pending 多轮后 authorized', () => {
  let tokenCallCount: number;
  let originalFetch: typeof globalThis.fetch;
  let originalStderrWrite: typeof process.stderr.write;
  let originalNoBrowser: string | undefined;

  beforeEach(() => {
    tokenCallCount = 0;
    originalFetch = globalThis.fetch;
    originalStderrWrite = process.stderr.write.bind(process.stderr);
    originalNoBrowser = process.env.SUPSUB_NO_BROWSER;
    // 测试环境跳过自动打开浏览器
    process.env.SUPSUB_NO_BROWSER = '1';
    // 静默 stderr 输出
    process.stderr.write = (() => true) as typeof process.stderr.write;

    globalThis.fetch = async (input: RequestInfo | URL): Promise<Response> => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : (input as Request).url;

      if (url.includes('/api/auth/device/code')) {
        return new Response(JSON.stringify(FAKE_DEVICE_CODE_RESPONSE), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // token 轮询：前两次 pending，第三次 authorized
      tokenCallCount++;
      if (tokenCallCount < 3) {
        return new Response(JSON.stringify({ status: 'pending' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(
        JSON.stringify({
          status: 'authorized',
          accessToken: 'access-abc',
          refreshToken: 'refresh-def',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    };
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

  test('多轮 pending 后返回 authorized 的 access_token / refresh_token', async () => {
    const result = await runDeviceFlow();
    expect(result.access_token).toBe('access-abc');
    expect(result.refresh_token).toBe('refresh-def');
    // 共 3 次 token 轮询（2 次 pending + 1 次 authorized）
    expect(tokenCallCount).toBe(3);
  });
});
