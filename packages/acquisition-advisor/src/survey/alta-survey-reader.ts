/**
 * ALTA / NSPS 2021 survey reader — encroachment + setback +
 * Table-A item presence scorer.
 */

import type {
  AltaSurveyReading,
  SetbackViolation,
  SurveyEncroachment,
} from '../types.js';

const DIRECTION_BASE_SCORE = {
  subjectOntoNeighbor: 6,
  neighborOntoSubject: 4,
  acrossROW: 8,
} as const;

export interface AltaSurveyInputs {
  readonly hasMonuments: boolean;
  readonly hasFloodZone: boolean;
  readonly hasZoningSummary: boolean;
  readonly encroachments: ReadonlyArray<Omit<SurveyEncroachment, 'severityScore'>>;
  readonly setbackViolations: ReadonlyArray<SetbackViolation>;
}

export function readAltaSurvey(
  inputs: AltaSurveyInputs,
): AltaSurveyReading {
  const encroachments = inputs.encroachments.map((e) => {
    const base = DIRECTION_BASE_SCORE[e.direction];
    const areaPenalty = Math.min(4, e.affectedAreaSqm / 25);
    const severityScore = clamp(0, 10, base + areaPenalty - (e.curableAtClose ? 2 : 0));
    return { ...e, severityScore };
  });

  const aggregateEncroachmentScore = encroachments.reduce(
    (s, e) => s + e.severityScore,
    0,
  );

  const materialSetback = inputs.setbackViolations.some(
    (v) => !v.grandfathered || v.redevelopmentTrigger,
  );

  let verdict: AltaSurveyReading['verdict'];
  if (aggregateEncroachmentScore >= 22 || encroachments.some((e) => e.severityScore >= 9)) {
    verdict = 'unworkable';
  } else if (
    aggregateEncroachmentScore >= 12 ||
    encroachments.some((e) => e.severityScore >= 7) ||
    materialSetback
  ) {
    verdict = 'material';
  } else if (aggregateEncroachmentScore >= 4) {
    verdict = 'minor';
  } else {
    verdict = 'clean';
  }

  return {
    hasMonuments: inputs.hasMonuments,
    hasFloodZone: inputs.hasFloodZone,
    hasZoningSummary: inputs.hasZoningSummary,
    encroachments,
    setbackViolations: inputs.setbackViolations,
    aggregateEncroachmentScore,
    verdict,
  };
}

function clamp(lo: number, hi: number, x: number): number {
  if (x < lo) return lo;
  if (x > hi) return hi;
  return x;
}
