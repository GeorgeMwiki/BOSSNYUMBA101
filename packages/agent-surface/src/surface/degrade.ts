/**
 * Cross-surface degradation rules.
 *
 * If the MD emits a rich AG-UI block (e.g. `chart-vega`, a Hebbia
 * `Matrix`, a `data-table`), each adapter must decide:
 *
 *   - Web/Mobile: render natively.
 *   - WhatsApp:   degrade to plain-text summary + optional PNG attachment.
 *   - SMS:        degrade to plain-text summary only; drop attachments.
 *   - Email:      render as HTML table for tables, or "[chart]" placeholder.
 *
 * This module isolates the degrade logic so a new rich block type can
 * be added in one place.
 */

import type { RichPart, SurfaceKind } from './types.js';

/**
 * Convert a rich part into a plain-text summary. Surfaces without
 * rich-block support call this; the summary is appended to the text
 * body in render order.
 *
 * Each handler is kept tiny — the goal is "informative one-liner",
 * not "complete reconstruction".
 */
export function summariseRichPart(part: RichPart): string {
  switch (part.kind) {
    case 'matrix':
      return summariseMatrix(part);
    case 'chart-vega':
      return summariseChart(part);
    case 'data-table':
      return summariseTable(part);
    case 'kpi-grid':
      return summariseKpiGrid(part);
    case 'timeline':
      return summariseTimeline(part);
    case 'budget-preview-card':
      return summariseBudgetCard(part);
    default:
      return `[${part.kind} block — view on Web for details]`;
  }
}

function summariseMatrix(part: RichPart): string {
  const rows = readNumber(part, 'rowCount') ?? readArrayLen(part, 'rows');
  const cols = readNumber(part, 'columnCount') ?? readArrayLen(part, 'columns');
  const title = readString(part, 'title') ?? 'Matrix';
  return `[${title}: ${rows}×${cols} grid — open in app for full results]`;
}

function summariseChart(part: RichPart): string {
  const title = readString(part, 'title') ?? 'chart';
  return `[chart: ${title} — open in app to view]`;
}

function summariseTable(part: RichPart): string {
  const title = readString(part, 'title') ?? 'table';
  const cols = readArrayLen(part, 'columns');
  const rows = readArrayLen(part, 'rows');
  return `[${title} table: ${rows} rows × ${cols} cols]`;
}

function summariseKpiGrid(part: RichPart): string {
  const tiles = readArray(part, 'tiles');
  if (!tiles || tiles.length === 0) return '[KPIs]';
  const parts = tiles.slice(0, 4).map((t) => {
    if (!isRecord(t)) return '';
    const lbl = readString(t, 'label') ?? '';
    const val = t['value'];
    return `${lbl}: ${val ?? '-'}`;
  });
  return parts.filter(Boolean).join(' · ');
}

function summariseTimeline(part: RichPart): string {
  const events = readArray(part, 'events');
  const n = events?.length ?? 0;
  return `[timeline: ${n} events]`;
}

function summariseBudgetCard(part: RichPart): string {
  const cost = readNumber(part, 'costUsd') ?? 0;
  const sec = readNumber(part, 'seconds') ?? 0;
  const desc = readString(part, 'description') ?? 'this action';
  return `Cost preview: ${desc} ~$${cost.toFixed(2)} · ~${Math.round(sec)}s. Reply Y to approve, N to skip.`;
}

/**
 * Helper: should a surface render this rich part natively?
 * Returns `true` for web/mobile (always), and `false` for SMS/email.
 * WhatsApp returns `false` for everything but markdown — the body
 * adapter then attaches images for chart-vega via the
 * `imageAttachment` of the part if present.
 */
export function canRenderNatively(surface: SurfaceKind, part: RichPart): boolean {
  if (surface === 'web' || surface === 'mobile') return true;
  if (surface === 'email') {
    // email renders tables but not interactive parts
    return part.kind === 'data-table' || part.kind === 'kpi-grid';
  }
  return false;
}

// ──────────────────────────────────────────────────────────────────────
// Local readers — never mutate; never throw.
// ──────────────────────────────────────────────────────────────────────

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function readString(r: Record<string, unknown>, k: string): string | undefined {
  const v = r[k];
  return typeof v === 'string' ? v : undefined;
}
function readNumber(r: Record<string, unknown>, k: string): number | undefined {
  const v = r[k];
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}
function readArray(r: Record<string, unknown>, k: string): ReadonlyArray<unknown> | undefined {
  const v = r[k];
  return Array.isArray(v) ? v : undefined;
}
function readArrayLen(r: Record<string, unknown>, k: string): number {
  const v = r[k];
  return Array.isArray(v) ? v.length : 0;
}
