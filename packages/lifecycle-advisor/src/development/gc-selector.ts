/**
 * GC selector — qualifications-based bid evaluation (CMAA-weighted)
 * with delivery-method recommendation (CMAR / DBB / DB / IPD).
 *
 * Authority: CMAA *Standard CM Practice* 2024, ConsensusDocs 510,
 * AIA A133 / A134, NCA (Kenya National Construction Authority) Class
 * requirements 2024.
 *
 * Weights:
 *  - past performance 35 %, team 20 %, schedule realism 15 %,
 *    price 15 %, safety 10 %, local hire 5 %.
 */

import type {
  DeliveryMethod,
  GCBid,
  GCBidScore,
  GCSelection,
  ProjectAttributes,
} from '../types.js';

const WEIGHTS = {
  trackRecord: 0.35,
  teamStrength: 0.20,
  scheduleRealism: 0.15,
  price: 0.15,
  safety: 0.10,
  localHire: 0.05,
} as const;

const DART_BENCHMARK_GOOD = 1.5;
const DART_BENCHMARK_POOR = 4.5;

export function recommendDeliveryMethod(
  attrs: Readonly<ProjectAttributes>,
): { readonly method: DeliveryMethod; readonly rationale: string } {
  if (attrs.complexity === 'extreme' && attrs.riskTolerance === 'low') {
    return {
      method: 'ipd',
      rationale: 'Extreme complexity + low risk-tolerance → IPD pools risk across owner / designer / GC.',
    };
  }
  if (
    attrs.innovationLevel === 'first-of-kind' ||
    (attrs.complexity === 'high' && attrs.speedRequired !== 'normal')
  ) {
    return {
      method: 'design-build',
      rationale: 'High complexity / first-of-kind with speed pressure → single point of responsibility (DB).',
    };
  }
  if (
    attrs.drawingsCompletePct < 0.85 ||
    attrs.speedRequired === 'fast-track' ||
    attrs.speedRequired === 'aggressive'
  ) {
    return {
      method: 'cmar',
      rationale: 'Partial drawings or fast-track → CMAR (GMP + savings split) preserves owner control.',
    };
  }
  return {
    method: 'design-bid-build',
    rationale: 'Complete drawings, normal pace, mid/low complexity → DBB delivers lowest price risk.',
  };
}

function normalisePriceScore(bid: GCBid): number {
  if (bid.lowestBidPrice <= 0) return 0;
  // Below lowest is impossible (lowest is the baseline). Use bid/lowest > 1 means worse.
  const ratio = bid.price / bid.lowestBidPrice;
  if (ratio < 1) return 1; // guard floor
  // Linear decay: at 1.00 → 1, at 1.30 → 0.
  return Math.max(0, 1 - (ratio - 1) / 0.3);
}

function normaliseSafetyScore(dart: number): number {
  if (dart <= DART_BENCHMARK_GOOD) return 1;
  if (dart >= DART_BENCHMARK_POOR) return 0;
  return 1 - (dart - DART_BENCHMARK_GOOD) / (DART_BENCHMARK_POOR - DART_BENCHMARK_GOOD);
}

export function scoreGCBids(bids: ReadonlyArray<GCBid>): ReadonlyArray<GCBidScore> {
  if (bids.length === 0) return [];
  const scored = bids.map((b) => {
    const priceScore = normalisePriceScore(b);
    const safetyScore = normaliseSafetyScore(b.dartRate);
    const total =
      b.trackRecord * WEIGHTS.trackRecord +
      b.teamStrength * WEIGHTS.teamStrength +
      b.scheduleRealism * WEIGHTS.scheduleRealism +
      priceScore * WEIGHTS.price +
      safetyScore * WEIGHTS.safety +
      b.localHireScore * WEIGHTS.localHire;
    return {
      contractorId: b.contractorId,
      trackRecordScore: b.trackRecord * WEIGHTS.trackRecord,
      teamStrengthScore: b.teamStrength * WEIGHTS.teamStrength,
      scheduleRealismScore: b.scheduleRealism * WEIGHTS.scheduleRealism,
      priceScore: priceScore * WEIGHTS.price,
      safetyScore: safetyScore * WEIGHTS.safety,
      localHireScore: b.localHireScore * WEIGHTS.localHire,
      total,
      rank: 0,
    };
  });
  const sorted = [...scored].sort((a, b) => b.total - a.total);
  return sorted.map((s, i) => ({ ...s, rank: i + 1 }));
}

export function selectGC(
  attrs: Readonly<ProjectAttributes>,
  bids: ReadonlyArray<GCBid>,
): GCSelection {
  if (bids.length === 0) {
    throw new Error('selectGC: no bids supplied');
  }
  const method = recommendDeliveryMethod(attrs);
  const ranked = scoreGCBids(bids);
  const recommended = ranked[0]!;
  return {
    method: method.method,
    rationale: method.rationale,
    rankedBids: ranked,
    recommended,
  };
}
