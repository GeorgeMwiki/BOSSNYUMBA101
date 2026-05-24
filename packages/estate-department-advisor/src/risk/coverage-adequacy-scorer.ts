/**
 * coverage-adequacy-scorer — 10-axis insurance coverage gap analysis.
 *
 * Per NAREIM Real-Estate Risk Management Guidebook 2023 + Marsh
 * Global Insurance Market 2024 Q4.
 */

import type {
  CoverageAxis,
  PortfolioSnapshot,
  Recommendation,
  RiskGap,
  RiskReport,
  Severity,
} from '../types.js';

interface AxisRequirement {
  readonly always: boolean;
  readonly conditional?: (portfolio: PortfolioSnapshot) => boolean;
  readonly minLimitFn?: (portfolio: PortfolioSnapshot) => number;
  readonly note: string;
  readonly severityIfMissing: Severity;
}

function totalGav(portfolio: PortfolioSnapshot): number {
  return portfolio.properties.reduce((s, p) => s + p.marketValueUsd, 0);
}

function totalDoors(portfolio: PortfolioSnapshot): number {
  return portfolio.properties.reduce((s, p) => s + p.doors, 0);
}

function employeeCount(portfolio: PortfolioSnapshot): number {
  return portfolio.fteHeadcount.reduce((s, h) => s + h.fte, 0);
}

export const AXIS_REQUIREMENTS: Readonly<Record<CoverageAxis, AxisRequirement>> = {
  'all-risk-property': {
    always: true,
    minLimitFn: (p) => totalGav(p),
    note: 'Replacement cost (not ACV); building + BPP.',
    severityIfMissing: 'critical',
  },
  'business-interruption': {
    always: true,
    minLimitFn: (p) =>
      p.properties.reduce((s, x) => s + x.annualRevenueUsd, 0) * 1.0,
    note: '12 months coverage minimum + 30-day extension period.',
    severityIfMissing: 'high',
  },
  'ordinance-and-law': {
    always: true,
    note: 'A: undamaged portion; B: demolition; C: increased COC.',
    severityIfMissing: 'high',
  },
  'equipment-breakdown': {
    always: true,
    note: 'Boiler, HVAC, transformers, elevators.',
    severityIfMissing: 'medium',
  },
  'general-liability': {
    always: true,
    minLimitFn: () => 2_000_000,
    note: '$1M/$2M minimum per occurrence/aggregate.',
    severityIfMissing: 'critical',
  },
  umbrella: {
    always: false,
    conditional: (p) => totalDoors(p) > 100,
    minLimitFn: () => 10_000_000,
    note: '$10M floor for portfolios > 100 units.',
    severityIfMissing: 'high',
  },
  cyber: {
    always: true,
    minLimitFn: () => 5_000_000,
    note: '$5M floor; premium up 35%/yr.',
    severityIfMissing: 'high',
  },
  epli: {
    always: false,
    conditional: (p) => employeeCount(p) > 25,
    note: 'Employment Practices Liability — required > 25 employees.',
    severityIfMissing: 'high',
  },
  'd-and-o': {
    always: false,
    conditional: (p) => p.ownerArchetype === 'institutional',
    note: 'Required when external investors present.',
    severityIfMissing: 'medium',
  },
  terrorism: {
    always: false,
    conditional: (p) => totalGav(p) > 50_000_000,
    note: 'TRIA (US) / Pool Re (UK); EA = optional but recommended.',
    severityIfMissing: 'medium',
  },
};

export function scoreCoverageAdequacy(portfolio: PortfolioSnapshot): RiskReport {
  const gaps: RiskGap[] = [];
  for (const axis of Object.keys(AXIS_REQUIREMENTS) as Array<CoverageAxis>) {
    const req = AXIS_REQUIREMENTS[axis];
    const required = req.always || (req.conditional?.(portfolio) ?? false);
    const policy = portfolio.insurancePolicies.find((p) => p.axis === axis);
    const covered = policy !== undefined;
    const minLimit = req.minLimitFn?.(portfolio) ?? 0;
    const limitGap = policy
      ? Math.max(0, minLimit - policy.perOccurrenceLimitUsd)
      : minLimit;

    if (required && !covered) {
      gaps.push({
        axis,
        required,
        covered,
        limitGapUsd: minLimit,
        notes: `Missing required coverage: ${req.note}`,
        severity: req.severityIfMissing,
      });
    } else if (required && policy && limitGap > 0) {
      gaps.push({
        axis,
        required,
        covered,
        limitGapUsd: limitGap,
        notes: `Limit short by $${limitGap.toLocaleString('en-US')} (${req.note})`,
        severity: 'high',
      });
    } else if (required && policy && axis === 'all-risk-property' && !policy.replacementCostBased) {
      gaps.push({
        axis,
        required,
        covered: true,
        limitGapUsd: 0,
        notes: 'Policy is ACV not replacement-cost — high under-insurance risk',
        severity: 'high',
      });
    }
  }

  const recs: Recommendation[] = gaps.map((g, i) => ({
    id: `risk.gap.${i}.${g.axis}`,
    kind: 'risk-insurance',
    severity: g.severity,
    headline: `Coverage gap: ${g.axis} ${g.limitGapUsd > 0 ? `— short $${g.limitGapUsd.toLocaleString('en-US')}` : ''}`.trim(),
    rationale: g.notes,
    citation: 'NAREIM RE Risk Mgmt Guidebook 2023 + Marsh Global Insurance 2024 Q4',
    strategicScore: g.severity === 'critical' ? 0.9 : g.severity === 'high' ? 0.75 : 0.55,
    urgencyScore: g.severity === 'critical' ? 0.85 : g.severity === 'high' ? 0.65 : 0.4,
    composite:
      0.45 * (g.severity === 'critical' ? 0.9 : g.severity === 'high' ? 0.75 : 0.55) +
      0.25 * (g.severity === 'critical' ? 0.85 : g.severity === 'high' ? 0.65 : 0.4),
  }));

  const annualPremium = portfolio.insurancePolicies.reduce(
    (s, p) => s + p.annualPremiumUsd,
    0,
  );
  const captiveRecommended =
    totalGav(portfolio) > 500_000_000 && annualPremium > 2_000_000;

  return {
    tenantId: portfolio.tenantId,
    gaps,
    recommendations: recs,
    captiveRecommended,
    catastropheExposures: detectCatastropheExposures(portfolio),
  };
}

function detectCatastropheExposures(portfolio: PortfolioSnapshot): string[] {
  const out: string[] = [];
  const cities = new Set(portfolio.properties.map((p) => p.city.toLowerCase()));
  if ([...cities].some((c) => c.includes('nairobi') || c.includes('kibera'))) {
    out.push('Nairobi flood-prone informal-settlement adjacency (RMS EA flood model)');
  }
  if (portfolio.properties.some((p) => p.jurisdiction === 'KE' || p.jurisdiction === 'TZ' || p.jurisdiction === 'UG' || p.jurisdiction === 'RW')) {
    out.push('East-African Rift seismic zone (~2 events/decade per AIR Worldwide)');
  }
  if (portfolio.properties.some((p) => p.jurisdiction === 'KE' || p.jurisdiction === 'NG')) {
    out.push('Post-election civil-unrest exposure (recurring KE 2007/2017; NG state cycles)');
  }
  return out;
}

export const __test__ = { AXIS_REQUIREMENTS, totalGav, totalDoors, employeeCount };
