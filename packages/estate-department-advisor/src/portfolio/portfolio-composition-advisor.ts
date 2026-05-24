/**
 * portfolio-composition-advisor
 *
 * Asset-mix balancing + Herfindahl-Hirschman concentration index
 * over geography. Bands and HHI thresholds calibrated to:
 *   - NCREIF Property Index 2024 Q4 sector weights
 *   - PREA Plan Sponsor Real Estate Investment Survey 2024
 *   - FFIEC concentration-risk guidance (adapted to RE from banking)
 *
 * Pure function. No I/O. Veteran-director voice: short, decisive,
 * with WHY + citation.
 */

import type {
  AssetClass,
  PortfolioSnapshot,
  PropertySnapshot,
  Recommendation,
  TenantId,
} from '../types.js';

export interface AssetMixBand {
  readonly target: number;
  readonly min: number;
  readonly max: number;
}

// NCREIF + PREA 2024 medians for institutional balanced portfolio.
export const ASSET_MIX_TARGETS: Readonly<Record<AssetClass, AssetMixBand>> = {
  multifamily: { target: 0.30, min: 0.20, max: 0.40 },
  industrial: { target: 0.28, min: 0.18, max: 0.38 },
  office: { target: 0.14, min: 0.05, max: 0.25 },
  retail: { target: 0.13, min: 0.05, max: 0.22 },
  hotel: { target: 0.07, min: 0.00, max: 0.15 },
  'mixed-use': { target: 0.08, min: 0.00, max: 0.15 },
  land: { target: 0.00, min: 0.00, max: 0.10 },
};

// FFIEC-adapted HHI thresholds (banking concentration → RE geography).
export const HHI_THRESHOLDS = {
  diversified: 1500,
  moderate: 2500,
  concentrated: 4000,
} as const;

export interface CompositionReport {
  readonly tenantId: TenantId;
  readonly assetMixActual: Readonly<Record<AssetClass, number>>;
  readonly assetMixDeltaFromTarget: Readonly<Record<AssetClass, number>>;
  readonly geographicHhi: number;
  readonly hhiBand: 'diversified' | 'moderate' | 'concentrated' | 'critically-concentrated';
  readonly recommendations: ReadonlyArray<Recommendation>;
  readonly citation: string;
}

function shareByClass(
  properties: ReadonlyArray<PropertySnapshot>,
): Record<AssetClass, number> {
  const total = properties.reduce((s, p) => s + p.marketValueUsd, 0);
  const result: Record<AssetClass, number> = {
    multifamily: 0,
    industrial: 0,
    office: 0,
    retail: 0,
    hotel: 0,
    'mixed-use': 0,
    land: 0,
  };
  if (total <= 0) {
    return result;
  }
  for (const p of properties) {
    result[p.assetClass] += p.marketValueUsd / total;
  }
  return result;
}

function computeHhi(properties: ReadonlyArray<PropertySnapshot>): number {
  const total = properties.reduce((s, p) => s + p.marketValueUsd, 0);
  if (total <= 0) {
    return 0;
  }
  const buckets = new Map<string, number>();
  for (const p of properties) {
    const key = `${p.jurisdiction}:${p.city}`;
    buckets.set(key, (buckets.get(key) ?? 0) + p.marketValueUsd);
  }
  let hhi = 0;
  for (const value of buckets.values()) {
    const sharePct = (value / total) * 100; // HHI uses %
    hhi += sharePct * sharePct;
  }
  return Math.round(hhi);
}

