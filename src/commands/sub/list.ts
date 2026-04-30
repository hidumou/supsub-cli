// packages/cli/src/commands/sub/list.ts
import type { Command } from 'commander';
import { listSubs } from '../../api/subscription.ts';
import type { Subscription } from '../../lib/types.ts';
import { output } from '../../ui/output.ts';
import { printTable, truncate } from '../../ui/table.ts';
import { normalizeType } from './_args.ts';

function sourceKindLabel(sourceType: string): string {
  const t = sourceType.toUpperCase();
  if (t === 'MP') return '公众号';
  if (t === 'WEBSITE') return '网站';
  return sourceType;
}

function renderSubscriptionTable(data: Subscription[]): void {
  if (data.length === 0) {
    process.stdout.write('(empty)\n');
    return;
  }
  printTable({
    headers: ['sourceId', '类型', 'name', 'description'],
    rows: data.map((s) => [
      s.sourceId,
      sourceKindLabel(s.sourceType),
      truncate(s.name, 24),
      truncate(s.description, 40),
    ]),
    columnWidths: [14, 10, 26, 42],
  });
  process.stdout.write(`(${data.length} items)\n`);
}

export function registerSubList(parent: Command): void {
  parent
    .command('list')
    .description('列出订阅源')
    .option('--type <type>', '过滤类型：MP|WEBSITE')
    .action(async (opts: { type?: string }) => {
      const globalOpts = (parent.parent?.opts() ?? {}) as { output?: string };
      const fmt = globalOpts.output;

      const sourceType = opts.type ? normalizeType(opts.type) : undefined;
      const data = await listSubs({ sourceType });

      output(data, fmt, renderSubscriptionTable);
    });
}
