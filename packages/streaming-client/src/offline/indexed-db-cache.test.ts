/**
 * Phase J8 — IndexedDbOfflineCache tests.
 *
 * Backed by `fake-indexeddb/auto` (loaded in `__tests__/setup.ts`).
 * Each test passes a unique store via `createStore` so the suite runs
 * cleanly in parallel without leaking DB state across cases.
 */

import { createStore } from 'idb-keyval';
import { beforeEach, describe, expect, it } from 'vitest';
import type { CachedEntity } from '../types.js';
import { cacheKey } from './cache-key.js';
import { IndexedDbOfflineCache } from './indexed-db-cache.js';

function ent<T>(
  tenantId: string,
  tabId: string,
  entityId: string,
  version: number,
  data: T,
): CachedEntity<T> {
  return {
    key: cacheKey(tenantId, tabId, entityId),
    tenantId,
    tabId,
    entityId,
    data,
    version,
    cachedAt: 1_700_000_000_000 + version,
  };
}

let dbCounter = 0;
function freshCache(): IndexedDbOfflineCache {
  dbCounter += 1;
  const suffix = `${dbCounter}-${Math.random().toString(36).slice(2)}`;
  return new IndexedDbOfflineCache({
    store: createStore(`bossnyumba-test-${suffix}`, 'entities'),
  });
}

describe('IndexedDbOfflineCache', () => {
  let cache: IndexedDbOfflineCache;

  beforeEach(() => {
    cache = freshCache();
  });

  it('put + get round-trips a single entity', async () => {
    const e = ent('t1', 'rent', 'L1', 1, { rent: 1000 });
    await cache.put(e);
    const got = await cache.get<{ rent: number }>(e.key);
    expect(got?.data.rent).toBe(1000);
  });

  it('get returns null on a missing key', async () => {
    expect(await cache.get('tenant:nope:tab:x:entity:y')).toBeNull();
  });

  it('putBatch is a no-op for an empty array', async () => {
    await cache.putBatch([]);
    expect(await cache.list('t', 'x', 10)).toHaveLength(0);
  });

  it('putBatch inserts multiple entities', async () => {
    const batch = [
      ent('t1', 'rent', 'L1', 1, 'a'),
      ent('t1', 'rent', 'L2', 2, 'b'),
      ent('t1', 'rent', 'L3', 3, 'c'),
    ];
    await cache.putBatch(batch);
    const got = await cache.get(batch[0]!.key);
    expect(got?.data).toBe('a');
    const list = await cache.list<string>('t1', 'rent', 10);
    expect(list).toHaveLength(3);
  });

  it('list respects the limit and is tab-scoped', async () => {
    await cache.putBatch([
      ent('t1', 'rent', 'L1', 1, 1),
      ent('t1', 'rent', 'L2', 2, 2),
      ent('t1', 'maintenance', 'M1', 1, 'm'),
    ]);
    const rent = await cache.list<number>('t1', 'rent', 50);
    expect(rent).toHaveLength(2);
    const limited = await cache.list<number>('t1', 'rent', 1);
    expect(limited).toHaveLength(1);
  });

  it('list sorts most-recent-first by cachedAt', async () => {
    await cache.putBatch([
      ent('t1', 'rent', 'L1', 1, 'older'),
      ent('t1', 'rent', 'L2', 2, 'newer'),
    ]);
    const list = await cache.list<string>('t1', 'rent', 10);
    expect(list[0]?.data).toBe('newer');
    expect(list[1]?.data).toBe('older');
  });

  it('list never crosses tenant boundaries', async () => {
    await cache.putBatch([
      ent('tenant-A', 'x', 'E1', 1, 'A'),
      ent('tenant-B', 'x', 'E1', 1, 'B'),
    ]);
    const fromA = await cache.list<string>('tenant-A', 'x', 50);
    expect(fromA.every((e) => e.tenantId === 'tenant-A')).toBe(true);
  });

  it('list returns empty when limit is zero or negative', async () => {
    await cache.put(ent('t', 'x', 'E1', 1, 'a'));
    expect(await cache.list('t', 'x', 0)).toHaveLength(0);
    expect(await cache.list('t', 'x', -5)).toHaveLength(0);
  });

  it('evictTenant drops only that tenant', async () => {
    await cache.putBatch([
      ent('tenant-A', 'x', 'E1', 1, 'A'),
      ent('tenant-B', 'x', 'E1', 1, 'B'),
    ]);
    await cache.evictTenant('tenant-A');
    expect(await cache.list<string>('tenant-A', 'x', 50)).toHaveLength(0);
    expect(await cache.list<string>('tenant-B', 'x', 50)).toHaveLength(1);
  });

  it('evictTenant is a no-op when the tenant has no entries', async () => {
    await cache.evictTenant('ghost'); // does not throw
  });

  it('highWatermark returns max version for the tab', async () => {
    await cache.putBatch([
      ent('t', 'x', 'E1', 5, 'a'),
      ent('t', 'x', 'E2', 12, 'b'),
      ent('t', 'x', 'E3', 7, 'c'),
      ent('t', 'y', 'E1', 99, 'z'), // wrong tab — must be excluded
    ]);
    expect(await cache.highWatermark('t', 'x')).toBe(12);
  });

  it('highWatermark returns 0 for an empty tab', async () => {
    expect(await cache.highWatermark('t', 'never')).toBe(0);
  });
});
