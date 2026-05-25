/**
 * boma-benchmarker — opex per rentable-square-foot vs BOMA EER peer.
 *
 * Source: BOMA Experience Exchange Report 2024 Q4 (Office).
 * For East-Africa we apply JLL Africa 2024 cost-of-occupancy
 * adjustment (~35% USD shift vs US median).
 *
 * Returns:
 *   - actual opex / RSF
 *   - peer P25 / P50 / P75
 *   - percentile band
 *   - rec list (only when controllable variance > 10 %)
 */

import type {
  Jurisdiction,
  OpsExcellenceReport,
  PortfolioSnapshot,
  PropertySnapshot,
  Recommendation,
  TenantId,
} from '../types.js';

export interface BomaBenchmark {
  readonly totalOpex: number;
  readonly cleaning: number;
  readonly utilities: number;
  readonly repairsMaintenance: number;
  readonly source: string;
}

// USD / RSF / yr.
export const BOMA_OFFICE_2024: Readonly<Record<string, BomaBenchmark>> = {
  'US-NORTHEAST': {
    totalOpex: 9.85,
    cleaning: 1.65,
    utilities: 2.85,
    repairsMaintenance: 1.95,
    source: 'BOMA EER 2024 Q4 — US Northeast',
  },
  'US-MIDWEST': {
    totalOpex: 8.40,
    cleaning: 1.40,
    utilities: 2.45,
    repairsMaintenance: 1.75,
    source: 'BOMA EER 2024 Q4 — US Midwest',
  },
  'US-SOUTH': {
    totalOpex: 7.85,
    cleaning: 1.30,
    utilities: 2.30,
    repairsMaintenance: 1.65,
    source: 'BOMA EER 2024 Q4 — US South',
  },
  'US-WEST': {
    totalOpex: 9.20,
    cleaning: 1.55,
    utilities: 2.65,
    repairsMaintenance: 1.85,
    source: 'BOMA EER 2024 Q4 — US West',
  },
  // EA-adjusted via JLL Africa 2024 cost-of-occupancy report.
  'KE-NAIROBI-A': {
    totalOpex: 5.10,
    cleaning: 0.95,
    utilities: 1.70,
    repairsMaintenance: 1.05,
    source: 'JLL Africa 2024 (BOMA-adjusted) — Nairobi Grade A',
  },
  'TZ-DAR-A': {
    totalOpex: 4.60,
    cleaning: 0.85,
    utilities: 1.55,
    repairsMaintenance: 0.95,
    source: 'JLL Africa 2024 — Dar Grade A',
  },
  'UG-KAMPALA-A': {
    totalOpex: 4.20,
    cleaning: 0.75,
    utilities: 1.45,
    repairsMaintenance: 0.85,
    source: 'JLL Africa 2024 — Kampala Grade A',
  },
  'NG-LAGOS-IKOYI': {
    totalOpex: 6.20,
    cleaning: 1.10,
    utilities: 2.45,
    repairsMaintenance: 1.25,
    source: 'Estate Intel 2024 — Lagos Ikoyi/VI',
  },
  'RW-KIGALI-A': {
    totalOpex: 4.30,
    cleaning: 0.80,
    utilities: 1.40,
    repairsMaintenance: 0.90,
    source: 'JLL Africa 2024 — Kigali Grade A (estimated)',
  },
  'ZA-JNB-A': {
    totalOpex: 6.85,
    cleaning: 1.20,
    utilities: 2.40,
    repairsMaintenance: 1.35,
    source: 'JLL South Africa 2024 — Johannesburg Sandton Grade A',
  },
} as const;

const PEER_BAND_RATIO = { p25: 0.85, p50: 1.0, p75: 1.18 };
const VARIANCE_TRIGGER = 0.10; // 10 %

function bomaKey(j: Jurisdiction, city: string): string {
  const upper = city.toUpperCase();
  switch (j) {
    case 'KE':
      return upper.includes('NAIROBI') ? 'KE-NAIROBI-A' : 'KE-NAIROBI-A';
    case 'TZ':
      return upper.includes('DAR') ? 'TZ-DAR-A' : 'TZ-DAR-A';
    case 'UG':
      return upper.includes('KAMPALA') ? 'UG-KAMPALA-A' : 'UG-KAMPALA-A';
    case 'NG':
      return 'NG-LAGOS-IKOYI';
    case 'RW':
      return 'RW-KIGALI-A';
    case 'ZA':
      return 'ZA-JNB-A';
    case 'US':
      if (upper.includes('NY') || upper.includes('BOSTON')) return 'US-NORTHEAST';
      if (upper.includes('CHICAGO')) return 'US-MIDWEST';
      if (upper.includes('TX') || upper.includes('FL') || upper.includes('GA'))
        return 'US-SOUTH';
      return 'US-WEST';
    default:
      return 'US-WEST';
  }
}

function percentileOf(actual: number, peerP50: number): number {
  if (peerP50 <= 0) return 0.5;
  const ratio = actual / peerP50;
  // lower opex = better percentile (lower percentile = top quartile);
  // we report as "where does this sit" 0..1 ascending.
  if (ratio < 0.85) return 0.15;
  if (ratio < 0.95) return 0.35;
  if (ratio < 1.05) return 0.5;
  if (ratio < 1.18) return 0.7;
  return 0.9;
}

