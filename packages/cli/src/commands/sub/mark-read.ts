// packages/cli/src/commands/sub/mark-read.ts
import type { Command } from "commander";
import { markAsRead } from "../../api/subscription.ts";
import { output } from "../../ui/output.ts";
import { printTable } from "../../ui/table.ts";
import { normalizeType, parseSourceId } from "./_args.ts";
import type { ErrorEnvelope } from "../../lib/errors.ts";

export function registerSubMarkRead(parent: Command): void {
  parent
    .command("mark-read")
    .description("标记已读")
    .requiredOption("--source-id <id>", "信息源 ID")
    .requiredOption("--type <type>", "信息源类型：MP|WEBSITE")
    .option("--content-id <cid>", "文章 ID（标记单篇）")
    .option("--all", "标记全部为已读")
    .action(
      async (opts: { sourceId: string; type: string; contentId?: string; all?: boolean }) => {
        const globalOpts = parent.parent!.opts() as { output?: string };
        const fmt = globalOpts.output;

        // 互斥与必填校验
        if (opts.contentId && opts.all) {
          throw {
            code: "INVALID_ARGS",
            status: 0,
            message: "--content-id 与 --all 互斥，请只指定一个",
          } satisfies ErrorEnvelope;
        }
        if (!opts.contentId && !opts.all) {
          throw {
            code: "INVALID_ARGS",
            status: 0,
            message: "--content-id <id> 与 --all 必须二选一",
          } satisfies ErrorEnvelope;
        }

        const sourceType = normalizeType(opts.type);
        const sourceId = parseSourceId(opts.sourceId);

        await markAsRead({
          sourceType,
          sourceId,
          ...(opts.contentId ? { contentId: opts.contentId } : {}),
        });

        const msg = "已标记为已读";
        output(
          { message: msg },
          fmt,
          (d) => {
            printTable({
              headers: ["结果"],
              rows: [[d.message]],
            });
          },
        );
      },
    );
}
