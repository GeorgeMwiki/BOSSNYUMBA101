/**
 * Module 5 — eval-driven-iteration
 *
 * Weekly cycle wrapping K-D Inspect: detect 5pp regressions and feed
 * failed scenarios back into the preference-pair builder.
 */

export {
  runEvalCycle,
  type EvalCyclePorts,
  type InspectHarnessPort,
  type EvalScenarioRun,
  type PreferencePairSink,
} from './run-cycle.js';

export {
  checkRegression,
  failedScenarioToPair,
  REGRESSION_ALERT_THRESHOLD_PP,
} from './regression-alert.js';
