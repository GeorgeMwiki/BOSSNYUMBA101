/**
 * buildPreferencePairs — main entrypoint of the pair builder.
 *
 * Reads feedback events from the J1 feedback_event store (via port),
 * groups them by turn (for regenerate-then-accept detection), and
 * dispatches to the per-rule generators. Output is filtered through the
 * quality-filter and serialised to the JSONL row shape expected by
 * SimPO / DPO / KTO trainers.
 */

import type {
  FeedbackEvent,
  PreferencePair,
  TurnId,
} from '../types.js';
import {
  generateKtoFromThumbs,
  generateDpoFromRegenerateThenAccept,
  generateDpoFromOwnerEdit,
  generateKtoFromStarRating,
  generatePrmStepDpoFromToolRecovery,
  type GeneratorDeps,
  type ToolFailThenSucceedInput,
} from './pair-generators.js';
import {
  applyQualityFilter,
  MIN_PAIRS_BEFORE_TUNING,
  REJECTED_PERCENTILE_TARGET,
} from './quality-filter.js';

/**
 * Storage port — read-only view of feedback events. Implemented by the
 * wire-side adapter against the J1 `feedback_event` entity.
 */
export interface FeedbackEventReader {
  listSince(args: {
    tenantId: string;
    since: Date;
  }): Promise<ReadonlyArray<FeedbackEvent>>;
}

/**
 * Optional tool-recovery feed — for Rule 5 step-DPO. Wire-side resolves
 * these from the kernel's sovereign-action-ledger.
 */
export interface ToolRecoveryFeed {
  listSince(args: {
    tenantId: string;
    since: Date;
  }): Promise<ReadonlyArray<ToolFailThenSucceedInput>>;
}

export interface PreferencePairSources extends GeneratorDeps {
  readonly feedback: FeedbackEventReader;
  readonly toolRecovery?: ToolRecoveryFeed;
}

export interface BuildPreferencePairsInput {
  readonly tenantId: string;
  readonly since: Date;
  /** Floor on the cohort size before pairs are usable for training. */
  readonly minPairs?: number;
}

export interface BuildPreferencePairsResult {
  readonly pairs: ReadonlyArray<PreferencePair>;
  readonly cohortReady: boolean;
  readonly stats: {
    readonly dpo: number;
    readonly kto: number;
    readonly simpo: number;
    readonly prmStepDpo: number;
    readonly rejected: number;
  };
}

/**
 * Public entrypoint.
 */
export async function buildPreferencePairs(
  sources: PreferencePairSources,
  input: BuildPreferencePairsInput,
): Promise<BuildPreferencePairsResult> {
  const minPairs = input.minPairs ?? MIN_PAIRS_BEFORE_TUNING;

  const feedbackEvents = await sources.feedback.listSince({
    tenantId: input.tenantId,
    since: input.since,
  });

  const candidates: PreferencePair[] = [];

  // Group by turn for regenerate-then-accept pairing.
  const byTurn = groupByTurn(feedbackEvents);

  for (const [_turnId, events] of byTurn) {
    // Pair regenerate-then-accept first (consumes both events).
    const regenerated = events.find((e) => e.kind === 'regenerated');
    const accepted = events.find(
      (e) => e.kind === 'accepted_as_is' || e.kind === 'thumbs_up',
    );
    if (regenerated && accepted) {
      const pair = await generateDpoFromRegenerateThenAccept(sources, {
        regenerated,
        accepted,
      });
      if (pair) candidates.push(pair);
    }

    // Remaining single-reaction generators.
    for (const e of events) {
      if (e.kind === 'edited_by_owner') {
        const pair = await generateDpoFromOwnerEdit(sources, e);
        if (pair) candidates.push(pair);
      } else if (e.kind === 'thumbs_up' || e.kind === 'thumbs_down') {
        // Skip thumbs_up consumed by regenerate-then-accept already.
        if (regenerated && accepted === e) continue;
        const pair = await generateKtoFromThumbs(sources, e);
        if (pair) candidates.push(pair);
      } else if (e.kind === 'star_rating') {
        const pair = await generateKtoFromStarRating(sources, e);
        if (pair) candidates.push(pair);
      }
    }
  }

  // Rule 5 — tool recovery pairs.
  if (sources.toolRecovery) {
    const recoveries = await sources.toolRecovery.listSince({
      tenantId: input.tenantId,
      since: input.since,
    });
    for (const r of recoveries) {
      candidates.push(generatePrmStepDpoFromToolRecovery(sources, r));
    }
  }

  // Apply quality filter.
  const accepted: PreferencePair[] = [];
  let rejectedCount = 0;
  for (const pair of candidates) {
    const verdict = applyQualityFilter({
      pair,
      rejectedPercentile: pair.rejectedPercentile,
    });
    if (verdict.accepted) accepted.push(pair);
    else rejectedCount += 1;
  }

  const stats = {
    dpo: accepted.filter((p) => p.algo === 'dpo').length,
    kto: accepted.filter((p) => p.algo === 'kto').length,
    simpo: accepted.filter((p) => p.algo === 'simpo').length,
    prmStepDpo: accepted.filter((p) => p.algo === 'prm-step-dpo').length,
    rejected: rejectedCount,
  };

  return Object.freeze({
    pairs: Object.freeze(accepted),
    cohortReady: accepted.length >= minPairs,
    stats: Object.freeze(stats),
  });
}

function groupByTurn(
  events: ReadonlyArray<FeedbackEvent>,
): Map<TurnId, FeedbackEvent[]> {
  const map = new Map<TurnId, FeedbackEvent[]>();
  for (const e of events) {
    const arr = map.get(e.turnId);
    if (arr) arr.push(e);
    else map.set(e.turnId, [e]);
  }
  return map;
}

/**
 * Serialise a single pair to a JSONL row appropriate for its algo.
 *
 *   DPO/SimPO row : {"prompt": ..., "chosen": ..., "rejected": ...}
 *   KTO row       : {"prompt": ..., "response": ..., "label": "good"|"bad"}
 *   PRM step-DPO  : {"prompt": ..., "state_chosen": ..., "state_rejected": ...}
 */
export function pairToJsonlRow(pair: PreferencePair): string {
  if (pair.algo === 'kto') {
    const response = pair.ktoLabel === 'good' ? pair.chosen : pair.rejected;
    return JSON.stringify({
      prompt: pair.prompt,
      response,
      label: pair.ktoLabel ?? 'good',
    });
  }
  if (pair.algo === 'prm-step-dpo') {
    return JSON.stringify({
      prompt: pair.prompt,
      state_chosen: pair.chosen,
      state_rejected: pair.rejected,
    });
  }
  // DPO + SimPO share the same row shape.
  return JSON.stringify({
    prompt: pair.prompt,
    chosen: pair.chosen,
    rejected: pair.rejected,
  });
}

export { MIN_PAIRS_BEFORE_TUNING, REJECTED_PERCENTILE_TARGET };
