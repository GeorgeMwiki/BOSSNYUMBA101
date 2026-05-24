/**
 * property-tax-appeal-advisor — per-jurisdiction filing windows.
 *
 * Authorities:
 *   - Kenya Rating Act 2019 §17 — 30 days post-assessment
 *   - Tanzania Local Govt Finance Act 1982 — 30 days
 *   - Uganda Local Govt Rating Act 2005 §38 — 60 days
 *   - Nigeria Land Use Charge Law (state-variable) — typically 30 days
 *   - Rwanda Law 75/2018 §52 — 30 days
 *   - South Africa MPRA 2004 — 30 days
 *   - US (typical) — 30-45 days per county assessor
 */

import type { Jurisdiction, TaxOpportunity } from '../types.js';

export interface AppealInput {
  readonly propertyId: string;
  readonly propertyName: string;
  readonly jurisdiction: Jurisdiction;
  readonly assessedValueUsd: number;
  readonly marketValueUsd: number;
  readonly compMedianUsd: number;
  readonly assessmentNoticeMs: number;
  readonly currentMs: number;
  readonly annualTaxUsd: number;
}

interface JurisdictionAppealRule {
  readonly windowDays: number;
  readonly statute: string;
  readonly note: string;
}

const APPEAL_RULES: Readonly<Record<Jurisdiction, JurisdictionAppealRule>> = {
  KE: { windowDays: 30, statute: 'Kenya Rating Act 2019 §17', note: 'File with county valuation board' },
  TZ: { windowDays: 30, statute: 'Tanzania Local Govt Finance Act 1982', note: 'File with local council valuation tribunal' },
  UG: { windowDays: 60, statute: 'Uganda Local Govt Rating Act 2005 §38', note: 'LG council valuation court' },
  NG: { windowDays: 30, statute: 'Lagos Land Use Charge Law (state-variable)', note: 'State assessment tribunal' },
  RW: { windowDays: 30, statute: 'Rwanda Law 75/2018 §52', note: 'RRA / sector tribunal' },
  ZA: { windowDays: 30, statute: 'Municipal Property Rates Act 2004', note: 'Municipal valuation appeal board' },
  US: { windowDays: 45, statute: 'County assessor (statute varies)', note: 'County assessor' },
};

const APPEAL_TRIGGER_PCT = 0.15;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function adviseAppeal(input: AppealInput): TaxOpportunity {
  const rule = APPEAL_RULES[input.jurisdiction];
  const overAssessedPct = input.compMedianUsd > 0
    ? (input.assessedValueUsd - input.compMedianUsd) / input.compMedianUsd
    : 0;
  const windowClosesMs = input.assessmentNoticeMs + rule.windowDays * MS_PER_DAY;
  const daysRemaining = Math.max(0, Math.round((windowClosesMs - input.currentMs) / MS_PER_DAY));

  if (overAssessedPct < APPEAL_TRIGGER_PCT) {
    return {
      id: `appeal.${input.propertyId}.skip`,
      kind: 'appeal',
      headline: `${input.propertyName}: appeal not warranted (${(overAssessedPct * 100).toFixed(1)}% over comp)`,
      estimatedSavingsUsd: 0,
      rationale: `Below ${(APPEAL_TRIGGER_PCT * 100).toFixed(0)}% over-assessment threshold — appeal cost likely exceeds savings.`,
      citation: rule.statute,
      jurisdiction: input.jurisdiction,
    };
  }

  // Estimate tax savings: assessment correction × effective rate.
  const effectiveRate = input.annualTaxUsd / Math.max(input.assessedValueUsd, 1);
  const correctionUsd = input.assessedValueUsd - input.compMedianUsd;
  const annualSavings = correctionUsd * effectiveRate;

  return {
    id: `appeal.${input.propertyId}`,
    kind: 'appeal',
    headline: `${input.propertyName}: appeal — est. $${Math.round(annualSavings).toLocaleString('en-US')}/yr (${daysRemaining} d left)`,
    estimatedSavingsUsd: Math.round(annualSavings * 3), // 3-yr typical lock-in
    windowEndsAtMs: windowClosesMs,
    rationale: `Assessed ${(overAssessedPct * 100).toFixed(0)}% above comp median; ${rule.statute} window closes in ${daysRemaining} days — ${rule.note}.`,
    citation: rule.statute,
    jurisdiction: input.jurisdiction,
  };
}

export const __test__ = { APPEAL_RULES, APPEAL_TRIGGER_PCT };
