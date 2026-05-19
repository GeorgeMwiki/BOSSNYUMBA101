/**
 * Confidence module — L3 §1 #1.
 *
 * Surface:
 *   - `extractConfidence(response)` — derives the routing decision
 *   - `appendJustAskConfidence(prompt)` — adds the "rate yourself" suffix
 *   - `calibrateVerbalized(v)` — exposed for callers that already have a
 *     verbalized score (e.g. structured tool output)
 *   - `combineCalibrated(v, l)` — composable for custom pipelines
 *   - `VERBALIZED_CALIBRATION_CURVE` — for inspection / dashboards
 */

export {
  extractConfidence,
  appendJustAskConfidence,
} from './extract-confidence.js';
export {
  calibrateVerbalized,
  combineCalibrated,
  VERBALIZED_CALIBRATION_CURVE,
} from './calibrate.js';
