/**
 * HBU Gate 2 — physically possible.
 *
 * Lot-coverage envelope, slope, soils, utilities, and access.
 */

import type { CandidateUse, GateResult, Parcel } from '../types.js';

export interface PhysicalRules {
  /** Maximum allowable slope in percent. */
  readonly maxSlopePct: number;
  /** Required soil bearing capacity in kPa. */
  readonly minSoilBearingKpa: number;
  /** Whether utilities must already be on-site. */
  readonly requireUtilitiesOnSite: boolean;
}

export function physicallyPossible(
  parcel: Parcel,
  use: CandidateUse,
  rules: PhysicalRules,
): GateResult {
  const reasons: string[] = [];

  // Footprint must fit within site after setbacks.
  const sideTotal = parcel.setbacksM.side * 2;
  // Crude rectangular approximation: assume sqrt(site) per side.
  const sideM = Math.sqrt(parcel.siteAreaSqm);
  const usableSideM = sideM - parcel.setbacksM.front - parcel.setbacksM.rear;
  const usableWidthM = sideM - sideTotal;
  const buildableFootprintSqm = Math.max(0, usableSideM * usableWidthM);
  const requiredFootprint = use.programmeSqm / Math.max(1, use.far);

  if (buildableFootprintSqm < requiredFootprint) {
    reasons.push(
      `setback envelope yields ${buildableFootprintSqm.toFixed(0)}sqm footprint, requires ${requiredFootprint.toFixed(0)}sqm`,
    );
  }

  if (parcel.slopePct !== undefined && parcel.slopePct > rules.maxSlopePct) {
    reasons.push(
      `slope ${parcel.slopePct}% exceeds buildable max ${rules.maxSlopePct}%`,
    );
  }

  if (
    parcel.soilBearingKpa !== undefined &&
    parcel.soilBearingKpa < rules.minSoilBearingKpa
  ) {
    reasons.push(
      `soil bearing ${parcel.soilBearingKpa}kPa below minimum ${rules.minSoilBearingKpa}kPa`,
    );
  }

  if (rules.requireUtilitiesOnSite && parcel.utilities) {
    if (!parcel.utilities.power) reasons.push('power not on-site');
    if (!parcel.utilities.water) reasons.push('water not on-site');
    if (!parcel.utilities.sewer) reasons.push('sewer not on-site');
  }

  return {
    use,
    gate: 'physicallyPossible',
    outcome: reasons.length === 0 ? 'pass' : 'fail',
    reasons,
  };
}
