/**
 * Excel → ParsedTable, using SheetJS (xlsx). Always reads the first sheet
 * unless a sheet name is supplied. Cell values are coerced to strings so
 * the type-inference pass sees raw text — matching the CSV path.
 */

import * as XLSX from 'xlsx';

import type { ParsedTable } from './types.js';

export interface ExcelParseOptions {
  /** Sheet name. Defaults to the workbook's first sheet. */
  readonly sheet?: string;
  /** If true (default), the first row is the header row. */
  readonly hasHeader?: boolean;
}

export function parseExcel(
  bytes: Buffer | Uint8Array | ArrayBuffer,
  options: ExcelParseOptions = {}
): ParsedTable {
  const workbook = XLSX.read(bytes, { type: 'array', cellDates: false });
  const sheetName =
    options.sheet ?? workbook.SheetNames[0] ?? null;
  if (!sheetName) {
    return Object.freeze({
      headers: [],
      rows: [],
      source_format: 'excel',
    });
  }
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    return Object.freeze({
      headers: [],
      rows: [],
      source_format: 'excel',
    });
  }

  // sheet_to_json with header:1 gives us a matrix of cells. raw:false coerces
  // to strings (matching CSV behaviour for the type-sniffer).
  const matrix = XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    raw: false,
    defval: '',
  });

  const cleaned: string[][] = matrix
    .filter((row) => Array.isArray(row))
    .map((row) => row.map((v) => (v === undefined || v === null ? '' : String(v))));

  if (cleaned.length === 0) {
    return Object.freeze({
      headers: [],
      rows: [],
      source_format: 'excel',
    });
  }

  const hasHeader = options.hasHeader ?? true;
  if (!hasHeader) {
    const firstRow = cleaned[0] ?? [];
    const headers = firstRow.map((_, idx) => `column_${idx + 1}`);
    return Object.freeze({
      headers: Object.freeze(headers),
      rows: Object.freeze(cleaned),
      source_format: 'excel',
    });
  }

  const headers = (cleaned[0] ?? []).map((h, idx) =>
    h && h.trim() ? h.trim() : `column_${idx + 1}`
  );

  // Normalise row width to the header width so type-sniffer sees consistent
  // tuples. Longer rows are truncated; shorter rows are padded with ''.
  const width = headers.length;
  const rows = cleaned.slice(1).map((row) => {
    if (row.length === width) return row;
    if (row.length > width) return row.slice(0, width);
    return [...row, ...Array.from({ length: width - row.length }, () => '')];
  });

  return Object.freeze({
    headers: Object.freeze(headers),
    rows: Object.freeze(rows),
    source_format: 'excel',
  });
}
