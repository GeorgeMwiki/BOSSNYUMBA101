/**
 * Quality filter for preference pairs.
 *
 * §2 R-LEARNING rules:
 *   1. Chosen-response quality DOMINATES — invest annotator time in
 *      making `chosen` excellent.
 *   2. Optimal rejected sample sits at reward percentile μ − 2σ, NOT at
 *      the minimum. Reject responses that are *plausibly wrong*, not
 *      catastrophically wrong.
 *   3. On-policy beats off-policy.
 *   4. 5k pairs MIN for measurable improvement; 20k+ for production-grade.
 */

import type { PreferencePair } from '../types.js';

export const MIN_PAIRS_BEFORE_TUNING = 5000;
/** Target percentile for rejected samples (μ − 2σ ≈ 2.5th percentile). */
export const REJECTED_PERCENTILE_TARGET = 0.025;
/** A chosen must score at least this much to enter the corpus. */
export const MIN_CHOSEN_QUALITY = 0.65;

export interface QualityFilterInput {
  readonly pair: PreferencePair;
  /** Percentile of the rejected response among all candidates, 0-1. */
  readonly rejectedPercentile: number;
}

export interface QualityVerdict {
  readonly accepted: boolean;
  readonly reason: string;
}

/**
 * Decide if a candidate pair is worth keeping.
 *
 * Accept iff:
 *   - chosenQuality ≥ MIN_CHOSEN_QUALITY
 *   - rejected sits in the μ − 2σ band (percentile ≤ 0.05) — bounded so
 *     we don't pull in worst-of-the-worst (catastrophic) rejections
 */
export function applyQualityFilter(
  input: QualityFilterInput,
): QualityVerdict {
  if (input.pair.chosenQuality < MIN_CHOSEN_QUALITY) {
    return Object.freeze({
      accepted: false,
      reason: `chosenQuality ${input.pair.chosenQuality} below MIN_CHOSEN_QUALITY ${MIN_CHOSEN_QUALITY}`,
    });
  }
  // Catastrophic rejection band — exclude bottom 0.5%.
  if (input.rejectedPercentile < 0.005) {
    return Object.freeze({
      accepted: false,
      reason: 'rejected is catastrophically bad — excluded (Anthropic 2025 reward-hack risk)',
    });
  }
  // Sweet spot for DPO rejected is ~p2.5; allow a band up to p10.
  if (input.rejectedPercentile > 0.1) {
    return Object.freeze({
      accepted: false,
      reason: `rejected at p${(input.rejectedPercentile * 100).toFixed(1)} too good — pair signal too weak`,
    });
  }
  return Object.freeze({
    accepted: true,
    reason: 'within quality envelope',
  });
}

/**
 * Cohort-level minimum check — does this batch have enough pairs to
 * justify a fine-tune?
 */
export function hasMinimumCohort(pairs: ReadonlyArray<PreferencePair>): boolean {
  return pairs.length >= MIN_PAIRS_BEFORE_TUNING;
}
