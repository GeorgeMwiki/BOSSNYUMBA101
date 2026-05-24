/**
 * Opposition scorer — predicts neighborhood opposition to a
 * rezoning / variance / SUP application.
 *
 * Per APA + MIT DUSP NIMBY Predictor 2023.
 */

import type { OppositionInputs, OppositionScore } from '../types.js';

interface AxisSpec {
  readonly weight: number;
  readonly scoreFn: (v: number) => number;
}

const HOA_DENSITY_MAX = 8; // HOAs per 0.8 km
const RECENT_REZONING_MAX = 5;
const INCOME_LOW_LIMIT_USD = 25_000;
const INCOME_HIGH_LIMIT_USD = 150_000;

const AXES: Readonly<Record<keyof OppositionInputs, AxisSpec>> = {
  hoaDensityWithin0_8Km: {
    weight: 0.20,
    scoreFn: (v) => clamp01(v / HOA_DENSITY_MAX),
  },
  ownerOccupiedSharePct: {
    weight: 0.15,
    scoreFn: (v) => clamp01(v / 100),
  },
  medianHouseholdIncomeUsd: {
    weight: 0.15,
    scoreFn: (v) => incomeBathtub(v),
  },
  contestedRezoningCountLast5Yr: {
    weight: 0.20,
    scoreFn: (v) => clamp01(v / RECENT_REZONING_MAX),
  },
  distanceToHistoricDistrictMetres: {
    weight: 0.10,
    scoreFn: (v) => clamp01(1 - v / 2_000),
  },
  transitProximityScore: {
    weight: 0.10,
    scoreFn: (v) => clamp01(1 - v), // higher transit -> less opposition
  },
  educationAttainmentSharePct: {
    weight: 0.10,
    scoreFn: (v) => clamp01(v / 100),
  },
};

export function scoreOpposition(
  inputs: OppositionInputs,
): OppositionScore {
  const contribution: Record<keyof OppositionInputs, number> = {
    hoaDensityWithin0_8Km: 0,
    ownerOccupiedSharePct: 0,
    medianHouseholdIncomeUsd: 0,
    contestedRezoningCountLast5Yr: 0,
    distanceToHistoricDistrictMetres: 0,
    transitProximityScore: 0,
    educationAttainmentSharePct: 0,
  };

  let score = 0;
  for (const key of Object.keys(AXES) as Array<keyof OppositionInputs>) {
    const spec = AXES[key];
    const c = spec.weight * spec.scoreFn(inputs[key]);
    contribution[key] = c;
    score += c;
  }
  const score100 = clamp01(score) * 100;

  const band: OppositionScore['band'] =
    score100 >= 75
      ? 'severe'
      : score100 >= 55
        ? 'high'
        : score100 >= 35
          ? 'moderate'
          : 'low';

  return {
    score: score100,
    band,
    contributionByAxis: contribution,
  };
}

/**
 * Bathtub curve — both very low and very high incomes drive
 * opposition (displacement fear + HOA activity).
 */
function incomeBathtub(v: number): number {
  if (v <= INCOME_LOW_LIMIT_USD) return 0.7;
  if (v >= INCOME_HIGH_LIMIT_USD) return 0.85;
  // Middle income: trough at 75k → 0.2
  const t = (v - INCOME_LOW_LIMIT_USD) / (INCOME_HIGH_LIMIT_USD - INCOME_LOW_LIMIT_USD);
  // Symmetric U shape: f(0)=0.7, f(0.4)=0.2, f(1)=0.85
  return 0.7 - 2 * t + 1.65 * t * t;
}

function clamp01(x: number): number {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}
