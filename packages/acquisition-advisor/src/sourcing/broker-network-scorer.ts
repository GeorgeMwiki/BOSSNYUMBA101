/**
 * Broker network scorer — per-broker composite score on the
 * institutional-acquisitions five-axis basis. Pure function.
 *
 * Heuristics drawn from NMHC Broker Cooperation Study 2024,
 * ALN Marketed-vs-Pocket Trade Velocity 2024, CBRE Capital
 * Markets Talent Report 2024.
 *
 * Composite =
 *   0.30 · closeRatio_n  +
 *   0.20 · daysToClose_n (inverted — lower days is better) +
 *   0.15 · repricingInverse_n  +
 *   0.20 · poolDepth_n  +
 *   0.15 · offMarketShare_n
 */

import type { BrokerProfile, BrokerScore } from '../types.js';

const WEIGHTS = {
  closeRatio: 0.30,
  daysToClose: 0.20,
  repricing: 0.15,
  poolDepth: 0.20,
  offMarket: 0.15,
} as const;

/** Normalization anchors (best-in-class observed). */
const ANCHORS = {
  closeRatio: 0.75,
  bestDaysToClose: 90,
  worstDaysToClose: 365,
  worstRepricingRate: 0.5,
  bestPoolDepth: 50,
  bestOffMarketShare: 0.5,
} as const;

export function scoreBroker(broker: Readonly<BrokerProfile>): BrokerScore {
  validate(broker);

  const closeRatioN = clamp01(broker.closeRatio / ANCHORS.closeRatio);
  const daysN = clamp01(
    (ANCHORS.worstDaysToClose - broker.daysToClose) /
      (ANCHORS.worstDaysToClose - ANCHORS.bestDaysToClose),
  );
  const repricingN = clamp01(
    1 - broker.repricingRate / ANCHORS.worstRepricingRate,
  );
  const poolN = clamp01(broker.buyerPoolDepth / ANCHORS.bestPoolDepth);
  const offMarketN = clamp01(broker.offMarketShare / ANCHORS.bestOffMarketShare);

  const breakdown = {
    closeRatioContribution: WEIGHTS.closeRatio * closeRatioN,
    daysToCloseContribution: WEIGHTS.daysToClose * daysN,
    repricingContribution: WEIGHTS.repricing * repricingN,
    poolDepthContribution: WEIGHTS.poolDepth * poolN,
    offMarketContribution: WEIGHTS.offMarket * offMarketN,
  };

  const composite =
    breakdown.closeRatioContribution +
    breakdown.daysToCloseContribution +
    breakdown.repricingContribution +
    breakdown.poolDepthContribution +
    breakdown.offMarketContribution;

  return {
    broker,
    composite,
    breakdown,
    tier: composite >= 0.70 ? 'tier-1' : composite >= 0.45 ? 'tier-2' : 'tier-3',
  };
}

export function rankBrokers(
  brokers: ReadonlyArray<BrokerProfile>,
): ReadonlyArray<BrokerScore> {
  return brokers.map(scoreBroker).slice().sort((a, b) => b.composite - a.composite);
}

function validate(b: BrokerProfile): void {
  if (b.closeRatio < 0 || b.closeRatio > 1) {
    throw new Error(`broker ${b.id}: closeRatio must be in [0,1]`);
  }
  if (b.repricingRate < 0 || b.repricingRate > 1) {
    throw new Error(`broker ${b.id}: repricingRate must be in [0,1]`);
  }
  if (b.offMarketShare < 0 || b.offMarketShare > 1) {
    throw new Error(`broker ${b.id}: offMarketShare must be in [0,1]`);
  }
  if (b.daysToClose <= 0) {
    throw new Error(`broker ${b.id}: daysToClose must be > 0`);
  }
  if (b.buyerPoolDepth < 0) {
    throw new Error(`broker ${b.id}: buyerPoolDepth must be >= 0`);
  }
}

function clamp01(x: number): number {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}
