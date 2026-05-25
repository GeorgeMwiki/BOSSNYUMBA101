import { describe, expect, it } from 'vitest';
import { irr, irrNpv, npv } from '../capital/irr-npv.js';

describe('irr-npv: NPV', () => {
  it('discounts a single future cash flow correctly', () => {
    expect(npv(0.1, [0, 110])).toBeCloseTo(100, 6);
  });

  it('handles zero discount rate as plain sum', () => {
    expect(npv(0, [-100, 50, 50, 50])).toBe(50);
  });

  it('handles entirely negative cash flows', () => {
    expect(npv(0.05, [-100, -50, -25])).toBeLessThan(-100);
  });
});

describe('irr-npv: IRR', () => {
  it('finds 10% IRR for textbook -100, +110 series', () => {
    expect(irr([-100, 110])).toBeCloseTo(0.10, 4);
  });

  it('returns NaN for series with no sign change', () => {
    expect(irr([100, 100, 100])).toBeNaN();
    expect(irr([-100, -100, -100])).toBeNaN();
  });

  it('returns NaN for series shorter than 2', () => {
    expect(irr([-100])).toBeNaN();
  });

  it('handles realistic real-estate dev cash flow', () => {
    const cf = [-1_000_000, 60_000, 60_000, 60_000, 60_000, 60_000 + 1_300_000];
    const r = irr(cf);
    expect(r).toBeGreaterThan(0.05);
    expect(r).toBeLessThan(0.20);
  });

  it('irrNpv returns both metrics', () => {
    const out = irrNpv({ cashflows: [-100, 110], discountRatePerPeriod: 0.05 });
    expect(out.npv).toBeCloseTo(4.7619, 3);
    expect(out.irr).toBeCloseTo(0.10, 4);
  });

  it('clamps absurd inputs without throwing', () => {
    expect(() => irr([-1, 0.0001, 0.0001])).not.toThrow();
  });
});
