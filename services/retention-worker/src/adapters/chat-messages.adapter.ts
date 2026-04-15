/**
 * Chat messages retention adapter.
 *
 * The messaging schema stores in-app conversation messages in the "messages"
 * table with a deleted_at soft-delete column. Retention here soft-deletes
 * rows older than the cutoff, honouring the existing soft-delete semantics.
 *
 * Per platform policy, chat message retention is 1 year by default. After
 * soft-delete, a separate PII hard-delete sweep (deleted_user_pii adapter)
 * will eventually purge the row bodies.
 */

import { sql } from 'drizzle-orm';
import type { AdapterResult, AdapterRunOptions, RetentionAdapter } from './types.js';
import { columnExists, countWhere, getDb, tableExists, type Db } from './db.js';
import { createLogger } from '../logger.js';

const logger = createLogger('retention.chat_messages');

export interface ChatMessagesAdapterOptions {
  db?: Db;
  databaseUrl?: string;
  retentionDays: number;
  /** When true, hard-delete instead of soft-delete. Defaults to false. */
  hardDelete?: boolean;
}

export function createChatMessagesAdapter(
  opts: ChatMessagesAdapterOptions
): RetentionAdapter {
  return {
    name: 'chat_messages',
    retentionDays: opts.retentionDays,

    async run({ cutoff, dryRun, batchLimit }: AdapterRunOptions): Promise<AdapterResult> {
      const start = Date.now();
      const result: AdapterResult = {
        entity: 'chat_messages',
        candidates: 0,
        affected: 0,
        skippedLegalHold: 0,
        warnings: [],
        ok: true,
        durationMs: 0,
      };

      try {
        const db = opts.db ?? getDb(opts.databaseUrl);

        // Canonical chat table is "messages"; some deployments may have a
        // separate "chat_messages" table. Pick whichever exists.
        const tableName = (await tableExists(db, 'messages'))
          ? 'messages'
          : (await tableExists(db, 'chat_messages'))
            ? 'chat_messages'
            : null;

        if (!tableName) {
          result.warnings.push('no chat messages table found; skipping');
          logger.warn('messages/chat_messages table missing; skipping sweep');
          result.durationMs = Date.now() - start;
          return result;
        }

        const hasLegalHold = await columnExists(db, tableName, 'legal_hold');
        const hasDeletedAt = await columnExists(db, tableName, 'deleted_at');
        const cutoffIso = cutoff.toISOString();

        // Only consider rows that are NOT already soft-deleted.
        const notDeletedClause = hasDeletedAt
          ? sql`deleted_at IS NULL`
          : sql`TRUE`;

        const baseWhere = sql`created_at < ${cutoffIso} AND ${notDeletedClause}`;
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
          logger.info('dry-run: chat messages retention sweep', {
            table: tableName,
            candidates: result.candidates,
            skippedLegalHold: result.skippedLegalHold,
            cutoff: cutoffIso,
          });
          result.durationMs = Date.now() - start;
          return result;
        }

        if (opts.hardDelete || !hasDeletedAt) {
          // Hard delete path - used when schema lacks deleted_at or when
          // explicitly configured.
          const deleteSql = sql`
            WITH victims AS (
              SELECT id FROM ${sql.identifier(tableName)}
              WHERE ${nonHoldWhere}
              ORDER BY created_at ASC
              LIMIT ${batchLimit}
            )
            DELETE FROM ${sql.identifier(tableName)}
            WHERE id IN (SELECT id FROM victims)
            RETURNING id
          `;
          const deleted = (await db.execute(deleteSql)) as unknown as Array<{ id: string }>;
          result.affected = Array.isArray(deleted) ? deleted.length : 0;
        } else {
          // Soft delete: set deleted_at = now() for rows past the cutoff.
          const updateSql = sql`
            WITH victims AS (
              SELECT id FROM ${sql.identifier(tableName)}
              WHERE ${nonHoldWhere}
              ORDER BY created_at ASC
              LIMIT ${batchLimit}
            )
            UPDATE ${sql.identifier(tableName)}
            SET deleted_at = NOW()
            WHERE id IN (SELECT id FROM victims)
            RETURNING id
          `;
          const updated = (await db.execute(updateSql)) as unknown as Array<{ id: string }>;
          result.affected = Array.isArray(updated) ? updated.length : 0;
        }

        logger.info('chat messages retention sweep complete', {
          table: tableName,
          candidates: result.candidates,
          affected: result.affected,
          mode: opts.hardDelete || !hasDeletedAt ? 'hard' : 'soft',
          cutoff: cutoffIso,
        });
      } catch (err) {
        result.ok = false;
        result.error = err instanceof Error ? err.message : String(err);
        logger.error('chat messages retention sweep failed', { error: result.error });
      }

      result.durationMs = Date.now() - start;
      return result;
    },
  };
}
