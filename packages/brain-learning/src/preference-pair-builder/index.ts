/**
 * Module 3 — preference-pair-builder
 *
 * Build DPO/KTO/SimPO/PRM-step-DPO pairs from feedback events. Output
 * is JSONL-ready for SimPO/DPO/KTO trainers.
 */

export {
  buildPreferencePairs,
  pairToJsonlRow,
  MIN_PAIRS_BEFORE_TUNING,
  REJECTED_PERCENTILE_TARGET,
} from './build-pairs.js';
export type {
  BuildPreferencePairsInput,
  BuildPreferencePairsResult,
  PreferencePairSources,
  FeedbackEventReader,
  ToolRecoveryFeed,
} from './build-pairs.js';

export {
  applyQualityFilter,
  hasMinimumCohort,
  MIN_CHOSEN_QUALITY,
} from './quality-filter.js';
export type { QualityFilterInput, QualityVerdict } from './quality-filter.js';

export {
  generateKtoFromThumbs,
  generateDpoFromRegenerateThenAccept,
  generateDpoFromOwnerEdit,
  generateKtoFromStarRating,
  generatePrmStepDpoFromToolRecovery,
} from './pair-generators.js';
export type {
  GeneratorDeps,
  TurnContentResolver,
  QualityScorer,
  ToolFailThenSucceedInput,
} from './pair-generators.js';
