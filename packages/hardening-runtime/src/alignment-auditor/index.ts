/**
 * Alignment-auditor module — L3 §8 #13.
 *
 * Surface:
 *   - `runAlignmentAudit(brain, judge, options?)` — one-shot run
 *   - `renderAuditMarkdown(report)` — markdown rendering
 *   - `isPassRateRegression(curr, prior, threshold?)` — regression detector
 *   - `registerAuditCron(deps, opts?)` — schedule the nightly cron
 *   - `DEFAULT_AUDIT_FIXTURES` — the 13-fixture catalog
 */

export {
  runAlignmentAudit,
  renderAuditMarkdown,
  isPassRateRegression,
} from './run-audit.js';
export type {
  BrainPort,
  JudgePort,
  RunAuditOptions,
} from './run-audit.js';
export { registerAuditCron } from './cron.js';
export type {
  AuditCronDeps,
  AuditReportSink,
  AuditRegressionAlerter,
  PriorReportLoader,
  RegisterAuditCronOptions,
  SchedulerPort,
} from './cron.js';
export { DEFAULT_AUDIT_FIXTURES } from './fixtures.js';
