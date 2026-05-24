/**
 * HBU Gate 4 — maximally productive.
 *
 * Ranks the survivors of the prior three gates by a composite
 * productivity score:
 *   - Residual land value (40%)
 *   - Yield-on-cost (30%)
 *   - IRR (20%)
 *   - NPV per sqm site (10%)
 */

import type { CandidateUse } from '../types.js';

export interface ProductivityInputs {
  readonly use: CandidateUse;
  readonly medianIrr: number;
  readonly medianNpv: number;
  readonly stabilisedNoi: number;
  readonly siteAreaSqm: number;
}

export interface ProductivityRanked {
  readonly use: CandidateUse;
  readonly residualLandValue: number;
  readonly yieldOnCost: number;
  readonly irr: number;
  readonly npv: number;
  readonly productivityScore: number;
}

const W_RESIDUAL = 0.4;
const W_YOC = 0.3;
const W_IRR = 0.2;
const W_NPV = 0.1;

export function maximallyProductive(
  inputs: ReadonlyArray<ProductivityInputs>,
): ProductivityRanked[] {
  if (inputs.length === 0) return [];

  const enriched = inputs.map((i) => {
    const totalBuildCost = i.use.buildCostPerSqm * i.use.programmeSqm;
    const totalCost = totalBuildCost + i.use.landBasis;
    const stabilisedValue = i.stabilisedNoi / i.use.capRate;
    const residualLandValue = Math.max(0, stabilisedValue - totalBuildCost);
    const yoc = totalCost > 0 ? i.stabilisedNoi / totalCost : 0;
    const npvPerSqm = i.siteAreaSqm > 0 ? i.medianNpv / i.siteAreaSqm : 0;
    return {
      use: i.use,
      residualLandValue,
      yieldOnCost: yoc,
      irr: i.medianIrr,
      npv: i.medianNpv,
      npvPerSqm,
    };
  });

  // Normalise each metric to [0,1] across the survivor set.
  const maxResidual = Math.max(...enriched.map((e) => e.residualLandValue), 1e-9);
  const maxYoc = Math.max(...enriched.map((e) => e.yieldOnCost), 1e-9);
  const maxIrr = Math.max(...enriched.map((e) => e.irr), 1e-9);
  const maxNpvPerSqm = Math.max(...enriched.map((e) => e.npvPerSqm), 1e-9);

  return enriched
    .map((e) => ({
      use: e.use,
      residualLandValue: e.residualLandValue,
      yieldOnCost: e.yieldOnCost,
      irr: e.irr,
      npv: e.npv,
      productivityScore:
        W_RESIDUAL * (e.residualLandValue / maxResidual) +
        W_YOC * (e.yieldOnCost / maxYoc) +
        W_IRR * (e.irr / maxIrr) +
        W_NPV * (e.npvPerSqm / maxNpvPerSqm),
    }))
    .sort((a, b) => b.productivityScore - a.productivityScore);
}
