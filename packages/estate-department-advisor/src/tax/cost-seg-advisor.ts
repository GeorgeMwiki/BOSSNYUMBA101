/**
 * cost-seg-advisor — depreciation acceleration estimator.
 *
 * Per ASCSP (American Society of Cost Segregation Professionals)
 * 2023 typical reclassification breakdown for commercial RE:
 *   5-yr life: 15-25 % of basis
 *   7-yr life: 5-10 %
 *   15-yr life: 8-15 %
 * Remainder stays at 27.5 yr (residential) or 39 yr (commercial).
 *
 * NPV of acceleration on $5M building ~ $400k at 8% discount.
 */

import type { PropertySnapshot, TaxOpportunity } from '../types.js';

export interface CostSegInput {
  readonly property: PropertySnapshot;
  readonly ownerMarginalTaxRate: number; // 0..1
  readonly discountRate: number; // 0..1 (e.g. 0.08)
  readonly placedInServiceMs: number;
  readonly nowMs: number;
}

const FIVE_YR_PCT = 0.20;
const SEVEN_YR_PCT = 0.075;
const FIFTEEN_YR_PCT = 0.115;
const COMMERCIAL_BASE_LIFE = 39;
const RESIDENTIAL_BASE_LIFE = 27.5;
const MS_PER_YEAR = 365 * 24 * 60 * 60 * 1000;

function presentValueAccelerationFactor(
  shortLifeYears: number,
  baseLifeYears: number,
  discountRate: number,
): number {
  // Approximate NPV-of-acceleration: 1 - (annuity short / annuity base).
  const annuity = (yrs: number) => (1 - Math.pow(1 + discountRate, -yrs)) / discountRate;
  if (annuity(baseLifeYears) <= 0) return 0;
  return 1 - annuity(shortLifeYears) / annuity(baseLifeYears);
}

export function estimateCostSeg(input: CostSegInput): TaxOpportunity {
  const yearsHeld = (input.nowMs - input.placedInServiceMs) / MS_PER_YEAR;
  const remainingMultiplier = Math.max(0, 1 - yearsHeld / COMMERCIAL_BASE_LIFE);
  const baseLife =
    input.property.assetClass === 'multifamily'
      ? RESIDENTIAL_BASE_LIFE
      : COMMERCIAL_BASE_LIFE;

  const fiveYrBasis = input.property.basisUsd * FIVE_YR_PCT * remainingMultiplier;
  const sevenYrBasis = input.property.basisUsd * SEVEN_YR_PCT * remainingMultiplier;
  const fifteenYrBasis = input.property.basisUsd * FIFTEEN_YR_PCT * remainingMultiplier;

  const f5 = presentValueAccelerationFactor(5, baseLife, input.discountRate);
  const f7 = presentValueAccelerationFactor(7, baseLife, input.discountRate);
  const f15 = presentValueAccelerationFactor(15, baseLife, input.discountRate);

  const npvSavings =
    (fiveYrBasis * f5 + sevenYrBasis * f7 + fifteenYrBasis * f15) *
    input.ownerMarginalTaxRate;

  return {
    id: `cost-seg.${input.property.propertyId}`,
    kind: 'cost-seg',
    headline: `Cost-segregation study on ${input.property.name}: ~$${Math.round(npvSavings).toLocaleString('en-US')} NPV`,
    estimatedSavingsUsd: Math.round(npvSavings),
    rationale: `ASCSP-typical 5/7/15-yr reclassification accelerates ~${((FIVE_YR_PCT + SEVEN_YR_PCT + FIFTEEN_YR_PCT) * 100).toFixed(0)}% of basis; NPV at ${(input.discountRate * 100).toFixed(0)}% discount.`,
    citation: 'ASCSP 2023 Cost-Segregation Study',
    jurisdiction: input.property.jurisdiction,
  };
}

export const __test__ = {
  FIVE_YR_PCT,
  SEVEN_YR_PCT,
  FIFTEEN_YR_PCT,
  presentValueAccelerationFactor,
};
