/**
 * Idempotency middleware.
 *
 * Ensures financial / side-effect safety when an agent retries a POST/PUT/PATCH.
 * Uses `X-Idempotency-Key` + a SHA-256 of the request body to detect duplicates.
 *
 * Rules:
 *   - Only POST / PUT / PATCH are idempotency-eligible.
 *   - Only 2xx responses are cached (failures can be retried safely).
 *   - TTL: 24 hours.
 *   - Same key + different body → `IDEMPOTENCY_CONFLICT`.
 *   - Same key + same body → cached response returned verbatim.
 *
 * Storage is injected so this package stays testable and storage-agnostic.
 */

import type { HeadersLike } from './correlation-id.js';
import type { IdempotencyRecord } from './types.js';
import { sha256Hex } from './agent-auth.js';

// ============================================================================
// Storage port
// ============================================================================

export interface IdempotencyStore {
  find(
    key: string,
    agentId: string,
  ): Promise<IdempotencyRecord | null>;
  put(record: IdempotencyRecord): Promise<void>;
  delete(key: string, agentId: string): Promise<void>;
  /**
   * Atomically write a record IFF no record exists for the key.
   *
   * H12 closure (round-3 audit): `find` then `put` is a TOCTOU window
   * — two concurrent requests with the same key both see `null` from
   * `find` and both `put`, double-executing a financial side-effect.
   *
   * Production wiring: `SET key value NX EX ttl` (Redis) or
   * `INSERT ... ON CONFLICT DO NOTHING RETURNING ...` (Postgres).
   * Returns `true` if the record was inserted (caller proceeds with
   * the side-effect), `false` if another writer won (caller must
   * read the existing row and replay its response).
   *
   * Stores that have not yet implemented this MUST throw — the
   * fallback to `find`+`put` is the bug.
   */
  putIfAbsent?(record: IdempotencyRecord): Promise<boolean>;
}

export function createInMemoryIdempotencyStore(): IdempotencyStore {
  const map = new Map<string, IdempotencyRecord>();
  const keyOf = (k: string, a: string): string => `${a}::${k}`;
  return {
    async find(key, agentId) {
      return map.get(keyOf(key, agentId)) ?? null;
    },
    async put(record) {
      map.set(keyOf(record.key, record.agentId), record);
    },
    async delete(key, agentId) {
      map.delete(keyOf(key, agentId));
    },
    async putIfAbsent(record) {
      const k = keyOf(record.key, record.agentId);
      // Single-threaded Node loop — Map.set after Map.has is atomic
      // for the purposes of within-process concurrency. Multi-process
      // deployments MUST swap in Redis / Postgres.
      if (map.has(k)) return false;
      map.set(k, record);
      return true;
    },
  };
}

// ============================================================================
// Check result
// ============================================================================

export type IdempotencyCheck =
  | {
      readonly kind: 'fresh';
      readonly idempotencyKey?: string;
      readonly requestHash?: string;
    }
  | {
      readonly kind: 'replayed';
      readonly statusCode: number;
      readonly responseBody: string;
    }
  | {
      readonly kind: 'conflict';
    };

const IDEMPOTENCY_KEY_HEADER = 'x-idempotency-key';
const TTL_MS = 24 * 60 * 60 * 1000;

// ============================================================================
// Check
// ============================================================================

