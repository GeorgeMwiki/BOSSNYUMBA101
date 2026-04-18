/**
 * Idempotency in-memory store — cache hit behavior (SCAFFOLDED 10)
 */

import { describe, it, expect } from 'vitest';
import {
  createInMemoryIdempotencyStore,
  type CachedResponse,
} from '../middleware/idempotency.js';

describe('createInMemoryIdempotencyStore', () => {
  it('returns undefined when key missing', async () => {
    const store = createInMemoryIdempotencyStore();
    const got = await store.get('missing');
    expect(got).toBeUndefined();
  });

  it('returns the cached value within TTL', async () => {
    const store = createInMemoryIdempotencyStore();
    const entry: CachedResponse = {
      status: 201,
      body: { ok: true },
      headers: { 'content-type': 'application/json' },
      cachedAt: Date.now(),
    };
    await store.set('k1', entry, 1000);
    const got = await store.get('k1');
    expect(got).toEqual(entry);
  });

  it('expires entries past TTL', async () => {
    const store = createInMemoryIdempotencyStore();
    await store.set('k2', { status: 200, body: {}, headers: {}, cachedAt: 0 }, 0);
    // TTL 0 → immediately expired on next get (we use Date.now() >= expiresAt)
    const got = await store.get('k2');
    expect(got).toBeUndefined();
  });
});
