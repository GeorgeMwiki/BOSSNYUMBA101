import { describe, expect, it } from 'vitest';
import { analyzeFeasibility } from '../development/feasibility-analyzer.js';
import type { FeasibilityInputs } from '../types.js';

const passing: FeasibilityInputs = {
  assetId: 'PASS-1',
  totalDevelopmentCost: 100_000_000,
  stabilisedNOI: 10_500_000, // YoC = 10.5%
  goingInCapRate: 0.075, // spread 300 bps
  hurdleIRR: 0.12,
  projectIRR: 0.18, // spread 600 bps
  peakEquity: 30_000_000,
  ownerEquityCapacity: 50_000_000, // 60% of pocket
  hardContingencyPct: 0.08,
  softContingencyPct: 0.12,
  ltc: 0.65,
  ltv: 0.55,
};

describe('feasibility-analyzer', () => {
  it('returns go verdict when all gates pass', () => {
    const r = analyzeFeasibility(passing);
    expect(r.verdict).toBe('go');
    expect(r.failingGates).toHaveLength(0);
    expect(r.untrendedYieldOnCost).toBeCloseTo(0.105, 4);
  });

  it('returns conditional-go when a single gate fails', () => {
    const r = analyzeFeasibility({ ...passing, ltc: 0.80 });
    expect(r.verdict).toBe('conditional-go');
    expect(r.failingGates).toEqual(['ltc-cap']);
  });

  it('returns redesign when multiple gates fail', () => {
    const r = analyzeFeasibility({ ...passing, ltc: 0.85, ltv: 0.75 });
    expect(r.verdict).toBe('redesign');
    expect(r.failingGates.length).toBeGreaterThanOrEqual(2);
  });

  it('flags failing yield arbitrage', () => {
    const r = analyzeFeasibility({ ...passing, stabilisedNOI: 7_500_000 });
    expect(r.failingGates).toContain('positive-yield-arbitrage');
  });

  it('flags failing equity cushion', () => {
    const r = analyzeFeasibility({ ...passing, peakEquity: 49_000_000 });
    expect(r.failingGates).toContain('equity-pocket-cushion');
  });

  it('throws on zero total development cost', () => {
    expect(() => analyzeFeasibility({ ...passing, totalDevelopmentCost: 0 })).toThrow();
  });

  it('flags failing hard contingency', () => {
    const r = analyzeFeasibility({ ...passing, hardContingencyPct: 0.04 });
    expect(r.failingGates).toContain('hard-contingency-floor');
  });

  it('flags failing soft contingency', () => {
    const r = analyzeFeasibility({ ...passing, softContingencyPct: 0.05 });
    expect(r.failingGates).toContain('soft-contingency-floor');
  });
});
