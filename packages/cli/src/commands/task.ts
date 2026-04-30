// packages/cli/src/commands/task.ts
import type { Command } from "commander";
import { getSearchTask } from "../api/mp.ts";
import { output } from "../ui/output.ts";
import { printTable, truncate } from "../ui/table.ts";
import { dieWith } from "../lib/errors.ts";

export function registerTask(program: Command): void {
  program
    .command("task <searchId>")
    .description("查询搜索任务状态")
    .action(async (searchId: string) => {
      const fmt = program.opts()["output"] as string | undefined;

      const r = await getSearchTask(searchId);

      if (!r.finished) {
        // 任务进行中，退出码 0（查询本身成功）
        // data 固定带 mp:null，schema 与 finished:true 路径保持一致
        output(
          { finished: false as const, message: r.message ?? "", mp: null },
          fmt,
          () => {
            printTable({
              headers: ["searchId", "status", "message"],
              rows: [[searchId, "进行中", r.message ?? ""]],
              columnWidths: [40, 12, 40],
            });
          },
        );
        return;
      }

      // finished: true
      if (r.mp) {
        // 成功路径：data 包含 finished/message/mp 完整字段
        output(
          { finished: true as const, message: r.message ?? "", mp: r.mp },
          fmt,
          (d) => {
            printTable({
              headers: ["mpId", "name", "description"],
              rows: [
                [
                  d.mp!.mpId,
                  truncate(d.mp!.name, 24),
                  truncate(d.mp!.description, 50),
                ],
              ],
              columnWidths: [20, 26, 52],
            });
          },
        );
        return;
      }

      // finished:true 但无 mp（未找到）— 业务退出码 1
      dieWith(
        {
          code: "MP_NOT_FOUND",
          message: r.message ?? "未找到对应公众号",
          status: 0,
        },
        fmt,
      );
    });
}
