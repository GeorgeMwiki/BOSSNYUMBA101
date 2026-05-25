/**
 * Corridor solar co-location estimator.
 *
 * Heuristics:
 *   - 1 MW per ~5 km of corridor ROW (East Africa, 1-side strip).
 *   - 5.5 - 6.5 kWh/m²/day insolation in TZ/KE/UG → ~1500 MWh/MW/yr.
 *   - Grid emission factor used = 0.40 tCO2e/MWh (representative
 *     for East-Africa hybrid grids 2026).
 *   - Capex 2026 = USD 0.85m/MW utility-scale, USD 1.20m/MW
 *     corridor-distributed.
 *
 * Pure. No I/O.
 */

import type { ProjectProfile } from '../types.js';

export interface SolarColocationEstimate {
  readonly mwInstallable: number;
  readonly annualGenerationMwh: number;
  readonly annualAbatementTCO2e: number;
  readonly indicativeCapexUsd: number;
}

const MW_PER_KM = 0.2;
const MWH_PER_MW_PER_YEAR = 1500;
const GRID_EF_T_PER_MWH = 0.4;
const CAPEX_USD_PER_MW = 1_200_000;

export function estimateCorridorSolar(profile: ProjectProfile): SolarColocationEstimate {
  const lengthKm = profile.lengthKm ?? 0;
  const mw = lengthKm * MW_PER_KM;
  const mwh = mw * MWH_PER_MW_PER_YEAR;
  const tCO2e = mwh * GRID_EF_T_PER_MWH;
  return {
    mwInstallable: Math.round(mw * 10) / 10,
    annualGenerationMwh: Math.round(mwh),
    annualAbatementTCO2e: Math.round(tCO2e),
    indicativeCapexUsd: Math.round(mw * CAPEX_USD_PER_MW),
  };
}
