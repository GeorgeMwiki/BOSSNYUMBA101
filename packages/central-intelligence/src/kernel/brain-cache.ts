/**
 * Brain-side cache — small LRU keyed on the *thought* parameters
 * (scope + persona + tier + message hash + stakes). Distinct from
 * the LLM provider's prompt cache:
 *
 *   - the LLM cache amortises prefix tokens within a SESSION
 *   - the brain cache de-duplicates ENTIRE thoughts across sessions
 *
 * Default TTL: 60 seconds. Default capacity: 64 entries. Both are
 * deliberately small — the cache exists to absorb burst traffic
 * (a frantic re-click) and preserve provenance idempotency. It is
 * NOT a long-term answer store.
 *
 * Pure data structure with an injectable clock; no IO.
 */

import { createHash } from 'crypto';
import type { ScopeContext } from '../types.js';
import type { AwarenessTier, BrainDecision, ThoughtRequest } from './kernel-types.js';

export interface BrainCache {
  readonly capacity: number;
  readonly ttlMs: number;
  get(key: string): BrainDecision | null;
  set(key: string, value: BrainDecision): void;
  delete(key: string): void;
  size(): number;
  clear(): void;
}

export interface BrainCacheDeps {
  readonly capacity?: number;
  readonly ttlMs?: number;
  readonly clock?: () => number;
}

interface Entry {
  readonly value: BrainDecision;
  readonly expiresAt: number;
}

export function createBrainCache(deps: BrainCacheDeps = {}): BrainCache {
  const capacity = deps.capacity ?? 64;
  const ttlMs = deps.ttlMs ?? 60_000;
  const clock = deps.clock ?? Date.now;
  const map = new Map<string, Entry>();

  function gc(): void {
    const now = clock();
    for (const [k, e] of map) if (e.expiresAt <= now) map.delete(k);
  }

  return {
    capacity,
    ttlMs,
    get(key) {
      const e = map.get(key);
      if (!e) return null;
      if (e.expiresAt <= clock()) {
        map.delete(key);
        return null;
      }
      // LRU touch
      map.delete(key);
      map.set(key, e);
      return e.value;
    },
    set(key, value) {
      gc();
      if (map.has(key)) map.delete(key);
      map.set(key, { value, expiresAt: clock() + ttlMs });
      while (map.size > capacity) {
        const oldest = map.keys().next().value as string | undefined;
        if (!oldest) break;
        map.delete(oldest);
      }
    },
    delete(key) {
      map.delete(key);
    },
    size() {
      return map.size;
    },
    clear() {
      map.clear();
    },
  };
}

export function thoughtCacheKey(req: ThoughtRequest): string {
  const tenantPart = req.scope.kind === 'tenant' ? req.scope.tenantId : '__platform__';
  const payload = [
    req.scope.kind,
    tenantPart,
    req.scope.personaId,
    req.tier as AwarenessTier,
    req.surface,
    req.stakes,
    sha(req.userMessage.trim()),
  ].join('|');
  return sha(payload);
}

function sha(s: string): string {
  return createHash('sha256').update(s, 'utf8').digest('hex').slice(0, 32);
}

/** Re-export the type so other modules don't need the `import type`. */
export type { ScopeContext };
