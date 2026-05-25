/**
 * EV charging hub estimator.
 *
 * Assumes a hub of 8 - 24 DC fast chargers; sized by project context.
 * Single hub: 8 × 150 kW chargers → ~1.2 MW peak.
 * Corridor highway: 1 hub per 150 km of route.
 *
 * Abatement is per-charger session displacement:
 *   ~6.5 sessions/day × 50 kWh × 0.4 tCO2e/MWh × 365 = ~47 tCO2e/yr per charger.
 *   Add ~3x multiplier for grid-fuel displacement vs. petrol: 140 tCO2e.
 *
 * Pure. No I/O.
 */

import type { ProjectProfile } from '../types.js';

export interface EvHubEstimate {
  readonly hubCount: number;
  readonly chargersPerHub: number;
  readonly totalChargers: number;
  readonly annualAbatementTCO2e: number;
  readonly indicativeCapexUsd: number;
}

const CHARGER_CAPEX_USD = 65_000;
const CHARGER_ABATEMENT_T_PER_YEAR = 140;

export function estimateEvHub(profile: ProjectProfile): EvHubEstimate {
  // Linear infra → multiple hubs spaced along route
  if (profile.signals.includes('linear-corridor') && profile.lengthKm) {
    const hubs = Math.max(1, Math.round(profile.lengthKm / 150));
    const chargersPerHub = 8;
    const total = hubs * chargersPerHub;
    return {
      hubCount: hubs,
      chargersPerHub,
      totalChargers: total,
      annualAbatementTCO2e: total * CHARGER_ABATEMENT_T_PER_YEAR,
      indicativeCapexUsd: total * CHARGER_CAPEX_USD,
    };
  }

  // Point asset (retail) — single hub of 12
  const total = 12;
  return {
    hubCount: 1,
    chargersPerHub: total,
    totalChargers: total,
    annualAbatementTCO2e: total * CHARGER_ABATEMENT_T_PER_YEAR,
    indicativeCapexUsd: total * CHARGER_CAPEX_USD,
  };
}
