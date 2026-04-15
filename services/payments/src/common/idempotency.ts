/**
 * In-process idempotency-key cache. Guarantees a given idempotency key
 * produces the same (cached) response when the same work is requested
 * multiple times within the TTL.
 *
 * For multi-instance deployments, replace with a Redis-backed implementation
 * sharing the same {@link IdempotencyStore} interface.
 */
import { createHash } from 'crypto';

export interface IdempotencyStore {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T, ttlMs?: number): Promise<void>;
  delete(key: string): Promise<void>;
}

interface Entry<T> {
  value: T;
  expiresAt: number;
}

export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly entries = new Map<string, Entry<unknown>>();
  private readonly defaultTtlMs: number;

  constructor(defaultTtlMs: number = 24 * 60 * 60 * 1000) {
    this.defaultTtlMs = defaultTtlMs;
  }

  async get<T>(key: string): Promise<T | undefined> {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  async put<T>(key: string, value: T, ttlMs?: number): Promise<void> {
    const expiresAt = Date.now() + (ttlMs ?? this.defaultTtlMs);
    this.entries.set(key, { value, expiresAt });
  }

  async delete(key: string): Promise<void> {
    this.entries.delete(key);
  }

  size(): number {
    return this.entries.size;
  }
}

// Process-local pending promise map for concurrent deduplication. This is
// per-process; for cross-process deduplication use a distributed lock
// (e.g. Redis SETNX) via a custom IdempotencyStore implementation.
const pendingPromises = new Map<string, Promise<unknown>>();

/**
 * Run `fn` once per idempotency key. If a previous successful result is
 * cached for the same key, that result is returned instead of re-executing.
 *
 * Concurrent in-process invocations with the same key share a single
 * underlying promise.
 */
export async function withIdempotency<T>(
  store: IdempotencyStore,
  key: string,
  fn: () => Promise<T>,
  options: { ttlMs?: number } = {}
): Promise<T> {
  const existing = await store.get<T>(key);
  if (existing !== undefined) {
    return existing;
  }

  const pending = pendingPromises.get(key) as Promise<T> | undefined;
  if (pending) {
    return pending;
  }

  const promise = (async () => {
    try {
      const value = await fn();
      await store.put(key, value, options.ttlMs);
      return value;
    } finally {
      pendingPromises.delete(key);
    }
  })();
  pendingPromises.set(key, promise);
  return promise;
}

/**
 * Derive a stable idempotency key from a canonical representation of the
 * request. Two identical requests yield the same key.
 */
export function deriveIdempotencyKey(
  provider: string,
  operation: string,
  payload: Record<string, unknown>
): string {
  const canonical = JSON.stringify(
    Object.fromEntries(
      Object.entries(payload).sort(([a], [b]) => a.localeCompare(b))
    )
  );
  const digest = createHash('sha256').update(canonical).digest('hex');
  return `${provider}:${operation}:${digest}`;
}
