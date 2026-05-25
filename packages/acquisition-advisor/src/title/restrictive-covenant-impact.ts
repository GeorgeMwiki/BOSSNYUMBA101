/**
 * Restrictive covenant impact — expected-loss model.
 *
 * Expected loss = P(breach) × cost-of-cure × P(enforcement)
 *
 * Use-category covenants are heavier than aesthetic ones; HOA-
 * enforced covenants typically enforce.
 */

import type { RestrictiveCovenantImpact } from '../types.js';

const CATEGORY_BASELINE_COST = {
  use: 250_000,
  density: 180_000,
  aesthetics: 25_000,
  height: 200_000,
  buildingLine: 75_000,
  architecturalReview: 15_000,
} as const;

export interface CovenantInputs {
  readonly covenantId: string;
  readonly category: RestrictiveCovenantImpact['category'];
  readonly probabilityOfBreach: number;
  readonly probabilityOfEnforcement: number;
  /** Optional override of baseline cost. */
  readonly costOfCureOverride?: number;
}

export function modelCovenantImpact(
  inputs: CovenantInputs,
): RestrictiveCovenantImpact {
  if (inputs.probabilityOfBreach < 0 || inputs.probabilityOfBreach > 1) {
    throw new Error('probabilityOfBreach must be in [0,1]');
  }
  if (inputs.probabilityOfEnforcement < 0 || inputs.probabilityOfEnforcement > 1) {
    throw new Error('probabilityOfEnforcement must be in [0,1]');
  }
  const costOfCure =
    inputs.costOfCureOverride ?? CATEGORY_BASELINE_COST[inputs.category];
  const expectedLoss =
    inputs.probabilityOfBreach * inputs.probabilityOfEnforcement * costOfCure;

  return {
    covenantId: inputs.covenantId,
    category: inputs.category,
    probabilityOfBreach: inputs.probabilityOfBreach,
    costOfCure,
    probabilityOfEnforcement: inputs.probabilityOfEnforcement,
    expectedLoss,
  };
}

export const COVENANT_BASELINE_COSTS = CATEGORY_BASELINE_COST;
