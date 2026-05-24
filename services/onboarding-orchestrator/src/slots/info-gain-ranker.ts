/**
 * Info-gain ranker — picks the next slot to ask about.
 *
 * Approach (Macquarie / ACL 2026 psychiatric-intake pattern; research
 * §2.1): score each unfilled slot by
 *
 *   score = uncertainty(slot) × downstream_unblocks(slot, state) × prior(slot)
 *
 * where
 *   * `uncertainty` = 1 if the slot is unfilled, 0 once filled. Free-text
 *     slots get a soft 0.5 so we never re-ask but also never push them.
 *   * `downstream_unblocks` = 1 + (number of other slots that name this
 *     slot in `dependsOn`). Slots that gate many others come first.
 *   * `prior` = slot.prior from the bank (the canonical 12-turn
 *     discovery script in §11 sets these weights).
 *
 * Dependency rule: if a slot has unmet `dependsOn`, its score is
 * forced to 0 — we will not ask about per-property unit counts before
 * the user has told us the property names.
 *
 * The ranker is deterministic — same state → same next question. This
 * makes orchestrator tests stable and lets the discovery script
 * (`discovery-script.ts`) act as a prior we can A/B against.
 */

import {
  type SlotDefinition,
  type SlotKey,
  type SlotState,
  listSlots,
} from './slot-schema.js';

export interface RankedSlot {
  readonly slot: SlotDefinition;
  readonly score: number;
}

export interface RankerOptions {
  /** Slots to ignore even if unfilled (e.g. user said "skip"). */
  readonly skip?: ReadonlySet<string>;
  /** Bias by category — e.g. prioritise compliance after KYC is uploaded. */
  readonly categoryBoost?: Partial<Record<string, number>>;
}

/**
 * Rank all unfilled slots by descending info-gain. Slots blocked by
 * unmet dependencies are excluded entirely.
 */
export function rankSlots(state: SlotState, opts: RankerOptions = {}): readonly RankedSlot[] {
  const skip = opts.skip ?? new Set<string>();
  const downstreamMap = buildDownstreamMap();

  const ranked = listSlots()
    .filter((s) => state[s.key as SlotKey] === undefined)
    .filter((s) => !skip.has(s.key))
    .filter((s) => dependenciesMet(s, state))
    .map((slot) => {
      const uncertainty = slot.freeText ? 0.5 : 1.0;
      const unblocks = 1 + (downstreamMap.get(slot.key)?.size ?? 0);
      const boost = opts.categoryBoost?.[slot.category] ?? 1;
      const score = uncertainty * unblocks * slot.prior * boost;
      return { slot, score };
    })
    .sort((a, b) => {
      if (b.score === a.score) return a.slot.key.localeCompare(b.slot.key);
      return b.score - a.score;
    });

  return ranked;
}

/**
 * The single next slot to ask about. Returns null when the state is
 * "complete enough" (no eligible unfilled slots remain).
 */
export function nextSlot(state: SlotState, opts: RankerOptions = {}): SlotDefinition | null {
  const ranked = rankSlots(state, opts);
  return ranked.length === 0 ? null : ranked[0]!.slot;
}

/**
 * Return the top-N — used by the Confirmer to batch related slots into
 * one turn ("Per Karen: units? rent? caretaker?") instead of three.
 */
export function topN(state: SlotState, n: number, opts: RankerOptions = {}): readonly SlotDefinition[] {
  return rankSlots(state, opts).slice(0, n).map((r) => r.slot);
}

// ---------------------------------------------------------------------------
// Internals.
// ---------------------------------------------------------------------------

function dependenciesMet(slot: SlotDefinition, state: SlotState): boolean {
  if (!slot.dependsOn || slot.dependsOn.length === 0) return true;
  return slot.dependsOn.every((dep) => state[dep as SlotKey] !== undefined);
}

/** Map slot.key -> set of slot keys that depend on it. */
function buildDownstreamMap(): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const slot of listSlots()) {
    for (const dep of slot.dependsOn ?? []) {
      if (!map.has(dep)) map.set(dep, new Set());
      map.get(dep)!.add(slot.key);
    }
  }
  return map;
}
