/**
 * Render a `MatrixResult` to CSV.
 *
 * Cells with `errorReason` render as the empty string. Values are
 * RFC-4180 quoted only when needed (commas, quotes, newlines).
 *
 * Citations are NOT emitted to CSV — they are kept in the result
 * object for the chat / UI surfaces. A separate `toCitedCsv` could
 * emit them as additional columns, but YAGNI for now.
 */

import type { MatrixResult } from './types.js';

export function toCsv(result: MatrixResult): string {
  const header = ['Row', ...result.columns.map((c) => c.text)];
  const rows = result.rows.map((r) => {
    const cells = r.cells.map((c) =>
      c.errorReason ? '' : c.displayValue,
    );
    return [r.label, ...cells];
  });
  return [header, ...rows].map(toCsvLine).join('\n');
}

function toCsvLine(fields: ReadonlyArray<string>): string {
  return fields.map(toCsvField).join(',');
}

function toCsvField(s: string): string {
  // RFC-4180: quote if the field contains comma, quote, or CR/LF.
  if (/[",\r\n]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}
