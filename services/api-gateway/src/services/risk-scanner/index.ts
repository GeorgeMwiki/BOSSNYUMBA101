/**
 * Risk Scanner — public barrel (real-estate domain).
 */

export type {
  Risk,
  RiskKind,
  RiskMitigationAction,
  RiskRule,
  RiskScannerState,
  RiskSeverity,
  ScanRisksOptions,
  BilingualText,
} from './types.js';

export { SEVERITY_WEIGHT, scoreRisk } from './types.js';

export { RISK_RULES, ALL_RISK_RULES } from './scan-rules.js';

export {
  scanRisks,
  renderRiskHeadline,
  renderRiskNarrative,
} from './scanner.js';