export function benchmarkBoma(input: {
  readonly portfolio: PortfolioSnapshot;
  readonly assetClassFilter?: 'office' | 'all';
}): OpsExcellenceReport {
  const { portfolio } = input;
  const filterToOffice = input.assetClassFilter !== 'all';
  const eligible = portfolio.properties.filter(
    (p) => !filterToOffice || p.assetClass === 'office',
  );
  if (eligible.length === 0) {
    return emptyReport(portfolio.tenantId);
  }
  const totalSf = eligible.reduce((s, p) => s + p.rentableSf, 0);
  const totalOpex = eligible.reduce((s, p) => s + p.annualOpexUsd, 0);
  const opexPerSfActual = totalSf > 0 ? totalOpex / totalSf : 0;

  // Weighted-average peer benchmark across this portfolio's footprint.
  const weighted = weightedPeer(eligible);
  const peerP50 = weighted.totalOpex;
  const peerP25 = peerP50 * PEER_BAND_RATIO.p25;
  const peerP75 = peerP50 * PEER_BAND_RATIO.p75;
  const percentile = percentileOf(opexPerSfActual, peerP50);

  const gapVsP50 = peerP50 > 0 ? (opexPerSfActual - peerP50) / peerP50 : 0;
  // Heuristic split: 60% controllable, 40% uncontrollable (BOMA EER avg).
  const controllableGap = gapVsP50 * 0.6;
  const uncontrollableGap = gapVsP50 * 0.4;

  const recommendations: Recommendation[] = [];
  if (controllableGap > VARIANCE_TRIGGER) {
    recommendations.push({
      id: 'boma.controllable.over',
      kind: 'operations',
      severity: gapVsP50 > 0.25 ? 'high' : 'medium',
      headline: `Opex is ${(gapVsP50 * 100).toFixed(0)}% over peer; controllable share ${(controllableGap * 100).toFixed(0)}%`,
      rationale: `Controllable variance > 10% per BOMA EER methodology — drill into cleaning + R&M contracts and re-bid the worst category.`,
      citation: weighted.source,
      strategicScore: 0.6,
      urgencyScore: 0.6,
      composite: 0.45 * 0.6 + 0.25 * 0.6,
    });
  }
  if (controllableGap < -VARIANCE_TRIGGER) {
    recommendations.push({
      id: 'boma.controllable.under',
      kind: 'operations',
      severity: 'info',
      headline: `Opex is ${(Math.abs(gapVsP50) * 100).toFixed(0)}% below peer — verify quality isn't deferred-maintenance creep`,
      rationale: `Below-peer opex can mean under-investment; sample tenant-satisfaction scores per BOMA Best-Practices Guide.`,
      citation: weighted.source,
      strategicScore: 0.45,
      urgencyScore: 0.3,
      composite: 0.45 * 0.45 + 0.25 * 0.3,
    });
  }

  return {
    tenantId: portfolio.tenantId,
    opexPerSfActual,
    opexPerSfPeerP50: peerP50,
    opexPerSfPeerP25: peerP25,
    opexPerSfPeerP75: peerP75,
    percentile,
    controllableGapPct: controllableGap,
    uncontrollableGapPct: uncontrollableGap,
    recommendations,
    citations: [weighted.source, 'BOMA EER 2024 Q4'],
  };
}

function weightedPeer(properties: ReadonlyArray<PropertySnapshot>): BomaBenchmark {
  const totalSf = properties.reduce((s, p) => s + p.rentableSf, 0);
  if (totalSf <= 0) {
    return BOMA_OFFICE_2024['US-WEST'] as BomaBenchmark;
  }
  let totalOpex = 0;
  let cleaning = 0;
  let utilities = 0;
  let rm = 0;
  let primarySource = '';
  for (const p of properties) {
    const key = bomaKey(p.jurisdiction, p.city);
    const peer = BOMA_OFFICE_2024[key];
    if (!peer) continue;
    const w = p.rentableSf / totalSf;
    totalOpex += peer.totalOpex * w;
    cleaning += peer.cleaning * w;
    utilities += peer.utilities * w;
    rm += peer.repairsMaintenance * w;
    if (!primarySource) primarySource = peer.source;
  }
  return {
    totalOpex,
    cleaning,
    utilities,
    repairsMaintenance: rm,
    source: primarySource || 'BOMA EER 2024 Q4 (US-West fallback)',
  };
}

function emptyReport(tenantId: TenantId): OpsExcellenceReport {
  return {
    tenantId,
    opexPerSfActual: 0,
    opexPerSfPeerP50: 0,
    opexPerSfPeerP25: 0,
    opexPerSfPeerP75: 0,
    percentile: 0,
    controllableGapPct: 0,
    uncontrollableGapPct: 0,
    recommendations: [],
    citations: ['BOMA EER 2024 Q4'],
  };
}

export const __test__ = { bomaKey, percentileOf, weightedPeer, PEER_BAND_RATIO, VARIANCE_TRIGGER };
