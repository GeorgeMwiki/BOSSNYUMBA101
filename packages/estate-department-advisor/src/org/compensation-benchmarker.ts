/**
 * compensation-benchmarker — CEL & Associates 2024 medians.
 *
 * EA adjustment factors per Korn Ferry East-Africa 2024 RE comp study.
 */

import type { Jurisdiction, Recommendation, Role } from '../types.js';

export interface CompBand {
  readonly baseP25: number;
  readonly baseP50: number;
  readonly baseP75: number;
  readonly bonusPct: number;
}

// USD base + bonus %. CEL 2024 US medians.
export const CEL_2024_US: Readonly<Record<Role, CompBand>> = {
  'property-manager': { baseP25: 65_000, baseP50: 85_000, baseP75: 110_000, bonusPct: 0.12 },
  'senior-pm': { baseP25: 95_000, baseP50: 120_000, baseP75: 155_000, bonusPct: 0.18 },
  'regional-pm': { baseP25: 130_000, baseP50: 165_000, baseP75: 210_000, bonusPct: 0.22 },
  'director-ops': { baseP25: 165_000, baseP50: 215_000, baseP75: 280_000, bonusPct: 0.28 },
  'asset-manager': { baseP25: 110_000, baseP50: 145_000, baseP75: 195_000, bonusPct: 0.25 },
  'leasing-agent': { baseP25: 45_000, baseP50: 60_000, baseP75: 80_000, bonusPct: 0 },
  'leasing-manager': { baseP25: 75_000, baseP50: 95_000, baseP75: 125_000, bonusPct: 0.15 },
  'accounting-manager': { baseP25: 90_000, baseP50: 115_000, baseP75: 145_000, bonusPct: 0.15 },
  accountant: { baseP25: 55_000, baseP50: 72_000, baseP75: 92_000, bonusPct: 0.08 },
  'maintenance-tech': { baseP25: 42_000, baseP50: 55_000, baseP75: 72_000, bonusPct: 0.05 },
  'maintenance-supervisor': { baseP25: 65_000, baseP50: 82_000, baseP75: 105_000, bonusPct: 0.10 },
  admin: { baseP25: 38_000, baseP50: 48_000, baseP75: 62_000, bonusPct: 0.03 },
};

// Korn Ferry EA 2024 RE comp factors.
export const EA_FACTORS: Readonly<Record<Jurisdiction, number>> = {
  KE: 0.45,
  TZ: 0.45,
  UG: 0.40,
  NG: 0.55,
  RW: 0.40,
  ZA: 0.65,
  US: 1.0,
};

const COMP_DRIFT_ALERT = 0.15;

export interface CompCheckInput {
  readonly role: Role;
  readonly actualBaseUsd: number;
  readonly jurisdiction: Jurisdiction;
}

export interface CompCheckResult {
  readonly role: Role;
  readonly benchmarkP50: number;
  readonly deltaPct: number;
  readonly band: 'below-P25' | 'P25-P50' | 'P50-P75' | 'above-P75';
  readonly recommendations: ReadonlyArray<Recommendation>;
  readonly citation: string;
}

export function checkCompensation(input: CompCheckInput): CompCheckResult {
  const us = CEL_2024_US[input.role];
  const factor = EA_FACTORS[input.jurisdiction];
  const p25 = us.baseP25 * factor;
  const p50 = us.baseP50 * factor;
  const p75 = us.baseP75 * factor;
  const delta = (input.actualBaseUsd - p50) / Math.max(p50, 1);
  let band: 'below-P25' | 'P25-P50' | 'P50-P75' | 'above-P75';
  if (input.actualBaseUsd < p25) band = 'below-P25';
  else if (input.actualBaseUsd < p50) band = 'P25-P50';
  else if (input.actualBaseUsd < p75) band = 'P50-P75';
  else band = 'above-P75';

  const recs: Recommendation[] = [];
  if (delta < -COMP_DRIFT_ALERT) {
    recs.push({
      id: `comp.${input.role}.underpaid`,
      kind: 'org-staffing',
      severity: 'high',
      headline: `${input.role} paid ${(Math.abs(delta) * 100).toFixed(0)}% below CEL P50`,
      rationale: `Below-market by > 15% drives 2.1× attrition risk per CEL 2024 cross-tab; market-adjust by Q-end.`,
      citation: 'CEL & Associates Real Estate Compensation Survey 2024',
      strategicScore: 0.7,
      urgencyScore: 0.6,
      composite: 0.45 * 0.7 + 0.25 * 0.6,
    });
  } else if (delta > COMP_DRIFT_ALERT) {
    recs.push({
      id: `comp.${input.role}.overpaid`,
      kind: 'org-staffing',
      severity: 'medium',
      headline: `${input.role} paid ${(delta * 100).toFixed(0)}% above CEL P50`,
      rationale: `Above-market premium > 15% should map to performance or retention rationale; review at next comp cycle.`,
      citation: 'CEL & Associates 2024',
      strategicScore: 0.45,
      urgencyScore: 0.3,
      composite: 0.45 * 0.45 + 0.25 * 0.3,
    });
  }

  return {
    role: input.role,
    benchmarkP50: p50,
    deltaPct: delta,
    band,
    recommendations: recs,
    citation: `CEL & Associates 2024 (${input.jurisdiction} factor ${factor})`,
  };
}

export const __test__ = { COMP_DRIFT_ALERT };
