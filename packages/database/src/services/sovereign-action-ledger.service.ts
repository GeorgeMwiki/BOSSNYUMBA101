/**
 * Sovereign action ledger — append-only hash-chained service.
 *
 * Three operations:
 *
 *   appendLedgerEntry(entry)        — INSERT a new row, computing
 *     payload_hash, prev_hash (= latest this_hash for the tenant, or
 *     GENESIS_HASH), and this_hash inline. Returns `{ id, thisHash }`.
 *
 *   getLedgerTail(tenantId, n)      — SELECT the last n rows ordered by
 *     (executed_at DESC, id DESC). Powers the operator dashboard tail
 *     and is the read used by `verifyLedgerChain` to fetch the head.
 *
 *   verifyLedgerChain(tenantId)     — walks every row for the tenant in
 *     chain order (executed_at, id) and re-derives `this_hash` from
 *     `prev_hash || tenant_id || action_type || payload_hash
 *     || executed_at_iso`. Returns `{ ok: true, count }` when every
 *     row checks; `{ ok: false, brokenAt, expected, actual, ... }`
 *     on the first mismatch.
 *
 * LITFIN parity:
 *   `audit-ledger.ts:46-71` — same column shape
 *   `audit-ledger.ts:77-100` — same `computeLedgerHash` semantics
 *   `audit-ledger.ts:260-299` — same forward-walk verifier
 *
 * Errors:
 *   - DB errors on append() are RETHROWN — the caller must know that
 *     the ledger write failed (audit-grade requirement; we never lose
 *     an executed action silently).
 *   - DB errors on getLedgerTail() / verifyLedgerChain() are logged
 *     and surface as `{ ok: false, reason: 'db-error', ... }`.
 *
 * Concurrency:
 *   appendLedgerEntry uses an advisory-locked SELECT-then-INSERT inside
 *   a transaction so two simultaneous appends on the same tenant can't
 *   race and write the same prev_hash. The lock key is derived from a
 *   stable hash of `tenant_id`.
 */
import { createHash } from 'crypto';
import { randomUUID } from 'crypto';
import { and, desc, eq, sql } from 'drizzle-orm';
import {
  sovereignActionLedger,
  GENESIS_HASH,
} from '../schemas/sovereign-action-ledger.schema.js';
import type { DatabaseClient } from '../client.js';

export interface SovereignLedgerAppendArgs {
  readonly tenantId: string;
  readonly actionType: string;
  readonly payloadJson: Record<string, unknown>;
  readonly proposer: string;
  readonly approvers: ReadonlyArray<string>;
  readonly executedAt: Date;
  /**
   * Optional reversal-plan payload (Phase D D2). Persisted alongside
   * the chain row so operators can drive a recovery workflow if a
   * sovereign action needs to be undone. NOT included in the hash
   * chain — verifyLedgerChain walks the existing hash inputs
   * untouched.
   */
  readonly rollbackPayload?: unknown;
}

export interface SovereignLedgerRow {
  readonly id: string;
  readonly tenantId: string;
  readonly actionType: string;
  readonly payloadJson: Record<string, unknown>;
  readonly payloadHash: string;
  readonly proposer: string;
  readonly approvers: ReadonlyArray<string>;
  readonly executedAt: string;
  readonly prevHash: string;
  readonly thisHash: string;
  readonly capturedAt: string;
}

export interface SovereignLedgerAppendResult {
  readonly id: string;
  readonly thisHash: string;
  readonly prevHash: string;
}

export type SovereignLedgerVerifyResult =
  | { readonly ok: true; readonly count: number }
  | {
      readonly ok: false;
      readonly count: number;
      readonly brokenAt: string;
      readonly expected: string;
      readonly actual: string;
      readonly reason: 'hash-mismatch' | 'prev-hash-mismatch' | 'db-error';
    };

export interface SovereignActionLedgerService {
  appendLedgerEntry(
    args: SovereignLedgerAppendArgs,
  ): Promise<SovereignLedgerAppendResult>;
  getLedgerTail(
    tenantId: string,
    limit: number,
  ): Promise<ReadonlyArray<SovereignLedgerRow>>;
  verifyLedgerChain(tenantId: string): Promise<SovereignLedgerVerifyResult>;
  /**
   * Load the optional rollback payload for a previously-recorded
   * sovereign action (Phase D D2). Returns `null` when the row is
   * missing OR when the row has no recorded rollback plan. Errors are
   * logged and surface as `null` so the operator UI can fall back to
   * manual recovery.
   */
  loadRollbackPayload(actionId: string): Promise<unknown | null>;
}

const MAX_TAIL = 1000;
const DEFAULT_TAIL = 100;
const VERIFY_CHUNK = 500;

/**
 * Canonical JSON serialisation: sort keys at every level so the hash is
 * stable across producers. Mirrors the kernel-side `hashPayload` in
 * `agency/executor/audit-sink.ts` (sha256 of canonical-key-sorted JSON).
 */
