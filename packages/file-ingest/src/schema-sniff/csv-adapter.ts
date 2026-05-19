/**
 * CSV → ParsedTable, using papaparse for robust quoting / escape / delim
 * detection. Returns a deterministic ParsedTable; never throws on malformed
 * cells (papaparse already coerces silently). The caller's responsibility is
 * to feed UTF-8 text, not raw bytes.
 */

import Papa from 'papaparse';

import type { ParsedTable } from './types.js';

export interface CsvParseOptions {
  /** If true, treat the first row as headers (default: true). */
  readonly hasHeader?: boolean;
  /** If supplied, override papaparse's auto-detected delimiter. */
  readonly delimiter?: string;
}

export function parseCsv(text: string, options: CsvParseOptions = {}): ParsedTable {
  const hasHeader = options.hasHeader ?? true;

  const result = Papa.parse<string[]>(text, {
    header: false,
    skipEmptyLines: 'greedy',
    dynamicTyping: false,
    ...(options.delimiter ? { delimiter: options.delimiter } : {}),
  });

  const data: ReadonlyArray<ReadonlyArray<string>> = (result.data ?? []).map((row) =>
    Array.isArray(row) ? row.map((v) => (v ?? '').toString()) : []
  );

  if (data.length === 0) {
    return Object.freeze({
      headers: [],
      rows: [],
      source_format: 'csv',
    });
  }

  if (!hasHeader) {
    const firstRow = data[0] ?? [];
    const headers = firstRow.map((_, idx) => `column_${idx + 1}`);
    return Object.freeze({
      headers: Object.freeze(headers),
      rows: Object.freeze(data),
      source_format: 'csv',
    });
  }

  const headers = (data[0] ?? []).map((h, idx) =>
    h && h.trim() ? h.trim() : `column_${idx + 1}`
  );
  const rows = data.slice(1);

  return Object.freeze({
    headers: Object.freeze(headers),
    rows: Object.freeze(rows),
    source_format: 'csv',
  });
}
