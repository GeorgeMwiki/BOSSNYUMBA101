/**
 * vendor-portfolio-advisor — concentration + contract-structure.
 *
 * Sources: Gartner sourcing best-practice, Procurement Leaders 2024
 * RE survey. Single-vendor cap = 25 % of any category; > 40 %
 * triggers second-source RFP within 6 months.
 */

import type { Recommendation, TenantId, VendorCategory, VendorSpend } from '../types.js';

export const CONCENTRATION_CAP = 0.25;
export const RFP_TRIGGER = 0.40;
export const SLA_RESPONSE_HOURS_BY_CATEGORY: Readonly<Record<VendorCategory, number>> = {
  janitorial: 24,
  landscaping: 72,
  hvac: 4,
  plumbing: 4,
  electrical: 4,
  security: 1,
  legal: 24,
  accounting: 48,
  insurance: 48,
  it: 4,
  'major-capex': 168,
  'pest-control': 48,
  other: 48,
};

const KPI_FIRST_FIX_FLOOR = 0.75; // CMMS industry standard
const KPI_COST_VARIANCE_CEIL = 0.08;
const KPI_QUALITY_FLOOR = 4.0;

// Recommended contract structures.
export const RECOMMENDED_STRUCTURE: Readonly<Record<VendorCategory, string>> = {
  janitorial: 'fixed-bid + KPI clawback',
  landscaping: 'fixed-bid seasonal',
  hvac: 'performance-based + warranty handoff',
  plumbing: 't&m with capped hourly',
  electrical: 't&m with capped hourly',
  security: 'fixed-monthly + per-incident surcharge',
  legal: 'hourly + matter-cap; alternative fees',
  accounting: 'fixed-monthly retainer',
  insurance: 'broker-of-record annual',
  it: 'msp fixed + project T&M',
  'major-capex': 'lump-sum competitive bid w/ retainage',
  'pest-control': 'fixed-monthly w/ inspection cadence',
  other: 'review case-by-case',
};

export interface VendorReport {
  readonly tenantId: TenantId;
  readonly concentrationByCategory: ReadonlyArray<{
    category: VendorCategory;
    topVendor: string;
    topSharePct: number;
    severity: 'critical' | 'high' | 'medium' | 'info';
  }>;
  readonly kpiBreaches: ReadonlyArray<{
    vendorId: string;
    vendorName: string;
    breach: string;
    severity: 'high' | 'medium';
  }>;
  readonly contractMismatch: ReadonlyArray<{
    vendorId: string;
    vendorName: string;
    actual: string;
    recommended: string;
  }>;
  readonly recommendations: ReadonlyArray<Recommendation>;
  readonly citation: string;
}

function topShare(
  vendors: ReadonlyArray<VendorSpend>,
  category: VendorCategory,
): { vendor: VendorSpend | undefined; sharePct: number } {
  const inCat = vendors.filter((v) => v.category === category);
  const total = inCat.reduce((s, v) => s + v.annualSpendUsd, 0);
  if (total <= 0) return { vendor: undefined, sharePct: 0 };
  let top = inCat[0];
  for (const v of inCat) {
    if (top === undefined || v.annualSpendUsd > top.annualSpendUsd) {
      top = v;
    }
  }
  if (!top) return { vendor: undefined, sharePct: 0 };
  return { vendor: top, sharePct: top.annualSpendUsd / total };
}

