/**
 * Replay-protection store for callback webhooks.
 *
 * M-Pesa callbacks include `MerchantRequestID` and `CheckoutRequestID`; we
 * combine them into a single key and refuse to process the same key twice
 * within the retention window (default 24h -- matches the Safaricom retry
 * policy for settlement callbacks).
 *
 * Storage is an in-memory LRU with TTL. For multi-instance deployments a
 * shared store (Redis SETNX with TTL) is REQUIRED so that a retry hitting a
 * different pod is still rejected. The interface here is narrow enough for a
 * Redis adapter to drop in.
 */

export interface ReplayStore {
  /**
   * Remember `key` for the configured TTL. Returns true if this is the first
   * time the key has been seen (i.e. the caller should process the event),
   * or false if the key was already recorded (i.e. the caller must reject).
   */
  remember(key: string): boolean;
  has(key: string): boolean;
  clear(): void;
  size(): number;
}

export interface ReplayStoreOptions {
  /** Default: 24h. */
  ttlMs?: number;
  /** Default: 50_000. */
  maxEntries?: number;
}

interface Entry {
  expiresAt: number;
}

export class InMemoryReplayStore implements ReplayStore {
  private readonly map = new Map<string, Entry>();
  private readonly ttlMs: number;
  private readonly maxEntries: number;

  constructor(opts: ReplayStoreOptions = {}) {
    this.ttlMs = opts.ttlMs ?? 24 * 60 * 60 * 1000;
    this.maxEntries = opts.maxEntries ?? 50_000;
  }

  remember(key: string): boolean {
    this.purgeExpired();
    const existing = this.map.get(key);
    if (existing && existing.expiresAt > Date.now()) {
      return false;
    }
    this.evictIfNeeded();
    this.map.set(key, { expiresAt: Date.now() + this.ttlMs });
    return true;
  }

  has(key: string): boolean {
    const existing = this.map.get(key);
    if (!existing) return false;
    if (existing.expiresAt <= Date.now()) {
      this.map.delete(key);
      return false;
    }
    return true;
  }

  clear(): void {
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
 * Module-level singleton used by the M-Pesa callback handler. Tests that
 * want a clean state should call `.clear()` in `beforeEach`.
 */
export const defaultCallbackReplayStore = new InMemoryReplayStore();
