/**
 * Module 4 — active-learning-queue
 *
 * Uncertainty sampling: when M-E confidence < 0.6 OR M-G PRM step < 0.5,
 * queue the turn for human labelling. Anti-fatigue caps: 25 items/day
 * per labeller, deprioritise after 3 declines.
 */

export {
  enqueueActiveLearningItem,
  buildDailyDigest,
  recordDecline,
  MAX_ITEMS_PER_LABELLER_PER_DAY,
  DECLINE_DEPRIORITISE_THRESHOLD,
} from './queue.js';
export type {
  ActiveLearningPorts,
  ActiveLearningItemStore,
  EnqueueInput,
  EnqueueOutcome,
  RecordDeclineInput,
  RecordDeclineOutcome,
} from './queue.js';

export {
  checkActiveLearningTrigger,
  CONFIDENCE_TRIGGER_THRESHOLD,
  PRM_STEP_TRIGGER_THRESHOLD,
  CALIBRATION_DRIFT_THRESHOLD,
} from './triggers.js';
export type { TriggerCheckInput } from './triggers.js';
