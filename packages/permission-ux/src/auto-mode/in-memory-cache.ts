/**
 * In-memory LRU + TTL cache for classifier verdicts. Reference adapter
 * — production may swap for Redis. Bounded by `capacity`; eviction is
 * LRU on `get`/`set`.
 */

import type { ClassifierVerdict, VerdictCachePort } from './types.js';

interface CacheEntry {
  readonly verdict: ClassifierVerdict;
  readonly expiresAt: number;
}

export interface InMemoryVerdictCacheOptions {
  /** Max number of live entries before LRU eviction. Default 1000. */
  readonly capacity?: number;
  /** Injectable clock — tests inject a deterministic time source. */
  readonly now?: () => number;
}

export class InMemoryVerdictCache implements VerdictCachePort {
  private readonly map = new Map<string, CacheEntry>();
  private readonly capacity: number;
  private readonly now: () => number;

  constructor(opts: InMemoryVerdictCacheOptions = {}) {
    this.capacity = Math.max(1, opts.capacity ?? 1000);
    this.now = opts.now ?? (() => Date.now());
  }

  get(key: string): ClassifierVerdict | null {
    const entry = this.map.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= this.now()) {
      this.map.delete(key);
      return null;
    }
    // LRU touch: re-insert to move to most-recent slot.
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.verdict;
  }

  set(key: string, value: ClassifierVerdict, ttlMs: number): void {
    if (ttlMs <= 0) return;
    if (this.map.has(key)) this.map.delete(key);
    while (this.map.size >= this.capacity) {
      const oldest = this.map.keys().next().value;
      if (oldest === undefined) break;
      this.map.delete(oldest);
    }
    this.map.set(key, { verdict: value, expiresAt: this.now() + ttlMs });
  }

  /** Diagnostic. */
  size(): number {
    return this.map.size;
  }
}
