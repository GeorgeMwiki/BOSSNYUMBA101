/**
 * Phase II trigger logic — per ASTM E1903-19. Decides if Phase II
 * is required, which media to sample, and provides cost estimate.
 *
 * Trigger rules:
 *  - Any REC in Phase I → Phase II.
 *  - CREC with active deed restriction → Phase II to confirm.
 *  - HREC alone → Phase II only if carrier requires.
 *  - Suspect ACM/LBP/PCB → ACM/LBP/PCB-specific survey, not full Phase II.
 */

import type { Phase1ScopingResult, Phase2Trigger } from '../types.js';

const BASELINE_PHASE2_COST_USD = 18_000;
const COST_PER_MEDIUM_USD = 7_000;
const INDUSTRIAL_PREMIUM_USD = 50_000;

export interface Phase2TriggerInputs {
  readonly phase1: Phase1ScopingResult;
  readonly siteIsIndustrial?: boolean;
}

export function triggerPhase2(inputs: Phase2TriggerInputs): Phase2Trigger {
  const reasons: string[] = [];
  const mediaSet = new Set<'soil' | 'groundwater' | 'soilVapor' | 'surfaceWater' | 'building'>();

  for (const f of inputs.phase1.findings) {
    if (f.category === 'REC') {
      reasons.push(`REC ${f.id} (${f.contaminant})`);
      for (const m of f.mediaAffected) mediaSet.add(m);
    }
    if (
      f.category === 'CREC' &&
      ['TCE', 'PCE', 'benzene', 'lead', 'PCB', 'PFAS'].includes(f.contaminant)
    ) {
      reasons.push(`CREC ${f.id} (high-concern contaminant ${f.contaminant})`);
      for (const m of f.mediaAffected) mediaSet.add(m);
    }
  }

  if (inputs.phase1.insuranceCarrierWillRequirePhase2 && reasons.length === 0) {
    reasons.push('Insurance carrier requires Phase II to bind environmental policy');
    // default to baseline media set
    mediaSet.add('soil');
    mediaSet.add('groundwater');
  }

  const triggered = reasons.length > 0;
  const mediaArray = Array.from(mediaSet);

  const estimatedCostUsd = triggered
    ? BASELINE_PHASE2_COST_USD +
      COST_PER_MEDIUM_USD * Math.max(0, mediaArray.length - 1) +
      (inputs.siteIsIndustrial ? INDUSTRIAL_PREMIUM_USD : 0)
    : 0;

  return {
    triggered,
    reasonCodes: reasons,
    mediaToSample: mediaArray,
    estimatedCostUsd,
  };
}
