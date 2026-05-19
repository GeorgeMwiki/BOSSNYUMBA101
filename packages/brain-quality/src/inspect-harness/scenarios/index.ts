/**
 * Bundled Inspect scenario suite — 30 scenarios across the tau-bench
 * triangle (policy + tool + dialog).
 */

import type { InspectScenario } from '../../types.js';
import { POLICY_COMPLIANCE_SCENARIOS } from './policy-compliance.js';
import { TOOL_USE_SCENARIOS } from './tool-use.js';
import { DIALOG_SCENARIOS } from './dialog.js';

export { POLICY_COMPLIANCE_SCENARIOS } from './policy-compliance.js';
export { TOOL_USE_SCENARIOS } from './tool-use.js';
export { DIALOG_SCENARIOS } from './dialog.js';

export const ALL_SCENARIOS: readonly InspectScenario[] = Object.freeze([
  ...POLICY_COMPLIANCE_SCENARIOS,
  ...TOOL_USE_SCENARIOS,
  ...DIALOG_SCENARIOS,
]);
