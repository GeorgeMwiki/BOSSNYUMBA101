/**
 * Idempotency store for STK-push requests.
 *
 * Design:
 *   - Primary implementation is an in-memory LRU with TTL. This is sufficient
 *     for single-instance deployments and for unit tests.
 *   - For multi-instance production deployments a shared store (Redis) is
 *     REQUIRED so that a retry hitting a different pod still hits the cache.
 *     The IdempotencyStore interface below is intentionally minimal so that a
 *     Redis-backed adapter can drop in without touching call sites.
 *
 * The store returns a sentinel tuple:
 *   - { status: 'new' }                  -> caller should execute and then
 *                                           call `complete()` with the result
 *   - { status: 'in-flight' }            -> another caller is currently
 *                                           processing this key
 *   - { status: 'replayed', value: T }   -> a previous call already succeeded
 *                                           and the stored value is returned
 *
 * Keys are expected to be opaque strings. Callers that don't supply an
 * explicit Idempotency-Key header can derive one via `deriveIdempotencyKey`.
 */
import { createHash } from 'crypto';

export interface IdempotencyStore<T> {
  begin(key: string): Promise<IdempotencyLookup<T>>;
  complete(key: string, value: T): Promise<void>;
  fail(key: string): Promise<void>;
  clear(): Promise<void>;
  size(): number;
}

export type IdempotencyLookup<T> =
  | { status: 'new' }
  | { status: 'in-flight' }
  | { status: 'replayed'; value: T };

interface Entry<T> {
  state: 'in-flight' | 'done';
  value?: T;
  expiresAt: number;
}

export interface InMemoryIdempotencyOptions {
  /** Maximum number of entries kept in the LRU. Default: 10_000. */
  maxEntries?: number;
  /** TTL for a completed entry in milliseconds. Default: 24h. */
  ttlMs?: number;
}

/**
 * Small LRU with TTL semantics.
 *
 * Uses a Map's insertion-order iteration for O(1) eviction of the
 * least-recently-used entry. Every read re-inserts the key so "recently used"
 * is preserved. Expired entries are purged lazily on access and proactively
 * whenever a write would overflow the cap.
 */
export class InMemoryIdempotencyStore<T> implements IdempotencyStore<T> {
  private readonly map = new Map<string, Entry<T>>();
  private readonly maxEntries: number;
  private readonly ttlMs: number;

  constructor(opts: InMemoryIdempotencyOptions = {}) {
    this.maxEntries = opts.maxEntries ?? 10_000;
    this.ttlMs = opts.ttlMs ?? 24 * 60 * 60 * 1000;
  }

  async begin(key: string): Promise<IdempotencyLookup<T>> {
    this.purgeExpired();
    const existing = this.map.get(key);
    if (existing && existing.expiresAt > Date.now()) {
      // Refresh LRU position.
      this.map.delete(key);
      this.map.set(key, existing);
      if (existing.state === 'in-flight') {
        return { status: 'in-flight' };
      }
      if (existing.state === 'done' && existing.value !== undefined) {
        return { status: 'replayed', value: existing.value };
      }
    }
    this.evictIfNeeded();
    this.map.set(key, {
      state: 'in-flight',
      expiresAt: Date.now() + this.ttlMs,
    });
    return { status: 'new' };
  }

  async complete(key: string, value: T): Promise<void> {
    this.map.set(key, {
      state: 'done',
      value,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  async fail(key: string): Promise<void> {
    // On failure, drop the in-flight marker so a client retry can try again.
    this.map.delete(key);
  }

  async clear(): Promise<void> {
    this.map.clear();
  }

  size(): number {
    return this.map.size;
  }

  private purgeExpired(): void {
    const now = Date.now();
    for (const [k, v] of this.map) {
      if (v.expiresAt <= now) this.map.delete(k);
    }
  }

  private evictIfNeeded(): void {
    while (this.map.size >= this.maxEntries) {
      const oldest = this.map.keys().next().value;
      if (oldest === undefined) break;
      this.map.delete(oldest);
    }
  }
}

/**
 * Derive a deterministic idempotency key from the tuple
 * (tenantId, orderId, amount). Used when the client did not supply an
 * explicit Idempotency-Key header.
 */
export function deriveIdempotencyKey(parts: {
  tenantId: string;
  orderId: string;
  amount: number;
}): string {
  const h = createHash('sha256');
  h.update(parts.tenantId);
  h.update('|');
  h.update(parts.orderId);
  h.update('|');
  h.update(String(parts.amount));
  return `stk:${h.digest('hex').slice(0, 32)}`;
}
