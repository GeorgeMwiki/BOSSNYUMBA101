/**
 * `MatrixPart` — AG-UI block emitter for a `MatrixResult`.
 *
 * Shape matches the `matrix` part schema in
 * `packages/genui/src/schemas/index.ts`.
 *
 * UX behaviour (handled by the chat surface):
 *   - Sortable: click any column header.
 *   - Filterable: header search bar.
 *   - Exportable to CSV: the surface calls `toCsv(result)` and
 *     attaches the blob to the conversation.
 */

import type { MatrixResult } from './types.js';

export interface MatrixPart {
  readonly kind: 'matrix';
  readonly title?: string;
  readonly columns: ReadonlyArray<{ readonly id: string; readonly header: string; readonly format?: string }>;
  readonly rows: ReadonlyArray<{
    readonly rowId: string;
    readonly label: string;
    readonly cells: ReadonlyArray<{
      readonly columnId: string;
      readonly displayValue: string;
      readonly confidence: 'low' | 'medium' | 'high';
      readonly hasCitation: boolean;
      readonly errored: boolean;
    }>;
  }>;
  readonly rowCount: number;
  readonly columnCount: number;
  readonly totalCostUsd: number;
  readonly elapsedMs: number;
}

export function buildMatrixPart(result: MatrixResult, title?: string): MatrixPart {
  return {
    kind: 'matrix',
    ...(title ? { title } : {}),
    columns: result.columns.map((c) => ({
      id: c.id,
      header: c.text,
      ...(c.answerFormat ? { format: c.answerFormat } : {}),
    })),
    rows: result.rows.map((r) => ({
      rowId: r.rowId,
      label: r.label,
      cells: r.cells.map((c) => ({
        columnId: c.columnId,
        displayValue: c.displayValue,
        confidence: c.confidence,
        hasCitation: c.citations.length > 0,
        errored: c.errorReason !== undefined,
      })),
    })),
    rowCount: result.rows.length,
    columnCount: result.columns.length,
    totalCostUsd: result.totalCostUsd,
    elapsedMs: result.elapsedMs,
  };
}
