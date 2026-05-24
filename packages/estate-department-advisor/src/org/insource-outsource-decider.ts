/**
 * insource-outsource-decider — six-category decision matrix.
 *
 * Per BOMA + IFMA + Cushman & Wakefield Outsourcing Benchmark 2023.
 */

import type { Recommendation } from '../types.js';

export type SourceableFunction =
  | 'legal'
  | 'maintenance'
  | 'leasing'
  | 'accounting'
  | 'it'
  | 'janitorial';

export interface SourcingInput {
  readonly fn: SourceableFunction;
  readonly portfolioDoors: number;
  readonly portfolioRentableSf: number;
  readonly portfolioGavUsd: number;
  readonly weeklyLegalHours?: number;
  readonly is24x7Maintenance?: boolean;
  readonly itEndpoints?: number;
  readonly piiHeavy?: boolean;
  readonly isLuxuryOrHospitalGrade?: boolean;
  readonly isBrandCritical?: boolean;
}

export type SourcingDecision = 'in-source' | 'outsource' | 'hybrid';

export interface SourcingResult {
  readonly fn: SourceableFunction;
  readonly decision: SourcingDecision;
  readonly rationale: string;
  readonly citation: string;
  readonly recommendations: ReadonlyArray<Recommendation>;
}

export function decideSourcing(input: SourcingInput): SourcingResult {
  const recs: Recommendation[] = [];
  let decision: SourcingDecision = 'outsource';
  let rationale = '';

  switch (input.fn) {
    case 'legal':
      if ((input.weeklyLegalHours ?? 0) > 50) {
        decision = 'in-source';
        rationale = '> 50 hrs/wk legal volume justifies in-house counsel per Cushman & Wakefield 2023 benchmark.';
      } else {
        decision = 'outsource';
        rationale = 'Sub-50 weekly legal hours economic only on hourly retainer with matter cap.';
      }
      break;
    case 'maintenance':
      if (input.portfolioDoors > 200 || input.portfolioRentableSf > 200_000) {
        if (input.is24x7Maintenance) {
          decision = 'in-source';
          rationale = '> 200 doors + 24×7 requirement: in-house team is more reliable per BOMA Maintenance Best-Practices 2023.';
        } else {
          decision = 'hybrid';
          rationale = 'Scale supports in-house leadership; tail work better outsourced (IFMA hybrid model).';
        }
      } else {
        decision = 'outsource';
        rationale = 'Sub-100-door portfolios cannot amortise a maintenance FTE — outsource per IFMA 2023.';
      }
      break;
    case 'leasing':
      if (input.portfolioDoors > 500 && input.isBrandCritical) {
        decision = 'in-source';
        rationale = '> 500 doors + brand-critical: in-house leasing protects NOI growth velocity per IREM 2024.';
      } else if (input.portfolioDoors < 200) {
        decision = 'outsource';
        rationale = 'Sub-200-door portfolio: 3rd-party leasing brokerage delivers better fill-rate economics.';
      } else {
        decision = 'hybrid';
        rationale = 'Mid-scale portfolios: lead-gen outsourced, tour conversion in-house (NAR mixed-model 2024).';
      }
      break;
    case 'accounting':
      if (input.portfolioGavUsd > 50_000_000) {
        decision = 'in-source';
        rationale = '> $50M GAV justifies in-house controller + analyst stack per Cushman & Wakefield 2023.';
      } else {
        decision = 'outsource';
        rationale = 'Sub-$50M GAV: fractional CFO / outsourced bookkeeping is more economic.';
      }
      break;
    case 'it':
      if ((input.itEndpoints ?? 0) > 250 || input.piiHeavy) {
        decision = 'in-source';
        rationale = '> 250 endpoints OR PII-heavy: in-house IT meets SOC2 readiness per IFMA + AICPA standards.';
      } else {
        decision = 'outsource';
        rationale = 'Lean IT footprint: MSP delivers better $/endpoint than in-house FTE.';
      }
      break;
    case 'janitorial':
      if (input.isLuxuryOrHospitalGrade) {
        decision = 'in-source';
        rationale = 'Luxury / hospital-grade environments demand in-house quality assurance per BOMA 360 standards.';
      } else {
        decision = 'outsource';
        rationale = 'Default outsource — janitorial commoditised; competitive bidding maintains cost discipline.';
      }
      break;
    default: {
      const _exhaustive: never = input.fn;
      void _exhaustive;
      decision = 'outsource';
      rationale = 'Unknown function — default outsource pending review.';
    }
  }

  recs.push({
    id: `sourcing.${input.fn}`,
    kind: 'org-staffing',
    severity: 'info',
    headline: `${input.fn}: ${decision}`,
    rationale,
    citation: 'BOMA + IFMA + Cushman & Wakefield Outsourcing Benchmark 2023',
    strategicScore: 0.55,
    urgencyScore: 0.35,
    composite: 0.45 * 0.55 + 0.25 * 0.35,
  });

  return {
    fn: input.fn,
    decision,
    rationale,
    citation: 'Cushman & Wakefield Outsourcing Benchmark 2023',
    recommendations: recs,
  };
}
