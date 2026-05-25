/**
 * Buyer-pipeline builder — scores buyers against asset, classifies
 * into 5 tiers (institutional / private / 1031 / owner-occupier /
 * international-PIRI), recommends top-2 tier focus + marketing
 * channels.
 *
 * Authority: Knight Frank Prime International Residential Index
 * (PIRI) 2026 Q1, JLL Capital Tracker 2026.
 */

import type {
  BuyerPipeline,
  BuyerProfile,
  BuyerScore,
  BuyerTier,
} from '../types.js';

interface TierMeta {
  readonly pricingPower: BuyerScore['pricingPower'];
  readonly typicalCloseDays: number;
  readonly channels: ReadonlyArray<string>;
}

const TIER_META: Readonly<Record<BuyerTier, TierMeta>> = {
  'institutional': {
    pricingPower: 'high',
    typicalCloseDays: 75,
    channels: ['JLL Capital Markets', 'Eastdil Secured', 'CBRE Cap Markets', 'NCREIF outreach'],
  },
  'private-investor': {
    pricingPower: 'medium',
    typicalCloseDays: 52,
    channels: ['regional brokerage', 'CCIM listing', 'family-office syndicate'],
  },
  '1031-exchange': {
    pricingPower: 'high',
    typicalCloseDays: 38,
    channels: ['1031 buyer rolodex', 'qualified-intermediary referrals', 'STR replacement listings'],
  },
  'owner-occupier': {
    pricingPower: 'low',
    typicalCloseDays: 90,
    channels: ['local broker', 'industry-specific listing', 'corporate-services placement'],
  },
  'international-piri': {
    pricingPower: 'variable',
    typicalCloseDays: 105,
    channels: ['PIRI-tier 1 cities cross-border', 'Knight Frank international', 'sovereign-wealth direct'],
  },
};

export function scoreBuyers(buyers: ReadonlyArray<BuyerProfile>): ReadonlyArray<BuyerScore> {
  return buyers.map((b) => {
    const matchScore =
      0.35 * b.assetClassFit +
      0.30 * b.capRateAppetiteFit +
      0.20 * b.ticketSizeFit +
      0.15 * b.buyerPoolActivity;
    const meta = TIER_META[b.tier];
    return {
      id: b.id,
      name: b.name,
      tier: b.tier,
      matchScore,
      pricingPower: meta.pricingPower,
      typicalCloseDays: meta.typicalCloseDays,
    };
  });
}

export function buildBuyerPipeline(
  assetId: string,
  buyers: ReadonlyArray<BuyerProfile>,
): BuyerPipeline {
  const scored = [...scoreBuyers(buyers)].sort((a, b) => b.matchScore - a.matchScore);
  const tierAvg = new Map<BuyerTier, { sum: number; n: number }>();
  for (const s of scored) {
    const cur = tierAvg.get(s.tier) ?? { sum: 0, n: 0 };
    tierAvg.set(s.tier, { sum: cur.sum + s.matchScore, n: cur.n + 1 });
  }
  const tierAvgArr = Array.from(tierAvg.entries()).map(([t, v]) => ({
    tier: t,
    avg: v.sum / v.n,
  }));
  const top2Tiers = [...tierAvgArr]
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 2)
    .map((x) => x.tier);
  const channels = new Set<string>();
  for (const tier of top2Tiers) {
    for (const ch of TIER_META[tier].channels) channels.add(ch);
  }
  return {
    assetId,
    scored,
    top2Tiers,
    suggestedMarketingChannels: Array.from(channels),
  };
}