function classifyHhi(
  hhi: number,
): 'diversified' | 'moderate' | 'concentrated' | 'critically-concentrated' {
  if (hhi < HHI_THRESHOLDS.diversified) return 'diversified';
  if (hhi < HHI_THRESHOLDS.moderate) return 'moderate';
  if (hhi < HHI_THRESHOLDS.concentrated) return 'concentrated';
  return 'critically-concentrated';
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function analyzePortfolioComposition(
  portfolio: PortfolioSnapshot,
): CompositionReport {
  const actual = shareByClass(portfolio.properties);
  const delta: Record<AssetClass, number> = {
    multifamily: 0,
    industrial: 0,
    office: 0,
    retail: 0,
    hotel: 0,
    'mixed-use': 0,
    land: 0,
  };
  const recommendations: Recommendation[] = [];
  for (const key of Object.keys(actual) as Array<AssetClass>) {
    const a = actual[key];
    const band = ASSET_MIX_TARGETS[key];
    delta[key] = a - band.target;
    if (a < band.min) {
      recommendations.push({
        id: `comp.underweight.${key}`,
        kind: 'portfolio',
        severity: 'medium',
        headline: `Under-allocated to ${key} (${(a * 100).toFixed(1)}% vs ≥ ${(band.min * 100).toFixed(0)}% floor)`,
        rationale: `NCREIF 2024 institutional bands set ${key} at ${(band.target * 100).toFixed(0)}%; current ${(a * 100).toFixed(1)}% sits below the ${(band.min * 100).toFixed(0)}% floor — risks under-diversification.`,
        citation: 'NCREIF Property Index 2024 Q4 + PREA Plan Sponsor Survey 2024',
        strategicScore: 0.6,
        urgencyScore: 0.4,
        composite: 0.45 * 0.6 + 0.25 * 0.4,
      });
    }
    if (a > band.max) {
      recommendations.push({
        id: `comp.overweight.${key}`,
        kind: 'portfolio',
        severity: 'high',
        headline: `Over-allocated to ${key} (${(a * 100).toFixed(1)}% vs ≤ ${(band.max * 100).toFixed(0)}% ceiling)`,
        rationale: `Concentration in ${key} at ${(a * 100).toFixed(1)}% breaches the NCREIF 2024 ceiling of ${(band.max * 100).toFixed(0)}% — single-sector shocks would dominate portfolio returns.`,
        citation: 'NCREIF Property Index 2024 Q4',
        strategicScore: 0.8,
        urgencyScore: 0.55,
        composite: 0.45 * 0.8 + 0.25 * 0.55,
      });
    }
  }

  const hhi = computeHhi(portfolio.properties);
  const band = classifyHhi(hhi);
  if (band === 'concentrated') {
    recommendations.push({
      id: 'comp.geo.concentrated',
      kind: 'portfolio',
      severity: 'high',
      headline: `Geographic HHI ${hhi} — concentrated; build 24-month diversification plan`,
      rationale: `FFIEC-adapted RE concentration thresholds put 2500-4000 in the concentrated band; a localised market shock would hit > 50% of GAV.`,
      citation: 'FFIEC concentration-risk guidance + ULI Emerging Trends 2025',
      strategicScore: 0.75,
      urgencyScore: 0.7,
      composite: 0.45 * 0.75 + 0.25 * 0.7,
    });
  } else if (band === 'critically-concentrated') {
    recommendations.push({
      id: 'comp.geo.critical',
      kind: 'portfolio',
      severity: 'critical',
      headline: `Geographic HHI ${hhi} — CRITICAL; halt acquisitions in dominant submarket`,
      rationale: `HHI above 4000 means a single submarket dominates GAV; halting acquisitions there is the FFIEC-adapted veteran default until HHI < 4000.`,
      citation: 'FFIEC concentration-risk guidance',
      strategicScore: 0.95,
      urgencyScore: 0.9,
      composite: 0.45 * 0.95 + 0.25 * 0.9,
    });
  }

  return {
    tenantId: portfolio.tenantId,
    assetMixActual: actual,
    assetMixDeltaFromTarget: delta,
    geographicHhi: hhi,
    hhiBand: band,
    recommendations,
    citation: 'NCREIF 2024 Q4 + PREA 2024 + FFIEC adapted',
  };
}

// Internal helper exported for testing.
export const __test__ = { shareByClass, computeHhi, classifyHhi, clamp };
