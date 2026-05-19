/**
 * PI-A · history · diff — short, human-readable diff lines suitable for
 * inline chat rendering (the K-B Action Receipts + J9 chat-as-workspace
 * pattern). Values that can't be displayed inline are summarized as
 * `<object: 3 keys>`.
 *
 * Pure, side-effect free.
 */

import type { AttributeHistoryEntry } from './types.js';

const MAX_VALUE_LEN = 80;

function displayValue(v: unknown): string {
  if (v === null) return 'null';
  if (v === undefined) return '(empty)';
  if (typeof v === 'string') return v.length > MAX_VALUE_LEN ? `${v.slice(0, MAX_VALUE_LEN)}…` : v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return `<list: ${v.length} items>`;
  if (typeof v === 'object') return `<object: ${Object.keys(v as object).length} keys>`;
  return String(v);
}

/**
 * Render a single AttributeHistoryEntry as one line:
 *   <attribute>: <from> → <to>   (by <actor.label>, <reason>)
 */
export function diffSummary(entry: AttributeHistoryEntry): string {
  const from = displayValue(entry.fromValue);
  const to = displayValue(entry.toValue);
  const actor = entry.actor.label ?? entry.actor.id;
  const reasonSuffix = entry.reason.trim().length > 0 ? `, ${entry.reason}` : '';
  return `${entry.attributeKey}: ${from} → ${to}   (by ${actor}${reasonSuffix})`;
}
