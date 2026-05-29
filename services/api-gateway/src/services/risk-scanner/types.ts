/**
 * Risk Scanner — typed shapes (real-estate domain).
 *
 * Mirrors the opportunity-scanner architecture but polarity-flipped:
 * every rule LOOKS for a threat the owner can mitigate BEFORE it
 * materialises. Headlines and narratives are bilingual; the scanner
 * ranks by severity * 1/timeToImpactDays so the most urgent meaningful
 * threats float to the top of the brain's `property.risks.scan` call.
 */

export type RiskKind =
  | 'cash_flow'
  | 'regulatory'
  | 'operational'
  | 'hr'
  | 'compliance'
  | 'counterparty'
  | 'market'
  | 'estate'
  | 'security'
  | 'reputational'
  | 'tax'
  | 'legal';

export type RiskSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface BilingualText {
  readonly en: string;
  readonly sw: string;
}

export interface RiskMitigationAction {
  readonly action: string;
  readonly target?: string;
  readonly payload?: Record<string, unknown>;
  readonly label: BilingualText;
}

export interface Risk {
  readonly id: string;
  readonly kind: RiskKind;
  readonly severity: RiskSeverity;
  readonly headline: BilingualText;
  readonly narrative: BilingualText;
  readonly exposure: number | null;
  readonly currencyCode: string;
  readonly timeToImpactDays: number;
  readonly mitigationActions: ReadonlyArray<RiskMitigationAction>;
  readonly relatedScopes: ReadonlyArray<string>;
  readonly citations: ReadonlyArray<string>;
  readonly ruleId: string;
}

export interface RiskScannerState {
  readonly tenantId: string;
  readonly nowIso: string;
  readonly primaryCurrencyCode: string;
  readonly cashRunwayDays: number | null;
  readonly arrearsOver60dPctOfMonthly: number | null;
  readonly payrollDueInDays: number | null;
  readonly payrollAmount: number | null;
  readonly cashOnHand: number | null;
  readonly housingPermitDaysToExpiry: number | null;
  readonly buildingComplianceDaysToExpiry: number | null;
  readonly traFilingDaysOverdue: number | null;
  readonly traPenaltyAccrual: number | null;
  readonly maintenanceBacklogMomMonthsUp: number;
  readonly maintenanceBacklogMomDeltaPct: number | null;
  readonly avgTurnaroundDaysOverP75: number | null;
  readonly equipmentRepeatFailures: ReadonlyArray<{
    readonly equipmentKind: string;
    readonly count: number;
    readonly windowDays: number;
  }>;
  readonly managerAttrition90d: number;
  readonly staffWithExpiredCertActive: number;
  readonly rentReceiptDraftPctDeviation: number | null;
  readonly housingBoardAmber: boolean;
  readonly safetyAmber: boolean;
  readonly openIncidents: number;
  readonly tenantLatePayments: ReadonlyArray<{
    readonly tenantUserId: string;
    readonly tenantName: string;
    readonly latePaymentCount: number;
    readonly crbScoreDelta: number | null;
  }>;
  readonly vendorQualityIssues: ReadonlyArray<{
    readonly vendorId: string;
    readonly vendorName: string;
    readonly offSpecCount: number;
  }>;
  readonly localRentIndexDelta30dSigma: number | null;
  readonly fxUsdLocalVolatilityPctIntraday: number | null;
  readonly monthlyRevenue: number | null;
  readonly successionReviewOverdueDays: number | null;
  readonly principalOwnerAgeYears: number | null;
  readonly insurancePoliciesExpiring30d: ReadonlyArray<{
    readonly policyId: string;
    readonly policyKind: string;
    readonly daysToExpiry: number;
  }>;
  readonly accessAnomaliesLastHour: number;
  readonly failedAuthSpike: number;
  readonly suspiciousActionCount: number;
  readonly tenantComplaints60d: number;
  readonly communityMilestonesOverdue: number;
  readonly withholdingTaxPayable: number | null;
  readonly withholdingProvision: number | null;
  readonly traInquiryOpen: boolean;
  readonly traFilingOverdueDays: number | null;
  readonly top3ContractsExpiring60d: ReadonlyArray<{
    readonly contractId: string;
    readonly counterpartyName: string;
    readonly daysToExpiry: number;
    readonly annualValue: number | null;
    readonly hasRenewalInFlight: boolean;
  }>;
  readonly disputeEscalations: ReadonlyArray<{
    readonly counterpartyId: string;
    readonly counterpartyName: string;
    readonly disputeCount90d: number;
  }>;
  readonly knownScopes: ReadonlyArray<{
    readonly id: string;
    readonly label: string;
  }>;
}

export interface RiskRule {
  readonly id: string;
  readonly kind: RiskKind;
  readonly severity: RiskSeverity;
  readonly defaultTimeToImpactDays: number;
  detect(state: RiskScannerState): boolean;
  evaluate(state: RiskScannerState): Risk;
}

export interface ScanRisksOptions {
  readonly limit?: number;
  readonly kindFilter?: ReadonlyArray<RiskKind>;
  readonly minSeverity?: RiskSeverity;
  readonly scopeIds?: ReadonlyArray<string>;
}

export const SEVERITY_WEIGHT: Readonly<Record<RiskSeverity, number>> = Object.freeze({
  low: 1,
  medium: 3,
  high: 7,
  critical: 12,
});

export function scoreRisk(risk: Risk): number {
  const ttd = Math.max(1, risk.timeToImpactDays);
  return SEVERITY_WEIGHT[risk.severity] / ttd;
}
