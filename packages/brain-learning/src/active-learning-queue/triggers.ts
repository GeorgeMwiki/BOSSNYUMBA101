/**
 * Active-learning trigger logic.
 *
 * §6 R-LEARNING triggers:
 *   - M-E verbalized_confidence < 0.6                 → confidence-low
 *   - M-G PRM step score < 0.5                        → prm-step-low
 *   - |verbalised - logprob_consistency| > 0.25       → consistency-disagreement
 *   - M-B debate ended split-decision                 → debate-split
 *
 * The triggers are pure: numbers in, ActiveLearningTrigger | null out.
 */

import type { ActiveLearningTrigger } from '../types.js';

/** M-E confidence threshold below which we queue. */
export const CONFIDENCE_TRIGGER_THRESHOLD = 0.6;
/** M-G PRM step score below which we queue. */
export const PRM_STEP_TRIGGER_THRESHOLD = 0.5;
/** Calibration drift threshold (verbalised vs logprob). */
export const CALIBRATION_DRIFT_THRESHOLD = 0.25;

export interface TriggerCheckInput {
  readonly verbalisedConfidence: number;
  readonly prmStepScore: number | null;
  readonly logprobConsistency?: number;
  readonly debateSplit?: boolean;
}

/**
 * Returns the first trigger that fires, or null if none do.
 */
export function checkActiveLearningTrigger(
  input: TriggerCheckInput,
): ActiveLearningTrigger | null {
  if (input.verbalisedConfidence < CONFIDENCE_TRIGGER_THRESHOLD) {
    return 'confidence-low';
  }
  if (input.prmStepScore !== null && input.prmStepScore < PRM_STEP_TRIGGER_THRESHOLD) {
    return 'prm-step-low';
  }
  if (
    input.logprobConsistency !== undefined &&
    Math.abs(input.verbalisedConfidence - input.logprobConsistency) >
      CALIBRATION_DRIFT_THRESHOLD
  ) {
    return 'consistency-disagreement';
  }
  if (input.debateSplit === true) {
    return 'debate-split';
  }
  return null;
}
