/**
 * Risk Scanner — public barrel.
 *
 * Mirrors the opportunity-scanner public surface, polarity-flipped. The
 * brain tools (`property.risks.scan` / `expand` / `mitigate` /
 * `acknowledge`) import from here; the daily-brief composer and the SSE
 * block parser also wire through this module.
 */

export {
  scanRisks,
  evaluateRisks,
  buildScannerState,
  listRules,
  countRulesByKind,
  type RiskScannerDeps,
} from './scanner.js';
export { RISK_RULES } from './scan-rules.js';
export {
  SEVERITY_WEIGHT,
  scoreRisk,
  type Risk,
  type RiskKind,
  type RiskMitigationAction,
  type RiskRule,
  type RiskScannerState,
  type RiskSeverity,
  type ScanRisksOptions,
  type BilingualText,
} from './types.js';
