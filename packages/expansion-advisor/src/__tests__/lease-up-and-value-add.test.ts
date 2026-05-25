import { describe, expect, it } from 'vitest';
import { leaseUpCurve } from '../leasing/lease-up-curves.js';
import { scoreValueAdd } from '../leasing/value-add-scorer.js';

describe('lease-up-curve', () => {
  it('multifamily reaches near-stabilised by month 18', () => {
    const c = leaseUpCurve({ assetClass: 'multifamily', horizonMonths: 36 });
    expect(c.points[18].occupied).toBeGreaterThan(0.85);
  });

  it('land never absorbs', () => {
    const c = leaseUpCurve({ assetClass: 'land', horizonMonths: 60 });
    expect(c.points.every((p) => p.occupied === 0)).toBe(true);
  });

  it('industrial outpaces office at month 12', () => {
    const ind = leaseUpCurve({ assetClass: 'industrial', horizonMonths: 24 });
    const off = leaseUpCurve({ assetClass: 'office', horizonMonths: 24 });
    expect(ind.points[12].occupied).toBeGreaterThan(off.points[12].occupied);
  });

  it('respects override midpoint', () => {
    const c = leaseUpCurve({
      assetClass: 'multifamily',
      horizonMonths: 36,
      overrides: { midpointMonths: 24 },
    });
    expect(c.midpointMonths).toBe(24);
  });
});

describe('value-add-scorer', () => {
  it('zero on a fully-priced building', () => {
    const r = scoreValueAdd({
      compRentPerSqm: 20,
      inPlaceRentPerSqm: 20,
      annualTurnoverPct: 0.2,
      compOperatingExpenseRatio: 0.35,
      actualOperatingExpenseRatio: 0.35,
      capexCatchUpScore: 0,
    });
    expect(r.total).toBeCloseTo(0, 6);
  });

  it('high on a mis-managed asset', () => {
    const r = scoreValueAdd({
      compRentPerSqm: 30,
      inPlaceRentPerSqm: 15,
      annualTurnoverPct: 0.3,
      compOperatingExpenseRatio: 0.30,
      actualOperatingExpenseRatio: 0.45,
      capexCatchUpScore: 0.8,
    });
    expect(r.total).toBeGreaterThan(0.3);
  });

  it('clamps all sub-scores to [0,1]', () => {
    const r = scoreValueAdd({
      compRentPerSqm: 30,
      inPlaceRentPerSqm: 1,
      annualTurnoverPct: 5,
      compOperatingExpenseRatio: 0.50,
      actualOperatingExpenseRatio: 0,
      capexCatchUpScore: 999,
    });
    expect(r.rentGapScore).toBeLessThanOrEqual(1);
    expect(r.turnoverScore).toBeLessThanOrEqual(1);
    expect(r.expenseEfficiencyScore).toBeLessThanOrEqual(1);
    expect(r.capexScore).toBeLessThanOrEqual(1);
  });
});