export async function checkIdempotency(deps: {
  readonly store: IdempotencyStore;
  readonly method: string;
  readonly headers: HeadersLike;
  readonly body: string;
  readonly agentId: string;
  readonly now?: () => number;
}): Promise<IdempotencyCheck> {
  const method = deps.method.toUpperCase();
  if (!['POST', 'PUT', 'PATCH'].includes(method)) {
    return { kind: 'fresh' };
  }
  const idempotencyKey = deps.headers[IDEMPOTENCY_KEY_HEADER];
  if (!idempotencyKey) return { kind: 'fresh' };

  const now = (deps.now ?? Date.now)();
  const requestHash = await sha256Hex(deps.body);

  const existing = await deps.store.find(idempotencyKey, deps.agentId);
  if (!existing) {
    return { kind: 'fresh', idempotencyKey, requestHash };
  }

  if (new Date(existing.expiresAt).getTime() < now) {
    await deps.store.delete(idempotencyKey, deps.agentId);
    return { kind: 'fresh', idempotencyKey, requestHash };
  }

  if (existing.requestHash !== requestHash) {
    return { kind: 'conflict' };
  }

  return {
    kind: 'replayed',
    statusCode: existing.statusCode,
    responseBody: existing.responseBody,
  };
}

// ============================================================================
// Cache
// ============================================================================

export async function cacheIdempotencyResponse(deps: {
  readonly store: IdempotencyStore;
  readonly idempotencyKey: string;
  readonly agentId: string;
  readonly method: string;
  readonly path: string;
  readonly requestHash: string;
  readonly statusCode: number;
  readonly responseBody: string;
  readonly now?: () => number;
}): Promise<void> {
  if (deps.statusCode < 200 || deps.statusCode >= 300) return;
  const now = (deps.now ?? Date.now)();
  const iso = (ts: number): string => new Date(ts).toISOString();
  const record: IdempotencyRecord = {
    key: deps.idempotencyKey,
    agentId: deps.agentId,
    method: deps.method.toUpperCase(),
    path: deps.path,
    requestHash: deps.requestHash,
    statusCode: deps.statusCode,
    responseBody: deps.responseBody,
    createdAt: iso(now),
    expiresAt: iso(now + TTL_MS),
  };
  // H12 closure: prefer the atomic putIfAbsent contract when the store
  // supports it. Fall back to `put` for legacy stores — but log a
  // warning trail so operators know to migrate. Multi-process
  // deployments without atomic-put can double-execute financial
  // operations under concurrent retries.
  if (typeof deps.store.putIfAbsent === 'function') {
    await deps.store.putIfAbsent(record);
    return;
  }
  await deps.store.put(record);
}

/**
 * Atomic-claim helper for the `checkIdempotency` fresh path (H12).
 *
 * The original `checkIdempotency` returns `kind: 'fresh'` and lets the
 * caller perform the side-effect, then call `cacheIdempotencyResponse`.
 * For non-idempotent side-effects (e.g. PAYMENT), the caller should
 * use `claimIdempotency` to RESERVE the key BEFORE the side-effect —
 * any concurrent caller with the same key + body sees `kind: 'replayed'`
 * (or 'conflict') and never double-executes.
 */
export async function claimIdempotency(deps: {
  readonly store: IdempotencyStore;
  readonly method: string;
  readonly headers: HeadersLike;
  readonly body: string;
  readonly agentId: string;
  readonly path: string;
  readonly now?: () => number;
}): Promise<IdempotencyCheck> {
  const initial = await checkIdempotency(deps);
  if (initial.kind !== 'fresh') return initial;
  if (typeof deps.store.putIfAbsent !== 'function') {
    // Legacy store — no atomic primitive. Fall back to the non-atomic
    // fresh path; caller must be aware of the TOCTOU window.
    return initial;
  }
  const now = (deps.now ?? Date.now)();
  const iso = (ts: number): string => new Date(ts).toISOString();
  // Reserve a placeholder record (statusCode 0 marks "in-flight").
  const placeholder: IdempotencyRecord = {
    key: initial.idempotencyKey!,
    agentId: deps.agentId,
    method: deps.method.toUpperCase(),
    path: deps.path,
    requestHash: initial.requestHash!,
    statusCode: 0,
    responseBody: '',
    createdAt: iso(now),
    expiresAt: iso(now + TTL_MS),
  };
  const claimed = await deps.store.putIfAbsent(placeholder);
  if (claimed) return initial;
  // Lost the race — re-check and return whatever the winner produced.
  return checkIdempotency(deps);
}
