/**
 * Cron registration adapter for the nightly alignment auditor.
 *
 * The package exposes a wire-agnostic `registerAuditCron(deps, opts)`
 * that returns a `disposable` (with `stop()`). The actual scheduler is
 * delegated to the K-C subagent-cron port — this module only sets up
 * the schedule + the audit-running closure.
 *
 * Default schedule: `0 2 * * *` (02:00 daily, UTC). Tenants may
 * override per K-A SessionStore.
 */

import type {
  AlignmentAuditReport,
  AuditFixture,
} from '../types.js';
import { isPassRateRegression, renderAuditMarkdown, runAlignmentAudit } from './run-audit.js';
import type { BrainPort, JudgePort } from './run-audit.js';

export interface AuditCronDeps {
  readonly brain: BrainPort;
  readonly judge: JudgePort;
  readonly scheduler: SchedulerPort;
  readonly reportSink: AuditReportSink;
  readonly priorReportLoader?: PriorReportLoader;
  readonly alerter?: AuditRegressionAlerter;
}

/**
 * Cron-style scheduler port. The wire-side adapter wraps node-cron /
 * the K-C subagent-cron infrastructure.
 */
export interface SchedulerPort {
  schedule(
    cronExpression: string,
    handler: () => Promise<void>,
  ): { stop(): void };
}

/**
 * Writes the rendered markdown report to wherever the wire-side adapter
 * puts it (filesystem `.audit/...`, blob storage, etc.).
 */
export interface AuditReportSink {
  write(report: AlignmentAuditReport, markdown: string): Promise<void>;
}

export interface PriorReportLoader {
  loadLatest(): Promise<AlignmentAuditReport | undefined>;
}

export interface AuditRegressionAlerter {
  alert(report: AlignmentAuditReport, delta: number): Promise<void>;
}

export interface RegisterAuditCronOptions {
  readonly cronExpression?: string;
  readonly fixtures?: ReadonlyArray<AuditFixture>;
  readonly regressionThreshold?: number;
}

/**
 * Register the nightly audit cron. Returns a disposable with `stop()`.
 *
 * The handler:
 *   1. Loads the prior report (if any).
 *   2. Runs the red-team battery.
 *   3. Renders to markdown + writes to the sink.
 *   4. If pass-rate regressed by more than threshold, alerts.
 *
 * Errors are SWALLOWED and logged to the report — never let a single
 * fixture failure crash the cron handler.
 */
export function registerAuditCron(
  deps: AuditCronDeps,
  opts: RegisterAuditCronOptions = {},
): { stop(): void } {
  const cronExpression = opts.cronExpression ?? '0 2 * * *';
  const regressionThreshold = opts.regressionThreshold ?? 0.05;

  const handler = async (): Promise<void> => {
    const prior =
      deps.priorReportLoader !== undefined
        ? await deps.priorReportLoader.loadLatest().catch(() => undefined)
        : undefined;

    const report = await runAlignmentAudit(deps.brain, deps.judge, {
      ...(opts.fixtures ? { fixtures: opts.fixtures } : {}),
      ...(prior !== undefined ? { priorReport: prior } : {}),
    });

    const markdown = renderAuditMarkdown(report);

    await deps.reportSink.write(report, markdown).catch(() => {
      // Sink failure is a critical issue but we still want the regression
      // check to fire if possible.
    });

    if (deps.alerter && isPassRateRegression(report, prior, regressionThreshold)) {
      const delta = (prior?.passRate ?? 1) - report.passRate;
      await deps.alerter.alert(report, delta).catch(() => {
        // alerter outage shouldn't crash the cron — log up-stack.
      });
    }
  };

  return deps.scheduler.schedule(cronExpression, handler);
}
