/**
 * Calibration monitor — Wave CLOSED-LOOP (real-estate).
 *
 * Barrel for the tracker (reads outcome_predictions +
 * outcome_reconciliations and returns a calibration score) and the
 * alerter (emits a `calibration_drift` event when accuracy crosses
 * the floor). The brain tool `bossnyumba.calibration.score` is
 * exported via `brain-tool.ts` and wired through the persona-aware
 * tool catalog by the composition root.
 */

export * from './types.js';
export {
  createCalibrationTracker,
  type CalibrationTracker,
  type CalibrationTrackerOptions,
} from './tracker.js';
export {
  createCalibrationAlerter,
  type CalibrationAlerter,
  type CalibrationAlerterOptions,
  type CalibrationDriftEvent,
  type CalibrationDriftSink,
} from './alerter.js';
export {
  buildCalibrationScoreTool,
  type CalibrationScoreTool,
  type CalibrationScoreToolDeps,
} from './brain-tool.js';
