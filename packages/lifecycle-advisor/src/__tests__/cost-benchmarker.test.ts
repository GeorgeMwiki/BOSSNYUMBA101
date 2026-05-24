import { describe, expect, it } from 'vitest';
import { benchmarkCost, listKnownRegions } from '../development/cost-benchmarker.js';

describe('cost-benchmarker', () => {
  it('passes within-band for Nairobi mid-rise residential at index', () => {
    const r = benchmarkCost({
      region: 'nairobi',
      assetClass: 'multifamily',
      floors: 5,
      grossSqm: 8000,
      quoteUsdPerSqm: 1150,
    });
    expect(r.verdict).toBe('within-band');
    expect(r.indexUsdPerSqm).toBe(1150);
  });

  it('flags reject for +30 % variance', () => {
    const r = benchmarkCost({
      region: 'nairobi',
      assetClass: 'multifamily',
      floors: 5,
      grossSqm: 8000,
      quoteUsdPerSqm: 1500,
    });
    expect(r.verdict).toBe('reject');
  });

  it('flags high-flag for +15 % variance', () => {
    const r = benchmarkCost({
      region: 'nairobi',
      assetClass: 'multifamily',
      floors: 5,
      grossSqm: 8000,
      quoteUsdPerSqm: 1325,
    });
    expect(r.verdict).toBe('high-flag');
  });

  it('flags low-flag for -15 % variance', () => {
    const r = benchmarkCost({
      region: 'us-tier-1',
      assetClass: 'multifamily',
      floors: 6,
      grossSqm: 10_000,
      quoteUsdPerSqm: 3200,
    });
    expect(r.verdict).toBe('low-flag');
  });

  it('applies high-rise floor premium', () => {
    const r = benchmarkCost({
      region: 'us-tier-1',
      assetClass: 'multifamily',
      floors: 20,
      grossSqm: 20_000,
      quoteUsdPerSqm: 4000,
    });
    expect(r.indexUsdPerSqm).toBeGreaterThan(3800);
  });

  it('lists known regions', () => {
    const list = listKnownRegions();
    expect(list).toContain('nairobi');
    expect(list).toContain('dar-es-salaam');
    expect(list).toContain('kampala');
  });

  it('throws on unknown region', () => {
    expect(() => benchmarkCost({
      // @ts-expect-error invalid for test
      region: 'mars',
      assetClass: 'multifamily',
      floors: 5,
      grossSqm: 1000,
      quoteUsdPerSqm: 100,
    })).toThrow();
  });
});
