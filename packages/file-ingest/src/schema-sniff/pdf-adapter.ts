/**
 * PDF → ParsedTable.
 *
 * The full PDF parser stack (pdf-parse) is heavy and noisy. For Phase J2 we
 * accept _extracted text_ as the input — production callers wire pdf-parse
 * upstream (it has a stable API), but the deterministic part of the
 * pipeline only needs the text.
 *
 * Heuristic: detect tabular layout by lines of consistent column counts,
 * delimited by two-or-more whitespace runs or pipe characters. Anything
 * else returns a single 'text' column so the LLM proposal layer can still
 * extract entities by free-text inference.
 */

import type { ParsedTable } from './types.js';

export interface PdfTextParseOptions {
  /**
   * If true, force single-column free-text mode (skip the table-detection
   * heuristic). Useful when the caller already knows the PDF is prose.
   */
  readonly forceFreeText?: boolean;
}

const COL_SPLIT_RX = /\s{2,}|\t+|\|/;

interface Candidate {
  readonly headers: ReadonlyArray<string>;
  readonly rows: ReadonlyArray<ReadonlyArray<string>>;
}

function tryDetectTable(lines: ReadonlyArray<string>): Candidate | null {
  const nonEmpty = lines.map((l) => l.trim()).filter((l) => l.length > 0);
  if (nonEmpty.length < 3) return null;

  // Count fields per line under the delimiter heuristic.
  const fields = nonEmpty.map((l) =>
    l.split(COL_SPLIT_RX).map((c) => c.trim()).filter((c) => c.length > 0)
  );

  // Find the longest contiguous run of lines that share the same field
  // count >= 2. Real-world PDFs put tabular blocks _after_ prose, so we
  // can't only look at the head of the file.
  const MIN_RUN = 3;
  let bestStart = -1;
  let bestLen = 0;
  let bestCount = 0;
  let curStart = 0;
  let curCount = fields[0]?.length ?? 0;
  for (let i = 1; i <= fields.length; i += 1) {
    const cnt = i < fields.length ? fields[i]?.length ?? 0 : -1;
    if (cnt !== curCount) {
      const runLen = i - curStart;
      if (curCount >= 2 && runLen >= MIN_RUN && runLen > bestLen) {
        bestLen = runLen;
        bestStart = curStart;
        bestCount = curCount;
      }
      curStart = i;
      curCount = cnt;
    }
  }
  if (bestStart === -1 || bestCount < 2) return null;

  const headers = fields[bestStart] ?? [];
  const rows: string[][] = [];
  for (let i = bestStart + 1; i < bestStart + bestLen; i += 1) {
    const row = fields[i];
    if (row && row.length === bestCount) {
      rows.push(row);
    }
  }
  if (rows.length === 0) return null;

  return { headers, rows };
}

export function parsePdfText(text: string, options: PdfTextParseOptions = {}): ParsedTable {
  const lines = text.split(/\r?\n/);

  if (!options.forceFreeText) {
    const detected = tryDetectTable(lines);
    if (detected) {
      return Object.freeze({
        headers: Object.freeze(detected.headers.map((h, idx) =>
          h && h.trim() ? h.trim() : `column_${idx + 1}`
        )),
        rows: Object.freeze(detected.rows),
        source_format: 'pdf',
      });
    }
  }

  // Free-text fallback: every non-blank line becomes one row with a single
  // 'text' column. The proposal layer is then responsible for extracting
  // structured entities from prose.
  const rows: string[][] = [];
  for (const raw of lines) {
    const trimmed = raw.trim();
    if (trimmed.length === 0) continue;
    rows.push([trimmed]);
  }

  return Object.freeze({
    headers: Object.freeze(['text']),
    rows: Object.freeze(rows),
    source_format: 'pdf',
  });
}
