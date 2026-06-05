/**
 * BKT mastery reader.
 *
 * The classroom SESSION/BKT feature was removed, but the Adaptive Training
 * feature (KEPT) still seeds its `MasteryPort` from per-concept Bayesian
 * Knowledge Tracing snapshots persisted in the `bkt_mastery` table (the table
 * + its migration are immutable and remain). This module supplies a small,
 * read-only accessor for that table so training no longer depends on the
 * deleted `classroom-wiring.ts`.
 *
 * Read-only by design: the classroom write path (which advanced BKT state per
 * quiz response) is gone, so mastery rows are now seeded by other surfaces
 * (e.g. the chat teaching mode / external imports). When no rows exist the
 * reader returns an empty map and training falls back to its cold-start
 * ordering.
 */

import { sql } from 'drizzle-orm';
import { createDatabaseClient } from '@bossnyumba/database';

/**
 * DatabaseClient via `ReturnType<...>` to sidestep the package-barrel
 * `TS2709 Cannot use namespace ... as a type` drift (same pattern the rest of
 * the composition root uses).
 */
type DatabaseClient = ReturnType<typeof createDatabaseClient>;

export interface BktMasteryRow {
  readonly conceptId: string;
  readonly pKnow: number;
}

export interface BktMasteryReader {
  /** Per-concept mastery snapshot for a user, scoped to their tenant. */
  getMastery(
    tenantId: string,
    userId: string,
  ): Promise<ReadonlyArray<BktMasteryRow>>;
}

function asList(res: unknown): ReadonlyArray<Record<string, unknown>> {
  if (Array.isArray(res)) return res as Record<string, unknown>[];
  const rows = (res as { rows?: unknown }).rows;
  return Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [];
}

/**
 * Build a BKT mastery reader. When `db` is null (degraded mode) the reader
 * returns an empty snapshot for every caller so training still boots.
 */
export function createBktMasteryReader(
  db: DatabaseClient | null,
): BktMasteryReader {
  if (!db) {
    return {
      async getMastery() {
        return [];
      },
    };
  }

  const exec = (
    db as unknown as { execute(q: unknown): Promise<unknown> }
  ).execute.bind(db as unknown as { execute(q: unknown): Promise<unknown> });

  return {
    async getMastery(tenantId, userId) {
      const rows = asList(
        await exec(sql`
          SELECT concept_id, p_know
          FROM bkt_mastery
          WHERE tenant_id = ${tenantId} AND user_id = ${userId}
          ORDER BY concept_id
        `),
      );
      return rows.map((r) => ({
        conceptId: String(r.concept_id),
        pKnow: Number(r.p_know ?? 0),
      }));
    },
  };
}
