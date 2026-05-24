/**
 * Gentrification index — 8-axis weighted blend per DataDelve / AEM
 * / Knight Frank methodologies.
 */

import type { GentrificationAxes, GentrificationIndex } from '../types.js';

const WEIGHTS: Readonly<Record<keyof GentrificationAxes, number>> = {
  medianIncomeTrajectory: 0.15,
  educationalAttainment: 0.10,
  newBuildPermitDensity: 0.15,
  cafeDensity: 0.10,
  crimeRateDecline: 0.10,
  rentGrowthVelocity: 0.15,
  ownerOccupierShare: 0.10,
  transitAccessibility: 0.15,
};

export function computeGentrificationIndex(
  axes: GentrificationAxes,
): GentrificationIndex {
  validateUnitInterval(axes);

  const contribution = Object.fromEntries(
    (Object.keys(WEIGHTS) as Array<keyof GentrificationAxes>).map((k) => [
      k,
      axes[k] * WEIGHTS[k],
    ]),
  ) as Record<keyof GentrificationAxes, number>;

  const score = Object.values(contribution).reduce((a, b) => a + b, 0);

  return {
    score,
    contribution,
    verdict: verdict(score),
  };
}

function verdict(score: number): GentrificationIndex['verdict'] {
  if (score < 0.2) return 'low';
  if (score < 0.4) return 'emerging';
  if (score < 0.6) return 'advancing';
  if (score < 0.8) return 'mature';
  return 'late';
}

function validateUnitInterval(axes: GentrificationAxes): void {
  for (const [k, v] of Object.entries(axes)) {
    if (typeof v !== 'number' || v < 0 || v > 1 || !Number.isFinite(v)) {
      throw new Error(`gentrification: axis ${k} must be in [0,1]`);
    }
  }
}