export function adviseVendorPortfolio(input: {
  readonly tenantId: TenantId;
  readonly vendors: ReadonlyArray<VendorSpend>;
}): VendorReport {
  const allCats = Array.from(new Set(input.vendors.map((v) => v.category)));
  const recs: Recommendation[] = [];

  const concentrationByCategory = allCats.map((cat) => {
    const { vendor, sharePct } = topShare(input.vendors, cat);
    let severity: 'critical' | 'high' | 'medium' | 'info' = 'info';
    if (sharePct >= RFP_TRIGGER) severity = 'critical';
    else if (sharePct > CONCENTRATION_CAP) severity = 'high';
    if (severity === 'critical' && vendor) {
      recs.push({
        id: `vendor.conc.crit.${cat}`,
        kind: 'vendor',
        severity: 'critical',
        headline: `${vendor.vendorName} = ${(sharePct * 100).toFixed(0)}% of ${cat} spend — RFP within 6 months`,
        rationale: `> 40% single-vendor share triggers second-source RFP per Procurement Leaders 2024 RE standards; concentration risk material.`,
        citation: 'Procurement Leaders 2024 RE survey',
        strategicScore: 0.85,
        urgencyScore: 0.75,
        composite: 0.45 * 0.85 + 0.25 * 0.75,
      });
    } else if (severity === 'high' && vendor) {
      recs.push({
        id: `vendor.conc.high.${cat}`,
        kind: 'vendor',
        severity: 'high',
        headline: `${vendor.vendorName} = ${(sharePct * 100).toFixed(0)}% of ${cat} spend — over 25% cap`,
        rationale: `Above 25% concentration breaches Gartner sourcing standard; document continuity plan.`,
        citation: 'Gartner sourcing best-practice + Procurement Leaders 2024',
        strategicScore: 0.65,
        urgencyScore: 0.5,
        composite: 0.45 * 0.65 + 0.25 * 0.5,
      });
    }
    return {
      category: cat,
      topVendor: vendor?.vendorName ?? '',
      topSharePct: sharePct,
      severity,
    };
  });

  const kpiBreaches: Array<{
    vendorId: string;
    vendorName: string;
    breach: string;
    severity: 'high' | 'medium';
  }> = [];
  for (const v of input.vendors) {
    const sla = SLA_RESPONSE_HOURS_BY_CATEGORY[v.category];
    if (v.responseTimeP50Hours > sla * 1.5) {
      kpiBreaches.push({
        vendorId: v.vendorId,
        vendorName: v.vendorName,
        breach: `Response time ${v.responseTimeP50Hours}h > 1.5× SLA (${sla}h)`,
        severity: 'high',
      });
    }
    if (v.firstTimeFixRate < KPI_FIRST_FIX_FLOOR) {
      kpiBreaches.push({
        vendorId: v.vendorId,
        vendorName: v.vendorName,
        breach: `First-time fix ${(v.firstTimeFixRate * 100).toFixed(0)}% below 75% floor`,
        severity: 'medium',
      });
    }
    if (Math.abs(v.costVariancePct) > KPI_COST_VARIANCE_CEIL) {
      kpiBreaches.push({
        vendorId: v.vendorId,
        vendorName: v.vendorName,
        breach: `Cost variance ${(v.costVariancePct * 100).toFixed(0)}% > 8% ceiling`,
        severity: 'medium',
      });
    }
    if (v.qualityScore < KPI_QUALITY_FLOOR) {
      kpiBreaches.push({
        vendorId: v.vendorId,
        vendorName: v.vendorName,
        breach: `Quality ${v.qualityScore.toFixed(1)}/5 below 4.0 floor`,
        severity: 'high',
      });
    }
  }

  const contractMismatch: Array<{
    vendorId: string;
    vendorName: string;
    actual: string;
    recommended: string;
  }> = [];
  for (const v of input.vendors) {
    const recommended = RECOMMENDED_STRUCTURE[v.category];
    if (!recommended) continue;
    // Simple contains-match heuristic: recommended structure name keyword in actual.
    if (!recommended.includes(v.contractType)) {
      contractMismatch.push({
        vendorId: v.vendorId,
        vendorName: v.vendorName,
        actual: v.contractType,
        recommended,
      });
    }
  }

  return {
    tenantId: input.tenantId,
    concentrationByCategory,
    kpiBreaches,
    contractMismatch,
    recommendations: recs,
    citation: 'Procurement Leaders 2024 RE + Gartner sourcing + BOMA vendor-KPI standards',
  };
}

export const __test__ = {
  CONCENTRATION_CAP,
  RFP_TRIGGER,
  KPI_FIRST_FIX_FLOOR,
  KPI_COST_VARIANCE_CEIL,
  KPI_QUALITY_FLOOR,
  topShare,
};
