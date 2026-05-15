/**
 * Stage 07 — Re-embed.
 *
 * Re-embed promoted facts (and any with NULL embedding) using the
 * CURRENT embedding model version so retrieval stays consistent when
 * the embedder is upgraded. The full bulk-reembedder lives in
 * `@bossnyumba/database`; this stage just calls the port.
 *
 * When no port is wired, the stage is a no-op — production keeps the
 * facts written by stage 04 (with their fresh embeddings) and a
 * separate batch job catches up the legacy rows.
 *
 * TODO (Phase B): wire the bulk re-embedder against `kernel_memory_
 * semantic` rows where `embedding IS NULL`.
 */

import type { ReEmbedReport, StageLogger } from './types.js';

export interface ReEmbedPort {
  reEmbedForTenant(args: {
    readonly tenantId: string | null;
    readonly limit: number;
  }): Promise<ReEmbedReport>;
}

export interface ReEmbedArgs {
  readonly tenantIds: ReadonlyArray<string | null>;
  readonly reEmbedder?: ReEmbedPort;
  readonly logger: StageLogger;
  /** Hard cap per tenant per tick. Default 500. */
  readonly perTenantLimit?: number;
}

const DEFAULT_LIMIT = 500;

export interface ReEmbedStageReport {
  readonly factsReEmbedded: number;
  readonly perTenant: Record<string, ReEmbedReport>;
}

export async function runReEmbedStage(
  args: ReEmbedArgs,
): Promise<ReEmbedStageReport> {
  const perTenant: Record<string, ReEmbedReport> = {};
  let total = 0;
  if (!args.reEmbedder) {
    args.logger.info(
      { stage: '07-re-embed' },
      're-embed stage skipped (Phase B will wire bulk re-embedder)',
    );
    return { factsReEmbedded: 0, perTenant };
  }
  const limit = args.perTenantLimit ?? DEFAULT_LIMIT;
  const unique = uniqueTenants(args.tenantIds);
  for (const tenantId of unique) {
    try {
      const report = await args.reEmbedder.reEmbedForTenant({
        tenantId,
        limit,
      });
      const safeKey = tenantId ?? '__global__';
      perTenant[safeKey] = report;
      total += report.reEmbeddedCount;
    } catch (error) {
      args.logger.warn(
        {
          stage: '07-re-embed',
          tenantId,
          err: asMessage(error),
        },
        're-embed failed for tenant',
      );
    }
  }
  args.logger.info(
    {
      stage: '07-re-embed',
      factsReEmbedded: total,
      tenants: unique.length,
    },
    're-embed stage complete',
  );
  return { factsReEmbedded: total, perTenant };
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
