// E2E：设备授权流程（Device Flow）针对测试环境的「真实行为」断言。
//
// ── 背景 ─────────────────────────────────────────────────────────────
// CLI 授权已改造为状态轮询型 Device Flow：
//   POST /api/auth/device/code  → 申请设备码（userCode / deviceCode）
//   POST /api/auth/device/token → 轮询 pending/authorized/expired
// 默认基址为测试环境 https://supsub-api.ctrlcv.tech。
//
// ⚠️ 当前现实：测试环境的三个 device 端点（device/code、device/token、
//    device/approve）后端「尚未实现」，实测 device/code 直接返回 404。
//    因此「CLI→后端→网页审批→CLI 拿 token」的完整闭环现在无法真跑通。
//
// 所以本文件的断言只反映「后端 device 端点尚未实现」的当下状态：
//   不带 --api-key + SUPSUB_NO_BROWSER=1 跑 `auth login`
//     → device/code 第一步即 404（不进入轮询，立即返回）
//     → CLI 以非 0 退出，且给出清晰的中文报错「无法获取设备码」。
// device/code 直接 404 会立刻返回、不会进入 5s/轮询，所以本测试很快结束；
// 仍给一个保守超时兜底，避免任何意外阻塞。
//
// ── ⏳ 完整流程待办（待测试环境后端实现这 3 个端点后改写本测试） ──────
//   1. 将 SUPSUB_API_URL 指向「有后端实现」的环境 + SUPSUB_NO_BROWSER=1，
//      子进程跑 `auth login`；
//   2. 从 stderr 抓 userCode（输出形如「授权码: XXXX」）；
//   3. 另一侧 POST /api/auth/device/approve 用该 userCode 完成审批；
//   4. CLI 轮询拿到 accessToken / refreshToken 并写入 config；
//   5. 再跑 `auth status`（GET /api/user/info）断言登录态。
//   届时应「移除」下面的 404 优雅报错断言，替换为上述完整闭环。

import { describe, expect, test } from 'bun:test';
import { spawn } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

// bun test 默认 cwd 为项目根目录
const ENTRY = 'src/index.ts';

type CliResult = { stdout: string; stderr: string; code: number };

/**
 * 子进程运行 CLI，返回 stdout/stderr/exit code。关键点：
 *   - HOME 指到空临时目录，避免本机 ~/.supsub/config.json 干扰；
 *   - 删除 SUPSUB_API_KEY，确保走 Device Flow 而非 --api-key 直登；
 *   - 删除 SUPSUB_API_URL，强制使用 DEFAULT_API_URL（测试环境），
 *     保证「打到测试环境的 device/code」这一断言的确定性。
 */
async function runCli(args: string[], extraEnv: Record<string, string> = {}): Promise<CliResult> {
  const tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), 'supsub-e2e-device-'));
  const env: Record<string, string> = { ...(process.env as Record<string, string>) };
  env.HOME = tmpHome;
  delete env.SUPSUB_API_KEY;
  delete env.SUPSUB_API_URL; // 强制走 DEFAULT_API_URL（测试环境）
  Object.assign(env, extraEnv);

  return await new Promise<CliResult>((resolve, reject) => {
    const child = spawn('bun', ['run', ENTRY, ...args], {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (c) => (stdout += c.toString()));
    child.stderr.on('data', (c) => (stderr += c.toString()));
    child.on('error', reject);
    child.on('close', (code) => resolve({ stdout, stderr, code: code ?? -1 }));
  });
}

describe('e2e/device-flow - 设备授权流程（测试环境真实行为）', () => {
  // ⚠️ 现状断言：测试环境 device/code 端点尚未实现（404）。
  // 待后端实现后，应改写为「完整设备流闭环」（见文件顶部待办）。
  test(
    '后端未实现：auth login 因 device/code 404 而优雅报错（非 0 退出 + stderr 含「无法获取设备码」）',
    async () => {
      const r = await runCli(['auth', 'login'], { SUPSUB_NO_BROWSER: '1' });
      // 非 0 退出：当前为业务错误码 1（status=404 < 500，errors.ts 默认分支）
      expect(r.code).not.toBe(0);
      // table/默认模式下 dieWith 把 message 写到 stderr
      expect(r.stderr).toContain('无法获取设备码');
    },
    30_000,
  );

  // JSON 模式同样应优雅失败：错误体落在 stdout（便于 jq 解析），success=false。
  test(
    '后端未实现（JSON 模式）：错误体落在 stdout 且 success=false',
    async () => {
      const r = await runCli(['--output', 'json', 'auth', 'login'], { SUPSUB_NO_BROWSER: '1' });
      expect(r.code).not.toBe(0);
      const body = JSON.parse(r.stdout);
      expect(body.success).toBe(false);
      expect(typeof body.error.code).toBe('string');
      expect(body.error.message).toContain('无法获取设备码');
    },
    30_000,
  );
});
