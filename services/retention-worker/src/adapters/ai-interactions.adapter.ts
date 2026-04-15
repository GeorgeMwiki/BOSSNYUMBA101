/**
 * AI interactions retention adapter.
 *
 * Tracks prompt/response pairs for Copilot features. Because this table is
 * not yet part of the shipped schema (packages/database/src/schemas does
 * not define it), this adapter is designed to NO-OP gracefully when the
 * table is missing - logging a warning and returning a successful result
 * with zero affected rows. Once the table lands, the same adapter kicks in
 * automatically with the configured retention window (default: 6 months).
 */

import { sql } from 'drizzle-orm';
import type { AdapterResult, AdapterRunOptions, RetentionAdapter } from './types.js';
import { columnExists, countWhere, getDb, tableExists, type Db } from './db.js';
import { createLogger } from '../logger.js';

const logger = createLogger('retention.ai_interactions');

export interface AiInteractionsAdapterOptions {
  db?: Db;
  databaseUrl?: string;
  retentionDays: number;
}

export function createAiInteractionsAdapter(
  opts: AiInteractionsAdapterOptions
): RetentionAdapter {
  return {
    name: 'ai_interactions',
    retentionDays: opts.retentionDays,

    async run({ cutoff, dryRun, batchLimit }: AdapterRunOptions): Promise<AdapterResult> {
      const start = Date.now();
      const result: AdapterResult = {
        entity: 'ai_interactions',
        candidates: 0,
        affected: 0,
        skippedLegalHold: 0,
        warnings: [],
        ok: true,
        durationMs: 0,
      };

      try {
        const db = opts.db ?? getDb(opts.databaseUrl);

        if (!(await tableExists(db, 'ai_interactions'))) {
          const msg = 'ai_interactions table does not exist; adapter is a no-op until migration lands';
          result.warnings.push(msg);
          logger.warn(msg);
          result.durationMs = Date.now() - start;
          return result;
        }

        const hasLegalHold = await columnExists(db, 'ai_interactions', 'legal_hold');
        const timeColumn = (await columnExists(db, 'ai_interactions', 'created_at'))
          ? 'created_at'
          : (await columnExists(db, 'ai_interactions', 'occurred_at'))
            ? 'occurred_at'
            : null;

        if (!timeColumn) {
          result.warnings.push('ai_interactions has no created_at/occurred_at column; skipping');
          logger.warn('ai_interactions missing timestamp column; skipping');
          result.durationMs = Date.now() - start;
          return result;
        }

        const cutoffIso = cutoff.toISOString();
        const baseWhere = sql`${sql.identifier(timeColumn)} < ${cutoffIso}`;
        const nonHoldWhere = hasLegalHold
          ? sql`${baseWhere} AND (legal_hold IS NULL OR legal_hold = false)`
          : baseWhere;

        result.candidates = await countWhere(db, 'ai_interactions', baseWhere);

        if (hasLegalHold) {
          result.skippedLegalHold = await countWhere(
            db,
            'ai_interactions',
            sql`${baseWhere} AND legal_hold = true`
          );
        }

        if (dryRun) {
          logger.info('dry-run: ai_interactions retention sweep', {
            candidates: result.candidates,
            skippedLegalHold: result.skippedLegalHold,
            cutoff: cutoffIso,
          });
          result.durationMs = Date.now() - start;
          return result;
        }

        const deleteSql = sql`
          WITH victims AS (
            SELECT id FROM ai_interactions
            WHERE ${nonHoldWhere}
            ORDER BY ${sql.identifier(timeColumn)} ASC
            LIMIT ${batchLimit}
          )
          DELETE FROM ai_interactions WHERE id IN (SELECT id FROM victims)
          RETURNING id
        `;
        const deleted = (await db.execute(deleteSql)) as unknown as Array<{ id: string }>;
        result.affected = Array.isArray(deleted) ? deleted.length : 0;

        logger.info('ai_interactions retention sweep complete', {
          candidates: result.candidates,
          affected: result.affected,
          skippedLegalHold: result.skippedLegalHold,
          cutoff: cutoffIso,
        });
      } catch (err) {
        result.ok = false;
        result.error = err instanceof Error ? err.message : String(err);
        logger.error('ai_interactions retention sweep failed', { error: result.error });
      }

      result.durationMs = Date.now() - start;
      return result;
    },
  };
}
