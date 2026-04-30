// packages/cli/src/ui/output.ts

/**
 * 统一输出 helper：
 * - json 模式：stdout 输出 { success: true, data }
 * - table 模式（默认）：调用 renderTable
 */
export function output<T>(data: T, format: string | undefined, renderTable: (d: T) => void): void {
  if (format === 'json') {
    process.stdout.write(`${JSON.stringify({ success: true, data }, null, 2)}\n`);
  } else {
    renderTable(data);
  }
}
