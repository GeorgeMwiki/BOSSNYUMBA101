/**
 * LOI 25-axis risk scorer — canonical institutional checklist
 * derived from ABA Real Property Section Model PSA 2024 + Pircher
 * Nichols & Meeks Acquisition Counsel Templates 2024.
 *
 * Each axis scored 0..5 (0 = unaddressed, 5 = fully buyer-protective).
 * Normalised = sum / 125. Verdict thresholds calibrated to
 * institutional counter-sign discipline.
 */

import type { LOIAxisKey, LOIAxisRating, LOIRiskScore } from '../types.js';

export const LOI_AXES: ReadonlyArray<LOIAxisKey> = [
  'purchasePrice',
  'earnestMoney',
  'ddPeriod',
  'ddExtension',
  'financingContingency',
  'titleCommitmentDeadline',
  'surveyDeadline',
  'estoppels',
  'snda',
  'serviceContracts',
  'casualtyCondemnation',
  'environmentalIndemnity',
  'repWarrantySurvival',
  'repWarrantyCap',
  'closingDate',
  'prorations',
  'closingCostAllocation',
  'brokerage',
  'sellerReps',
  'operatingCovenants',
  'rofoRofr',
  'confidentiality',
  'exclusivity',
  'taxCooperation',
  'governingLaw',
];

/** Axes where a critical score (0..1) blocks counter-sign. */
const CRITICAL_AXES: ReadonlyArray<LOIAxisKey> = [
  'purchasePrice',
  'earnestMoney',
  'ddPeriod',
  'casualtyCondemnation',
  'environmentalIndemnity',
  'exclusivity',
  'closingDate',
];

export function scoreLOI(
  axes: ReadonlyArray<LOIAxisRating>,
): LOIRiskScore {
  if (axes.length !== LOI_AXES.length) {
    throw new Error(
      `LOI scorer expects exactly ${LOI_AXES.length} axes, got ${axes.length}`,
    );
  }
  const seen = new Set<LOIAxisKey>();
  for (const a of axes) {
    if (!LOI_AXES.includes(a.key)) {
      throw new Error(`unknown LOI axis: ${a.key}`);
    }
    if (seen.has(a.key)) {
      throw new Error(`duplicate LOI axis: ${a.key}`);
    }
    seen.add(a.key);
    if (a.score < 0 || a.score > 5) {
      throw new Error(`axis ${a.key} score must be 0..5`);
    }
  }

  const sum = axes.reduce((acc, a) => acc + a.score, 0);
  const normalized = sum / (LOI_AXES.length * 5);

  const criticalGaps: LOIAxisKey[] = [];
  for (const a of axes) {
    if (CRITICAL_AXES.includes(a.key) && a.score <= 1) {
      criticalGaps.push(a.key);
    }
  }

  let verdict: LOIRiskScore['verdict'];
  if (criticalGaps.length > 0 || normalized < 0.45) {
    verdict = 'do-not-sign';
  } else if (normalized < 0.65) {
    verdict = 'redraft';
  } else if (normalized < 0.85) {
    verdict = 'acceptable';
  } else {
    verdict = 'strong';
  }

  return {
    axes,
    normalized,
    verdict,
    criticalGaps,
  };
}

/** Build a fully-unaddressed (worst-case) LOI for tests / templates. */
export function emptyLOI(): ReadonlyArray<LOIAxisRating> {
  return LOI_AXES.map((key) => ({
    key,
    score: 0 as LOIAxisRating['score'],
    notes: '',
  }));
}
