import { describe, expect, it } from 'vitest';
import { yieldOnCost } from '../capital/yield-on-cost.js';

describe('yield-on-cost', () => {
  it('computes basic YoC correctly', () => {
    const r = yieldOnCost({
      stabilisedNOI: 1_000_000,
      totalCost: 10_000_000,
      marketCapRate: 0.08,
    });
    expect(r.yieldOnCost).toBeCloseTo(0.10, 6);
    expect(r.spread).toBeCloseTo(0.02, 6);
    expect(r.meetsThreshold).toBe(true);
  });

  it('reports failure when spread below required', () => {
    const r = yieldOnCost({
      stabilisedNOI: 80_000,
      totalCost: 1_000_000,
      marketCapRate: 0.08,
    });
    expect(r.meetsThreshold).toBe(false);
  });

  it('honours custom requiredSpread', () => {
    const r = yieldOnCost({
      stabilisedNOI: 100_000,
      totalCost: 1_000_000,
      marketCapRate: 0.08,
      requiredSpread: 0.005,
    });
    expect(r.threshold).toBeCloseTo(0.085, 6);
    expect(r.meetsThreshold).toBe(true);
  });

  it('throws when totalCost <= 0', () => {
    expect(() =>
      yieldOnCost({ stabilisedNOI: 0, totalCost: 0, marketCapRate: 0.08 }),
    ).toThrow(/positive/);
  });
});
