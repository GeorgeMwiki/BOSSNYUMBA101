import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TTL_SECONDS,
  ONE_HOUR_OPT_IN_SNIPPET,
  betasForCacheTtl,
  summariseCacheUtilization,
  wrapStablePrefix,
  wrapStablePrefixes,
} from './cache-control.js';

describe('wrapStablePrefix', () => {
  it('defaults to 1h TTL', () => {
    const seg = wrapStablePrefix('SYSTEM_PROMPT');
    expect(seg.cache_control.ttl_seconds).toBe(3600);
    expect(seg.cache_control.type).toBe('ephemeral');
  });

  it('respects an explicit 5min override', () => {
    const seg = wrapStablePrefix('TEMPLATE', { ttlSeconds: 300 });
    expect(seg.cache_control.ttl_seconds).toBe(300);
  });

  it('exposes DEFAULT_TTL_SECONDS = 3600', () => {
    expect(DEFAULT_TTL_SECONDS).toBe(3600);
  });
});

describe('wrapStablePrefixes', () => {
  it('wraps multiple segments', () => {
    const segs = wrapStablePrefixes(['a', 'b', 'c']);
    expect(segs).toHaveLength(3);
    expect(segs.every((s) => s.cache_control.ttl_seconds === 3600)).toBe(true);
  });

  it('enforces 4-breakpoint limit', () => {
    expect(() => wrapStablePrefixes(['a', 'b', 'c', 'd', 'e'])).toThrow(
      /4 cache_control breakpoints/i,
    );
  });
});

describe('betasForCacheTtl', () => {
  it('returns extended-cache-ttl beta for 1h', () => {
    expect(betasForCacheTtl(3600)).toEqual(['extended-cache-ttl-2025-04-11']);
  });

  it('returns empty array for 5min default', () => {
    expect(betasForCacheTtl(300)).toEqual([]);
  });
});

describe('summariseCacheUtilization', () => {
  it('computes hit rate', () => {
    const t = summariseCacheUtilization({
      cacheCreationTokens: 100,
      cacheReadTokens: 900,
      ttlSeconds: 3600,
      model: 'claude-opus-4-7',
      correlationId: 'corr-1',
      elapsedMs: 60_000,
    });
    expect(t.hitRate).toBeCloseTo(0.9, 3);
  });

  it('reports would5MinHaveEvicted when 5min ttl + elapsedMs > 5min', () => {
    const t = summariseCacheUtilization({
      cacheCreationTokens: 100,
      cacheReadTokens: 0,
      ttlSeconds: 300,
      model: 'claude-sonnet-4-6',
      correlationId: 'corr-1',
      elapsedMs: 6 * 60_000,
    });
    expect(t.would5MinHaveEvicted).toBe(true);
  });

  it('does NOT report would5MinHaveEvicted when 1h ttl is used', () => {
    const t = summariseCacheUtilization({
      cacheCreationTokens: 100,
      cacheReadTokens: 0,
      ttlSeconds: 3600,
      model: 'claude-sonnet-4-6',
      correlationId: 'corr-1',
      elapsedMs: 30 * 60_000,
    });
    expect(t.would5MinHaveEvicted).toBe(false);
  });

  it('returns 0 hit rate when no cache tokens at all', () => {
    const t = summariseCacheUtilization({
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
      ttlSeconds: 3600,
      model: 'claude-haiku-4-5',
      correlationId: 'c',
      elapsedMs: 0,
    });
    expect(t.hitRate).toBe(0);
  });
});

describe('ONE_HOUR_OPT_IN_SNIPPET', () => {
  it('contains the canonical wrapStablePrefix import + ttl_seconds=3600', () => {
    expect(ONE_HOUR_OPT_IN_SNIPPET).toContain('wrapStablePrefix');
    expect(ONE_HOUR_OPT_IN_SNIPPET).toContain('ttl_seconds: 3600');
    expect(ONE_HOUR_OPT_IN_SNIPPET).toContain('extended-cache-ttl-2025-04-11');
  });
});
