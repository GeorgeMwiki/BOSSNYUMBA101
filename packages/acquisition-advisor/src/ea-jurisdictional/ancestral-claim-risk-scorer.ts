/**
 * Ancestral-claim risk scorer — universal EA risk on customary /
 * ancestral / clan claims over seemingly-titled land.
 */

import type { AncestralClaimInputs, AncestralClaimRiskScore } from '../types.js';

const GENESIS_RISK_BY_PATH = {
  allotment: 0.40,
  adjudication: 0.20,
  grant: 0.10,
  inheritance: 0.30,
  unknown: 0.55,
} as const;

export function scoreAncestralClaim(
  inputs: AncestralClaimInputs,
): AncestralClaimRiskScore {
  if (inputs.distanceToCustomaryTenureKm < 0) {
    throw new Error('distanceToCustomaryTenureKm must be >= 0');
  }
  if (inputs.titleAgeYears < 0) {
    throw new Error('titleAgeYears must be >= 0');
  }
  if (inputs.heirCount < 0) {
    throw new Error('heirCount must be >= 0');
  }

  // 0..1 components
  const distanceComp = clamp01(1 - inputs.distanceToCustomaryTenureKm / 25);
  const ageComp = clamp01(1 - inputs.titleAgeYears / 30);
  const genesisComp = GENESIS_RISK_BY_PATH[inputs.titleGenesisPath];
  const heirComp = clamp01(inputs.heirCount / 8);
  const elderComp = inputs.villageElderAttestationObtained ? 0 : 0.7;
  const quietTitleComp = inputs.quietTitleDecreeObtained ? 0 : 0.6;
  const litigationComp = inputs.pendingLandCourtLitigation ? 1.0 : 0;

  // Weighted aggregate
  const raw =
    0.18 * distanceComp +
    0.12 * ageComp +
    0.20 * genesisComp +
    0.10 * heirComp +
    0.15 * elderComp +
    0.15 * quietTitleComp +
    0.10 * litigationComp;

  const score = clamp01(raw) * 100;

  const band: AncestralClaimRiskScore['band'] =
    score >= 75
      ? 'severe'
      : score >= 55
        ? 'high'
        : score >= 35
          ? 'moderate'
          : 'low';

  const recommendedActions: string[] = [];
  if (!inputs.villageElderAttestationObtained) {
    recommendedActions.push('Obtain notarised village-elder attestation');
  }
  if (!inputs.quietTitleDecreeObtained && score >= 55) {
    recommendedActions.push('Pursue quiet-title decree in Land & Environment Court before close');
  }
  if (inputs.pendingLandCourtLitigation) {
    recommendedActions.push('Resolve pending land-court litigation before close');
  }
  if (score >= 60) {
    recommendedActions.push('Publish notice of intended transfer in local press for 60 days');
  }
  if (score >= 75) {
    recommendedActions.push('Consider title-insurance with ancestral-claim rider (if available)');
  }
  if (recommendedActions.length === 0) {
    recommendedActions.push('Standard EA customary-tenure review only');
  }

  return { score, band, recommendedActions };
}

function clamp01(x: number): number {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

export const ANCESTRAL_GENESIS_RISK = GENESIS_RISK_BY_PATH;
