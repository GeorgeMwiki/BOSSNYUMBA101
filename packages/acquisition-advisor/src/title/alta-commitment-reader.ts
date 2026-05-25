/**
 * ALTA 2021 Commitment reader — schedule B-II scorer.
 *
 * Each exception is scored 0-10 (default by type; caller may
 * override). Aggregate score + critical-exception count drive
 * the deal verdict.
 *
 * Per ALTA Title Insurance Forms Committee 2021 Commitment
 * (06/17/06 supersedes 2006 form).
 */

import type {
  AltaCommitmentReading,
  ScheduleBException,
  ScheduleBExceptionType,
} from '../types.js';

export const DEFAULT_IMPACT_BY_TYPE: Readonly<Record<ScheduleBExceptionType, number>> = {
  utilityEasement: 1,
  accessEasement: 3,
  drainageEasement: 2,
  conservationEasement: 7,
  mineralReservation: 8,
  restrictiveCovenant: 5,
  pendingLitigation: 9,
  boundaryDispute: 8,
  taxLien: 9,
  mechanicLien: 7,
  hoaArrears: 5,
  mortgage: 4,
  lisPendens: 10,
  federalTaxLien: 9,
};

/** Exception types that are always curable at close (with payoff). */
const ALWAYS_CURABLE: ReadonlyArray<ScheduleBExceptionType> = [
  'taxLien',
  'mechanicLien',
  'hoaArrears',
  'mortgage',
  'federalTaxLien',
];

/** Exception types that block deal regardless of impact score. */
const DEAL_KILLERS: ReadonlyArray<ScheduleBExceptionType> = [
  'lisPendens',
  'pendingLitigation',
];

export interface AltaCommitmentInputs {
  readonly exceptions: ReadonlyArray<ScheduleBException>;
  readonly standardExceptionsDeletable: boolean;
}

export function readAltaCommitment(
  inputs: AltaCommitmentInputs,
): AltaCommitmentReading {
  const exceptions = inputs.exceptions.map((e) => {
    const impactScore =
      Number.isFinite(e.impactScore) && e.impactScore >= 0
        ? Math.min(10, e.impactScore)
        : DEFAULT_IMPACT_BY_TYPE[e.type];
    return {
      ...e,
      impactScore,
      curableAtClose: e.curableAtClose || ALWAYS_CURABLE.includes(e.type),
    };
  });

  const criticalCount = exceptions.filter((e) => e.impactScore >= 8).length;
  const dealKillerCount = exceptions.filter((e) =>
    DEAL_KILLERS.includes(e.type),
  ).length;
  const aggregateImpactScore = exceptions.reduce((s, e) => s + e.impactScore, 0);

  let verdict: AltaCommitmentReading['verdict'];
  if (dealKillerCount > 0) {
    verdict = 'unworkable';
  } else if (criticalCount >= 3 || aggregateImpactScore >= 35) {
    verdict = 'unworkable';
  } else if (criticalCount >= 1 || aggregateImpactScore >= 20) {
    verdict = 'requires-cure';
  } else if (aggregateImpactScore >= 8) {
    verdict = 'workable';
  } else {
    verdict = 'clean';
  }

  return {
    exceptions,
    standardExceptionsDeletable: inputs.standardExceptionsDeletable,
    criticalCount,
    aggregateImpactScore,
    verdict,
  };
}
