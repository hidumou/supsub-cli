// packages/cli/src/commands/update.ts
import type { Command } from 'commander';
import { checkForUpdate, performUpdate } from '../lib/self-update.ts';
import { output } from '../ui/output.ts';
import { withSpinner } from '../ui/spinner.ts';
import { printTable } from '../ui/table.ts';

export function registerUpdate(program: Command): void {
  program
    .command('update')
    .description('检查并更新 supsub 到最新版本（自更新）')
    .option('--check', '只检查是否有新版本，不实际更新')
    .option('--force', '即使已是最新也重新下载安装（修复损坏的 binary）')
    .action(async (opts: { check?: boolean; force?: boolean }) => {
      const fmt = program.opts().output as string | undefined;

      const { current, latest, hasUpdate } = await withSpinner('检查更新…', () => checkForUpdate());

      // --check：只报告，不下载
      if (opts.check) {
        output({ current, latest, hasUpdate, updated: false }, fmt, () => {
          printTable({
            headers: ['字段', '值'],
            rows: [
              ['当前版本', current],
              ['最新版本', latest],
              ['可更新', hasUpdate ? `是（运行 supsub update 升级到 v${latest}）` : '否'],
            ],
          });
        });
        return;
      }

      // 已最新且非强制：直接告知
      if (!hasUpdate && !opts.force) {
        output({ current, latest, hasUpdate: false, updated: false }, fmt, () => {
          process.stdout.write(`✅ 已是最新版本 v${current}\n`);
        });
        return;
      }

      // 下载并原地替换
      await withSpinner(`下载并安装 v${latest}…`, () => performUpdate(latest));

      output({ current, latest, hasUpdate, updated: true }, fmt, () => {
        const from = current === latest ? `v${latest}（重新安装）` : `v${current} → v${latest}`;
        process.stdout.write(`✅ 已更新 ${from}\n`);
      });
    });
}
