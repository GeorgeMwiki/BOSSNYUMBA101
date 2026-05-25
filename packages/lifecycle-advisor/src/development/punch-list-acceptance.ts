/**
 * Punch-list acceptance — Substantial Completion (SC) and Final
 * Acceptance gates per AIA G704 and AGC Punch List Tolerances 2024.
 *
 * Acceptance thresholds (items per 100 m²):
 *  Substantial Completion
 *    - cosmetic        ≤ 0.5
 *    - mechanical      ≤ 0.2
 *    - life-safety     0   (zero defects)
 *    - total           ≤ 1.0
 *  Final Acceptance
 *    - total           ≤ 0.1
 *    - life-safety     0
 */

import type { PunchListInputs, PunchListResult } from '../types.js';

const SC_LIMITS = {
  cosmetic: 0.5,
  mechanical: 0.2,
  lifeSafety: 0,
  total: 1.0,
} as const;

const FINAL_LIMITS = {
  total: 0.1,
  lifeSafety: 0,
} as const;

function per100sqm(count: number, grossSqm: number): number {
  if (grossSqm <= 0) return 0;
  return (count / grossSqm) * 100;
}

function aggregate(inputs: PunchListInputs) {
  let cosmetic = 0;
  let mechanical = 0;
  let lifeSafety = 0;
  for (const it of inputs.items) {
    if (it.category === 'cosmetic') cosmetic += it.count;
    else if (it.category === 'mechanical') mechanical += it.count;
    else if (it.category === 'life-safety') lifeSafety += it.count;
  }
  return {
    cosmetic: per100sqm(cosmetic, inputs.grossSqm),
    mechanical: per100sqm(mechanical, inputs.grossSqm),
    lifeSafety: per100sqm(lifeSafety, inputs.grossSqm),
    total: per100sqm(cosmetic + mechanical + lifeSafety, inputs.grossSqm),
  };
}

export function evaluateSubstantialCompletion(
  inputs: Readonly<PunchListInputs>,
): PunchListResult {
  const agg = aggregate(inputs);
  const blockers: string[] = [];
  if (agg.cosmetic > SC_LIMITS.cosmetic) {
    blockers.push(`cosmetic ${agg.cosmetic.toFixed(2)} > ${SC_LIMITS.cosmetic}/100sqm`);
  }
  if (agg.mechanical > SC_LIMITS.mechanical) {
    blockers.push(`mechanical ${agg.mechanical.toFixed(2)} > ${SC_LIMITS.mechanical}/100sqm`);
  }
  if (agg.lifeSafety > SC_LIMITS.lifeSafety) {
    blockers.push(`life-safety must be zero (current ${agg.lifeSafety.toFixed(2)}/100sqm)`);
  }
  if (agg.total > SC_LIMITS.total) {
    blockers.push(`total ${agg.total.toFixed(2)} > ${SC_LIMITS.total}/100sqm`);
  }
  return {
    stage: 'substantial-completion',
    per100SqmCosmetic: agg.cosmetic,
    per100SqmMechanical: agg.mechanical,
    per100SqmLifeSafety: agg.lifeSafety,
    per100SqmTotal: agg.total,
    accepted: blockers.length === 0,
    blockers,
  };
}

export function evaluateFinalAcceptance(
  inputs: Readonly<PunchListInputs>,
): PunchListResult {
  const agg = aggregate(inputs);
  const blockers: string[] = [];
  if (agg.lifeSafety > FINAL_LIMITS.lifeSafety) {
    blockers.push(`life-safety must be zero (current ${agg.lifeSafety.toFixed(2)}/100sqm)`);
  }
  if (agg.total > FINAL_LIMITS.total) {
    blockers.push(`total ${agg.total.toFixed(2)} > ${FINAL_LIMITS.total}/100sqm`);
  }
  return {
    stage: 'final-acceptance',
    per100SqmCosmetic: agg.cosmetic,
    per100SqmMechanical: agg.mechanical,
    per100SqmLifeSafety: agg.lifeSafety,
    per100SqmTotal: agg.total,
    accepted: blockers.length === 0,
    blockers,
  };
}
