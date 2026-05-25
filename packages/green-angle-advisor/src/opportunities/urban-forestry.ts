/**
 * Urban forestry estimator.
 *
 * Heuristics:
 *   - 1 mature tree ≈ 21 kg CO2e/yr (US Forest Service rule of thumb)
 *   - Survival rate to 25 years: 60%
 *   - 1 ha hosts ~250 mature trees
 *   - PM2.5 reduction ~7 g per tree per year
 *
 * Pure. No I/O.
 */

import type { ProjectProfile } from '../types.js';

export interface UrbanForestryEstimate {
  readonly treesPlanted: number;
  readonly hectaresGreened: number;
  readonly survivingTreesAt25y: number;
  readonly annualAbatementTCO2eAtMaturity: number;
  readonly annualPm25ReductionKg: number;
  readonly indicativeCapexUsd: number;
}

const TREES_PER_HA = 250;
const TCO2E_PER_MATURE_TREE_PER_YEAR = 0.021;
const PM25_REDUCTION_G_PER_TREE_PER_YEAR = 7;
const COST_USD_PER_TREE = 18;
const SURVIVAL_TO_25Y = 0.6;

export function estimateUrbanForestry(profile: ProjectProfile, hectaresHint?: number): UrbanForestryEstimate {
  const ha = hectaresHint ?? defaultArea(profile);
  const trees = ha * TREES_PER_HA;
  const surviving = Math.round(trees * SURVIVAL_TO_25Y);
  const tCO2e = surviving * TCO2E_PER_MATURE_TREE_PER_YEAR;
  const pm25Kg = (surviving * PM25_REDUCTION_G_PER_TREE_PER_YEAR) / 1000;
  return {
    treesPlanted: Math.round(trees),
    hectaresGreened: ha,
    survivingTreesAt25y: surviving,
    annualAbatementTCO2eAtMaturity: Math.round(tCO2e),
    annualPm25ReductionKg: Math.round(pm25Kg),
    indicativeCapexUsd: Math.round(trees * COST_USD_PER_TREE),
  };
}

function defaultArea(profile: ProjectProfile): number {
  if (profile.areaHa && profile.areaHa > 0) return profile.areaHa * 0.1; // 10% of site
  if (profile.projectTypes.includes('infrastructure-airport')) return 30;
  if (profile.projectTypes.includes('residential')) return 2;
  return 5;
}
