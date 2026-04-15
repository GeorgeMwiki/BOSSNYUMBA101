import { describe, it, expect, vi } from 'vitest';
import {
  InMemoryIdempotencyStore,
  withIdempotency,
  deriveIdempotencyKey,
} from '../common/idempotency';

describe('InMemoryIdempotencyStore', () => {
  it('stores and retrieves values', async () => {
    const store = new InMemoryIdempotencyStore();
    await store.put('k', { a: 1 });
    expect(await store.get('k')).toEqual({ a: 1 });
  });

  it('expires entries past TTL', async () => {
    const store = new InMemoryIdempotencyStore();
    await store.put('k', 'v', 1);
    await new Promise((r) => setTimeout(r, 5));
    expect(await store.get('k')).toBeUndefined();
  });
});

describe('withIdempotency', () => {
  it('executes fn once and caches the result', async () => {
    const store = new InMemoryIdempotencyStore();
    const fn = vi.fn().mockResolvedValue(42);
    const a = await withIdempotency(store, 'x', fn);
    const b = await withIdempotency(store, 'x', fn);
    expect(a).toBe(42);
    expect(b).toBe(42);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does not cache failed results', async () => {
    const store = new InMemoryIdempotencyStore();
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValueOnce('ok');
    await expect(withIdempotency(store, 'y', fn)).rejects.toThrow('transient');
    const result = await withIdempotency(store, 'y', fn);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('deduplicates concurrent invocations of the same key', async () => {
    const store = new InMemoryIdempotencyStore();
    let invocations = 0;
    const fn = async (): Promise<string> => {
      invocations++;
      await new Promise((r) => setTimeout(r, 10));
      return 'done';
    };
    const [a, b] = await Promise.all([
      withIdempotency(store, 'c', fn),
      withIdempotency(store, 'c', fn),
    ]);
    expect(a).toBe('done');
    expect(b).toBe('done');
    expect(invocations).toBe(1);
  });
});

describe('deriveIdempotencyKey', () => {
  it('produces a stable key regardless of field order', () => {
    const a = deriveIdempotencyKey('mpesa', 'stk', { amount: 100, phone: '254700' });
    const b = deriveIdempotencyKey('mpesa', 'stk', { phone: '254700', amount: 100 });
    expect(a).toBe(b);
  });

  it('differs when payload differs', () => {
    const a = deriveIdempotencyKey('mpesa', 'stk', { amount: 100 });
    const b = deriveIdempotencyKey('mpesa', 'stk', { amount: 200 });
    expect(a).not.toBe(b);
  });
});
