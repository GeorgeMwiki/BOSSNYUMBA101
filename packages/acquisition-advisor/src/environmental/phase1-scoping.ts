/**
 * Phase I ESA scoping — per ASTM E1527-21 + EPA AAI Rule
 * (40 CFR Part 312).
 *
 * Inputs: a set of RECFindings raised by historical-records review,
 * site reconnaissance, and interviews. Produces aggregate severity
 * + Phase II recommendation.
 *
 * Note: this module does not perform the records review itself —
 * it scores the *output* of an actual Phase I report.
 */

import type { Phase1ScopingResult, RECFinding } from '../types.js';

const SEVERITY_BY_CATEGORY = {
  REC: 0.85,
  CREC: 0.65,
  HREC: 0.40,
  deMinimis: 0.10,
  none: 0,
} as const;

const HIGH_CONCERN_CONTAMINANTS = new Set([
  'TCE',
  'PCE',
  'benzene',
  'lead',
  'PCB',
  'PFAS',
  'PFOS',
  'PFOA',
]);

export interface Phase1ScopingInputs {
  readonly findings: ReadonlyArray<RECFinding>;
  /** Insurance carrier policy — some carriers require Phase II for HREC. */
  readonly insuranceCarrierStrict?: boolean;
}

export function scopePhase1(inputs: Phase1ScopingInputs): Phase1ScopingResult {
  const findings = inputs.findings;
  if (findings.length === 0) {
    return {
      findings: [],
      severity: 0,
      recommendPhase2: false,
      priorityContaminants: [],
      insuranceCarrierWillRequirePhase2: false,
    };
  }

  // Weighted aggregate severity, with closer findings weighted higher
  const totalWeight = findings.reduce(
    (s, f) => s + distanceWeight(f.distanceMetres),
    0,
  );
  const severity =
    findings.reduce(
      (s, f) =>
        s +
        distanceWeight(f.distanceMetres) *
          (SEVERITY_BY_CATEGORY[f.category] ?? 0),
      0,
    ) / Math.max(totalWeight, 1e-9);

  const recommendPhase2 =
    findings.some((f) => f.category === 'REC') ||
    findings.some(
      (f) => f.category === 'CREC' && HIGH_CONCERN_CONTAMINANTS.has(f.contaminant),
    );

  const insuranceCarrierWillRequirePhase2 =
    inputs.insuranceCarrierStrict === true &&
    findings.some((f) => f.category === 'HREC' || f.category === 'CREC' || f.category === 'REC');

  const priorityContaminants = Array.from(
    new Set(
      findings
        .filter((f) => HIGH_CONCERN_CONTAMINANTS.has(f.contaminant))
        .map((f) => f.contaminant),
    ),
  );

  return {
    findings,
    severity,
    recommendPhase2: recommendPhase2 || insuranceCarrierWillRequirePhase2,
    priorityContaminants,
    insuranceCarrierWillRequirePhase2,
  };
}

function distanceWeight(distanceMetres: number): number {
  // Inverse-distance-with-floor; closer findings carry more weight.
  // At 0 m → 1.0; at 100 m → 0.5; at 500 m → 0.17; at >1000 m → ~0.09
  return 1 / (1 + distanceMetres / 100);
}

export const PHASE1_SEVERITY_BY_CATEGORY = SEVERITY_BY_CATEGORY;
export const PHASE1_HIGH_CONCERN_CONTAMINANTS = HIGH_CONCERN_CONTAMINANTS;
