import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { getUserInfo } from '../../src/api/auth.ts';
import { searchAll } from '../../src/api/search.ts';
import { listSubs } from '../../src/api/subscription.ts';
import { setCliApiKey } from '../../src/http/credentials.ts';

const BEARER_TOKEN = process.env.SUPSUB_E2E_BEARER;
const SKIP = !BEARER_TOKEN;

/**
 * 解析 JWT payload（URL-safe base64），用于断言 /api/user/info 返回与 token 身份一致。
 * 不校验签名（运行时无密钥），仅取 payload。
 */
function decodeJwtPayload(token: string): { id?: number; email?: string } {
  const part = token.split('.')[1];
  if (!part) return {};
  const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
  const json = Buffer.from(b64 + pad, 'base64').toString('utf-8');
  return JSON.parse(json) as { id?: number; email?: string };
}

describe.skipIf(SKIP)('e2e/prod-bearer - 正式环境 bearer_token 鉴权', () => {
  let originalApiUrl: string | undefined;
  let originalEnvKey: string | undefined;
  let expectedId: number | undefined;
  let expectedEmail: string | undefined;

  beforeAll(() => {
    const payload = decodeJwtPayload(BEARER_TOKEN!);
    expectedId = payload.id;
    expectedEmail = payload.email;

    originalApiUrl = process.env.SUPSUB_API_URL;
    originalEnvKey = process.env.SUPSUB_API_KEY;
    // 强制走正式环境，覆盖本地可能存在的 SUPSUB_API_URL（如 dev mock server）
    process.env.SUPSUB_API_URL = 'https://supsub.net';
    // 清掉环境里的 api_key，避免抢占优先级
    delete process.env.SUPSUB_API_KEY;
    // 通过 cliApiKey 通道注入 bearer_token，不动 ~/.supsub/config.json
    setCliApiKey(BEARER_TOKEN!);
  });

  afterAll(() => {
    setCliApiKey(undefined);
    if (originalApiUrl === undefined) delete process.env.SUPSUB_API_URL;
    else process.env.SUPSUB_API_URL = originalApiUrl;
    if (originalEnvKey === undefined) delete process.env.SUPSUB_API_KEY;
    else process.env.SUPSUB_API_KEY = originalEnvKey;
  });

  test('GET /api/user/info 返回的 id/email 与 JWT payload 一致', async () => {
    const info = await getUserInfo();
    if (expectedId !== undefined) expect(info.id).toBe(expectedId);
    if (expectedEmail !== undefined) expect(info.email).toBe(expectedEmail);
    expect(typeof info.expired).toBe('boolean');
  });

  test('GET /api/subscriptions 返回数组（订阅列表）', async () => {
    const subs = await listSubs();
    expect(Array.isArray(subs)).toBe(true);
    if (subs.length > 0) {
      const s = subs[0]!;
      expect(typeof s.sourceId).toBe('number');
      expect(['MP', 'WEBSITE']).toContain(s.sourceType);
      expect(typeof s.name).toBe('string');
      expect(typeof s.unreadCount).toBe('number');
    }
  });

  test('GET /api/search 返回 SearchResponse 结构（results）', async () => {
    const r = await searchAll({ type: 'ALL', keywords: 'openai', page: 1 });
    expect(Array.isArray(r.results)).toBe(true);
    // results 内每项必须有 type 字段且为 SOURCE/CONTENT
    for (const item of r.results) {
      expect(['SOURCE', 'CONTENT']).toContain(item.type);
    }
  });

  test('GET /api/subscriptions 携带 --type=MP 时仅返回 MP 类型', async () => {
    const subs = await listSubs({ sourceType: 'MP' });
    expect(Array.isArray(subs)).toBe(true);
    for (const s of subs) {
      expect(s.sourceType).toBe('MP');
    }
  });
});
