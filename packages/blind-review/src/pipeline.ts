/**
 * Blind-review pipeline — builds the anonymised, shuffled dataset and the
 * per-reviewer assignments for a Turing-style indistinguishability test
 * over marginal real-estate decisions.
 *
 * Pure TypeScript over an injected {@link DecisionFetcher} (production wires
 * a real archive-backed fetcher; CI wires the synthetic generator) so it
 * runs end-to-end with no live I/O.
 *
 * Flow:
 *   1. fetch -> N marginal cases (50 AI + 50 human by default)
 *   2. anonymise -> redact NIDA, names, phone, account, lease references
 *   3. shuffle -> mix AI + human, deterministic seed for replay
 *   4. assign -> each reviewer sees all records in a randomised order
 *
 * The fetcher port has three distinct outcomes — data, empty, error — and
 * {@link safeFetch} collapses them to `T | undefined` so a fetcher that
 * throws degrades to an empty bucket instead of crashing the run.
 *
 * @module @bossnyumba/blind-review/pipeline
 */

import { anonymiseRecord } from './anonymise';
import { deterministicShuffle } from './shuffle';
import {
  DEFAULT_SEED,
  type BlindReviewDataset,
  type MarginalDecisionRecord,
  type ReviewerAssignment,
} from './types';
import type { DecisionFetcher } from './ports';

/**
 * Wrap one read-only fetcher call so its three outcomes stay type-distinct:
 *   - resolved array  -> the array
 *   - resolved `null` -> `undefined` (empty state)
 *   - throw           -> caught, `undefined` (error degrades to empty)
 * Never re-throws; the pipeline treats `undefined` as "no records".
 */
async function safeFetch<T>(
  call: () => Promise<ReadonlyArray<T> | null>,
): Promise<ReadonlyArray<T> | undefined> {
  try {
    const result = await call();
    return result ?? undefined;
  } catch {
    return undefined;
  }
}

export interface BuildDatasetInput {
  readonly fetcher: DecisionFetcher;
  readonly limit?: number;
  readonly aiRatio?: number;
  readonly seed?: number;
  /** Clock override for deterministic ids/timestamps in tests. */
  readonly now?: () => number;
}

export async function buildBlindReviewDataset(
  input: BuildDatasetInput,
): Promise<BlindReviewDataset> {
  const limit = input.limit ?? 100;
  const aiRatio = input.aiRatio ?? 0.5;
  const seed = input.seed ?? DEFAULT_SEED;
  const nowMs = (input.now ?? Date.now)();
  const aiTarget = Math.round(limit * aiRatio);
  const humanTarget = limit - aiTarget;

  const [ai, human] = await Promise.all([
    safeFetch<MarginalDecisionRecord>(() => input.fetcher.fetchAi(aiTarget)),
    safeFetch<MarginalDecisionRecord>(() => input.fetcher.fetchHuman(humanTarget)),
  ]);

  const aiAnon = (ai ?? []).map(anonymiseRecord);
  const humanAnon = (human ?? []).map(anonymiseRecord);

  return {
    id: `blr_${seed}_${nowMs.toString(36)}`,
    createdAtMs: nowMs,
    aiRecords: aiAnon,
    humanRecords: humanAnon,
    totalSize: aiAnon.length + humanAnon.length,
  };
}

export interface AssignReviewersInput {
  readonly dataset: BlindReviewDataset;
  readonly reviewerIds: ReadonlyArray<string>;
  readonly seed?: number;
}

export function assignReviewers(
  input: AssignReviewersInput,
): ReadonlyArray<ReviewerAssignment> {
  const allRecords = [...input.dataset.aiRecords, ...input.dataset.humanRecords];
  const seed = input.seed ?? DEFAULT_SEED;
  return input.reviewerIds.map((reviewerId, idx) => {
    const order = deterministicShuffle(allRecords, seed + idx);
    return { reviewerId, recordIds: order.map((r) => r.id) };
  });
}
