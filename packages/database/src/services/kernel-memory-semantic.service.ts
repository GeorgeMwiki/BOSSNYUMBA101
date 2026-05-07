/**
 * Kernel memory — semantic service.
 *
 * Drizzle-backed adapter for the `kernel_memory_semantic` table
 * (migration 0121). Operations:
 *
 *   - upsertFact(args) : insert-or-update by (tenant, user, key) with
 *                        evidence_count bump + last_seen_at refresh.
 *   - lookup(args)     : fetch a single fact by (tenant, user, key).
 *                        Returns null when no row.
 *   - search(args)     : list facts for a (tenant, user) pair, optional
 *                        prefix-match on `key`, ranked by last_seen_at
 *                        DESC. Bounded by `limit` (default 25).
 *   - decay(args)      : multiplicative confidence decay across all
 *                        facts in a tenant. For the nightly cycle.
 *
 * Hard DB failures degrade to no-ops / null / [] — the kernel never
 * crashes because the semantic store is unreachable.
 */

import { randomUUID } from 'crypto';
import { and, eq, like, sql, desc, isNull, type SQL } from 'drizzle-orm';
import { kernelMemorySemantic } from '../schemas/kernel-memory-semantic.schema.js';
import type { DatabaseClient } from '../client.js';

export type SemanticSource = 'extracted' | 'declared' | 'consolidated';

export interface SemanticFact {
  readonly id: string;
  readonly tenantId: string | null;
  readonly userId: string | null;
  readonly key: string;
  readonly value: unknown;
  readonly confidence: number;
  readonly sourceTurnId: string | null;
  readonly evidenceCount: number;
  readonly firstSeenAt: string;
  readonly lastSeenAt: string;
  readonly expiresAt: string | null;
  readonly source: SemanticSource;
}

export interface UpsertFactArgs {
  readonly tenantId: string | null;
  readonly userId?: string | null;
  readonly key: string;
  readonly value: unknown;
  readonly confidence: number;
  readonly sourceTurnId?: string | null;
  readonly source?: SemanticSource;
}

export interface LookupArgs {
  readonly tenantId: string | null;
  readonly userId?: string | null;
  readonly key: string;
}

export interface SearchArgs {
  readonly tenantId: string | null;
  readonly userId?: string | null;
  readonly prefix?: string;
  readonly limit?: number;
}

export interface DecayArgs {
  readonly tenantId: string | null;
  /** Multiplicative factor per day; e.g. 0.99 = 1% daily decay. */
  readonly decayPerDay: number;
}

export interface SemanticMemoryService {
  upsertFact(args: UpsertFactArgs): Promise<void>;
  lookup(args: LookupArgs): Promise<SemanticFact | null>;
  search(args: SearchArgs): Promise<ReadonlyArray<SemanticFact>>;
  decay(args: DecayArgs): Promise<number>;
}

const KEY_MAX_LEN = 200;
const DEFAULT_SEARCH_LIMIT = 25;

