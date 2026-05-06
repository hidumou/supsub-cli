// 测试侧的配置路径解析，与 src/config/store.ts 同语义：
// 优先读 SUPSUB_CONFIG_DIR；缺失时回退到 ~/.supsub。
// 测试整体由 test/setup.ts 在 preload 阶段把 env 指向 tmp 目录，
// 所以 import 这个 helper 的测试天然落到 tmp，不污染本机。
import * as os from 'node:os';
import * as path from 'node:path';

export function configDir(): string {
  const override = process.env.SUPSUB_CONFIG_DIR;
  if (override && override.trim() !== '') return override;
  return path.join(os.homedir(), '.supsub');
}

export function configFile(): string {
  return path.join(configDir(), 'config.json');
}
