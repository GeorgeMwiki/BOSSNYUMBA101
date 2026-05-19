/**
 * InMemoryVerdictCache — LRU + TTL behaviour.
 */

import { describe, it, expect } from 'vitest';
import { InMemoryVerdictCache } from '../in-memory-cache.js';
import type { ClassifierVerdict } from '../types.js';

const SAFE: ClassifierVerdict = {
  verdict: 'safe',
  reason: 'ok',
  recommendPlanMode: false,
};

describe('InMemoryVerdictCache', () => {
  it('returns null on miss', () => {
    const c = new InMemoryVerdictCache();
    expect(c.get('nope')).toBeNull();
  });

  it('stores + retrieves a verdict', () => {
    const c = new InMemoryVerdictCache();
    c.set('k1', SAFE, 1000);
    expect(c.get('k1')).toEqual(SAFE);
  });

  it('expires entries after TTL', () => {
    let now = 1000;
    const c = new InMemoryVerdictCache({ now: () => now });
    c.set('k1', SAFE, 500);
    now = 1499;
    expect(c.get('k1')).toEqual(SAFE);
    now = 1501;
    expect(c.get('k1')).toBeNull();
  });

  it('does not store with non-positive TTL', () => {
    const c = new InMemoryVerdictCache();
    c.set('k1', SAFE, 0);
    expect(c.get('k1')).toBeNull();
  });

  it('evicts oldest entry when capacity exceeded', () => {
    const c = new InMemoryVerdictCache({ capacity: 2 });
    c.set('a', SAFE, 10_000);
    c.set('b', SAFE, 10_000);
    c.set('c', SAFE, 10_000);
    expect(c.get('a')).toBeNull();
    expect(c.get('b')).not.toBeNull();
    expect(c.get('c')).not.toBeNull();
  });

  it('treats a get as an LRU touch', () => {
    const c = new InMemoryVerdictCache({ capacity: 2 });
    c.set('a', SAFE, 10_000);
    c.set('b', SAFE, 10_000);
    // touch a so it becomes most-recent
    c.get('a');
    c.set('c', SAFE, 10_000);
    // b (least recent) should have been evicted
    expect(c.get('b')).toBeNull();
    expect(c.get('a')).not.toBeNull();
    expect(c.get('c')).not.toBeNull();
  });
});
