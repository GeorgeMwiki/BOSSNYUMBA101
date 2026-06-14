/**
 * Report sink adapter — durably records each tenant's nightly
 * `BrainEvolutionReport` into the `consolidation_emissions` table via
 * `createConsolidationEmissionsService`. The admin portal reads that
 * table to surface "what the brain learned overnight".
 *
 * The emissions row is keyed on (tenantId, emissionDate) with an
 * upsert-on-conflict, so a re-run of the same UTC day overwrites the
 * prior emission rather than duplicating it — matching the worker's
 * idempotent-by-day contract.
 *
 * Field mapping (BrainEvolutionReport → consolidation_emissions):
 *   - factsPromoted        ← deltasApplied
 *   - reflexionLessonsWritten ← deltasEscalated
 *   - factsDistilled       ← deltasProposed
 *   - digestMarkdown       ← synthesis excerpt
 *   - highlights           ← per-delta application trace
 *
 * Emit failures are swallowed by stage-05 (`emitEvolutionReport`) — a
 * missing report just means operators see no entry for this tenant; the
 * deltas are already written.
 */

import { createConsolidationEmissionsService } from '@bossnyumba/database';

import type { ReportSink } from '../pipeline/stage-05-emit-report.js';
import type { BrainEvolutionReport } from '../types.js';
import type { DrizzleLikeClient } from './shared.js';

export interface ReportSinkAdapterDeps {
  readonly db: DrizzleLikeClient;
}

/**
 * Build a report sink over `consolidation_emissions`. Pure adapter — the
 * service handles the upsert; this module only shapes the report into the
 * emission record.
 */
export function createReportSinkAdapter(
  deps: ReportSinkAdapterDeps,
): ReportSink {
  const emissions = createConsolidationEmissionsService(deps.db as never);

  return {
    async emit(report: BrainEvolutionReport) {
      await emissions.record({
        tenantId: report.tenantId,
        emissionDate: toEmissionDate(report.emittedAt),
        tickId: report.runId,
        factsDistilled: report.deltasProposed,
        factsPromoted: report.deltasApplied,
        reflexionLessonsWritten: report.deltasEscalated,
        digestMarkdown: report.synthesisExcerpt || null,
        highlights: report.applications.map((a) => ({
          idempotencyKey: a.idempotencyKey,
          applied: a.applied,
          escalated: a.escalated,
          skippedReason: a.skippedReason,
          violations: a.violations,
        })),
      });
    },
  };
}

/** UTC `YYYY-MM-DD` extracted from an ISO timestamp. */
function toEmissionDate(isoTimestamp: string): string {
  const parsed = new Date(isoTimestamp);
  const date = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  return date.toISOString().slice(0, 10);
}
