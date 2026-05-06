// 全局 bun test preload：把 SUPSUB_CONFIG_DIR 指到一个临时目录，
// 让所有依赖 src/config/store.ts 的代码（生产 + 测试）在跑测试时
// 一律落到 tmp 目录，不会污染用户真实的 ~/.supsub/config.json。
//
// 通过 bunfig.toml 的 [test] preload 注入，进程级别只跑一次。
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

if (!process.env.SUPSUB_CONFIG_DIR) {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'supsub-test-'));
  process.env.SUPSUB_CONFIG_DIR = tmpRoot;

  process.on('exit', () => {
    try {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    } catch {
      // 静默忽略，进程退出阶段不影响测试结果
    }
  });
}
