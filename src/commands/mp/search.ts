// packages/cli/src/commands/mp/search.ts
import type { Command } from 'commander';
import { createSearchTask, getSearchTask } from '../../api/mp.ts';
import { dieWith } from '../../lib/errors.ts';
import { sleep } from '../../lib/sleep.ts';
import type { MpSearchTaskResult } from '../../lib/types.ts';
import { output } from '../../ui/output.ts';
import { withSpinner } from '../../ui/spinner.ts';
import { printTable, truncate } from '../../ui/table.ts';

const POLL_INTERVAL_MS = 2000;
const POLL_MAX_MS = 30_000;

type Mp = NonNullable<MpSearchTaskResult['mp']>;

function renderMpTable(mps: Mp[]): void {
  printTable({
    headers: ['mpId', 'name', 'description'],
    rows: mps.map((mp) => [mp.mpId, truncate(mp.name, 24), truncate(mp.description, 50)]),
    columnWidths: [20, 26, 52],
  });
}

/** 一轮搜索的结局：完成（带累积候选）或超时。output / dieWith 都放到 spinner 停止之后再做。 */
type SearchOutcome = {
  kind: 'done' | 'timeout';
  searchId: string;
  candidates: Mp[];
  lastMessage: string;
};

async function runSyncSearch(name: string, fmt: string | undefined): Promise<void> {
  // spinner 只包裹「创建任务 + 轮询」这段耗时操作；
  // 结束后再 output / dieWith，避免与 spinner 行串扰
  const outcome = await withSpinner(
    `搜索公众号「${name}」中…`,
    async (): Promise<SearchOutcome> => {
      const { searchId } = await createSearchTask({ name });

      const start = Date.now();
      const candidates: Mp[] = [];
      const seen = new Set<string>();
      let lastMessage = '';

      while (Date.now() - start < POLL_MAX_MS) {
        // 先 sleep，避免创建后立即查询触发后端 not-yet-ready 抖动
        await sleep(POLL_INTERVAL_MS);

        const r = await getSearchTask(searchId);
        if (r.message) lastMessage = r.message;

        // 后端会在多次轮询里逐条返回候选公众号，需累积去重
        if (r.mp && !seen.has(r.mp.mpId)) {
          seen.add(r.mp.mpId);
          candidates.push(r.mp);
        }

        // finished：候选流已结束，返回全部命中结果
        if (r.finished) {
          return { kind: 'done', searchId, candidates, lastMessage };
        }
      }

      return { kind: 'timeout', searchId, candidates, lastMessage };
    },
  );

  if (outcome.kind === 'done') {
    if (outcome.candidates.length > 0) {
      output(outcome.candidates, fmt, renderMpTable);
      return;
    }
    dieWith(
      {
        code: 'MP_NOT_FOUND',
        message: outcome.lastMessage || '未找到对应公众号',
        status: 0,
      },
      fmt,
    );
  }

  // 超时
  dieWith(
    {
      code: 'MP_SEARCH_TIMEOUT',
      message: `30 秒内未完成，可重试 supsub mp search 或取消任务: supsub mp search-cancel ${outcome.searchId}`,
      status: 0,
      data: { searchId: outcome.searchId },
    },
    fmt,
  );
}

export function registerMpSearch(parent: Command): void {
  parent
    .command('search <name>')
    .description('搜索公众号')
    .action(async (name: string) => {
      const fmt = (parent.parent?.opts().output ?? undefined) as string | undefined;
      await runSyncSearch(name, fmt);
    });
}
