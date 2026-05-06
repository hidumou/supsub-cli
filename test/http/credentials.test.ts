// packages/cli/test/bearer-token-auth.test.ts
// add-cli-bearer-token-auth：bearer_token 作为第三种鉴权来源
//
// 配置目录由 SUPSUB_CONFIG_DIR 解析，bun preload (test/setup.ts) 已经
// 把它指向一次性 tmp 目录，afterEach 仅做用例间清理，不会影响本机 ~/.supsub。

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import * as fs from 'node:fs/promises';
import { configFile } from '../_helpers/config-path.ts';

const CONFIG_FILE = configFile();

async function cleanupAuthFields(): Promise<void> {
  try {
    const content = await fs.readFile(CONFIG_FILE, 'utf-8');
    const parsed = JSON.parse(content) as Record<string, unknown>;
    const { api_key: _a, client_id: _c, bearer_token: _b, ...rest } = parsed;
    await fs.writeFile(CONFIG_FILE, JSON.stringify(rest, null, 2), 'utf-8');
  } catch {
    // 文件不存在时忽略
  }
}

describe('resolveApiKey - bearer_token 第三种鉴权来源', () => {
  let originalEnvKey: string | undefined;

  beforeEach(async () => {
    originalEnvKey = process.env.SUPSUB_API_KEY;
    delete process.env.SUPSUB_API_KEY;
    // 清空 CLI flag 覆写，确保每个用例从干净状态开始
    const { setCliApiKey } = await import('../../src/http/credentials.ts');
    setCliApiKey(undefined);
  });

  afterEach(async () => {
    if (originalEnvKey === undefined) {
      delete process.env.SUPSUB_API_KEY;
    } else {
      process.env.SUPSUB_API_KEY = originalEnvKey;
    }
    const { setCliApiKey } = await import('../../src/http/credentials.ts');
    setCliApiKey(undefined);
    await cleanupAuthFields();
  });

  test('仅 bearer_token 时被识别为 session 来源', async () => {
    const { writeConfig } = await import('../../src/config/store.ts');
    const { resolveApiKey } = await import('../../src/http/credentials.ts');

    await writeConfig({ bearer_token: 'abc.def.ghi', client_id: 'supsub-cli' });

    const result = await resolveApiKey();
    expect(result.key).toBe('abc.def.ghi');
    expect(result.clientId).toBe('supsub-cli');
    expect(result.source).toBe('session');
  });

  test('api_key 与 bearer_token 共存时 api_key 胜出', async () => {
    const { writeConfig } = await import('../../src/config/store.ts');
    const { resolveApiKey } = await import('../../src/http/credentials.ts');

    await writeConfig({
      api_key: 'sk_live_xxx',
      bearer_token: 'browser_token',
      client_id: 'supsub-cli',
    });

    const result = await resolveApiKey();
    expect(result.key).toBe('sk_live_xxx');
    expect(result.source).toBe('config');
  });

  test('env SUPSUB_API_KEY 与 bearer_token 共存时 env 胜出', async () => {
    const { writeConfig } = await import('../../src/config/store.ts');
    const { resolveApiKey } = await import('../../src/http/credentials.ts');

    await writeConfig({ bearer_token: 'browser_token', client_id: 'supsub-cli' });
    process.env.SUPSUB_API_KEY = 'env_key';

    const result = await resolveApiKey();
    expect(result.key).toBe('env_key');
    expect(result.source).toBe('env');
  });

  test('--api-key flag 始终最高优先级', async () => {
    const { writeConfig } = await import('../../src/config/store.ts');
    const { resolveApiKey, setCliApiKey } = await import('../../src/http/credentials.ts');

    await writeConfig({
      api_key: 'sk_live_xxx',
      bearer_token: 'browser_token',
    });
    process.env.SUPSUB_API_KEY = 'env_key';
    setCliApiKey('flag_key');

    const result = await resolveApiKey();
    expect(result.key).toBe('flag_key');
    expect(result.source).toBe('flag');
  });

  test('clearAuth 同时清除 bearer_token', async () => {
    const { writeConfig, readConfig, clearAuth } = await import('../../src/config/store.ts');

    await writeConfig({
      api_key: 'k_unit',
      bearer_token: 't_unit',
      client_id: 'c_unit',
    });
    await clearAuth();

    const cfg = await readConfig();
    expect(cfg.api_key).toBeUndefined();
    expect(cfg.bearer_token).toBeUndefined();
    expect(cfg.client_id).toBeUndefined();
  });

  test('无任何凭证时 source 为 undefined', async () => {
    const { resolveApiKey } = await import('../../src/http/credentials.ts');

    // 确保 config 没有认证字段
    await cleanupAuthFields();

    const result = await resolveApiKey();
    expect(result.key).toBeUndefined();
    expect(result.source).toBeUndefined();
  });
});
