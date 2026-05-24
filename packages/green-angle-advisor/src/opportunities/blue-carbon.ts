/**
 * Blue-carbon (mangrove + seagrass) estimator.
 *
 * Per IPCC 2013 Wetlands Supplement + Verra VM0033 calculations:
 *   - Mangroves: 6.2 tC/ha/yr biomass + 1.4 tC/ha/yr soil → 7.6 tC/ha/yr
 *     × 3.67 = 27.9 tCO2e/ha/yr early years, declining over time.
 *     Conservative steady-state ~1700 tCO2e per 100 ha matures.
 *   - Seagrass: ~50% of mangrove rate.
 *
 * Pure. No I/O.
 */

import type { ProjectProfile } from '../types.js';

export interface BlueCarbonEstimate {
  readonly habitat: 'mangrove' | 'seagrass';
  readonly hectaresRestorable: number;
  readonly annualSequestrationTCO2e: number;
  readonly creditingPeriodYears: number;
  readonly lifetimeCreditsTCO2e: number;
  readonly indicativeCapexUsdPerHa: number;
}

const MANGROVE_T_CO2E_PER_HA_YEAR = 17;
const SEAGRASS_T_CO2E_PER_HA_YEAR = 8;
const DEFAULT_CREDITING_PERIOD_YEARS = 30;
const MANGROVE_CAPEX_PER_HA = 6500;
const SEAGRASS_CAPEX_PER_HA = 22_000;

export function estimateBlueCarbon(
  profile: ProjectProfile,
  habitat: 'mangrove' | 'seagrass',
  hectaresHint?: number,
): BlueCarbonEstimate {
  const isMangrove = habitat === 'mangrove';
  const ratePerHa = isMangrove ? MANGROVE_T_CO2E_PER_HA_YEAR : SEAGRASS_T_CO2E_PER_HA_YEAR;
  const ha = hectaresHint ?? defaultArea(profile);
  const annual = ha * ratePerHa;
  return {
    habitat,
    hectaresRestorable: ha,
    annualSequestrationTCO2e: Math.round(annual),
    creditingPeriodYears: DEFAULT_CREDITING_PERIOD_YEARS,
    lifetimeCreditsTCO2e: Math.round(annual * DEFAULT_CREDITING_PERIOD_YEARS),
    indicativeCapexUsdPerHa: isMangrove ? MANGROVE_CAPEX_PER_HA : SEAGRASS_CAPEX_PER_HA,
  };
}

function defaultArea(profile: ProjectProfile): number {
  if (profile.areaHa && profile.areaHa > 0) return Math.min(profile.areaHa, 1000);
  if (profile.projectTypes.includes('infrastructure-port')) return 250;
  if (profile.projectTypes.includes('hospitality')) return 50;
  return 100;
}
