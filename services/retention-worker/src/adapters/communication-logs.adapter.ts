/**
 * Communication logs retention adapter.
 *
 * Covers outbound notification history - SMS/email/WhatsApp/push sends.
 * The canonical table is "message_instances" from the communications
 * schema; some deployments may instead use "communication_logs". We try
 * both and pick whichever exists. Soft-delete via deleted_at when present;
 * otherwise hard-delete.
 *
 * Default retention: 1 year.
 */

import { sql } from 'drizzle-orm';
import type { AdapterResult, AdapterRunOptions, RetentionAdapter } from './types.js';
import { columnExists, countWhere, getDb, tableExists, type Db } from './db.js';
import { createLogger } from '../logger.js';

const logger = createLogger('retention.communication_logs');

export interface CommunicationLogsAdapterOptions {
  db?: Db;
  databaseUrl?: string;
  retentionDays: number;
}

export function createCommunicationLogsAdapter(
  opts: CommunicationLogsAdapterOptions
): RetentionAdapter {
  return {
    name: 'communication_logs',
    retentionDays: opts.retentionDays,

    async run({ cutoff, dryRun, batchLimit }: AdapterRunOptions): Promise<AdapterResult> {
      const start = Date.now();
      const result: AdapterResult = {
        entity: 'communication_logs',
        candidates: 0,
        affected: 0,
        skippedLegalHold: 0,
        warnings: [],
        ok: true,
        durationMs: 0,
      };

      try {
        const db = opts.db ?? getDb(opts.databaseUrl);

        const tableName = (await tableExists(db, 'communication_logs'))
          ? 'communication_logs'
          : (await tableExists(db, 'message_instances'))
            ? 'message_instances'
            : null;

        if (!tableName) {
          result.warnings.push('no communication log table found; skipping');
          logger.warn('communication_logs/message_instances table missing; skipping sweep');
          result.durationMs = Date.now() - start;
          return result;
        }

        const hasLegalHold = await columnExists(db, tableName, 'legal_hold');
        const hasDeletedAt = await columnExists(db, tableName, 'deleted_at');
        // message_instances uses created_at; communication_logs may use
        // logged_at or created_at. Prefer created_at, fall back to sent_at.
        const timeColumn = (await columnExists(db, tableName, 'created_at'))
          ? 'created_at'
          : (await columnExists(db, tableName, 'sent_at'))
            ? 'sent_at'
            : null;

        if (!timeColumn) {
          result.warnings.push(`${tableName} has no created_at/sent_at; skipping`);
          logger.warn('communication_logs missing timestamp column; skipping');
          result.durationMs = Date.now() - start;
          return result;
        }

        const cutoffIso = cutoff.toISOString();
        const notDeletedClause = hasDeletedAt ? sql`deleted_at IS NULL` : sql`TRUE`;
        const baseWhere = sql`${sql.identifier(timeColumn)} < ${cutoffIso} AND ${notDeletedClause}`;
        const nonHoldWhere = hasLegalHold
          ? sql`${baseWhere} AND (legal_hold IS NULL OR legal_hold = false)`
          : baseWhere;

        result.candidates = await countWhere(db, tableName, baseWhere);

        if (hasLegalHold) {
          result.skippedLegalHold = await countWhere(
            db,
            tableName,
            sql`${baseWhere} AND legal_hold = true`
          );
        }

        if (dryRun) {
          logger.info('dry-run: communication logs retention sweep', {
            table: tableName,
            candidates: result.candidates,
            skippedLegalHold: result.skippedLegalHold,
            cutoff: cutoffIso,
          });
          result.durationMs = Date.now() - start;
          return result;
        }

        if (hasDeletedAt) {
          const updateSql = sql`
            WITH victims AS (
              SELECT id FROM ${sql.identifier(tableName)}
              WHERE ${nonHoldWhere}
              ORDER BY ${sql.identifier(timeColumn)} ASC
              LIMIT ${batchLimit}
            )
            UPDATE ${sql.identifier(tableName)}
            SET deleted_at = NOW()
            WHERE id IN (SELECT id FROM victims)
            RETURNING id
          `;
          const updated = (await db.execute(updateSql)) as unknown as Array<{ id: string }>;
          result.affected = Array.isArray(updated) ? updated.length : 0;
        } else {
          const deleteSql = sql`
            WITH victims AS (
              SELECT id FROM ${sql.identifier(tableName)}
              WHERE ${nonHoldWhere}
              ORDER BY ${sql.identifier(timeColumn)} ASC
              LIMIT ${batchLimit}
            )
            DELETE FROM ${sql.identifier(tableName)}
            WHERE id IN (SELECT id FROM victims)
            RETURNING id
          `;
          const deleted = (await db.execute(deleteSql)) as unknown as Array<{ id: string }>;
          result.affected = Array.isArray(deleted) ? deleted.length : 0;
        }

        logger.info('communication logs retention sweep complete', {
          table: tableName,
          candidates: result.candidates,
          affected: result.affected,
          mode: hasDeletedAt ? 'soft' : 'hard',
          cutoff: cutoffIso,
        });
      } catch (err) {
        result.ok = false;
        result.error = err instanceof Error ? err.message : String(err);
        logger.error('communication logs retention sweep failed', { error: result.error });
      }

      result.durationMs = Date.now() - start;
      return result;
    },
  };
}
