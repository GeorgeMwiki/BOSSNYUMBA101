/**
 * satisfaction-benchmarker — Kingsley + Trepp-style tenant satisfaction.
 *
 * Sources:
 *   - Kingsley Index 2024 (multifamily / commercial)
 *   - Trepp tenant-survey averages
 */

import type { Recommendation, TenantId } from '../types.js';

export interface SatisfactionInput {
  readonly tenantId: TenantId;
  readonly overall: number; // 0..100
  readonly maintenance: number;
  readonly communication: number;
  readonly moveInExperience: number;
  readonly renewalIntentPct: number; // 0..1
}

// Kingsley 2024 Multifamily P50.
export const KINGSLEY_P50 = {
  overall: 78,
  maintenance: 76,
  communication: 74,
  moveInExperience: 81,
  renewalIntent: 0.60,
} as const;

const ALERT_DELTA = 6;

export interface SatisfactionReport {
  readonly tenantId: TenantId;
  readonly deltas: {
    overall: number;
    maintenance: number;
    communication: number;
    moveInExperience: number;
    renewalIntent: number;
  };
  readonly recommendations: ReadonlyArray<Recommendation>;
  readonly citation: string;
}

export function benchmarkSatisfaction(input: SatisfactionInput): SatisfactionReport {
  const deltas = {
    overall: input.overall - KINGSLEY_P50.overall,
    maintenance: input.maintenance - KINGSLEY_P50.maintenance,
    communication: input.communication - KINGSLEY_P50.communication,
    moveInExperience: input.moveInExperience - KINGSLEY_P50.moveInExperience,
    renewalIntent: input.renewalIntentPct - KINGSLEY_P50.renewalIntent,
  };

  const recs: Recommendation[] = [];
  if (deltas.overall <= -ALERT_DELTA) {
    recs.push({
      id: 'sat.overall.low',
      kind: 'operations',
      severity: 'high',
      headline: `Overall satisfaction ${input.overall} is ${Math.abs(deltas.overall).toFixed(0)} pts below Kingsley P50`,
      rationale: `Material gap to Kingsley peer — root-cause analysis on top driver (typically maintenance response time per Kingsley 2024 driver-analysis).`,
      citation: 'Kingsley Index 2024',
      strategicScore: 0.7,
      urgencyScore: 0.65,
      composite: 0.45 * 0.7 + 0.25 * 0.65,
    });
  }
  if (deltas.maintenance <= -ALERT_DELTA) {
    recs.push({
      id: 'sat.maint.low',
      kind: 'operations',
      severity: 'high',
      headline: `Maintenance satisfaction lags peer by ${Math.abs(deltas.maintenance).toFixed(0)} pts`,
      rationale: `Maintenance is the #1 driver of overall score per Kingsley 2024; fix response-time SLAs before any amenity spend.`,
      citation: 'Kingsley Index 2024 driver-analysis',
      strategicScore: 0.75,
      urgencyScore: 0.7,
      composite: 0.45 * 0.75 + 0.25 * 0.7,
    });
  }
  if (deltas.renewalIntent <= -0.10) {
    recs.push({
      id: 'sat.renewal.low',
      kind: 'operations',
      severity: 'critical',
      headline: `Renewal intent ${(input.renewalIntentPct * 100).toFixed(0)}% — material churn risk`,
      rationale: `> 10 pp below P50 forecasts revenue cliff in 6-12 months per Trepp tenant-survey correlation studies.`,
      citation: 'Trepp tenant-survey 2024',
      strategicScore: 0.85,
      urgencyScore: 0.75,
      composite: 0.45 * 0.85 + 0.25 * 0.75,
    });
  }
  if (deltas.communication <= -ALERT_DELTA) {
    recs.push({
      id: 'sat.comm.low',
      kind: 'operations',
      severity: 'medium',
      headline: `Communication score lags peer by ${Math.abs(deltas.communication).toFixed(0)} pts`,
      rationale: `Tenant-portal cadence and proactive notifications close most comm-score gaps within 90 days per Kingsley playbook.`,
      citation: 'Kingsley Index 2024',
      strategicScore: 0.55,
      urgencyScore: 0.45,
      composite: 0.45 * 0.55 + 0.25 * 0.45,
    });
  }

  return {
    tenantId: input.tenantId,
    deltas,
    recommendations: recs,
    citation: 'Kingsley Index 2024 + Trepp tenant-survey 2024',
  };
}

export const __test__ = { KINGSLEY_P50, ALERT_DELTA };
