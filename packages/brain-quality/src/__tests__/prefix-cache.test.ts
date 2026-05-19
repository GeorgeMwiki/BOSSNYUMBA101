import { describe, expect, it } from 'vitest';

import {
  PREFIX_CACHE_HIT_RATIO_TARGET,
  composePrompt,
  computePrefixHash,
  countPrefixTokens,
  createPrefixCache,
  toAnthropicBlocks,
  type PromptInputs,
} from '../prefix-cache/index.js';

function baseInputs(turn: string, lessons = ''): PromptInputs {
  return {
    systemPrompt: 'You are the BOSSNYUMBA brain.',
    constitution:
      'Never hard-code jurisdiction. Always check tenant residency before persisting.',
    toolManifest: ['create_ticket', 'lookup_lease', 'send_notice'],
    reflectionLessons: lessons,
    dynamicTurn: turn,
  };
}

describe('PrefixCache — Anthropic ephemeral cache_control', () => {
  it('composePrompt returns prefix + suffix', () => {
    const shape = composePrompt(baseInputs('hello'));
    expect(shape.prefix.length).toBeGreaterThanOrEqual(3);
    expect(shape.suffix.length).toBeGreaterThanOrEqual(1);
    expect(shape.prefix.every((s) => s.cacheable)).toBe(true);
    expect(shape.suffix.every((s) => !s.cacheable)).toBe(true);
  });

  it('composePrompt adds lessons segment when non-empty', () => {
    const shape = composePrompt(baseInputs('hello', '# lesson\n- be careful'));
    const lessonsSeg = shape.prefix.find((s) => s.id === 'lessons');
    expect(lessonsSeg).toBeDefined();
  });

  it('composePrompt omits lessons segment when empty', () => {
    const shape = composePrompt(baseInputs('hello', ''));
    const lessonsSeg = shape.prefix.find((s) => s.id === 'lessons');
    expect(lessonsSeg).toBeUndefined();
  });

  it('computePrefixHash is stable across identical inputs', () => {
    const h1 = computePrefixHash(composePrompt(baseInputs('turn-1')));
    const h2 = computePrefixHash(composePrompt(baseInputs('turn-2')));
    expect(h1).toBe(h2);
  });

  it('computePrefixHash changes when constitution changes', () => {
    const a = composePrompt(baseInputs('turn'));
    const b = composePrompt({ ...baseInputs('turn'), constitution: 'different' });
    expect(computePrefixHash(a)).not.toBe(computePrefixHash(b));
  });

  it('toAnthropicBlocks attaches cache_control only to cacheable prefix segments', () => {
    const blocks = toAnthropicBlocks(composePrompt(baseInputs('t')));
    const cached = blocks.filter((b) => b.cache_control?.type === 'ephemeral');
    expect(cached.length).toBeGreaterThan(0);
    const uncached = blocks.filter((b) => !b.cache_control);
    expect(uncached.length).toBeGreaterThan(0);
  });

  it('countPrefixTokens > 0 for any populated prefix', () => {
    expect(countPrefixTokens(composePrompt(baseInputs('x')))).toBeGreaterThan(0);
  });

  it('first observation of a shape is a miss', () => {
    const cache = createPrefixCache();
    const event = cache.observe('t1', composePrompt(baseInputs('hello')));
    expect(event.cacheHit).toBe(false);
    expect(event.cachedTokens).toBe(0);
  });

  it('second observation with same prefix is a hit', () => {
    const cache = createPrefixCache();
    cache.observe('t1', composePrompt(baseInputs('hello')));
    const event = cache.observe('t2', composePrompt(baseInputs('different turn')));
    expect(event.cacheHit).toBe(true);
    expect(event.cachedTokens).toBeGreaterThan(0);
    expect(event.cacheHitRatio).toBeGreaterThan(0);
  });

  it('cache.stats() reflects hit count', () => {
    const cache = createPrefixCache();
    for (let i = 0; i < 10; i += 1) {
      cache.observe(`turn-${i}`, composePrompt(baseInputs(`turn ${i}`)));
    }
    const stats = cache.stats();
    expect(stats.turns).toBe(10);
    expect(stats.hits).toBe(9);
    expect(stats.misses).toBe(1);
    expect(stats.meanHitRatio).toBeGreaterThanOrEqual(
      PREFIX_CACHE_HIT_RATIO_TARGET,
    );
  });

  it('cache.reset() clears everything', () => {
    const cache = createPrefixCache();
    cache.observe('t1', composePrompt(baseInputs('x')));
    cache.reset();
    expect(cache.stats().turns).toBe(0);
  });

  it('telemetry sink receives every event', () => {
    const events: string[] = [];
    const cache = createPrefixCache((e) => events.push(e.turnId));
    cache.observe('t1', composePrompt(baseInputs('hello')));
    cache.observe('t2', composePrompt(baseInputs('world')));
    expect(events).toEqual(['t1', 't2']);
  });

  it('sink errors do not break observe()', () => {
    const cache = createPrefixCache(() => {
      throw new Error('downstream failed');
    });
    expect(() =>
      cache.observe('t', composePrompt(baseInputs('x'))),
    ).not.toThrow();
  });
});
