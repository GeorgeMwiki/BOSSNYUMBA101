/**
 * Entitlement-path analyzer — selects the path (by-right /
 * administrative / SUP / variance / rezoning / PUD) and forecasts
 * timeline, approval probability, and cost.
 *
 * Per APA Zoning Practice Quarterly 2024, NCC Development
 * Control Manual 2023 (Nairobi), DCC Master Plan 2026-2056
 * (Dar es Salaam).
 */

import type {
  EntitlementAnalysis,
  EntitlementPath,
  Jurisdiction,
} from '../types.js';

interface PathProfile {
  readonly monthsUS: [number, number];
  readonly monthsEA: [number, number];
  readonly baseApprovalProbability: number;
  readonly baseCostUsd: number;
  readonly riskLevel: EntitlementAnalysis['riskLevel'];
}

const PATH_PROFILES: Readonly<Record<EntitlementPath, PathProfile>> = {
  'by-right': {
    monthsUS: [1, 3],
    monthsEA: [3, 6],
    baseApprovalProbability: 0.98,
    baseCostUsd: 25_000,
    riskLevel: 'low',
  },
  administrative: {
    monthsUS: [3, 6],
    monthsEA: [6, 9],
    baseApprovalProbability: 0.92,
    baseCostUsd: 60_000,
    riskLevel: 'low',
  },
  'special-use': {
    monthsUS: [6, 12],
    monthsEA: [9, 18],
    baseApprovalProbability: 0.72,
    baseCostUsd: 180_000,
    riskLevel: 'medium',
  },
  variance: {
    monthsUS: [6, 12],
    monthsEA: [12, 24],
    baseApprovalProbability: 0.55,
    baseCostUsd: 220_000,
    riskLevel: 'high',
  },
  rezoning: {
    monthsUS: [12, 24],
    monthsEA: [18, 36],
    baseApprovalProbability: 0.45,
    baseCostUsd: 500_000,
    riskLevel: 'high',
  },
  pud: {
    monthsUS: [18, 36],
    monthsEA: [24, 48],
    baseApprovalProbability: 0.40,
    baseCostUsd: 850_000,
    riskLevel: 'very-high',
  },
};

export interface EntitlementInputs {
  readonly path: EntitlementPath;
  readonly jurisdiction: Jurisdiction;
  /** Opposition score 0..100 (from opposition-scorer). */
  readonly oppositionScore: number;
  /** Optional probability adjustment from political alignment. */
  readonly politicalAlignmentAdj?: number;
  /** Optional schedule risk multiplier (e.g. 1.5 for fragile jurisdictions). */
  readonly scheduleRiskMultiplier?: number;
}

const EA_JURISDICTIONS: ReadonlyArray<Jurisdiction> = ['KE', 'TZ', 'UG'];

export function analyzeEntitlementPath(
  inputs: EntitlementInputs,
): EntitlementAnalysis {
  if (inputs.oppositionScore < 0 || inputs.oppositionScore > 100) {
    throw new Error('oppositionScore must be in [0, 100]');
  }
  const profile = PATH_PROFILES[inputs.path];
  const isEA = EA_JURISDICTIONS.includes(inputs.jurisdiction);
  const [loMonths, hiMonths] = isEA ? profile.monthsEA : profile.monthsUS;
  const baseMonths = (loMonths + hiMonths) / 2;

  // Opposition penalty: 0 at 0; 12 months at 100 for high-risk paths
  const pathHardness = profile.baseApprovalProbability < 0.6 ? 1.0 : 0.5;
  const oppositionMonthPenalty = (inputs.oppositionScore / 100) * 12 * pathHardness;

  const scheduleRiskMult = inputs.scheduleRiskMultiplier ?? (isEA ? 1.2 : 1.0);
  const estimatedMonths =
    (baseMonths + oppositionMonthPenalty) * scheduleRiskMult;

  // Approval prob drops with opposition; political alignment can lift
  const oppositionPenalty = (inputs.oppositionScore / 100) * 0.35;
  const adjustment = inputs.politicalAlignmentAdj ?? 0;
  const probabilityOfApproval = clamp01(
    profile.baseApprovalProbability - oppositionPenalty + adjustment,
  );

  // Cost rises with opposition (legal + community engagement)
  const cost =
    profile.baseCostUsd *
    (1 + (inputs.oppositionScore / 100) * 0.6) *
    (isEA ? 0.65 : 1.0); // EA: lower legal / engagement cost

  const notes: string[] = [];
  if (inputs.oppositionScore >= 65) {
    notes.push('Expect material opposition; budget 2-yr entitlement runway.');
  }
  if (isEA) {
    notes.push('EA timeline + cost band applied (EA: 1.2x schedule, 0.65x cost).');
  }

  return {
    path: inputs.path,
    estimatedMonths,
    probabilityOfApproval,
    oppositionScore: inputs.oppositionScore,
    cost,
    riskLevel: profile.riskLevel,
    notes,
  };
}

function clamp01(x: number): number {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

export const ENTITLEMENT_PATH_PROFILES = PATH_PROFILES;
