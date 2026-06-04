/**
 * Belief store — PURE helpers.
 *
 * `makeSubjectKey` + `computeConfidence` carry the source-of-truth for
 * canonical subject keys + confidence aggregation. They touch no I/O. The
 * `BeliefStorePort` interface lives in `./ports`; the Map-backed reference
 * adapter for tests + local dev lives in `./in-memory-store`. Production
 * wires a Drizzle/Supabase adapter at the composition root targeting the
 * brain_beliefs / belief_revisions / belief_review_queue tables.
 */

import type { BeliefSource } from './types';

// ─────────────────────────────────────────────────────────────────────
// Subject-key canonicalisation
// ─────────────────────────────────────────────────────────────────────

/**
 * Canonicalise the parts of a subject key into a stable lowercase-dashed
 * identifier. Strips diacritics, collapses whitespace, drops punctuation
 * other than letters / digits / dashes.
 *
 * Example:
 *   makeSubjectKey(['Kinondoni', '2BR', 'Rent', 'Comparable'])
 *     → 'kinondoni-2br-rent-comparable'
 */
export function makeSubjectKey(parts: ReadonlyArray<string>): string {
  return parts
    .map((part) =>
      part
        .normalize('NFD')
        .replace(/\p{M}/gu, '') // strip combining marks (diacritics)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, ''),
    )
    .filter((part) => part.length > 0)
    .join('-');
}

// ─────────────────────────────────────────────────────────────────────
// Confidence aggregation
// ─────────────────────────────────────────────────────────────────────

const SOURCE_KIND_WEIGHT: Record<BeliefSource['kind'], number> = {
  'regulator-doc': 1.0,
  'internal-data': 0.85,
  'manager-input': 0.75,
  'admin-input': 0.75,
  'web-research': 0.6,
  'user-claim': 0.45,
  'prior-belief': 0.4,
};

/**
 * Confidence is a weighted average of source.authority × kind-weight,
 * capped at 0.99 so the brain never claims certainty. PURE.
 */
export function computeConfidence(
  sources: ReadonlyArray<BeliefSource>,
): number {
  if (sources.length === 0) return 0.1;
  let weighted = 0;
  let denom = 0;
  for (const src of sources) {
    const kw = SOURCE_KIND_WEIGHT[src.kind] ?? 0.4;
    weighted += clamp01(src.authority) * kw;
    denom += kw;
  }
  if (denom === 0) return 0.1;
  return Math.min(0.99, weighted / denom);
}

export function clamp01(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  if (n > 1) return 1;
  return n;
}
