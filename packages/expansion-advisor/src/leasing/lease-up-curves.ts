/**
 * Lease-up curves per asset class.
 *
 * Logistic with class-specific midpoint, steepness, and stabilised
 * vacancy floor (NMHC / NAIOP / ICSC bench-marks 2026).
 */

import type { AssetClass, LeaseUpCurve } from '../types.js';

interface ClassParams {
  readonly midpointMonths: number;
  readonly steepness: number;
  readonly stabilisedVacancy: number;
}

const DEFAULTS: Readonly<Record<AssetClass, ClassParams>> = {
  multifamily: { midpointMonths: 6, steepness: 0.5, stabilisedVacancy: 0.05 },
  office: { midpointMonths: 18, steepness: 0.2, stabilisedVacancy: 0.12 },
  retail: { midpointMonths: 12, steepness: 0.25, stabilisedVacancy: 0.07 },
  industrial: { midpointMonths: 4, steepness: 0.55, stabilisedVacancy: 0.04 },
  'mixed-use': { midpointMonths: 10, steepness: 0.3, stabilisedVacancy: 0.08 },
  land: { midpointMonths: 0, steepness: 0, stabilisedVacancy: 1 },
};

export interface LeaseUpInputs {
  readonly assetClass: AssetClass;
  readonly horizonMonths: number;
  readonly overrides?: Partial<ClassParams>;
}

export function leaseUpCurve(input: LeaseUpInputs): LeaseUpCurve {
  const base = DEFAULTS[input.assetClass];
  const params: ClassParams = {
    midpointMonths: input.overrides?.midpointMonths ?? base.midpointMonths,
    steepness: input.overrides?.steepness ?? base.steepness,
    stabilisedVacancy: input.overrides?.stabilisedVacancy ?? base.stabilisedVacancy,
  };

  const ceiling = 1 - params.stabilisedVacancy;
  const points: Array<{ t: number; occupied: number }> = [];

  for (let t = 0; t <= input.horizonMonths; t += 1) {
    if (input.assetClass === 'land') {
      points.push({ t, occupied: 0 });
      continue;
    }
    const occ = ceiling / (1 + Math.exp(-params.steepness * (t - params.midpointMonths)));
    points.push({ t, occupied: occ });
  }

  return {
    assetClass: input.assetClass,
    midpointMonths: params.midpointMonths,
    steepness: params.steepness,
    stabilisedVacancy: params.stabilisedVacancy,
    points,
  };
}
