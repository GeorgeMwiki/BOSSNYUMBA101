/**
 * Consolidation worker — composition root.
 *
 * This is the cron-style entrypoint that wires the abstract worker
 * (`consolidation.ts`) to:
 *
 *   1. The Drizzle-backed reservoir source. Reads `kernel_cot_reservoir`
 *      rows from the last 24h where `consolidated_at IS NULL`, and
 *      marks them after the worker consumes them.
 *   2. The `@bossnyumba/database` semantic memory service for fact
 *      writes (`createSemanticMemoryService.upsertFact`).
 *   3. A default stub consolidator (1 fact per 5 turns). The real
 *      Haiku consolidator is plug-in compatible — swap at the
 *      composition root only.
 *
 * Behaviour mirrors `services/api-gateway/src/composition/consolidation-
 * runner.ts` and `wake-loop-cron.ts`:
 *
 *   - Missing `DATABASE_URL` ⇒ supervisor logs + exits gracefully (no-op).
 *   - SIGTERM / SIGINT ⇒ loop.stop() then process.exit(0).
 *   - Any unhandled error inside a tick is absorbed by the worker
 *     itself — the loop never crashes on its own.
 */

import { sql } from 'drizzle-orm';
import { createSemanticMemoryService } from '@bossnyumba/database';
import {
  createConsolidationLoop,
  createStubConsolidator,
  type ReservoirEntry,
  type ReservoirSource,
  type SemanticSink,
  type WorkerLogger,
} from './consolidation.js';

// ─────────────────────────────────────────────────────────────────────
// Logger — tiny pino-shape that doesn't require pulling pino in.
// ─────────────────────────────────────────────────────────────────────

function consoleLogger(): WorkerLogger {
  return {
    info: (obj, msg) =>
      // eslint-disable-next-line no-console
      console.info('[consolidation-worker]', msg ?? '', obj),
    warn: (obj, msg) =>
      // eslint-disable-next-line no-console
      console.warn('[consolidation-worker]', msg ?? '', obj),
    error: (obj, msg) =>
      // eslint-disable-next-line no-console
      console.error('[consolidation-worker]', msg ?? '', obj),
  };
}

// ─────────────────────────────────────────────────────────────────────
// Drizzle-backed reservoir source — reads kernel_cot_reservoir rows
// captured since `since` whose `consolidated_at IS NULL`. Marks them
// with NOW() after consumption.
//
// The `kernel_cot_reservoir` schema today (migration 0114) does NOT
// have a `consolidated_at` column or a `user_id` column. This adapter
// codes against those columns being added by a future migration —
// when missing, the SELECT returns zero rows and the worker is a
// benign no-op. Keeping the wiring intent-correct + reservoir schema
// extension OUT-OF-SCOPE here (task said do not touch packages/database/).
// ─────────────────────────────────────────────────────────────────────

interface DrizzleLikeClient {
  execute(q: unknown): Promise<unknown>;
}

function createReservoirSource(db: DrizzleLikeClient): ReservoirSource {
  return {
    async fetchUnconsolidated({ since, limit }) {
      try {
        const lim = clampLimit(limit, 5000);
        const result = (await db.execute(
          sql`SELECT thought_id, tenant_id, user_id, thread_id,
                     thought_text AS summary, captured_at
              FROM kernel_cot_reservoir
              WHERE consolidated_at IS NULL
                AND captured_at >= ${since}
                AND user_id IS NOT NULL
              ORDER BY captured_at DESC
              LIMIT ${lim}`,
        )) as unknown;
        const rows = toRows(result) as ReadonlyArray<{
          thought_id?: unknown;
          tenant_id?: unknown;
          user_id?: unknown;
          thread_id?: unknown;
          summary?: unknown;
          captured_at?: unknown;
        }>;
        const entries: ReservoirEntry[] = [];
        for (const row of rows) {
          const thoughtId = asString(row.thought_id);
          const userId = asString(row.user_id);
          if (!thoughtId || !userId) continue;
          entries.push({
            thoughtId,
            tenantId: asNullableString(row.tenant_id),
            userId,
            threadId: asString(row.thread_id) ?? '',
            summary: asString(row.summary) ?? '',
            capturedAt: asDateString(row.captured_at),
          });
        }
        return entries;
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn(
          '[consolidation-worker] reservoir fetch failed (schema may be pre-migration):',
          asMessage(error),
        );
        return [];
      }
    },
    async markConsolidated(thoughtIds) {
      if (thoughtIds.length === 0) return;
      try {
        // Drizzle's `sql` template doesn't safely parameterise IN
        // lists by default — we pass an array literal via JSON.
        const idsJson = JSON.stringify(thoughtIds);
        await db.execute(
          sql`UPDATE kernel_cot_reservoir
              SET consolidated_at = NOW()
              WHERE thought_id = ANY(
                SELECT jsonb_array_elements_text(${idsJson}::jsonb)
              )`,
        );
      } catch (error) {
        // Rethrow so the worker logs + reports the error per-group.
        throw new Error(`markConsolidated: ${asMessage(error)}`);
      }
    },
  };
}

