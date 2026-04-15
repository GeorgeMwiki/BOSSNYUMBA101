/**
 * Audit events retention adapter.
 *
 * Audit events are immutable compliance records; per platform policy we
 * retain them for 90 days in hot storage (configurable). Older rows are
 * hard-deleted unless they carry a legal_hold flag.
 *
 * The audit_events schema (packages/database/src/schemas/audit-events.schema.ts)
 * does NOT currently have a legal_hold column. We check for it dynamically
 * and include it in the WHERE clause only when present, so adding it later
 * does not require a code change here.
 */

import { sql } from 'drizzle-orm';
import type { AdapterResult, AdapterRunOptions, RetentionAdapter } from './types.js';
import { columnExists, countWhere, getDb, tableExists, type Db } from './db.js';
import { createLogger } from '../logger.js';

const logger = createLogger('retention.audit_events');

export interface AuditEventsAdapterOptions {
  db?: Db;
  databaseUrl?: string;
  retentionDays: number;
}

export function createAuditEventsAdapter(
  opts: AuditEventsAdapterOptions
): RetentionAdapter {
  return {
    name: 'audit_events',
    retentionDays: opts.retentionDays,

    async run({ cutoff, dryRun, batchLimit }: AdapterRunOptions): Promise<AdapterResult> {
      const start = Date.now();
      const result: AdapterResult = {
        entity: 'audit_events',
        candidates: 0,
        affected: 0,
        skippedLegalHold: 0,
        warnings: [],
        ok: true,
        durationMs: 0,
      };

      try {
        const db = opts.db ?? getDb(opts.databaseUrl);

        if (!(await tableExists(db, 'audit_events'))) {
          result.warnings.push('table audit_events missing; skipping');
          logger.warn('audit_events table missing; skipping sweep');
          result.durationMs = Date.now() - start;
          return result;
        }

        const hasLegalHold = await columnExists(db, 'audit_events', 'legal_hold');
        const cutoffIso = cutoff.toISOString();

        // Use timestamp (the canonical event time) for the cutoff.
        const baseWhere = sql`"timestamp" < ${cutoffIso}`;
        const nonHoldWhere = hasLegalHold
          ? sql`${baseWhere} AND (legal_hold IS NULL OR legal_hold = false)`
          : baseWhere;

        result.candidates = await countWhere(db, 'audit_events', baseWhere);

        if (hasLegalHold) {
          const held = await countWhere(
            db,
            'audit_events',
            sql`${baseWhere} AND legal_hold = true`
          );
          result.skippedLegalHold = held;
        }

        if (dryRun) {
          logger.info('dry-run: audit_events retention sweep', {
            candidates: result.candidates,
            skippedLegalHold: result.skippedLegalHold,
            cutoff: cutoffIso,
          });
          result.durationMs = Date.now() - start;
          return result;
        }

        // Hard-delete in batches. Using CTE with LIMIT so a single sweep
        // cannot take an exclusive lock on the entire table.
        const deleteSql = sql`
          WITH victims AS (
            SELECT id FROM audit_events
            WHERE ${nonHoldWhere}
            ORDER BY "timestamp" ASC
            LIMIT ${batchLimit}
          )
          DELETE FROM audit_events WHERE id IN (SELECT id FROM victims)
          RETURNING id
        `;
        const deleted = (await db.execute(deleteSql)) as unknown as Array<{ id: string }>;
        result.affected = Array.isArray(deleted) ? deleted.length : 0;

        logger.info('audit_events retention sweep complete', {
          candidates: result.candidates,
          affected: result.affected,
          skippedLegalHold: result.skippedLegalHold,
          cutoff: cutoffIso,
        });
      } catch (err) {
        result.ok = false;
        result.error = err instanceof Error ? err.message : String(err);
        logger.error('audit_events retention sweep failed', { error: result.error });
      }

      result.durationMs = Date.now() - start;
      return result;
    },
  };
}
