/**
 * Broker selector — qualification matrix per NAR Commercial /
 * CCIM 2024 weighting.
 *
 * Weights:
 *   - track record (closed deals) 30 %
 *   - asset-class book share      20 %
 *   - buyer-pool match            20 %
 *   - marketing budget            10 %
 *   - submarket years             10 %
 *   - co-broker willingness       10 %
 *
 * Top-2 advance to BOV bake-off.
 */

import type { BrokerCandidate, BrokerScore, BrokerSelection } from '../types.js';

const WEIGHTS = {
  trackRecord: 0.30,
  assetClassBook: 0.20,
  buyerPool: 0.20,
  marketingBudget: 0.10,
  submarketYears: 0.10,
  coBroker: 0.10,
} as const;

const SUBMARKET_YEARS_PEAK = 20;

function normaliseYears(years: number): number {
  if (years <= 0) return 0;
  return Math.min(1, years / SUBMARKET_YEARS_PEAK);
}

export function scoreBrokers(
  candidates: ReadonlyArray<BrokerCandidate>,
): ReadonlyArray<BrokerScore> {
  if (candidates.length === 0) return [];
  const scored = candidates.map((c) => {
    const trackScore = c.maxComparableClosedDeals > 0
      ? c.comparableClosedDeals / c.maxComparableClosedDeals
      : 0;
    const total =
      WEIGHTS.trackRecord * trackScore +
      WEIGHTS.assetClassBook * c.assetClassBookShare +
      WEIGHTS.buyerPool * c.buyerPoolMatch +
      WEIGHTS.marketingBudget * c.marketingBudgetShare +
      WEIGHTS.submarketYears * normaliseYears(c.submarketYears) +
      WEIGHTS.coBroker * (c.coBrokerWilling ? 1 : 0);
    return {
      id: c.id,
      firm: c.firm,
      total,
      rank: 0,
    };
  });
  const sorted = [...scored].sort((a, b) => b.total - a.total);
  return sorted.map((s, i) => ({ ...s, rank: i + 1 }));
}

export function selectBroker(
  assetId: string,
  candidates: ReadonlyArray<BrokerCandidate>,
): BrokerSelection {
  const ranked = scoreBrokers(candidates);
  const bakeOff = ranked.slice(0, Math.min(2, ranked.length));
  return {
    assetId,
    ranked,
    bovBakeOff: bakeOff,
  };
}
