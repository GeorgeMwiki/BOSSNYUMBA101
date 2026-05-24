/**
 * Flood zone risk — FEMA + EA NEMA Flood Risk Map.
 *
 * Caller passes either:
 *  - FEMA zone code, or
 *  - EA risk band, or
 *  - raw distance + elevation parameters
 */

import type { FloodRisk, FloodRiskInputs } from '../types.js';

const FEMA_TO_BAND: Readonly<Record<NonNullable<FloodRiskInputs['femaZone']>, FloodRisk['band']>> = {
  X: 'minimal',
  'X-shaded': 'low',
  A: 'high',
  AE: 'high',
  AO: 'moderate',
  AH: 'moderate',
  V: 'very-high',
  VE: 'very-high',
  D: 'moderate',
};

const EA_TO_BAND: Readonly<Record<NonNullable<FloodRiskInputs['eaRiskBand']>, FloodRisk['band']>> = {
  low: 'low',
  moderate: 'moderate',
  high: 'high',
  'very-high': 'very-high',
};

const PREMIUM_PER_SQM_USD = {
  minimal: 0,
  low: 0.5,
  moderate: 2.5,
  high: 6.0,
  'very-high': 15.0,
} as const;

const DESIGN_UPLIFT = {
  minimal: 0,
  low: 0.01,
  moderate: 0.04,
  high: 0.10,
  'very-high': 0.18,
} as const;

export function scoreFloodRisk(inputs: FloodRiskInputs): FloodRisk {
  let band: FloodRisk['band'];
  if (inputs.femaZone) {
    band = FEMA_TO_BAND[inputs.femaZone];
  } else if (inputs.eaRiskBand) {
    band = EA_TO_BAND[inputs.eaRiskBand];
  } else if (
    inputs.distanceToWatercourseMetres !== undefined &&
    inputs.elevationMetres !== undefined &&
    inputs.base100YrFloodElevationMetres !== undefined
  ) {
    band = deriveFromRaw(
      inputs.distanceToWatercourseMetres,
      inputs.elevationMetres,
      inputs.base100YrFloodElevationMetres,
    );
  } else {
    throw new Error(
      'scoreFloodRisk requires femaZone OR eaRiskBand OR (distance + elevation + base flood elevation)',
    );
  }

  return {
    band,
    insuranceRequired: band === 'high' || band === 'very-high',
    annualPremiumPerSqmUsd: PREMIUM_PER_SQM_USD[band],
    designUpliftPct: DESIGN_UPLIFT[band],
  };
}

function deriveFromRaw(
  distance: number,
  elevation: number,
  baseFloodElevation: number,
): FloodRisk['band'] {
  // If finished elevation is below or near the 100-yr base, treat as very-high.
  if (elevation < baseFloodElevation - 0.5) return 'very-high';
  if (elevation < baseFloodElevation) return 'high';
  if (distance < 100) return 'high';
  if (elevation < baseFloodElevation + 1.0) return 'moderate';
  if (distance < 500) return 'moderate';
  if (distance < 1_500) return 'low';
  return 'minimal';
}

export const FLOOD_FEMA_TO_BAND = FEMA_TO_BAND;
export const FLOOD_EA_TO_BAND = EA_TO_BAND;
