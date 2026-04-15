/**
 * Module-level store holders for M-Pesa handlers.
 *
 * Handlers read their stores through the getters below, which default to
 * in-memory implementations. At service boot, `createStores()` (from
 * `store-factory.ts`) produces the appropriate backend (memory or redis) and
 * injects them via `setStkIdempotencyStore()`, `setCallbackReplayStore()`,
 * and `setStkRateLimiter()`.
 */

/**
 * Idempotency store for STK Push requests. Keys are idempotency keys;
 * values are arbitrary JSON (typically the prior response snapshot).
 */
export interface StkIdempotencyStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  /**
   * Atomically set key only if absent. Returns true when the key was stored.
   */
  setIfAbsent(key: string, value: string, ttlSeconds?: number): Promise<boolean>;
}

/**
 * Callback replay store. Tracks already-processed callback identifiers
 * (e.g., CheckoutRequestID + MpesaReceiptNumber) to drop duplicates.
 */
export interface CallbackReplayStore {
  has(key: string): Promise<boolean>;
  mark(key: string, ttlSeconds?: number): Promise<void>;
}

/**
 * Rate limiter for STK Push invocations (per phone number or tenant).
 */
export interface StkRateLimiter {
  /**
   * Attempt to consume one token. Returns true when allowed.
   */
  tryConsume(key: string, limit: number, windowSeconds: number): Promise<boolean>;
}

// ---------------------------------------------------------------------------
// In-memory default implementations
// ---------------------------------------------------------------------------

class MemoryIdempotencyStore implements StkIdempotencyStore {
  private data = new Map<string, { value: string; expiresAt?: number }>();

  async get(key: string): Promise<string | null> {
    const entry = this.data.get(key);
    if (!entry) return null;
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.data.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    this.data.set(key, {
      value,
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined,
    });
  }

  async setIfAbsent(
    key: string,
    value: string,
    ttlSeconds?: number
  ): Promise<boolean> {
    const existing = await this.get(key);
    if (existing !== null) return false;
    await this.set(key, value, ttlSeconds);
    return true;
  }
}

class MemoryCallbackReplayStore implements CallbackReplayStore {
  private data = new Map<string, number | undefined>();

  async has(key: string): Promise<boolean> {
    const expiresAt = this.data.get(key);
    if (expiresAt === undefined && this.data.has(key)) return true;
    if (expiresAt !== undefined && expiresAt > Date.now()) return true;
    if (expiresAt !== undefined && expiresAt <= Date.now()) {
      this.data.delete(key);
      return false;
    }
    return this.data.has(key);
  }

  async mark(key: string, ttlSeconds?: number): Promise<void> {
    this.data.set(key, ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined);
  }
}

class MemoryStkRateLimiter implements StkRateLimiter {
  private buckets = new Map<string, number[]>();

  async tryConsume(
    key: string,
    limit: number,
    windowSeconds: number
  ): Promise<boolean> {
    const now = Date.now();
    const windowStart = now - windowSeconds * 1000;
    const hits = (this.buckets.get(key) || []).filter((t) => t > windowStart);
    if (hits.length >= limit) {
      this.buckets.set(key, hits);
      return false;
    }
    hits.push(now);
    this.buckets.set(key, hits);
    return true;
  }
}

// ---------------------------------------------------------------------------
// Module-level singletons + setters
// ---------------------------------------------------------------------------

let stkIdempotencyStore: StkIdempotencyStore = new MemoryIdempotencyStore();
let callbackReplayStore: CallbackReplayStore = new MemoryCallbackReplayStore();
let stkRateLimiter: StkRateLimiter = new MemoryStkRateLimiter();

export function setStkIdempotencyStore(store: StkIdempotencyStore): void {
  stkIdempotencyStore = store;
}

export function getStkIdempotencyStore(): StkIdempotencyStore {
  return stkIdempotencyStore;
}

export function setCallbackReplayStore(store: CallbackReplayStore): void {
  callbackReplayStore = store;
}

export function getCallbackReplayStore(): CallbackReplayStore {
  return callbackReplayStore;
}

export function setStkRateLimiter(limiter: StkRateLimiter): void {
  stkRateLimiter = limiter;
}

export function getStkRateLimiter(): StkRateLimiter {
  return stkRateLimiter;
}

export const __memoryImpls = {
  MemoryIdempotencyStore,
  MemoryCallbackReplayStore,
  MemoryStkRateLimiter,
};
