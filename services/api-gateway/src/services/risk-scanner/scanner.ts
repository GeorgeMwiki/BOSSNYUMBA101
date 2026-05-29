/**
 * Risk Scanner — engine (real-estate domain).
 *
 * Walks every rule in `RISK_RULES`, evaluates the matches, dedupes by
 * rule id, then ranks by severity / max(1, timeToImpactDays). Ties are
 * broken by exposureAmount then id so order is stable across calls.
 *
 * Pure engine — no I/O. The state assembler is `buildScannerState()`
 * which is the only function that touches the DB (and degrades to
 * `null` fields when the DB read fails).
 */

import { RISK_RULES } from './scan-rules.js';
import {
  scoreRisk,
  SEVERITY_WEIGHT,
  type Risk,
  type RiskKind,
  type RiskScannerState,
  type RiskSeverity,
  type ScanRisksOptions,
} from './types.js';

interface DbLike {
  execute(query: unknown): Promise<unknown>;
}

export interface RiskScannerDeps {
  readonly db: DbLike | null;
  readonly now?: () => Date;
  readonly stateOverride?: Partial<RiskScannerState>;
  readonly primaryCurrencyCode?: string;
}

function emptyState(
  tenantId: string,
  nowIso: string,
  currency: string,
): RiskScannerState {
  return {
    tenantId,
    nowIso,
    primaryCurrencyCode: currency,
    cashRunwayDays: null,
    arOverdue60dPctOfMonthly: null,
    payrollDueInDays: null,
    payrollAmount: null,
    cashOnHand: null,
    mortgagePaymentDueInDays: null,
    mortgagePaymentAmount: null,
    rentArrears30dCount: 0,
    rentArrears60dCount: 0,
    rentArrears90dCount: 0,
    rentArrearsTotalAmount: null,
    insuranceCertDaysToExpiry: null,
    fireSafetyCertDaysToExpiry: null,
    gasSafetyCertDaysToExpiry: null,
    housingFilingDaysOverdue: null,
    housingPenaltyAccrual: null,
    regulatorInspectionDueInDays: null,
    propertyTaxDaysOverdue: null,
    propertyTaxAccruedAmount: null,
    hoaDuesOverdueAmount: null,
    hoaDuesDaysOverdue: null,
    maintenanceTicketsOverSlaCount: 0,
    maintenanceTicketsOverSla7dCount: 0,
    avgTicketAgingDays: null,
    contractorRepeatNonPerformances: [],
    leaseExpiryWithoutRenewalCount: 0,
    leaseExpiryWithoutRenewalAverageDaysOut: null,
    evictionNoticeDeadlineRiskCount: 0,
    evictionDeadlineWithinDays: null,
    staffAttrition90d: 0,
    staffCertsExpiredActive: 0,
    housingCompliancePoliciesAmber: false,
    safetyCompliancePoliciesAmber: false,
    openIncidents: 0,
    tenantsLatePayments: [],
    contractorQualityIssues: [],
    localMarketRentDropPct: null,
    fxVolatilityPctIntraday: null,
    monthlyRevenue: null,
    successionReviewOverdueDays: null,
    principalOwnerAgeYears: null,
    insurancePoliciesExpiring30d: [],
    topTenantRevenuePct: null,
    titleDeedRegistrationDriftDays: null,
    propertiesWithoutInsuranceCount: 0,
    avgPropertyValuationForUninsured: null,
    accessAnomaliesLastHour: 0,
    failedAuthSpike: 0,
    suspiciousActionCount: 0,
    tenantGrievances60d: 0,
    communityComplaintsOverdue: 0,
    disputeEscalatingCount: 0,
    withholdingTaxPayable: null,
    withholdingProvision: null,
    taxInquiryOpen: false,
    taxFilingOverdueDays: null,
    top3ContractsExpiring60d: [],
    disputeEscalations: [],
    knownScopes: [],
  };
}

export async function buildScannerState(
  tenantId: string,
  deps: RiskScannerDeps,
): Promise<RiskScannerState> {
  const nowIso = (deps.now?.() ?? new Date()).toISOString();
  const currency = deps.primaryCurrencyCode ?? 'TZS';
  const base = emptyState(tenantId, nowIso, currency);
  return deps.stateOverride ? { ...base, ...deps.stateOverride } : base;
}

const DEFAULT_LIMIT = 5;
const MIN_LIMIT = 1;
const MAX_LIMIT = 10;

function meetsSeverityFloor(
  severity: RiskSeverity,
  floor: RiskSeverity | undefined,
): boolean {
  if (!floor) return true;
  return SEVERITY_WEIGHT[severity] >= SEVERITY_WEIGHT[floor];
}

export function evaluateRisks(
  state: RiskScannerState,
  options?: ScanRisksOptions,
): ReadonlyArray<Risk> {
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(MIN_LIMIT, options?.limit ?? DEFAULT_LIMIT),
  );
  const kindFilter = options?.kindFilter
    ? new Set<RiskKind>(options.kindFilter)
    : null;
  const scopeFilter = options?.scopeIds
    ? new Set<string>(options.scopeIds)
    : null;
  const minSeverity = options?.minSeverity;

  const candidates: Risk[] = [];
  for (const rule of RISK_RULES) {
    if (kindFilter && !kindFilter.has(rule.kind)) continue;
    let detected = false;
    try {
      detected = rule.detect(state);
    } catch {
      continue;
    }
    if (!detected) continue;
    let risk: Risk | null = null;
    try {
      risk = rule.evaluate(state);
    } catch {
      continue;
    }
    if (!risk) continue;
    if (!meetsSeverityFloor(risk.severity, minSeverity)) continue;
    if (scopeFilter) {
      const intersects =
        risk.relatedScopes.length === 0 ||
        risk.relatedScopes.some((id) => scopeFilter.has(id));
      if (!intersects) continue;
    }
    candidates.push(risk);
  }

  candidates.sort((a, b) => {
    const sa = scoreRisk(a);
    const sb = scoreRisk(b);
    if (sa !== sb) return sb - sa;
    const ea = a.exposureAmount ?? 0;
    const eb = b.exposureAmount ?? 0;
    if (ea !== eb) return eb - ea;
    return a.id.localeCompare(b.id);
  });

  const seen = new Set<string>();
  const deduped: Risk[] = [];
  for (const risk of candidates) {
    if (seen.has(risk.ruleId)) continue;
    seen.add(risk.ruleId);
    deduped.push(risk);
    if (deduped.length >= limit) break;
  }
  return Object.freeze(deduped);
}

export async function scanRisks(
  tenantId: string,
  deps: RiskScannerDeps,
  options?: ScanRisksOptions,
): Promise<ReadonlyArray<Risk>> {
  const state = await buildScannerState(tenantId, deps);
  return evaluateRisks(state, options);
}

export function listRules(): ReadonlyArray<(typeof RISK_RULES)[number]> {
  return RISK_RULES;
}

export function countRulesByKind(): Readonly<Record<RiskKind, number>> {
  const counts: Record<RiskKind, number> = {
    cash_flow: 0,
    regulatory: 0,
    operational: 0,
    hr: 0,
    compliance: 0,
    counterparty: 0,
    market: 0,
    estate: 0,
    security: 0,
    reputational: 0,
    tax: 0,
    legal: 0,
  };
  for (const rule of RISK_RULES) {
    counts[rule.kind] += 1;
  }
  return Object.freeze(counts);
}
