/**
 * Regenerative agriculture corridor estimator.
 *
 * Verra VM0042 methodology baseline:
 *   - SOC accumulation 0.3 - 0.6 tC/ha/yr in tropical / subtropical climates
 *   - Crediting period 30 years
 *   - Buffer pool 10 - 25% (default 15%)
 *
 * Pure. No I/O.
 */

import type { ProjectProfile } from '../types.js';

export interface RegenAgEstimate {
  readonly hectaresUnderManagement: number;
  readonly annualSocSequestrationTCO2e: number;
  readonly bufferPoolPct: number;
  readonly issuableTCO2ePerYear: number;
  readonly creditingPeriodYears: number;
  readonly indicativeCapexUsdPerHa: number;
}

const SOC_T_C_PER_HA_PER_YEAR = 0.5;
const T_CO2E_PER_T_C = 3.67;
const DEFAULT_BUFFER_POOL_PCT = 15;
const DEFAULT_CREDITING_PERIOD = 30;
const CAPEX_USD_PER_HA = 350;

export function estimateRegenAg(profile: ProjectProfile, hectaresHint?: number): RegenAgEstimate {
  const ha = hectaresHint ?? defaultArea(profile);
  const annualSocCO2e = ha * SOC_T_C_PER_HA_PER_YEAR * T_CO2E_PER_T_C;
  const issuable = annualSocCO2e * (1 - DEFAULT_BUFFER_POOL_PCT / 100);
  return {
    hectaresUnderManagement: ha,
    annualSocSequestrationTCO2e: Math.round(annualSocCO2e),
    bufferPoolPct: DEFAULT_BUFFER_POOL_PCT,
    issuableTCO2ePerYear: Math.round(issuable),
    creditingPeriodYears: DEFAULT_CREDITING_PERIOD,
    indicativeCapexUsdPerHa: CAPEX_USD_PER_HA,
  };
}

function defaultArea(profile: ProjectProfile): number {
  // Corridor: 1km buffer × length × both sides = 200 ha/km
  if (profile.signals.includes('linear-corridor') && profile.lengthKm) {
    return profile.lengthKm * 200;
  }
  return profile.areaHa ?? 1000;
}
