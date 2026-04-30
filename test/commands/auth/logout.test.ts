// commands/auth/logout：通过 Commander 端到端调用，验证 clearAuth 文件副作用与 stderr 输出
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { Command } from 'commander';
import { registerAuthLogout } from '../../../src/commands/auth/logout.ts';

const CONFIG_DIR = path.join(os.homedir(), '.supsub');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

async function cleanupAuthFields(): Promise<void> {
  try {
    const content = await fs.readFile(CONFIG_FILE, 'utf-8');
    const parsed = JSON.parse(content) as Record<string, unknown>;
    const { api_key: _a, client_id: _c, bearer_token: _b, ...rest } = parsed;
    await fs.writeFile(CONFIG_FILE, JSON.stringify(rest, null, 2), 'utf-8');
  } catch {
    // 文件不存在则忽略
  }
}

function buildProgram(): Command {
  const program = new Command();
  program
    .name('supsub')
    .option('-o, --output <fmt>', '输出格式：table|json', 'table')
    .exitOverride(); // 让 commander 抛错而不是 process.exit
  const auth = program.command('auth');
  registerAuthLogout(auth);
  return program;
}

describe('commands/auth/logout - 清除本地认证', () => {
  let stderrOutput: string;
  let stdoutOutput: string;
  let originalStderr: typeof process.stderr.write;
  let originalStdout: typeof process.stdout.write;

  beforeEach(async () => {
    stderrOutput = '';
    stdoutOutput = '';
    originalStderr = process.stderr.write.bind(process.stderr);
    originalStdout = process.stdout.write.bind(process.stdout);
    process.stderr.write = ((chunk: string | Uint8Array): boolean => {
      stderrOutput += typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk);
      return true;
    }) as typeof process.stderr.write;
    process.stdout.write = ((chunk: string | Uint8Array): boolean => {
      stdoutOutput += typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk);
      return true;
    }) as typeof process.stdout.write;

    // 预置认证字段
    await fs.mkdir(CONFIG_DIR, { recursive: true });
    await fs.writeFile(
      CONFIG_FILE,
      JSON.stringify(
        { api_key: 'sk_logout_test', client_id: 'supsub-cli', bearer_token: 'tk' },
        null,
        2,
      ),
      'utf-8',
    );
  });

  afterEach(async () => {
    process.stderr.write = originalStderr;
    process.stdout.write = originalStdout;
    await cleanupAuthFields();
  });

  test('logout 后 config 中 api_key/client_id/bearer_token 全部被移除', async () => {
    const program = buildProgram();
    await program.parseAsync(['node', 'supsub', 'auth', 'logout']);

    const after = JSON.parse(await fs.readFile(CONFIG_FILE, 'utf-8')) as Record<string, unknown>;
    expect(after.api_key).toBeUndefined();
    expect(after.client_id).toBeUndefined();
    expect(after.bearer_token).toBeUndefined();
  });

  test('logout 输出「已登出」到 stderr', async () => {
    const program = buildProgram();
    await program.parseAsync(['node', 'supsub', 'auth', 'logout']);
    expect(stderrOutput).toContain('已登出');
  });

  test('--output json 时同时把空对象写到 stdout（保持 json 模式契约）', async () => {
    const program = buildProgram();
    await program.parseAsync(['node', 'supsub', '--output', 'json', 'auth', 'logout']);

    // ui/output 在 json 模式输出 { success: true, data: {} }
    expect(stdoutOutput).toContain('"success": true');
    expect(stdoutOutput).toContain('"data": {}');
  });

  test('table 模式（默认）不向 stdout 写 JSON', async () => {
    const program = buildProgram();
    await program.parseAsync(['node', 'supsub', 'auth', 'logout']);
    expect(stdoutOutput).toBe('');
  });
});