export function createSemanticMemoryService(
  db: DatabaseClient,
): SemanticMemoryService {
  return {
    async upsertFact(args) {
      try {
        const key = (args.key ?? '').slice(0, KEY_MAX_LEN);
        if (!key) return;
        const confidence = clamp01(args.confidence);
        const userId = args.userId ?? null;
        const source: SemanticSource = args.source ?? 'extracted';

        await db
          .insert(kernelMemorySemantic)
          .values({
            id: randomUUID(),
            tenantId: args.tenantId,
            userId,
            key,
            value: args.value as never,
            confidence,
            sourceTurnId: args.sourceTurnId ?? null,
            evidenceCount: 1,
            source,
          } as never)
          .onConflictDoUpdate({
            target: [
              kernelMemorySemantic.tenantId,
              kernelMemorySemantic.userId,
              kernelMemorySemantic.key,
            ],
            set: {
              value: args.value as never,
              confidence,
              sourceTurnId: args.sourceTurnId ?? null,
              evidenceCount: sql`${kernelMemorySemantic.evidenceCount} + 1`,
              lastSeenAt: new Date(),
              source,
            } as never,
          });
      } catch (error) {
        console.error('kernel-memory-semantic.upsertFact failed:', error);
      }
    },

    async lookup(args) {
      try {
        const key = (args.key ?? '').slice(0, KEY_MAX_LEN);
        if (!key) return null;
        const conds = [eq(kernelMemorySemantic.key, key)];
        if (args.tenantId)
          conds.push(eq(kernelMemorySemantic.tenantId, args.tenantId));
        if (args.userId === null || args.userId === undefined) {
          conds.push(isNull(kernelMemorySemantic.userId));
        } else {
          conds.push(eq(kernelMemorySemantic.userId, args.userId));
        }

        const rows = await db
          .select(SELECT_COLS)
          .from(kernelMemorySemantic)
          .where(and(...conds))
          .limit(1);

        const hit = Array.isArray(rows) ? rows[0] : undefined;
        return hit ? rowToFact(hit) : null;
      } catch (error) {
        console.error('kernel-memory-semantic.lookup failed:', error);
        return null;
      }
    },

    async search(args) {
      try {
        const limit = clampLimit(args.limit, DEFAULT_SEARCH_LIMIT);
        const conds: SQL<unknown>[] = [];
        if (args.tenantId)
          conds.push(eq(kernelMemorySemantic.tenantId, args.tenantId));
        if (args.userId === null) {
          conds.push(isNull(kernelMemorySemantic.userId));
        } else if (args.userId !== undefined) {
          conds.push(eq(kernelMemorySemantic.userId, args.userId));
        }
        if (args.prefix && args.prefix.length > 0) {
          // Postgres LIKE — escape % and _ defensively.
          const safe = args.prefix.replace(/[\\%_]/g, '\\$&');
          conds.push(like(kernelMemorySemantic.key, `${safe}%`));
        }

        const rows = await db
          .select(SELECT_COLS)
          .from(kernelMemorySemantic)
          .where(conds.length > 0 ? and(...conds) : undefined)
          .orderBy(desc(kernelMemorySemantic.lastSeenAt))
          .limit(limit);

        return (rows ?? []).map(rowToFact);
      } catch (error) {
        console.error('kernel-memory-semantic.search failed:', error);
        return [];
      }
    },

    async decay(args) {
      try {
        const factor = Number(args.decayPerDay);
        if (!Number.isFinite(factor) || factor <= 0 || factor > 1) {
          return 0;
        }
        const conds: SQL<unknown>[] = [];
        if (args.tenantId)
          conds.push(eq(kernelMemorySemantic.tenantId, args.tenantId));

        const out = (await db
          .update(kernelMemorySemantic)
          .set({
            confidence: sql`${kernelMemorySemantic.confidence} * ${factor}`,
          } as never)
          .where(conds.length > 0 ? and(...conds) : undefined)
          .returning({ id: kernelMemorySemantic.id })) as ReadonlyArray<{
          id: string;
        }>;
        return Array.isArray(out) ? out.length : 0;
      } catch (error) {
        console.error('kernel-memory-semantic.decay failed:', error);
        return 0;
      }
    },
  };
}

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

const SELECT_COLS = {
  id: kernelMemorySemantic.id,
  tenantId: kernelMemorySemantic.tenantId,
  userId: kernelMemorySemantic.userId,
  key: kernelMemorySemantic.key,
  value: kernelMemorySemantic.value,
  confidence: kernelMemorySemantic.confidence,
  sourceTurnId: kernelMemorySemantic.sourceTurnId,
  evidenceCount: kernelMemorySemantic.evidenceCount,
  firstSeenAt: kernelMemorySemantic.firstSeenAt,
  lastSeenAt: kernelMemorySemantic.lastSeenAt,
  expiresAt: kernelMemorySemantic.expiresAt,
  source: kernelMemorySemantic.source,
} as const;

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0.5;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function clampLimit(input: number | undefined, fallback: number): number {
  if (typeof input !== 'number' || !Number.isFinite(input) || input <= 0) {
    return fallback;
  }
  return Math.min(Math.floor(input), 1000);
}

interface SemanticRow {
  id: string;
  tenantId: string | null;
  userId: string | null;
  key: string;
  value: unknown;
  confidence: number;
  sourceTurnId: string | null;
  evidenceCount: number;
  firstSeenAt: Date | string;
  lastSeenAt: Date | string;
  expiresAt: Date | string | null;
  source: string;
}

function rowToFact(row: SemanticRow): SemanticFact {
  return {
    id: row.id,
    tenantId: row.tenantId,
    userId: row.userId,
    key: row.key,
    value: row.value,
    confidence: Number(row.confidence ?? 0),
    sourceTurnId: row.sourceTurnId,
    evidenceCount: Number(row.evidenceCount ?? 0),
    firstSeenAt:
      row.firstSeenAt instanceof Date
        ? row.firstSeenAt.toISOString()
        : String(row.firstSeenAt),
    lastSeenAt:
      row.lastSeenAt instanceof Date
        ? row.lastSeenAt.toISOString()
        : String(row.lastSeenAt),
    expiresAt:
      row.expiresAt === null
        ? null
        : row.expiresAt instanceof Date
          ? row.expiresAt.toISOString()
          : String(row.expiresAt),
    source: row.source as SemanticSource,
  };
}
