/**
 * Slope stability — per USGS Slope Stability Hazard Mapping +
 * FHWA Geotechnical Design Manual (2022).
 *
 * Crude band-based design uplift; production deals should
 * commission a geotechnical investigation.
 */

import type { SlopeStability, SlopeStabilityInputs } from '../types.js';

export function scoreSlopeStability(
  inputs: SlopeStabilityInputs,
): SlopeStability {
  if (inputs.slopePct < 0) {
    throw new Error('slopePct must be >= 0');
  }
  let band: SlopeStability['band'];
  let designUpliftPct: number;
  let engineeredRetainingRequired: boolean;

  if (inputs.slopePct < 5) {
    band = 'flat';
    designUpliftPct = 0;
    engineeredRetainingRequired = false;
  } else if (inputs.slopePct < 15) {
    band = 'gentle';
    designUpliftPct = 0.02;
    engineeredRetainingRequired = false;
  } else if (inputs.slopePct < 25) {
    band = 'moderate';
    designUpliftPct = 0.08;
    engineeredRetainingRequired = true;
  } else if (inputs.slopePct < 40) {
    band = 'steep';
    designUpliftPct = 0.20;
    engineeredRetainingRequired = true;
  } else {
    band = 'very-steep';
    designUpliftPct = 0.35;
    engineeredRetainingRequired = true;
  }

  return { band, designUpliftPct, engineeredRetainingRequired };
}
