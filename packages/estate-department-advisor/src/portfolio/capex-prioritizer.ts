/**
 * capex-prioritizer — urgency × strategic-fit × IRR ranking.
 *
 * Per BOMA Preventive Maintenance Guidebook (2023) and IFMA's
 * 5-tier urgency model. Composite weights:
 *   0.45 · urgency_normalised
 * + 0.30 · strategic_fit
 * + 0.25 · IRR_normalised
 *
 * Pure function. Budget cap applied top-down after ranking.
 */

import type { Recommendation, Role, TenantId } from '../types.js';

export type CapexUrgency =
  | 'regulatory'
  | 'life-safety'
  | 'revenue-critical'
  | 'efficiency'
  | 'aesthetic';

export interface CapexLine {
  readonly id: string;
  readonly propertyId: string;
  readonly description: string;
  readonly urgency: CapexUrgency;
  readonly estimatedCostUsd: number;
  readonly expectedIrr: number; // 0..1
  readonly strategicFit: number; // 0..1
}

export interface PrioritizedCapex {
  readonly tenantId: TenantId;
  readonly ranked: ReadonlyArray<CapexLine & { readonly composite: number }>;
  readonly funded: ReadonlyArray<CapexLine & { readonly composite: number }>;
  readonly deferred: ReadonlyArray<CapexLine & { readonly composite: number }>;
  readonly recommendations: ReadonlyArray<Recommendation>;
  readonly totalFundedUsd: number;
  readonly totalDeferredUsd: number;
}

const URGENCY_SCORE: Readonly<Record<CapexUrgency, number>> = {
  regulatory: 1.0,
  'life-safety': 0.9,
  'revenue-critical': 0.7,
  efficiency: 0.5,
  aesthetic: 0.3,
};

function normalize(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.max(0, Math.min(1, value / max));
}

function composite(line: CapexLine, maxIrr: number): number {
  const u = URGENCY_SCORE[line.urgency];
  const irr = normalize(line.expectedIrr, Math.max(maxIrr, 0.001));
  return 0.45 * u + 0.30 * line.strategicFit + 0.25 * irr;
}

function ownerForUrgency(u: CapexUrgency): Role {
  switch (u) {
    case 'regulatory':
      return 'director-ops';
    case 'life-safety':
      return 'director-ops';
    case 'revenue-critical':
      return 'asset-manager';
    case 'efficiency':
      return 'senior-pm';
    case 'aesthetic':
      return 'property-manager';
    default:
      return 'property-manager';
  }
}

export function prioritizeCapex(input: {
  readonly tenantId: TenantId;
  readonly lines: ReadonlyArray<CapexLine>;
  readonly budgetUsd: number;
}): PrioritizedCapex {
  const { tenantId, lines, budgetUsd } = input;
  const maxIrr = lines.reduce((m, l) => Math.max(m, l.expectedIrr), 0);
  const scored = lines
    .map((l) => ({ ...l, composite: composite(l, maxIrr) }))
    .sort((a, b) => b.composite - a.composite);

  const funded: Array<CapexLine & { composite: number }> = [];
  const deferred: Array<CapexLine & { composite: number }> = [];
  let spent = 0;
  for (const line of scored) {
    if (line.urgency === 'regulatory' || line.urgency === 'life-safety') {
      funded.push(line);
      spent += line.estimatedCostUsd;
      continue;
    }
    if (spent + line.estimatedCostUsd <= budgetUsd) {
      funded.push(line);
      spent += line.estimatedCostUsd;
    } else {
      deferred.push(line);
    }
  }

  const recommendations: Recommendation[] = funded.slice(0, 5).map((l) => ({
    id: `capex.${l.id}`,
    kind: 'portfolio' as const,
    severity:
      l.urgency === 'regulatory' || l.urgency === 'life-safety'
        ? ('critical' as const)
        : l.urgency === 'revenue-critical'
          ? ('high' as const)
          : ('medium' as const),
    headline: `Fund: ${l.description} ($${l.estimatedCostUsd.toLocaleString('en-US')})`,
    rationale: `Composite ${l.composite.toFixed(2)} — ${l.urgency} urgency, ${(l.expectedIrr * 100).toFixed(1)}% IRR, ${(l.strategicFit * 100).toFixed(0)}% strategic fit per BOMA/IFMA matrix.`,
    citation: 'BOMA Preventive Maintenance Guidebook 2023 + IFMA 5-tier model',
    estimatedCostUsd: l.estimatedCostUsd,
    estimatedIrrPct: l.expectedIrr * 100,
    strategicScore: l.strategicFit,
    urgencyScore: URGENCY_SCORE[l.urgency],
    composite: l.composite,
    ownerRole: ownerForUrgency(l.urgency),
  }));

  return {
    tenantId,
    ranked: scored,
    funded,
    deferred,
    recommendations,
    totalFundedUsd: funded.reduce((s, l) => s + l.estimatedCostUsd, 0),
    totalDeferredUsd: deferred.reduce((s, l) => s + l.estimatedCostUsd, 0),
  };
}

export const __test__ = { URGENCY_SCORE, composite, normalize, ownerForUrgency };
