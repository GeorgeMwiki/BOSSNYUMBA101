/**
 * Water reclaim / greywater estimator.
 *
 * Heuristics:
 *   - Rainwater capture: 0.6 efficiency × rainfall × roof area.
 *   - Greywater reuse: ~40% of building demand displaced.
 *   - Energy/carbon avoided via pumped supply: 0.3 kWh/m³ → 0.12 kg CO2e/m³.
 *
 * Pure. No I/O.
 */

import type { ProjectProfile } from '../types.js';

export interface WaterReclaimEstimate {
  readonly annualHarvestableM3: number;
  readonly annualGreywaterReuseM3: number;
  readonly annualWaterAvoidedM3: number;
  readonly annualAbatementTCO2e: number;
  readonly indicativeCapexUsd: number;
}

const KG_CO2_PER_M3 = 0.12;

export function estimateWaterReclaim(
  profile: ProjectProfile,
  options: { readonly rainfallMmPerYear?: number; readonly roofAreaSqm?: number } = {},
): WaterReclaimEstimate {
  const rainfall = options.rainfallMmPerYear ?? defaultRainfallForProfile(profile);
  const roofArea = options.roofAreaSqm ?? (profile.areaHa ?? 0.5) * 10_000 * 0.3; // 30% built coverage
  const harvest = (rainfall / 1000) * roofArea * 0.6; // m³/yr
  const greywater = harvest * 0.5;
  const total = harvest + greywater;
  const tCO2e = (total * KG_CO2_PER_M3) / 1000;
  return {
    annualHarvestableM3: Math.round(harvest),
    annualGreywaterReuseM3: Math.round(greywater),
    annualWaterAvoidedM3: Math.round(total),
    annualAbatementTCO2e: Math.round(tCO2e),
    indicativeCapexUsd: Math.round(roofArea * 35), // ~USD 35/m² capex
  };
}

function defaultRainfallForProfile(profile: ProjectProfile): number {
  if (profile.signals.includes('high-rainfall')) return 1500;
  if (profile.signals.includes('low-rainfall')) return 500;
  if (profile.biomes.includes('arid') || profile.biomes.includes('semi-arid')) return 400;
  if (profile.biomes.includes('coastal')) return 1300;
  if (profile.biomes.includes('tropical-forest')) return 2000;
  return 900;
}
