import { describe, expect, it } from 'vitest';
import { optimiseCapitalStack } from '../capital/capital-stack-optimizer.js';
import type { StackInputs } from '../types.js';

const baseInput = (over: Partial<StackInputs> = {}): StackInputs => ({
  totalCost: 10_000_000,
  stabilisedNOI: 900_000,
  stabilisedValue: 11_000_000,
  tiers: [
    { tier: 'seniorDebt', maxShareOfCost: 0.60, rate: 0.06 },
    { tier: 'mezzanine', maxShareOfCost: 0.15, rate: 0.11 },
    { tier: 'preferredEquity', maxShareOfCost: 0.10, rate: 0.09 },
    { tier: 'commonEquity', maxShareOfCost: 1.0, rate: 0.15 },
  ],
  constraints: {
    minDscr: 1.20,
    minIcr: 1.20,
    maxLtc: 0.75,
    maxLtv: 0.70,
    minYieldOnCost: 0.08,
  },
  ...over,
});

describe('capital-stack-optimizer', () => {
  it('fills cheapest tier first', () => {
    const r = optimiseCapitalStack(baseInput());
    const senior = r.tiers.find((t) => t.tier === 'seniorDebt');
    expect(senior?.amount).toBe(6_000_000);
  });

  it('sums tiers to total cost', () => {
    const r = optimiseCapitalStack(baseInput());
    const sum = r.tiers.reduce((a, s) => a + s.amount, 0);
    expect(sum).toBeCloseTo(10_000_000, 2);
  });

  it('computes DSCR correctly', () => {
    const r = optimiseCapitalStack(baseInput());
    expect(r.dscr).toBeGreaterThan(1.20);
  });

  it('computes LTC and LTV inside ceilings', () => {
    const r = optimiseCapitalStack(baseInput());
    expect(r.ltc).toBeLessThanOrEqual(0.75);
    expect(r.ltv).toBeLessThanOrEqual(0.70);
  });

  it('throws when DSCR floor is violated', () => {
    expect(() =>
      optimiseCapitalStack(
        baseInput({
          stabilisedNOI: 100_000,
          constraints: {
            minDscr: 1.50,
            minIcr: 1.20,
            maxLtc: 0.75,
            maxLtv: 0.70,
            minYieldOnCost: 0.01,
          },
        }),
      ),
    ).toThrow(/DSCR/);
  });

  it('throws when YoC floor is violated', () => {
    expect(() =>
      optimiseCapitalStack(
        baseInput({
          stabilisedNOI: 100_000,
          constraints: {
            minDscr: 0.1,
            minIcr: 0.1,
            maxLtc: 0.9,
            maxLtv: 0.9,
            minYieldOnCost: 0.20,
          },
        }),
      ),
    ).toThrow(/YoC/);
  });

  it('throws when tiers cannot fund total cost', () => {
    expect(() =>
      optimiseCapitalStack(
        baseInput({
          tiers: [
            { tier: 'seniorDebt', maxShareOfCost: 0.50, rate: 0.06 },
            { tier: 'mezzanine', maxShareOfCost: 0.10, rate: 0.11 },
          ],
        }),
      ),
    ).toThrow(/insufficient/);
  });

  it('throws when totalCost is non-positive', () => {
    expect(() => optimiseCapitalStack(baseInput({ totalCost: 0 }))).toThrow();
  });
});
