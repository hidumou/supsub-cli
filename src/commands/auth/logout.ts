// packages/cli/src/commands/auth/logout.ts
import type { Command } from 'commander';
import { clearAuth } from '../../config/store.ts';
import { output } from '../../ui/output.ts';

export function registerAuthLogout(parent: Command): void {
  parent
    .command('logout')
    .description('登出（清除本地认证信息）')
    .action(async () => {
      const globalOpts = parent.parent!.opts() as { output?: string };
      await clearAuth();
      process.stderr.write('已登出\n');
      if (globalOpts.output === 'json') {
        output({}, 'json', () => {});
      }
    });
}