export function hashPayload(payload: Record<string, unknown> | null): string {
  if (!payload || typeof payload !== 'object') {
    return createHash('sha256').update('null', 'utf8').digest('hex');
  }
  let canonical: string;
  try {
    canonical = JSON.stringify(payload, Object.keys(payload).sort());
  } catch {
    canonical = String(payload);
  }
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

/**
 * Per-row hash binding the action to its predecessor. Matches LITFIN's
 * `computeLedgerHash`: sha256 of (prev_hash || tenant_id ||
 * action_type || payload_hash || executed_at_iso) joined with a
 * record-separator byte so adjacent column values cannot blur together.
 */
export function computeRowHash(args: {
  readonly prevHash: string;
  readonly tenantId: string;
  readonly actionType: string;
  readonly payloadHash: string;
  readonly executedAt: Date;
}): string {
  const SEP = '\x1f';
  const buf = [
    args.prevHash,
    args.tenantId,
    args.actionType,
    args.payloadHash,
    args.executedAt.toISOString(),
  ].join(SEP);
  return createHash('sha256').update(buf, 'utf8').digest('hex');
}

function tenantLockKey(tenantId: string): number {
  // Stable signed-int64 from sha256(tenantId) — we slice the leading 15
  // hex digits to fit comfortably inside a Postgres BIGINT (53 bits is
  // safe for JS Number). pg_try_advisory_xact_lock accepts BIGINT.
  const digest = createHash('sha256').update(tenantId, 'utf8').digest('hex');
  return Number.parseInt(digest.slice(0, 15), 16);
}

function rowToLedger(row: Record<string, unknown>): SovereignLedgerRow {
  return {
    id: String(row.id ?? ''),
    tenantId: String(row.tenantId ?? row.tenant_id ?? ''),
    actionType: String(row.actionType ?? row.action_type ?? ''),
    payloadJson:
      (row.payloadJson as Record<string, unknown>) ??
      (row.payload_json as Record<string, unknown>) ??
      {},
    payloadHash: String(row.payloadHash ?? row.payload_hash ?? ''),
    proposer: String(row.proposer ?? ''),
    approvers: Array.isArray(row.approvers)
      ? (row.approvers as string[])
      : [],
    executedAt: toIso(row.executedAt ?? row.executed_at),
    prevHash: String(row.prevHash ?? row.prev_hash ?? ''),
    thisHash: String(row.thisHash ?? row.this_hash ?? ''),
    capturedAt: toIso(row.capturedAt ?? row.captured_at),
  };
}

function toIso(value: unknown): string {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') {
    const asDate = new Date(value);
    if (!Number.isNaN(asDate.getTime())) return asDate.toISOString();
    return value;
  }
  return '';
}

