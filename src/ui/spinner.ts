// packages/cli/src/ui/spinner.ts
import kleur from 'kleur';

/**
 * 终端 Loading 动画（spinner），用于「发请求 / 轮询」等耗时操作期间避免黑屏。
 *
 * 设计要点：
 * - 只写 stderr：绝不污染 stdout，保证 `-o json` / 表格数据 / 管道纯净。
 * - 仅在交互式 TTY 下动画；非 TTY（管道、CI、e2e 子进程）直接静默执行，
 *   既不破坏现有断言，也不在日志里留下乱码。
 * - `SUPSUB_NO_SPINNER` 真值时可强制关闭。
 * - 兜底：命令内部若直接 process.exit（如 mp search 的 dieWith），
 *   finally 不会触发，这里用一次性 'exit' 监听恢复光标、清掉残留行。
 */

const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const FRAME_INTERVAL_MS = 80;

const HIDE_CURSOR = '\x1b[?25l';
const SHOW_CURSOR = '\x1b[?25h';
// \r 回到行首 + \x1b[K 清到行尾：覆盖上一帧文案
const CLEAR_LINE = '\r\x1b[K';

/**
 * 判断环境变量是否为「真值」。空串 / '0' / 'false' 视为假，其余非空字符串视为真。
 * 与 device-flow.ts 的 SUPSUB_NO_BROWSER 护栏同语义。
 */
function isTruthyEnv(value: string | undefined): boolean {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  return v !== '' && v !== '0' && v !== 'false';
}

/** 当前环境是否应该渲染动画 */
function spinnerEnabled(): boolean {
  if (!process.stderr.isTTY) return false;
  if (isTruthyEnv(process.env.SUPSUB_NO_SPINNER)) return false;
  return true;
}

/**
 * 在执行 `task` 期间显示一个带文案的 loading 动画，结束后自动清理。
 * task 的返回值 / 异常都会原样透传，调用方无需感知 spinner 是否真的渲染。
 */
export async function withSpinner<T>(text: string, task: () => Promise<T>): Promise<T> {
  if (!spinnerEnabled()) {
    return task();
  }

  let frame = 0;
  const render = (): void => {
    const glyph = FRAMES[frame % FRAMES.length] ?? FRAMES[0] ?? '⠋';
    process.stderr.write(`${CLEAR_LINE}${kleur.cyan(glyph)} ${text}`);
    frame += 1;
  };

  // 进程被直接 exit 时的兜底清理（恢复光标 + 清掉残留 spinner 行）
  const onExit = (): void => {
    process.stderr.write(`${CLEAR_LINE}${SHOW_CURSOR}`);
  };

  process.stderr.write(HIDE_CURSOR);
  render();
  const timer = setInterval(render, FRAME_INTERVAL_MS);
  process.once('exit', onExit);

  try {
    return await task();
  } finally {
    clearInterval(timer);
    process.removeListener('exit', onExit);
    process.stderr.write(`${CLEAR_LINE}${SHOW_CURSOR}`);
  }
}
