/**
 * External Nightly Auditor — module barrel.
 */
export type {
  AuditRunInput,
  AuditRunReport,
  BrainAuditAdapter,
  PreviousRunStore,
  ScenarioOutcome,
} from './types.js';
export { AuditorTamperError } from './types.js';
export { runNightlyAudit, renderReport, judge } from './runner.js';
