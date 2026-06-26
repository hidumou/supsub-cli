// commands/update + lib/self-update：纯函数 + checkForUpdate（mock fetch）+ update --check 命令路径
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { Command } from 'commander';
import { registerUpdate } from '../../src/commands/update.ts';
import {
  buildDownloadUrl,
  CURRENT_VERSION,
  checkForUpdate,
  compareSemver,
  detectPlatform,
} from '../../src/lib/self-update.ts';

describe('lib/self-update - compareSemver', () => {
  test('a 比 b 新返回 >0', () => {
    expect(compareSemver('0.3.0', '0.2.6')).toBeGreaterThan(0);
    expect(compareSemver('1.0.0', '0.9.9')).toBeGreaterThan(0);
    expect(compareSemver('0.3.1', '0.3.0')).toBeGreaterThan(0);
  });
  test('a 比 b 旧返回 <0', () => {
    expect(compareSemver('0.2.6', '0.3.0')).toBeLessThan(0);
  });
  test('相等返回 0（含 v 前缀与 prerelease 尾巴）', () => {
    expect(compareSemver('0.3.0', '0.3.0')).toBe(0);
    expect(compareSemver('v0.3.0', '0.3.0')).toBe(0);
    expect(compareSemver('0.3.0-beta.1', '0.3.0')).toBe(0);
  });
});

describe('lib/self-update - detectPlatform / buildDownloadUrl', () => {
  test('detectPlatform 返回当前平台的资产命名段', () => {
    const info = detectPlatform();
    expect(['darwin', 'linux', 'windows']).toContain(info.platform);
    expect(['amd64', 'arm64']).toContain(info.arch);
    expect([info.ext]).toContainEqual(info.platform === 'windows' ? '.zip' : '.tar.gz');
    expect(info.binaryName).toBe(info.platform === 'windows' ? 'supsub.exe' : 'supsub');
  });

  test('buildDownloadUrl 拼出 GitHub Release 资产地址', () => {
    const info = detectPlatform();
    const url = buildDownloadUrl('0.3.0', info);
    expect(url).toBe(
      `https://github.com/hidumou/supsub-cli/releases/download/v0.3.0/supsub-cli_0.3.0_${info.platform}_${info.arch}${info.ext}`,
    );
  });
});

describe('lib/self-update - checkForUpdate（mock fetch）', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function mockRegistry(version: string): void {
    globalThis.fetch = async (input: RequestInfo | URL): Promise<Response> => {
      const url = typeof input === 'string' ? input : input.toString();
      expect(url).toContain('registry.npmjs.org/@supsub/cli/latest');
      return new Response(JSON.stringify({ version }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };
  }

  test('registry 版本更高 → hasUpdate=true', async () => {
    mockRegistry('99.0.0');
    const r = await checkForUpdate();
    expect(r.current).toBe(CURRENT_VERSION);
    expect(r.latest).toBe('99.0.0');
    expect(r.hasUpdate).toBe(true);
  });

  test('registry 版本不高于当前 → hasUpdate=false', async () => {
    mockRegistry('0.0.1');
    const r = await checkForUpdate();
    expect(r.hasUpdate).toBe(false);
  });

  test('registry 非 2xx → 抛 SERVER_ERROR', async () => {
    globalThis.fetch = async (): Promise<Response> => new Response('nope', { status: 503 });
    let caught: unknown;
    try {
      await checkForUpdate();
    } catch (e) {
      caught = e;
    }
    expect((caught as { code: string }).code).toBe('SERVER_ERROR');
  });
});

describe('commands/update - update --check（不下载，mock fetch）', () => {
  let originalFetch: typeof globalThis.fetch;
  let stdoutOutput: string;
  let originalStdout: typeof process.stdout.write;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    stdoutOutput = '';
    originalStdout = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((chunk: string | Uint8Array): boolean => {
      stdoutOutput += typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk);
      return true;
    }) as typeof process.stdout.write;
    globalThis.fetch = async (): Promise<Response> =>
      new Response(JSON.stringify({ version: '99.0.0' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
  });
  afterEach(() => {
    process.stdout.write = originalStdout;
    globalThis.fetch = originalFetch;
  });

  function buildProgram(): Command {
    const program = new Command();
    program
      .name('supsub')
      .option('-o, --output <fmt>', '输出格式：table|json', 'table')
      .exitOverride();
    registerUpdate(program);
    return program;
  }

  test('--check --output json 只报告版本、updated=false', async () => {
    const program = buildProgram();
    await program.parseAsync(['node', 'supsub', '--output', 'json', 'update', '--check']);
    const parsed = JSON.parse(stdoutOutput);
    expect(parsed.success).toBe(true);
    expect(parsed.data.current).toBe(CURRENT_VERSION);
    expect(parsed.data.latest).toBe('99.0.0');
    expect(parsed.data.hasUpdate).toBe(true);
    expect(parsed.data.updated).toBe(false);
  });
});
