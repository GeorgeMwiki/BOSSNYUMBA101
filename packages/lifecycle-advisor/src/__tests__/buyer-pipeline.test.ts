import { describe, expect, it } from 'vitest';
import {
  buildBuyerPipeline,
  scoreBuyers,
} from '../disposition/buyer-pipeline-builder.js';
import type { BuyerProfile } from '../types.js';

const buyers: ReadonlyArray<BuyerProfile> = [
  {
    id: 'I1',
    name: 'Mega Pension',
    tier: 'institutional',
    assetClassFit: 0.95,
    capRateAppetiteFit: 0.90,
    ticketSizeFit: 1.0,
    buyerPoolActivity: 0.85,
  },
  {
    id: 'I2',
    name: 'Sovereign Wealth',
    tier: 'institutional',
    assetClassFit: 0.90,
    capRateAppetiteFit: 0.85,
    ticketSizeFit: 1.0,
    buyerPoolActivity: 0.70,
  },
  {
    id: 'P1',
    name: 'Family Office X',
    tier: 'private-investor',
    assetClassFit: 0.70,
    capRateAppetiteFit: 0.65,
    ticketSizeFit: 0.80,
    buyerPoolActivity: 0.60,
  },
  {
    id: 'X1',
    name: 'Knight Frank Intl',
    tier: 'international-piri',
    assetClassFit: 0.50,
    capRateAppetiteFit: 0.40,
    ticketSizeFit: 0.30,
    buyerPoolActivity: 0.20,
  },
];

describe('buyer-pipeline-builder', () => {
  it('scores all buyers', () => {
    const s = scoreBuyers(buyers);
    expect(s).toHaveLength(4);
  });

  it('returns sorted scored list', () => {
    const p = buildBuyerPipeline('A-1', buyers);
    expect(p.scored[0]!.matchScore).toBeGreaterThanOrEqual(p.scored[1]!.matchScore);
    expect(p.scored[1]!.matchScore).toBeGreaterThanOrEqual(p.scored[2]!.matchScore);
  });

  it('selects top-2 tiers by tier average', () => {
    const p = buildBuyerPipeline('A-1', buyers);
    expect(p.top2Tiers).toHaveLength(2);
    expect(p.top2Tiers).toContain('institutional');
  });

  it('returns at least one marketing channel', () => {
    const p = buildBuyerPipeline('A-1', buyers);
    expect(p.suggestedMarketingChannels.length).toBeGreaterThan(0);
  });

  it('handles single-tier buyer pool', () => {
    const p = buildBuyerPipeline('A-1', [buyers[0]!]);
    expect(p.top2Tiers).toEqual(['institutional']);
  });
});
