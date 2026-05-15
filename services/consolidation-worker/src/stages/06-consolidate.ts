/**
 * Stage 06 — Consolidate.
 *
 * Zep-style community detection over the semantic-memory entity graph
 * to merge duplicate "Tenant John Mwangi" / "John M." entries. The
 * full graph-merge logic lives in `@bossnyumba/database` once the
 * temporal-KG layer ships (Phase B); for Phase A this stage is a
 * stub that wires the port shape so the orchestrator can run
 * end-to-end. The stub:
 *
 *   - asks the port (when supplied) to merge entities for each tenant
 *   - logs the result + emits the report
 *
 * When no port is wired, returns zeroed counters.
 *
 * TODO (Phase B): wire Zep/Graphiti community detection here.
 */

import type {
  ConsolidateMergeReport,
  StageLogger,
} from './types.js';

export interface EntityConsolidatorPort {
  consolidateForTenant(args: {
    readonly tenantId: string | null;
  }): Promise<ConsolidateMergeReport>;
}

export interface ConsolidateArgs {
  readonly tenantIds: ReadonlyArray<string | null>;
  readonly consolidator?: EntityConsolidatorPort;
  readonly logger: StageLogger;
}

export interface ConsolidateReport {
  readonly entitiesMerged: number;
  readonly perTenant: Record<string, ConsolidateMergeReport>;
}

export async function runConsolidateStage(
  args: ConsolidateArgs,
): Promise<ConsolidateReport> {
  const perTenant: Record<string, ConsolidateMergeReport> = {};
  let total = 0;
  if (!args.consolidator) {
    args.logger.info(
      { stage: '06-consolidate' },
      'consolidate stage skipped (Phase B will wire Zep/Graphiti)',
    );
    return { entitiesMerged: 0, perTenant };
  }
  const unique = uniqueTenants(args.tenantIds);
  for (const tenantId of unique) {
    try {
      const report = await args.consolidator.consolidateForTenant({
        tenantId,
      });
      const safeKey = tenantId ?? '__global__';
      perTenant[safeKey] = report;
      total += report.mergedEntities;
    } catch (error) {
      args.logger.warn(
        {
          stage: '06-consolidate',
          tenantId,
          err: asMessage(error),
        },
        'consolidate failed for tenant',
      );
    }
  }
  args.logger.info(
    {
      stage: '06-consolidate',
      entitiesMerged: total,
      tenants: unique.length,
    },
    'consolidate stage complete',
  );
  return { entitiesMerged: total, perTenant };
}

function uniqueTenants(
  ids: ReadonlyArray<string | null>,
): ReadonlyArray<string | null> {
  const seen = new Set<string>();
  const out: Array<string | null> = [];
  for (const id of ids) {
    const k = id ?? '__null__';
    if (!seen.has(k)) {
      seen.add(k);
      out.push(id);
    }
  }
  return out;
}

function asMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
