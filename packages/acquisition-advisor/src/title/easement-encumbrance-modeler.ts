/**
 * Easement encumbrance modeler — quantifies $ impact of a given
 * easement on the deal.
 *
 * Inputs: easement scope (surface / sub-surface / aerial), term,
 * exclusivity, the affected area, and the subject's value-per-sqm.
 *
 * Impact = developable-area lost × value-per-sqm + compensation
 * owed + entitlement-friction premium.
 */

import type { EasementImpact } from '../types.js';

export interface EasementImpactInputs {
  readonly easementId: string;
  readonly scope: EasementImpact['scope'];
  readonly term: EasementImpact['term'];
  readonly exclusivity: EasementImpact['exclusivity'];
  readonly affectedAreaSqm: number;
  readonly subjectValuePerSqm: number;
  /** Probability that buildable envelope still works around easement. */
  readonly buildAroundProbability: number;
  readonly compensationOwed?: number;
}

const SCOPE_DEVELOPABLE_LOSS_SHARE = {
  surface: 1.0,
  subSurface: 0.4,
  aerial: 0.6,
  mixed: 0.8,
} as const;

const TERM_PREMIUM_MULTIPLIER = {
  perpetual: 1.0,
  fixed: 0.6,
  terminable: 0.3,
} as const;

const EXCLUSIVITY_MULTIPLIER = {
  exclusive: 1.0,
  shared: 0.6,
} as const;

export function modelEasementImpact(
  inputs: EasementImpactInputs,
): EasementImpact {
  if (inputs.affectedAreaSqm < 0) {
    throw new Error('affectedAreaSqm must be >= 0');
  }
  if (inputs.subjectValuePerSqm < 0) {
    throw new Error('subjectValuePerSqm must be >= 0');
  }
  if (inputs.buildAroundProbability < 0 || inputs.buildAroundProbability > 1) {
    throw new Error('buildAroundProbability must be in [0,1]');
  }

  const lossShare = SCOPE_DEVELOPABLE_LOSS_SHARE[inputs.scope];
  const termMult = TERM_PREMIUM_MULTIPLIER[inputs.term];
  const exclMult = EXCLUSIVITY_MULTIPLIER[inputs.exclusivity];

  const developableAreaLostSqm =
    inputs.affectedAreaSqm * lossShare * termMult * exclMult;
  const buildAroundFeasible = inputs.buildAroundProbability >= 0.7;

  // If build-around feasible, only 30% of lost area counts as $$ loss
  const effectiveLossSqm = buildAroundFeasible
    ? developableAreaLostSqm * 0.3
    : developableAreaLostSqm;

  const valuationImpact =
    effectiveLossSqm * inputs.subjectValuePerSqm +
    (inputs.compensationOwed ?? 0);

  return {
    easementId: inputs.easementId,
    scope: inputs.scope,
    term: inputs.term,
    exclusivity: inputs.exclusivity,
    developableAreaLostSqm,
    buildAroundFeasible,
    compensationOwed: inputs.compensationOwed ?? 0,
    valuationImpact,
  };
}
