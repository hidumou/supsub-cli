// packages/cli/src/commands/mp/search-cancel.ts
import type { Command } from 'commander';
import { cancelSearchTask } from '../../api/mp.ts';
import { dieWith, isErrorEnvelope } from '../../lib/errors.ts';
import { output } from '../../ui/output.ts';
import { printTable } from '../../ui/table.ts';

export function registerMpSearchCancel(parent: Command): void {
  parent
    .command('search-cancel <searchId>')
    .description('取消公众号搜索任务')
    .action(async (searchId: string) => {
      const fmt = (parent.parent?.opts().output ?? undefined) as string | undefined;

      try {
        await cancelSearchTask(searchId);
      } catch (err) {
        if (isErrorEnvelope(err) && err.status === 404) {
          dieWith(
            {
              code: 'TASK_NOT_FOUND',
              message: '任务不存在或已取消',
              status: 404,
            },
            fmt,
          );
        }
        throw err;
      }

      output({ message: '已取消' }, fmt, (d) => {
        printTable({
          headers: ['结果'],
          rows: [[d.message]],
        });
      });
    });
}
