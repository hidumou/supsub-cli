// packages/cli/src/commands/search.ts
import type { Command } from "commander";
import { searchAll } from "../api/search.ts";
import type { SearchResultItem, SourceBasic } from "../lib/types.ts";
import { output } from "../ui/output.ts";
import { printTable, truncate } from "../ui/table.ts";
import type { ErrorEnvelope } from "../lib/errors.ts";

const VALID_TYPES = new Set(["ALL", "MP", "WEBSITE", "CONTENT"]);

function shortUrl(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url.slice(0, 40);
  }
}

function sourceKindLabel(sourceType: string): string {
  const t = sourceType.toUpperCase();
  if (t === "MP") return "公众号";
  if (t === "WEBSITE") return "网站";
  return sourceType;
}

function resultKindLabel(item: SearchResultItem): string {
  if (item.type === "CONTENT") return "文章";
  return sourceKindLabel((item.data as SourceBasic).sourceType);
}

function renderResultItem(item: SearchResultItem): string[] {
  if (item.type === "SOURCE") {
    const d = item.data as SourceBasic;
    return [
      resultKindLabel(item),
      truncate(d.name, 24),
      shortUrl(d.url),
      truncate(d.description, 40),
    ];
  } else {
    const d = item.data;
    return [
      resultKindLabel(item),
      truncate(d.title, 24),
      shortUrl(d.url),
      truncate(d.summary, 40),
    ];
  }
}

function renderSourceRow(s: SourceBasic): string[] {
  return [
    sourceKindLabel(s.sourceType),
    truncate(s.name, 24),
    shortUrl(s.url),
    truncate(s.description, 40),
  ];
}

export function registerSearch(program: Command): void {
  program
    .command("search <keyword>")
    .description("全量搜索（源 + 内容）")
    .option("--type <type>", "搜索类型：ALL|MP|WEBSITE|CONTENT", "ALL")
    .option("--page <n>", "页码", "1")
    .action(async (keyword: string, opts: { type: string; page: string }) => {
      const globalOpts = program.opts() as { output?: string };
      const fmt = globalOpts.output;

      const typeVal = opts.type.trim().toUpperCase();
      if (!VALID_TYPES.has(typeVal)) {
        throw {
          code: "INVALID_ARGS",
          status: 0,
          message: `--type 仅支持 ALL|MP|WEBSITE|CONTENT，收到: ${opts.type}`,
        } satisfies ErrorEnvelope;
      }

      const page = parseInt(opts.page, 10) || 1;

      const data = await searchAll({
        type: typeVal as "ALL" | "MP" | "WEBSITE" | "CONTENT",
        keywords: keyword,
        page,
      });

      output(data, fmt, (d) => {
        const results = d.results ?? [];
        const recommendations = d.recommendations ?? [];

        // Results 表
        if (results.length === 0) {
          process.stdout.write(`Results (0 items, page ${page})\n(empty)\n`);
        } else {
          process.stdout.write(`Results (${results.length} items, page ${page})\n`);
          printTable({
            headers: ["类型", "name/title", "url", "summary"],
            rows: results.map(renderResultItem),
            columnWidths: [10, 26, 42, 42],
          });
        }

        // Recommendations 表（仅在有数据时显示）
        if (recommendations.length > 0) {
          process.stdout.write(`\nRecommendations (${recommendations.length} items)\n`);
          printTable({
            headers: ["类型", "name", "url", "description"],
            rows: recommendations.map(renderSourceRow),
            columnWidths: [10, 26, 42, 42],
          });
        }
      });
    });
}
