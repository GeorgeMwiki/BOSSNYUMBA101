/**
 * Co-benefits scorer — composes SDG alignment, jobs, health, water,
 * gender dimensions into an ImpactScore.
 *
 * Heuristic mapping by category:
 *   - renewable-energy: jobs ↑, gender mid
 *   - biodiversity: water ↑, health mid
 *   - water: water ↑↑, health ↑, gender ↑
 *   - circular-economy: jobs mid
 *   - land-use: water ↑, jobs ↑, gender ↑
 *   - transport-emissions: health ↑↑ (PM2.5)
 *   - energy-efficiency: jobs mid
 *   - pollution-prevention: health ↑↑
 *   - climate-adaptation: water ↑, health ↑
 *   - community: jobs ↑↑, gender ↑↑, health ↑
 *
 * Pure. No I/O.
 *
 * Reference: `.audit/sota-2026-05-24/05-green-angle-advisor.md` §7.
 */

import type { GreenOpportunity, ImpactScore, OpportunityCategory } from '../types.js';
import { scoreSdgAlignment } from './sdg-alignment-scorer.js';

interface CategoryWeights {
  readonly jobs: number;
  readonly health: number;
  readonly water: number;
  readonly gender: number;
}

const CATEGORY_WEIGHTS: Readonly<Record<OpportunityCategory, CategoryWeights>> = {
  'renewable-energy': { jobs: 0.7, health: 0.3, water: 0.1, gender: 0.4 },
  biodiversity: { jobs: 0.3, health: 0.4, water: 0.8, gender: 0.3 },
  water: { jobs: 0.4, health: 0.8, water: 1.0, gender: 0.7 },
  'circular-economy': { jobs: 0.5, health: 0.4, water: 0.2, gender: 0.3 },
  'land-use': { jobs: 0.6, health: 0.4, water: 0.7, gender: 0.5 },
  'transport-emissions': { jobs: 0.4, health: 0.9, water: 0.1, gender: 0.3 },
  'energy-efficiency': { jobs: 0.4, health: 0.3, water: 0.1, gender: 0.3 },
  'pollution-prevention': { jobs: 0.3, health: 1.0, water: 0.4, gender: 0.3 },
  'climate-adaptation': { jobs: 0.4, health: 0.7, water: 0.7, gender: 0.5 },
  community: { jobs: 0.9, health: 0.6, water: 0.3, gender: 0.9 },
};

const DEFAULT_DIM_WEIGHTS = {
  sdgAlignment: 0.3,
  jobs: 0.2,
  health: 0.2,
  water: 0.15,
  gender: 0.15,
} as const;

export interface CoBenefitsWeights {
  readonly sdgAlignment?: number;
  readonly jobs?: number;
  readonly health?: number;
  readonly water?: number;
  readonly gender?: number;
}

export function scoreCoBenefits(
  opportunities: readonly GreenOpportunity[],
  weights: CoBenefitsWeights = {},
): ImpactScore {
  const sdg = scoreSdgAlignment(opportunities);

  let jobs = 0;
  let health = 0;
  let water = 0;
  let gender = 0;

  for (const opp of opportunities) {
    const w = CATEGORY_WEIGHTS[opp.category];
    jobs += w.jobs * opp.score;
    health += w.health * opp.score;
    water += w.water * opp.score;
    gender += w.gender * opp.score;
  }

  // Normalise by opportunity count (avoid divide-by-zero)
  const n = Math.max(1, opportunities.length);
  const jobsN = Math.min(1, jobs / n);
  const healthN = Math.min(1, health / n);
  const waterN = Math.min(1, water / n);
  const genderN = Math.min(1, gender / n);

  const w = {
    sdgAlignment: weights.sdgAlignment ?? DEFAULT_DIM_WEIGHTS.sdgAlignment,
    jobs: weights.jobs ?? DEFAULT_DIM_WEIGHTS.jobs,
    health: weights.health ?? DEFAULT_DIM_WEIGHTS.health,
    water: weights.water ?? DEFAULT_DIM_WEIGHTS.water,
    gender: weights.gender ?? DEFAULT_DIM_WEIGHTS.gender,
  };
  const totalW = w.sdgAlignment + w.jobs + w.health + w.water + w.gender;
  if (Math.abs(totalW - 1) > 0.01) {
    throw new Error(`Co-benefits weights must sum to 1.0 (got ${totalW.toFixed(3)})`);
  }

  const coBenefitsScore =
    sdg.alignment * w.sdgAlignment +
    jobsN * w.jobs +
    healthN * w.health +
    waterN * w.water +
    genderN * w.gender;

  return {
    sdgVector: sdg.vector,
    coBenefitsScore: Math.round(coBenefitsScore * 1000) / 1000,
    dimensions: {
      sdgAlignment: Math.round(sdg.alignment * 1000) / 1000,
      jobs: Math.round(jobsN * 1000) / 1000,
      health: Math.round(healthN * 1000) / 1000,
      water: Math.round(waterN * 1000) / 1000,
      gender: Math.round(genderN * 1000) / 1000,
    },
    sdgCount: sdg.count,
  };
}
