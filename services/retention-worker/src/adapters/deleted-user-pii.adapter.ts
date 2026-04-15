/**
 * Deleted user PII hard-delete adapter.
 *
 * Two-stage GDPR/POPIA erasure model:
 *   1. When a user requests deletion, the app sets deleted_at on the
 *      customers row (or moves the PII into a deleted_user_pii staging
 *      table). Rows remain recoverable for 30 days in case of mistakes or
 *      chargebacks.
 *   2. This adapter runs after the 30-day grace window and permanently
 *      removes the PII.
 *
 * The adapter prefers a dedicated "deleted_user_pii" table when present
 * (the canonical model). If not, it falls back to hard-deleting rows from
 * the "customers" table where deleted_at is older than the cutoff. In both
 * cases rows under legal_hold are skipped.
 */

import { sql } from 'drizzle-orm';
import type { AdapterResult, AdapterRunOptions, RetentionAdapter } from './types.js';
import { columnExists, countWhere, getDb, tableExists, type Db } from './db.js';
import { createLogger } from '../logger.js';

const logger = createLogger('retention.deleted_user_pii');

export interface DeletedUserPiiAdapterOptions {
  db?: Db;
  databaseUrl?: string;
  /** Grace period (days) between soft-delete and hard-delete. */
  retentionDays: number;
}

export function createDeletedUserPiiAdapter(
  opts: DeletedUserPiiAdapterOptions
): RetentionAdapter {
  return {
    name: 'deleted_user_pii',
    retentionDays: opts.retentionDays,

    async run({ cutoff, dryRun, batchLimit }: AdapterRunOptions): Promise<AdapterResult> {
      const start = Date.now();
      const result: AdapterResult = {
        entity: 'deleted_user_pii',
        candidates: 0,
        affected: 0,
        skippedLegalHold: 0,
        warnings: [],
        ok: true,
        durationMs: 0,
      };

      try {
        const db = opts.db ?? getDb(opts.databaseUrl);

        // Prefer a dedicated staging table; fall back to customers.deleted_at.
        let table: string;
        let timeColumn: string;

        if (await tableExists(db, 'deleted_user_pii')) {
          table = 'deleted_user_pii';
          timeColumn = (await columnExists(db, table, 'deleted_at'))
            ? 'deleted_at'
            : (await columnExists(db, table, 'soft_deleted_at'))
              ? 'soft_deleted_at'
              : 'created_at';
        } else if (await tableExists(db, 'customers')) {
          table = 'customers';
          if (!(await columnExists(db, table, 'deleted_at'))) {
            result.warnings.push(
              'customers table has no deleted_at; PII hard-delete cannot run'
            );
            logger.warn('customers.deleted_at missing; skipping PII hard-delete');
            result.durationMs = Date.now() - start;
            return result;
          }
          timeColumn = 'deleted_at';
        } else {
          result.warnings.push(
            'neither deleted_user_pii nor customers table exists; skipping'
          );
          logger.warn('no PII table found; skipping sweep');
          result.durationMs = Date.now() - start;
          return result;
        }

        const hasLegalHold = await columnExists(db, table, 'legal_hold');
        const cutoffIso = cutoff.toISOString();

        // For customers, only consider rows where deleted_at IS NOT NULL
        // (i.e. soft-deleted) AND older than cutoff. For deleted_user_pii
        // staging, the timeColumn is the soft-delete moment itself.
        const baseWhere =
          table === 'customers'
            ? sql`deleted_at IS NOT NULL AND deleted_at < ${cutoffIso}`
            : sql`${sql.identifier(timeColumn)} < ${cutoffIso}`;

        const nonHoldWhere = hasLegalHold
          ? sql`${baseWhere} AND (legal_hold IS NULL OR legal_hold = false)`
          : baseWhere;

        result.candidates = await countWhere(db, table, baseWhere);

        if (hasLegalHold) {
          result.skippedLegalHold = await countWhere(
            db,
            table,
            sql`${baseWhere} AND legal_hold = true`
          );
        }

        if (dryRun) {
          logger.info('dry-run: deleted_user_pii hard-delete', {
            table,
            candidates: result.candidates,
            skippedLegalHold: result.skippedLegalHold,
            cutoff: cutoffIso,
          });
          result.durationMs = Date.now() - start;
          return result;
        }

        const deleteSql = sql`
          WITH victims AS (
            SELECT id FROM ${sql.identifier(table)}
            WHERE ${nonHoldWhere}
            ORDER BY ${sql.identifier(timeColumn)} ASC
            LIMIT ${batchLimit}
          )
          DELETE FROM ${sql.identifier(table)}
          WHERE id IN (SELECT id FROM victims)
          RETURNING id
        `;
        const deleted = (await db.execute(deleteSql)) as unknown as Array<{ id: string }>;
        result.affected = Array.isArray(deleted) ? deleted.length : 0;

        logger.info('deleted_user_pii hard-delete complete', {
          table,
          candidates: result.candidates,
          affected: result.affected,
          skippedLegalHold: result.skippedLegalHold,
          cutoff: cutoffIso,
        });
      } catch (err) {
        result.ok = false;
        result.error = err instanceof Error ? err.message : String(err);
        logger.error('deleted_user_pii hard-delete failed', { error: result.error });
      }

      result.durationMs = Date.now() - start;
      return result;
    },
  };
}
