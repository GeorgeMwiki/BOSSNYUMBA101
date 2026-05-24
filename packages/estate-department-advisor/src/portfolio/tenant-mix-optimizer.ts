/**
 * tenant-mix-optimizer — covenant strength + lease-roll laddering.
 *
 * Sources: ICSC retail-mix research, CBRE Office Lease-Maturity Wall
 * 2025, NAREIT covenant-quality framework.
 *
 * Three levers:
 *   1. Covenant-strength weighting (investment-grade 1.5×; SME 0.5×;
 *      gov't 2.0×).
 *   2. Lease-roll laddering — no single year should hold > 25 % of
 *      rent-roll roll-over.
 *   3. Anchor analysis — single tenant > 35 % is a red flag; > 50 %
 *      mandates diversification plan.
 */

import type { Recommendation, TenantId } from '../types.js';

export interface TenantMixEntry {
  readonly tenantName: string;
  readonly annualRentUsd: number;
  readonly leaseEndsAtMs: number;
  readonly covenantClass: 'investment-grade' | 'middle-market' | 'sme' | 'government' | 'un-rated';
}

export interface TenantMixReport {
  readonly tenantId: TenantId;
  readonly weightedCovenantScore: number; // 0..2; > 1.0 = strong
  readonly rollByYear: ReadonlyArray<{ year: number; sharePct: number }>;
  readonly maxYearSharePct: number;
  readonly topTenantSharePct: number;
  readonly recommendations: ReadonlyArray<Recommendation>;
}

const COVENANT_WEIGHTS = {
  'investment-grade': 1.5,
  'middle-market': 1.0,
  sme: 0.5,
  government: 2.0,
  'un-rated': 0.7,
} as const;

const ROLL_YEAR_CEILING = 0.25;
const ANCHOR_FLAG_PCT = 0.35;
const ANCHOR_MUST_ACT_PCT = 0.50;
const MS_PER_YEAR = 365 * 24 * 60 * 60 * 1000;

export function optimizeTenantMix(input: {
  readonly tenantId: TenantId;
  readonly tenants: ReadonlyArray<TenantMixEntry>;
  readonly nowMs: number;
}): TenantMixReport {
  const total = input.tenants.reduce((s, t) => s + t.annualRentUsd, 0);
  if (total <= 0) {
    return {
      tenantId: input.tenantId,
      weightedCovenantScore: 0,
      rollByYear: [],
      maxYearSharePct: 0,
      topTenantSharePct: 0,
      recommendations: [],
    };
  }

  const weighted =
    input.tenants.reduce(
      (s, t) => s + (t.annualRentUsd / total) * COVENANT_WEIGHTS[t.covenantClass],
      0,
    );

  const rollMap = new Map<number, number>();
  for (const t of input.tenants) {
    const yearsOut = Math.floor((t.leaseEndsAtMs - input.nowMs) / MS_PER_YEAR);
    const safeYear = Math.max(0, yearsOut);
    rollMap.set(safeYear, (rollMap.get(safeYear) ?? 0) + t.annualRentUsd / total);
  }
  const rollByYear = Array.from(rollMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([year, sharePct]) => ({ year, sharePct }));

  const maxYearShare = rollByYear.reduce((m, r) => Math.max(m, r.sharePct), 0);
  const topTenantShare =
    input.tenants.reduce((m, t) => Math.max(m, t.annualRentUsd / total), 0);

  const recommendations: Recommendation[] = [];
  if (maxYearShare > ROLL_YEAR_CEILING) {
    const peakYear = rollByYear.find((r) => r.sharePct === maxYearShare)?.year ?? 0;
    recommendations.push({
      id: `mix.roll.${peakYear}`,
      kind: 'portfolio',
      severity: 'high',
      headline: `Year ${peakYear} holds ${(maxYearShare * 100).toFixed(0)}% of rent-roll — ladder it`,
      rationale: `ICSC industry tolerance caps any single roll-year at 25%; concentration above creates renewal-cliff risk.`,
      citation: 'ICSC tenant-mix research + CBRE Lease-Maturity Wall 2025',
      strategicScore: 0.75,
      urgencyScore: 0.55,
      composite: 0.45 * 0.75 + 0.25 * 0.55,
    });
  }
  if (topTenantShare > ANCHOR_MUST_ACT_PCT) {
    recommendations.push({
      id: 'mix.anchor.must-act',
      kind: 'portfolio',
      severity: 'critical',
      headline: `Single tenant holds ${(topTenantShare * 100).toFixed(0)}% of rent — mandatory diversification plan`,
      rationale: `NAREIT covenant-quality framework treats > 50% single-tenant share as existential; default scenarios eliminate distribution capacity overnight.`,
      citation: 'NAREIT covenant-quality framework',
      strategicScore: 0.95,
      urgencyScore: 0.9,
      composite: 0.45 * 0.95 + 0.25 * 0.9,
    });
  } else if (topTenantShare > ANCHOR_FLAG_PCT) {
    recommendations.push({
      id: 'mix.anchor.flag',
      kind: 'portfolio',
      severity: 'high',
      headline: `Single tenant holds ${(topTenantShare * 100).toFixed(0)}% of rent — watchlist`,
      rationale: `Above 35% triggers credit-watch protocols per NAREIT covenant guidance; build pipeline of backfill tenants.`,
      citation: 'NAREIT covenant-quality framework',
      strategicScore: 0.7,
      urgencyScore: 0.55,
      composite: 0.45 * 0.7 + 0.25 * 0.55,
    });
  }
  if (weighted < 0.7) {
    recommendations.push({
      id: 'mix.covenant.weak',
      kind: 'portfolio',
      severity: 'medium',
      headline: `Weighted covenant score ${weighted.toFixed(2)} — covenant-quality drift`,
      rationale: `Score < 0.7 means the rent-roll is leaning on sub-prime credit; widen guarantor + deposit requirements per ICSC standards.`,
      citation: 'ICSC + NAREIT covenant frameworks',
      strategicScore: 0.55,
      urgencyScore: 0.4,
      composite: 0.45 * 0.55 + 0.25 * 0.4,
    });
  }

  return {
    tenantId: input.tenantId,
    weightedCovenantScore: weighted,
    rollByYear,
    maxYearSharePct: maxYearShare,
    topTenantSharePct: topTenantShare,
    recommendations,
  };
}

export const __test__ = {
  COVENANT_WEIGHTS,
  ROLL_YEAR_CEILING,
  ANCHOR_FLAG_PCT,
  ANCHOR_MUST_ACT_PCT,
};
