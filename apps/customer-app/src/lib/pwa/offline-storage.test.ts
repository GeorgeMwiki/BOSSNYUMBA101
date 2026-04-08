/**
 * Vitest suite for the offline-storage module. Uses `fake-indexeddb` to get a
 * real in-memory IDB implementation inside Node so we can exercise the full
 * listing cache + mutation queue flows end-to-end.
 *
 * Required dev dep: `fake-indexeddb` (add to apps/customer-app/package.json
 * devDependencies before running `pnpm test`).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';

import {
  __resetOfflineStorageForTests,
  cacheListings,
  getCachedListings,
  clearCachedListings,
  enqueueMutation,
  getMutationQueue,
  getMutationQueueLength,
  flushMutationQueue,
  offlineAwareFetch,
} from './offline-storage';

// Re-open a fresh IndexedDB between tests by deleting the database.
async function resetDB() {
  __resetOfflineStorageForTests();
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase('bossnyumba-offline');
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}

describe('offline-storage: cached listings', () => {
  beforeEach(async () => {
    await resetDB();
  });

  it('stores and retrieves listings', async () => {
    await cacheListings([
      { id: '1', title: 'Listing One' },
      { id: '2', title: 'Listing Two' },
    ]);
    const rows = await getCachedListings();
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.id).sort()).toEqual(['1', '2']);
  });

  it('caps the cache at 50 entries (oldest evicted first)', async () => {
    const first = Array.from({ length: 30 }, (_, i) => ({
      id: `old-${i}`,
      title: `Old ${i}`,
    }));
    await cacheListings(first);

    // Second batch lands after a later timestamp.
    const now = Date.now();
    const dateSpy = vi.spyOn(Date, 'now').mockReturnValue(now + 10_000);
    const second = Array.from({ length: 30 }, (_, i) => ({
      id: `new-${i}`,
      title: `New ${i}`,
    }));
    await cacheListings(second);
    dateSpy.mockRestore();

    const rows = await getCachedListings();
    expect(rows.length).toBe(50);
    // All 30 "new-*" should survive; 20 oldest "old-*" should remain, 10 evicted.
    const newCount = rows.filter((r) => r.id.startsWith('new-')).length;
    expect(newCount).toBe(30);
  });

  it('clearCachedListings empties the store', async () => {
    await cacheListings([{ id: 'x', name: 'foo' }]);
    await clearCachedListings();
    expect(await getCachedListings()).toHaveLength(0);
  });
});

describe('offline-storage: mutation queue', () => {
  beforeEach(async () => {
    await resetDB();
  });

  it('enqueues and lists queued mutations in FIFO order', async () => {
    await enqueueMutation({
      url: '/api/listings',
      method: 'POST',
      body: { title: 'A' },
    });
    await enqueueMutation({
      url: '/api/listings/1',
      method: 'DELETE',
    });
    const queue = await getMutationQueue();
    expect(queue).toHaveLength(2);
    expect(queue[0].url).toBe('/api/listings');
    expect(queue[1].method).toBe('DELETE');
    expect(await getMutationQueueLength()).toBe(2);
  });

  it('flushMutationQueue replays in FIFO order and clears successful items', async () => {
    await enqueueMutation({
      url: '/api/a',
      method: 'POST',
      body: { k: 1 },
    });
    await enqueueMutation({
      url: '/api/b',
      method: 'PUT',
      body: { k: 2 },
    });

    const seen: string[] = [];
    const fakeFetch = vi.fn(async (url: RequestInfo | URL) => {
      seen.push(String(url));
      return new Response(null, { status: 200 });
    }) as unknown as typeof fetch;

    const result = await flushMutationQueue(fakeFetch);
    expect(result.flushed).toBe(2);
    expect(result.failed).toBe(0);
    expect(seen).toEqual(['/api/a', '/api/b']);
    expect(await getMutationQueueLength()).toBe(0);
  });

  it('keeps failed mutations in the queue with incremented attempts', async () => {
    await enqueueMutation({
      url: '/api/broken',
      method: 'POST',
      body: {},
    });
    const fakeFetch = vi.fn(
      async () => new Response(null, { status: 500 }),
    ) as unknown as typeof fetch;

    const result = await flushMutationQueue(fakeFetch);
    expect(result.failed).toBe(1);
    expect(result.flushed).toBe(0);

    const queue = await getMutationQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].attempts).toBe(1);
    expect(queue[0].lastError).toContain('500');
  });
});

describe('offline-storage: offlineAwareFetch', () => {
  beforeEach(async () => {
    await resetDB();
  });

  it('queues mutations when navigator reports offline and returns 202', async () => {
    const originalOnLine = Object.getOwnPropertyDescriptor(
      window.navigator,
      'onLine',
    );
    Object.defineProperty(window.navigator, 'onLine', {
      value: false,
      configurable: true,
    });

    try {
      const resp = await offlineAwareFetch('/api/listings', {
        method: 'POST',
        body: JSON.stringify({ title: 'Queued' }),
      });
      expect(resp.status).toBe(202);
      const body = await resp.json();
      expect(body.queued).toBe(true);
      expect(await getMutationQueueLength()).toBe(1);
    } finally {
      if (originalOnLine) {
        Object.defineProperty(window.navigator, 'onLine', originalOnLine);
      }
    }
  });

  it('passes through GET requests even when offline (no enqueue)', async () => {
    const originalOnLine = Object.getOwnPropertyDescriptor(
      window.navigator,
      'onLine',
    );
    Object.defineProperty(window.navigator, 'onLine', {
      value: false,
      configurable: true,
    });

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('ok', { status: 200 }));

    try {
      await offlineAwareFetch('/api/listings');
      expect(fetchSpy).toHaveBeenCalled();
      expect(await getMutationQueueLength()).toBe(0);
    } finally {
      fetchSpy.mockRestore();
      if (originalOnLine) {
        Object.defineProperty(window.navigator, 'onLine', originalOnLine);
      }
    }
  });
});
