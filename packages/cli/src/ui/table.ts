// packages/cli/src/ui/table.ts
import Table from "cli-table3";
import kleur from "kleur";

/**
 * 单字符显示宽度（CJK / 全角字符按 2 列计算，其余 1 列）
 */
function charWidth(cp: number): 1 | 2 {
  if (
    // CJK Unified Ideographs
    (cp >= 0x4e00 && cp <= 0x9fff) ||
    // CJK Extension A
    (cp >= 0x3400 && cp <= 0x4dbf) ||
    // CJK Extension B
    (cp >= 0x20000 && cp <= 0x2a6df) ||
    // CJK Compatibility Ideographs
    (cp >= 0xf900 && cp <= 0xfaff) ||
    // Fullwidth Forms
    (cp >= 0xff01 && cp <= 0xff60) ||
    // Halfwidth and Fullwidth Forms (other full-width)
    (cp >= 0xffe0 && cp <= 0xffe6) ||
    // Hiragana / Katakana
    (cp >= 0x3040 && cp <= 0x30ff) ||
    // Korean Hangul Syllables
    (cp >= 0xac00 && cp <= 0xd7af) ||
    // CJK Symbols and Punctuation
    (cp >= 0x3000 && cp <= 0x303f)
  ) {
    return 2;
  }
  return 1;
}

/**
 * 截断字符串到指定显示宽度（CJK-aware）
 */
export function truncate(s: string, maxWidth: number): string {
  let w = 0;
  let result = "";
  for (const ch of s) {
    const cw = charWidth(ch.codePointAt(0) ?? 0);
    if (w + cw > maxWidth) {
      result += "…";
      break;
    }
    result += ch;
    w += cw;
  }
  return result;
}

type PrintTableOptions = {
  headers: string[];
  rows: (string | number | boolean)[][];
  columnWidths?: number[];
};

/**
 * 打印表格（基于 cli-table3）
 * 表头用 kleur.cyan().bold() 着色
 */
export function printTable({ headers, rows, columnWidths }: PrintTableOptions): void {
  const tableOptions: ConstructorParameters<typeof Table>[0] = {
    head: headers.map((h) => kleur.cyan().bold(h)),
    style: { head: [] }, // 不让 cli-table3 再加颜色，我们已经手动加了
  };

  if (columnWidths) {
    tableOptions.colWidths = columnWidths;
  }

  const table = new Table(tableOptions);

  for (const row of rows) {
    table.push(row.map((cell) => String(cell)));
  }

  process.stdout.write(table.toString() + "\n");
}
