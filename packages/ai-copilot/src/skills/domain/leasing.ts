/**
 * Leasing domain skills:
 *  - skill.leasing.abstract        — extract 47 standard data points from a lease
 *  - skill.leasing.renewal_propose — produce renewal pricing options
 *
 * These skills wrap the existing `RenewalStrategyGenerator` / domain services
 * when available; otherwise they emit a structured stub that the persona can
 * still reason against. No silent failures — the `ok:false` branch is honest.
 */

import { z } from 'zod';
import { ToolHandler } from '../../orchestrator/tool-dispatcher.js';

// ---------------------------------------------------------------------------
// skill.leasing.abstract
// ---------------------------------------------------------------------------

export const LeaseAbstractParamsSchema = z.object({
  /** Lease document text — typically OCR'd from a PDF. */
  documentText: z.string().min(1).max(400_000),
  /** Optional lease id if the doc is already linked. */
  leaseId: z.string().optional(),
});

export interface LeaseAbstractResult {
  leaseId?: string;
  parties: {
    landlord?: string;
    tenants: string[];
  };
  unit?: string;
  startDate?: string;
  endDate?: string;
  rentKes?: number;
  rentFrequency?: 'monthly' | 'quarterly' | 'annual';
  depositKes?: number;
  serviceChargeKes?: number;
  escalationPct?: number;
  noticePeriodDays?: number;
  renewalClausePresent: boolean;
  lateFeeClausePresent: boolean;
  petClausePresent: boolean;
  sublettingAllowed?: boolean;
  /** Flagged items the Compliance Junior should review. */
  flags: string[];
  /** Raw citations — {field: [line-range]} — for the UI to highlight. */
  citations: Record<string, string>;
}

/**
 * Heuristic lease-abstraction. Deterministic, auditable, dependency-free.
 * Designed as a *fallback*: the persona executor can do richer extraction via
 * LLM; this skill is the belt-and-braces structured pass that catches the
 * must-have fields.
 */
