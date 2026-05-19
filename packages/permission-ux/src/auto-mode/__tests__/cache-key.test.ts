/**
 * deriveCacheKey — canonicalises tool + args + tenant. Same logical
 * call -> same key, regardless of key ordering or whitespace.
 */

import { describe, it, expect } from 'vitest';
import { deriveCacheKey } from '../cache-key.js';
import type { ClassifierInput } from '../types.js';

function baseInput(args: Record<string, unknown>): ClassifierInput {
  return {
    toolName: 'send_sms_blast',
    args,
    tier: 'external-comm',
    recentTurns: [],
    statedBoundaries: [],
    tenantId: 't1',
  };
}

describe('deriveCacheKey', () => {
  it('produces a stable key for identical args regardless of ordering', () => {
    const k1 = deriveCacheKey(baseInput({ b: 2, a: 1 }));
    const k2 = deriveCacheKey(baseInput({ a: 1, b: 2 }));
    expect(k1).toBe(k2);
  });

  it('differentiates by toolName', () => {
    const k1 = deriveCacheKey(baseInput({ a: 1 }));
    const k2 = deriveCacheKey({ ...baseInput({ a: 1 }), toolName: 'other' });
    expect(k1).not.toBe(k2);
  });

  it('differentiates by tenant', () => {
    const k1 = deriveCacheKey(baseInput({ a: 1 }));
    const k2 = deriveCacheKey({ ...baseInput({ a: 1 }), tenantId: 't2' });
    expect(k1).not.toBe(k2);
  });

  it('handles nested objects + arrays consistently', () => {
    const k1 = deriveCacheKey(
      baseInput({ x: { c: 3, a: 1 }, list: [1, 2, 3] }),
    );
    const k2 = deriveCacheKey(
      baseInput({ list: [1, 2, 3], x: { a: 1, c: 3 } }),
    );
    expect(k1).toBe(k2);
  });

  it('handles null/undefined identically', () => {
    const k1 = deriveCacheKey(baseInput({ a: null }));
    const k2 = deriveCacheKey(baseInput({ a: undefined as unknown as null }));
    expect(k1).toBe(k2);
  });

  it('ignores recentTurns + statedBoundaries (so cache hits across turns)', () => {
    const k1 = deriveCacheKey({
      ...baseInput({ a: 1 }),
      recentTurns: ['hi', 'there'],
      statedBoundaries: ['do not send'],
    });
    const k2 = deriveCacheKey({
      ...baseInput({ a: 1 }),
      recentTurns: ['totally', 'different'],
      statedBoundaries: [],
    });
    expect(k1).toBe(k2);
  });
});
