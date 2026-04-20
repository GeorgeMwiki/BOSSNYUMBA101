/**
 * Unit tests for the offline queue used by the station-master flow.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  enqueue,
  pendingCount,
  clearQueue,
  drain,
} from '../offline-queue';

describe('offline-queue', () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    storage.clear();
    // Minimal localStorage shim for node.
    const ls = {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => {
        storage.set(k, v);
      },
      removeItem: (k: string) => {
        storage.delete(k);
      },
      clear: () => storage.clear(),
    };
    vi.stubGlobal('window', {
      localStorage: ls,
      navigator: { onLine: true },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    vi.stubGlobal('localStorage', ls);
    vi.stubGlobal('navigator', { onLine: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('enqueue pushes jobs and pendingCount grows', () => {
    enqueue({ path: '/a', method: 'POST', body: { x: 1 } });
    enqueue({ path: '/b', method: 'POST', body: { y: 2 } });
    expect(pendingCount()).toBe(2);
  });

  it('clearQueue empties the stored queue', () => {
    enqueue({ path: '/a', method: 'POST', body: {} });
    clearQueue();
    expect(pendingCount()).toBe(0);
  });

  it('drain posts each job with X-Client-Job-Id and empties the queue on success', async () => {
    const id1 = enqueue({ path: '/work-orders/close', method: 'POST', body: { a: 1 } });
    const id2 = enqueue({ path: '/work-orders/close', method: 'POST', body: { a: 2 } });
    expect(pendingCount()).toBe(2);

    const calls: Array<{ url: string; jobId: string | null }> = [];
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const headers = (init?.headers ?? {}) as Record<string, string>;
      calls.push({ url, jobId: headers['X-Client-Job-Id'] ?? null });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await drain({
      apiBaseUrl: 'https://api.example/api/v1',
      authToken: 'tok',
    });
    expect(res.drained).toBe(2);
    expect(pendingCount()).toBe(0);
    expect(calls.map((c) => c.jobId)).toEqual([id1, id2]);
    expect(calls[0].url).toContain('/work-orders/close');
  });

  it('drain leaves remaining jobs in place when the network throws', async () => {
    enqueue({ path: '/a', method: 'POST', body: {} });
    enqueue({ path: '/b', method: 'POST', body: {} });

    let firstCall = true;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        if (firstCall) {
          firstCall = false;
          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        }
        throw new Error('ECONNREFUSED');
      }),
    );

    const res = await drain({ apiBaseUrl: 'https://api.example' });
    expect(res.drained).toBe(1);
    expect(pendingCount()).toBe(1);
  });

  it('drain drops jobs that hit a non-2xx server response (avoid poison queue)', async () => {
    enqueue({ path: '/a', method: 'POST', body: {} });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('bad', { status: 400 })),
    );
    const res = await drain({ apiBaseUrl: 'https://api.example' });
    expect(res.drained).toBe(0);
    expect(res.failed.length).toBe(1);
    expect(pendingCount()).toBe(0);
  });
});
