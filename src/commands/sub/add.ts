// packages/cli/src/commands/sub/add.ts
import type { Command } from 'commander';
import { addSub } from '../../api/subscription.ts';
import type { ErrorEnvelope } from '../../lib/errors.ts';
import { output } from '../../ui/output.ts';
import { printTable } from '../../ui/table.ts';
import { normalizeType, parseSourceId } from './_args.ts';

export function registerSubAdd(parent: Command): void {
  parent
    .command('add')
    .description('添加订阅')
    .requiredOption('--source-id <id>', '信息源 ID')
    .requiredOption('--type <type>', '信息源类型：MP|WEBSITE')
    .option(
      '--group <gid>',
      '分组 ID（可多次指定）',
      (val: string, prev: string[]) => {
        return [...(prev ?? []), val];
      },
      [] as string[],
    )
    .action(async (opts: { sourceId: string; type: string; group: string[] }) => {
      const globalOpts = (parent.parent?.opts() ?? {}) as { output?: string };
      const fmt = globalOpts.output;

      const sourceType = normalizeType(opts.type);
      const sourceId = parseSourceId(opts.sourceId);
      const groupIds = opts.group && opts.group.length > 0 ? opts.group.map(Number) : undefined;

      if (groupIds?.some(Number.isNaN)) {
        throw {
          code: 'INVALID_ARGS',
          status: 0,
          message: '--group 必须是有效的数字',
        } satisfies ErrorEnvelope;
      }

      const data = await addSub({
        sourceType,
        sourceId,
        ...(groupIds ? { groupIds } : {}),
      });

      output({ message: data.message }, fmt, (d) => {
        printTable({
          headers: ['结果'],
          rows: [[d.message]],
        });
      });
    });
}
