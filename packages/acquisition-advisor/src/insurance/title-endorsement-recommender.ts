/**
 * Title insurance endorsement recommender — per Stewart Title
 * Endorsement Decision Guide 2024 + First American Title
 * Endorsement Manual 2024.
 *
 * Takes the AltaCommitmentReading and survey/zoning findings,
 * returns recommended ALTA endorsements (06-series numbering).
 */

import type {
  AltaCommitmentReading,
  EndorsementCode,
  EndorsementRecommendation,
  ScheduleBExceptionType,
} from '../types.js';

interface EndorsementSpec {
  readonly code: EndorsementCode;
  readonly trigger: (reading: AltaCommitmentReading, ctx: EndorsementContext) => boolean;
  readonly reason: string;
  readonly mandatoryWhenTriggered: boolean;
  readonly estimatedPremiumUsd: number;
}

export interface EndorsementContext {
  readonly hasZoningCompletedStructure: boolean;
  readonly hasZoningVacantLand: boolean;
  readonly accessViaPrivateRoad: boolean;
  readonly insuredIsContiguousParcels: boolean;
  readonly hasSurveyAmendments: boolean;
  readonly taxParcelMismatch: boolean;
  readonly subdivisionApprovalNeeded: boolean;
  readonly doingBusinessAs: boolean;
}

const ENDORSEMENTS: ReadonlyArray<EndorsementSpec> = [
  {
    code: '9-06',
    trigger: (r) => exceptionTypeExists(r, 'restrictiveCovenant'),
    reason: 'Restrictive-covenant exposure — insure no current violation',
    mandatoryWhenTriggered: true,
    estimatedPremiumUsd: 850,
  },
  {
    code: '9.2-06',
    trigger: (r) => exceptionTypeExists(r, 'restrictiveCovenant'),
    reason: 'Restrictive-covenant exposure (improved-land variant)',
    mandatoryWhenTriggered: false,
    estimatedPremiumUsd: 950,
  },
  {
    code: '13-06',
    trigger: (_, ctx) => ctx.subdivisionApprovalNeeded,
    reason: 'Subdivision-approval endorsement',
    mandatoryWhenTriggered: true,
    estimatedPremiumUsd: 700,
  },
  {
    code: '16-06',
    trigger: (_, ctx) => ctx.doingBusinessAs,
    reason: 'DBA endorsement',
    mandatoryWhenTriggered: false,
    estimatedPremiumUsd: 250,
  },
  {
    code: '17-06',
    trigger: (_, ctx) => ctx.accessViaPrivateRoad,
    reason: 'Access endorsement (private-road access)',
    mandatoryWhenTriggered: true,
    estimatedPremiumUsd: 600,
  },
  {
    code: '18-06',
    trigger: (_, ctx) => ctx.taxParcelMismatch,
    reason: 'Tax-parcel-mismatch endorsement',
    mandatoryWhenTriggered: true,
    estimatedPremiumUsd: 450,
  },
  {
    code: '19-06',
    trigger: (_, ctx) => ctx.insuredIsContiguousParcels,
    reason: 'Contiguity endorsement (multiple parcels insured as one)',
    mandatoryWhenTriggered: true,
    estimatedPremiumUsd: 750,
  },
  {
    code: '22-06',
    trigger: (r) => exceptionTypeExists(r, 'mineralReservation'),
    reason: 'Mineral-reservation location endorsement',
    mandatoryWhenTriggered: true,
    estimatedPremiumUsd: 1_200,
  },
  {
    code: '25-06',
    trigger: (_, ctx) => ctx.hasSurveyAmendments,
    reason: 'Survey endorsement (post-commitment survey amendments)',
    mandatoryWhenTriggered: true,
    estimatedPremiumUsd: 500,
  },
  {
    code: '28.2-06',
    trigger: (r) => exceptionTypeExists(r, 'boundaryDispute'),
    reason: 'Encroachment-of-boundary-structure endorsement',
    mandatoryWhenTriggered: true,
    estimatedPremiumUsd: 850,
  },
  {
    code: '3.1-06',
    trigger: (_, ctx) => ctx.hasZoningCompletedStructure,
    reason: 'Zoning endorsement — completed structure',
    mandatoryWhenTriggered: true,
    estimatedPremiumUsd: 600,
  },
  {
    code: '3-06',
    trigger: (_, ctx) => ctx.hasZoningVacantLand,
    reason: 'Zoning endorsement — vacant land',
    mandatoryWhenTriggered: true,
    estimatedPremiumUsd: 550,
  },
  {
    code: '35-06',
    trigger: (r) => exceptionTypeExists(r, 'mineralReservation'),
    reason: 'Minerals + surface damage endorsement',
    mandatoryWhenTriggered: false,
    estimatedPremiumUsd: 900,
  },
];

function exceptionTypeExists(
  reading: AltaCommitmentReading,
  type: ScheduleBExceptionType,
): boolean {
  return reading.exceptions.some((e) => e.type === type);
}

export function recommendEndorsements(
  reading: AltaCommitmentReading,
  ctx: EndorsementContext,
): ReadonlyArray<EndorsementRecommendation> {
  const out: EndorsementRecommendation[] = [];
  for (const spec of ENDORSEMENTS) {
    if (spec.trigger(reading, ctx)) {
      out.push({
        code: spec.code,
        reason: spec.reason,
        mandatory: spec.mandatoryWhenTriggered,
        estimatedPremiumUsd: spec.estimatedPremiumUsd,
      });
    }
  }
  return out;
}

export const TITLE_ENDORSEMENT_SPECS = ENDORSEMENTS;