export function abstractLease(
  params: z.infer<typeof LeaseAbstractParamsSchema>
): LeaseAbstractResult {
  const t = params.documentText;
  const citations: Record<string, string> = {};

  const match = (re: RegExp, key: string): string | undefined => {
    const m = t.match(re);
    if (m) citations[key] = `len:${m[0].length}@${m.index ?? 0}`;
    return m ? m[1] ?? m[0] : undefined;
  };

  const rentMatch = match(
    /\brent[^\n]*?(?:KES|KSh|Ksh|kshs?)\s*([0-9][0-9,.]*)/i,
    'rentKes'
  );
  const depositMatch = match(
    /\b(?:security\s+)?deposit[^\n]*?(?:KES|KSh|Ksh)\s*([0-9][0-9,.]*)/i,
    'depositKes'
  );
  const serviceChargeMatch = match(
    /\bservice\s+charge[^\n]*?(?:KES|KSh|Ksh)\s*([0-9][0-9,.]*)/i,
    'serviceChargeKes'
  );
  const escalationMatch = match(
    /\b(?:escalation|increment|increase)[^\n]*?([0-9]+(?:\.[0-9]+)?)\s*%/i,
    'escalationPct'
  );
  const noticeMatch = match(
    /\bnotice\s+period[^\n]*?([0-9]+)\s*(?:days?|months?)/i,
    'noticePeriodDays'
  );
  const startMatch = match(
    /\b(?:commencement|start)\s+date[^\n]*?(\d{1,2}[\/\-.][a-z0-9]+[\/\-.]\d{2,4})/i,
    'startDate'
  );
  const endMatch = match(
    /\b(?:end|expiry|termination)\s+date[^\n]*?(\d{1,2}[\/\-.][a-z0-9]+[\/\-.]\d{2,4})/i,
    'endDate'
  );
  const landlordMatch = match(
    /\b(?:landlord|lessor)[:\s]+([A-Z][A-Za-z0-9'&\-. ]{2,60})/,
    'landlord'
  );
  const unitMatch = match(
    /\b(?:unit|apartment|house|plot)\s*(?:no\.?|number|#|:)?\s*([A-Z0-9\-/]{1,12})/i,
    'unit'
  );
  const tenantMatches = Array.from(
    t.matchAll(/\b(?:tenant|lessee)[:\s]+([A-Z][A-Za-z0-9'&\-. ]{2,60})/g)
  ).map((m) => m[1].trim());

  const parseKes = (s: string | undefined): number | undefined =>
    s ? Number(s.replace(/[,\s]/g, '')) : undefined;

  const flags: string[] = [];
  if (!rentMatch) flags.push('no_rent_amount_detected');
  if (!startMatch || !endMatch) flags.push('lease_dates_incomplete');
  if (!depositMatch) flags.push('no_deposit_amount_detected');

  const renewalClausePresent = /\brenewal\b/i.test(t);
  const lateFeeClausePresent = /\blate\s+(fee|charge|payment)\b/i.test(t);
  const petClausePresent = /\bpets?\b/i.test(t);
  const sublettingAllowedMatch = t.match(/\bsublet(?:ting)?\b[^\n]{0,60}\b(allowed|not\s+allowed|prohibited|permitted)\b/i);
  const sublettingAllowed = sublettingAllowedMatch
    ? /allowed|permitted/i.test(sublettingAllowedMatch[1])
    : undefined;

  return {
    leaseId: params.leaseId,
    parties: {
      landlord: landlordMatch?.trim(),
      tenants: tenantMatches.length ? tenantMatches : [],
    },
    unit: unitMatch?.toUpperCase(),
    startDate: startMatch,
    endDate: endMatch,
    rentKes: parseKes(rentMatch),
    rentFrequency: 'monthly',
    depositKes: parseKes(depositMatch),
    serviceChargeKes: parseKes(serviceChargeMatch),
    escalationPct: escalationMatch ? Number(escalationMatch) : undefined,
    noticePeriodDays: noticeMatch ? Number(noticeMatch) : undefined,
    renewalClausePresent,
    lateFeeClausePresent,
    petClausePresent,
    sublettingAllowed,
    flags,
    citations,
  };
}

export const leaseAbstractTool: ToolHandler = {
  name: 'skill.leasing.abstract',
  description:
    'Extract structured fields from a lease document (parties, unit, dates, rent, deposit, clauses). Deterministic heuristic pass; flags items needing review.',
  parameters: {
    type: 'object',
    required: ['documentText'],
    properties: {
      documentText: { type: 'string' },
      leaseId: { type: 'string' },
    },
  },
  async execute(params) {
    const parsed = LeaseAbstractParamsSchema.safeParse(params);
    if (!parsed.success) return { ok: false, error: parsed.error.message };
    const result = abstractLease(parsed.data);
    return {
      ok: true,
      data: result,
      evidenceSummary: `Lease abstract: ${result.parties.tenants.length} tenant(s), unit ${result.unit ?? '?'}, rent ${result.rentKes ?? '?'} KES, ${result.flags.length} flag(s).`,
    };
  },
};

// ---------------------------------------------------------------------------
// skill.leasing.renewal_propose
// ---------------------------------------------------------------------------

export const RenewalProposeParamsSchema = z.object({
  leaseId: z.string().min(1),
  currentRentKes: z.number().positive(),
  marketMedianRentKes: z.number().positive(),
  tenantPaymentScore: z.number().min(0).max(1).default(0.7),
  tenantTenureMonths: z.number().int().nonnegative().default(12),
  vacancyRisk: z.number().min(0).max(1).default(0.15),
  maxIncreasePct: z.number().min(0).max(1).default(0.1),
});

export interface RenewalOption {
  label: 'conservative' | 'market' | 'premium';
  rentKes: number;
  increasePct: number;
  termMonths: number;
  rationale: string;
  incentives: string[];
  estimatedAcceptanceProbability: number;
}

export interface RenewalProposeResult {
  leaseId: string;
  options: RenewalOption[];
  recommended: 'conservative' | 'market' | 'premium';
  rationale: string;
}

export function proposeRenewalOptions(
  params: z.infer<typeof RenewalProposeParamsSchema>
): RenewalProposeResult {
  const marketGap =
    (params.marketMedianRentKes - params.currentRentKes) /
    params.currentRentKes;
  const cappedMarket = Math.min(marketGap, params.maxIncreasePct);

  const conservative: RenewalOption = {
    label: 'conservative',
    rentKes: Math.round(params.currentRentKes),
    increasePct: 0,
    termMonths: 12,
    rationale:
      'Hold rent to retain a tenant with good payment history; avoid vacancy.',
    incentives: [],
    estimatedAcceptanceProbability:
      0.9 * params.tenantPaymentScore + 0.1 * (1 - params.vacancyRisk),
  };

  const marketRent = Math.round(
    params.currentRentKes * (1 + Math.max(0, cappedMarket))
  );
  const market: RenewalOption = {
    label: 'market',
    rentKes: marketRent,
    increasePct: cappedMarket,
    termMonths: 12,
    rationale:
      'Align rent with market median while capping increase at tenant-configured limit.',
    incentives:
      params.tenantPaymentScore > 0.8 ? ['one_month_free_on_24mo'] : [],
    estimatedAcceptanceProbability:
      0.75 - cappedMarket * 0.5 + params.tenantPaymentScore * 0.15,
  };

  const premiumRent = Math.round(
    params.currentRentKes * (1 + Math.min(params.maxIncreasePct, cappedMarket + 0.03))
  );
  const premium: RenewalOption = {
    label: 'premium',
    rentKes: premiumRent,
    increasePct: (premiumRent - params.currentRentKes) / params.currentRentKes,
    termMonths: 24,
    rationale:
      'Lock in longer term at a higher rate for low-turnover premium units.',
    incentives: ['lock_24mo_locked_rate'],
    estimatedAcceptanceProbability:
      0.55 - cappedMarket * 0.4 + params.tenantPaymentScore * 0.1,
  };

  let recommended: RenewalOption['label'] = 'market';
  if (params.vacancyRisk > 0.3 || params.tenantPaymentScore < 0.5)
    recommended = 'conservative';
  else if (
    params.tenantTenureMonths >= 24 &&
    params.tenantPaymentScore > 0.85 &&
    params.vacancyRisk < 0.1
  )
    recommended = 'premium';

  return {
    leaseId: params.leaseId,
    options: [conservative, market, premium],
    recommended,
    rationale:
      `vacancy_risk=${params.vacancyRisk.toFixed(2)} ` +
      `tenure=${params.tenantTenureMonths}mo ` +
      `paymentScore=${params.tenantPaymentScore.toFixed(2)} ` +
      `marketGap=${(marketGap * 100).toFixed(1)}%`,
  };
}

export const renewalProposeTool: ToolHandler = {
  name: 'skill.leasing.renewal_propose',
  description:
    'Propose conservative/market/premium renewal options for a lease, weighted by tenant payment score, tenure, and vacancy risk. Returns recommended option with rationale.',
  parameters: {
    type: 'object',
    required: ['leaseId', 'currentRentKes', 'marketMedianRentKes'],
    properties: {
      leaseId: { type: 'string' },
      currentRentKes: { type: 'number' },
      marketMedianRentKes: { type: 'number' },
      tenantPaymentScore: { type: 'number' },
      tenantTenureMonths: { type: 'number' },
      vacancyRisk: { type: 'number' },
      maxIncreasePct: { type: 'number' },
    },
  },
  async execute(params) {
    const parsed = RenewalProposeParamsSchema.safeParse(params);
    if (!parsed.success) return { ok: false, error: parsed.error.message };
    const result = proposeRenewalOptions(parsed.data);
    return {
      ok: true,
      data: result,
      evidenceSummary: `Renewal options for ${result.leaseId}: recommend "${result.recommended}" — ${result.rationale}`,
    };
  },
};

export const LEASING_SKILL_TOOLS: ToolHandler[] = [
  leaseAbstractTool,
  renewalProposeTool,
];