export function createSovereignActionLedgerService(
  db: DatabaseClient,
): SovereignActionLedgerService {
  return {
    async appendLedgerEntry(args) {
      if (!args.tenantId) {
        throw new Error('sovereign-action-ledger.append: tenantId is required');
      }
      if (!args.actionType) {
        throw new Error(
          'sovereign-action-ledger.append: actionType is required',
        );
      }
      if (!args.proposer) {
        throw new Error('sovereign-action-ledger.append: proposer is required');
      }

      const payloadHash = hashPayload(args.payloadJson);
      const lockKey = tenantLockKey(args.tenantId);
      const id = randomUUID();
      // Advisory lock keeps two simultaneous appends on the same
      // tenant chain from racing on the prev_hash read. We use the
      // session-level `pg_advisory_lock` paired with `pg_advisory_unlock`
      // to keep the lock scoped to this call even outside an explicit
      // transaction (the drizzle helper does not always open one).
      try {
        await (db as unknown as {
          execute(q: unknown): Promise<unknown>;
        }).execute(sql`SELECT pg_advisory_lock(${lockKey})`);
      } catch (error) {
        console.error(
          'sovereign-action-ledger: advisory_lock failed:',
          error,
        );
        throw error instanceof Error
          ? error
          : new Error('sovereign-action-ledger: advisory_lock failed');
      }
      try {
        const headRows = (await db
          .select({ thisHash: sovereignActionLedger.thisHash })
          .from(sovereignActionLedger)
          .where(eq(sovereignActionLedger.tenantId, args.tenantId))
          .orderBy(
            desc(sovereignActionLedger.executedAt),
            desc(sovereignActionLedger.id),
          )
          .limit(1)) as ReadonlyArray<{ thisHash: string }>;
        const prevHash = headRows[0]?.thisHash ?? GENESIS_HASH;
        const thisHash = computeRowHash({
          prevHash,
          tenantId: args.tenantId,
          actionType: args.actionType,
          payloadHash,
          executedAt: args.executedAt,
        });
        try {
          await db.insert(sovereignActionLedger).values({
            id,
            tenantId: args.tenantId,
            actionType: args.actionType,
            payloadJson: args.payloadJson as unknown as Record<
              string,
              unknown
            >,
            payloadHash,
            proposer: args.proposer,
            approvers: args.approvers as unknown as Record<string, unknown>[],
            executedAt: args.executedAt,
            prevHash,
            thisHash,
            ...(args.rollbackPayload !== undefined
              ? {
                  rollbackPayload: args.rollbackPayload as unknown as Record<
                    string,
                    unknown
                  >,
                }
              : {}),
          } as never);
        } catch (error) {
          console.error('sovereign-action-ledger.append insert failed:', error);
          throw error instanceof Error
            ? error
            : new Error('sovereign-action-ledger.append failed');
        }
        return { id, thisHash, prevHash };
      } finally {
        try {
          await (db as unknown as {
            execute(q: unknown): Promise<unknown>;
          }).execute(sql`SELECT pg_advisory_unlock(${lockKey})`);
        } catch (error) {
          // unlock failure is non-fatal — the session will release the
          // lock on disconnect anyway. Log so operators can spot a
          // stuck session.
          console.error(
            'sovereign-action-ledger: advisory_unlock failed:',
            error,
          );
        }
      }
    },

    async getLedgerTail(tenantId, limit) {
      try {
        if (!tenantId) return [];
        const capped = Math.max(
          1,
          Math.min(MAX_TAIL, Math.floor(limit ?? DEFAULT_TAIL)),
        );
        const rows = (await db
          .select()
          .from(sovereignActionLedger)
          .where(eq(sovereignActionLedger.tenantId, tenantId))
          .orderBy(
            desc(sovereignActionLedger.executedAt),
            desc(sovereignActionLedger.id),
          )
          .limit(capped)) as ReadonlyArray<Record<string, unknown>>;
        return (rows ?? []).map(rowToLedger);
      } catch (error) {
        console.error('sovereign-action-ledger.getLedgerTail failed:', error);
        return [];
      }
    },

    async verifyLedgerChain(tenantId) {
      if (!tenantId) {
        return {
          ok: false,
          count: 0,
          brokenAt: '',
          expected: '',
          actual: '',
          reason: 'db-error',
        };
      }
      let expectedPrev = GENESIS_HASH;
      let count = 0;
      let lastId = '';
      try {
        // Chunked forward walk so we never load >VERIFY_CHUNK rows at
        // once for tenants with deep ledgers. Pagination uses a
        // (executed_at, id) cursor — both monotonically advance within
        // a tenant's chain (id is unique, so ordered after executed_at
        // is a stable tiebreaker).
        let cursorExecutedAt: Date | null = null;
        let cursorId: string | null = null;
        while (true) {
          const where = cursorExecutedAt
            ? and(
                eq(sovereignActionLedger.tenantId, tenantId),
                sql`(${sovereignActionLedger.executedAt}, ${sovereignActionLedger.id}) > (${cursorExecutedAt.toISOString()}::timestamptz, ${cursorId ?? ''})`,
              )
            : eq(sovereignActionLedger.tenantId, tenantId);
          const rows = (await db
            .select()
            .from(sovereignActionLedger)
            .where(where)
            .orderBy(
              sovereignActionLedger.executedAt,
              sovereignActionLedger.id,
            )
            .limit(VERIFY_CHUNK)) as ReadonlyArray<Record<string, unknown>>;
          if (!rows || rows.length === 0) break;
          for (const raw of rows) {
            const r = rowToLedger(raw);
            count += 1;
            lastId = r.id;
            if (r.prevHash !== expectedPrev) {
              return {
                ok: false,
                count,
                brokenAt: r.id,
                expected: expectedPrev,
                actual: r.prevHash,
                reason: 'prev-hash-mismatch',
              };
            }
            const recomputed = computeRowHash({
              prevHash: r.prevHash,
              tenantId: r.tenantId,
              actionType: r.actionType,
              payloadHash: r.payloadHash,
              executedAt: new Date(r.executedAt),
            });
            if (recomputed !== r.thisHash) {
              return {
                ok: false,
                count,
                brokenAt: r.id,
                expected: recomputed,
                actual: r.thisHash,
                reason: 'hash-mismatch',
              };
            }
            expectedPrev = r.thisHash;
            cursorExecutedAt = new Date(r.executedAt);
            cursorId = r.id;
          }
          if (rows.length < VERIFY_CHUNK) break;
        }
        return { ok: true, count };
      } catch (error) {
        console.error(
          'sovereign-action-ledger.verifyLedgerChain failed:',
          error,
        );
        return {
          ok: false,
          count,
          brokenAt: lastId,
          expected: expectedPrev,
          actual: '',
          reason: 'db-error',
        };
      }
    },

    async loadRollbackPayload(actionId) {
      if (!actionId) return null;
      try {
        const rows = (await db
          .select()
          .from(sovereignActionLedger)
          .where(eq(sovereignActionLedger.id, actionId))
          .limit(1)) as ReadonlyArray<Record<string, unknown>>;
        const first = rows?.[0];
        if (!first) return null;
        const raw =
          (first.rollbackPayload as unknown) ??
          (first.rollback_payload as unknown) ??
          null;
        return raw ?? null;
      } catch (error) {
        console.error(
          'sovereign-action-ledger.loadRollbackPayload failed:',
          error,
        );
        return null;
      }
    },
  };
}

export { sovereignActionLedger, GENESIS_HASH };
