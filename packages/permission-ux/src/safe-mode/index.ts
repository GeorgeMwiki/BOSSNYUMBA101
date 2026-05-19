/**
 * safe-mode — public surface.
 */

export type {
  ConfidenceSample,
  SafeModeChoice,
  SafeModeState,
  SafeModeThresholds,
  SafeModeEntryMessage,
} from './types.js';

export { DEFAULT_THRESHOLDS, INITIAL_SAFE_MODE_STATE } from './types.js';

export {
  advanceSafeModeState,
  resetSafeModeState,
  type AdvanceSafeModeInput,
  type SafeModeAdvanceResult,
} from './confidence-monitor.js';

export {
  buildSafeModeMessage,
  resolveSafeModeChoice,
  type BuildSafeModeMessageInput,
  type SafeModeNextStep,
} from './build-message.js';
