import { describe, expect, it } from 'vitest';
import {
  evaluateFinalAcceptance,
  evaluateSubstantialCompletion,
} from '../development/punch-list-acceptance.js';

describe('punch-list-acceptance: SC', () => {
  it('accepts SC when within all tolerances', () => {
    const r = evaluateSubstantialCompletion({
      grossSqm: 10_000,
      assetClass: 'multifamily',
      items: [
        { category: 'cosmetic', count: 30 }, // 0.3/100sqm
        { category: 'mechanical', count: 10 }, // 0.1
        { category: 'life-safety', count: 0 },
      ],
    });
    expect(r.accepted).toBe(true);
    expect(r.stage).toBe('substantial-completion');
  });

  it('rejects SC on any life-safety defect', () => {
    const r = evaluateSubstantialCompletion({
      grossSqm: 10_000,
      assetClass: 'office',
      items: [
        { category: 'life-safety', count: 1 },
      ],
    });
    expect(r.accepted).toBe(false);
    expect(r.blockers.some((b) => b.includes('life-safety'))).toBe(true);
  });

  it('rejects SC on cosmetic over tolerance', () => {
    const r = evaluateSubstantialCompletion({
      grossSqm: 1000,
      assetClass: 'multifamily',
      items: [
        { category: 'cosmetic', count: 10 }, // 1.0/100sqm > 0.5
      ],
    });
    expect(r.accepted).toBe(false);
    expect(r.blockers.some((b) => b.includes('cosmetic'))).toBe(true);
  });
});

describe('punch-list-acceptance: final', () => {
  it('accepts final when total ≤ 0.1/100sqm and no life-safety', () => {
    const r = evaluateFinalAcceptance({
      grossSqm: 10_000,
      assetClass: 'multifamily',
      items: [
        { category: 'cosmetic', count: 5 }, // 0.05
        { category: 'mechanical', count: 4 }, // 0.04
      ],
    });
    expect(r.accepted).toBe(true);
  });

  it('rejects final when total > 0.1/100sqm', () => {
    const r = evaluateFinalAcceptance({
      grossSqm: 10_000,
      assetClass: 'office',
      items: [
        { category: 'cosmetic', count: 50 }, // 0.5/100sqm
      ],
    });
    expect(r.accepted).toBe(false);
  });

  it('rejects final on any life-safety', () => {
    const r = evaluateFinalAcceptance({
      grossSqm: 50_000,
      assetClass: 'office',
      items: [
        { category: 'life-safety', count: 1 },
      ],
    });
    expect(r.accepted).toBe(false);
  });
});