function createSemanticAdapter(db: DrizzleLikeClient): SemanticSink {
  const svc = createSemanticMemoryService(db as never);
  return {
    async upsertFact(args) {
      await svc.upsertFact({
        tenantId: args.tenantId,
        userId: args.userId,
        key: args.key,
        value: args.value,
        confidence: args.confidence,
        source: args.source,
      });
    },
  };
}

// ─────────────────────────────────────────────────────────────────────
// Main entry — env-driven boot, SIGTERM-safe shutdown.
// ─────────────────────────────────────────────────────────────────────

export interface MainOptions {
  /** Inject db for tests. Production reads DATABASE_URL via api-gateway db-client. */
  readonly db?: DrizzleLikeClient | null;
  readonly logger?: WorkerLogger;
  readonly intervalMs?: number;
}

export async function main(options: MainOptions = {}): Promise<void> {
  const logger = options.logger ?? consoleLogger();

  let db: DrizzleLikeClient | null = options.db ?? null;
  if (!db) {
    const dbUrl = process.env.DATABASE_URL?.trim();
    if (!dbUrl) {
      logger.warn({}, 'consolidation-worker: DATABASE_URL not set — supervisor is a no-op');
      return;
    }
    try {
      // Reuse the api-gateway db-client so the connection pool config
      // matches the rest of the platform. Lazy-imported so unit tests
      // never need a real DB connection.
      const mod = (await import(
        // @ts-expect-error — sibling-service import resolved by pnpm symlink
        '../../api-gateway/dist/composition/db-client.js'
      )) as { getDb?: () => unknown };
      db = (mod.getDb?.() ?? null) as DrizzleLikeClient | null;
    } catch (error) {
      logger.warn(
        { err: asMessage(error) },
        'consolidation-worker: db-client import failed — supervisor is a no-op',
      );
      return;
    }
    if (!db) {
      logger.warn({}, 'consolidation-worker: db-client returned null — supervisor is a no-op');
      return;
    }
  }

  const source = createReservoirSource(db);
  const sink = createSemanticAdapter(db);
  const consolidator = createStubConsolidator();
  const loop = createConsolidationLoop({
    source,
    sink,
    consolidator,
    logger,
    ...(typeof options.intervalMs === 'number' ? { intervalMs: options.intervalMs } : {}),
  });

  // SIGTERM-safe shutdown.
  let shuttingDown = false;
  const shutdown = (signal: NodeJS.Signals) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'consolidation-worker: shutdown requested');
    loop.stop();
    // Give in-flight tick room to finish (the loop's safeTick is
    // already guarded; we just want to flush pending logs before exit).
    setTimeout(() => process.exit(0), 50).unref();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  await loop.start();
}

// CLI guard — only run main() when this file is the program entry.
const isDirect =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  typeof process.argv[1] === 'string' &&
  /index(\.js|\.ts)?$/.test(process.argv[1]) &&
  process.argv[1].includes('consolidation-worker');

if (isDirect) {
  main().catch((error) => {
    // eslint-disable-next-line no-console
    console.error('[consolidation-worker] fatal:', error);
    process.exit(2);
  });
}

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

function clampLimit(input: number | undefined, fallback: number): number {
  if (typeof input !== 'number' || !Number.isFinite(input) || input <= 0) return fallback;
  return Math.min(Math.floor(input), 50000);
}

function toRows(result: unknown): ReadonlyArray<Record<string, unknown>> {
  if (Array.isArray(result)) return result as ReadonlyArray<Record<string, unknown>>;
  const wrapped = (result as { rows?: ReadonlyArray<Record<string, unknown>> })?.rows;
  return Array.isArray(wrapped) ? wrapped : [];
}

function asString(v: unknown): string | undefined {
  if (typeof v === 'string' && v.length > 0) return v;
  return undefined;
}

function asNullableString(v: unknown): string | null {
  if (typeof v === 'string' && v.length > 0) return v;
  return null;
}

function asDateString(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'string') return v;
  return new Date().toISOString();
}

function asMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
