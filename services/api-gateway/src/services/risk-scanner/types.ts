/**
 * Risk Scanner — typed shapes (real-estate domain).
 *
 * Mirrors the opportunity-scanner architecture but polarity-flipped: every
 * rule LOOKS for a threat the owner can mitigate BEFORE it materialises.
 * Headlines and narratives are bilingual; the scanner ranks by severity *
 * 1/timeToImpactDays so the most urgent meaningful threats float to the
 * top of the brain's `property.risks.scan` call.
 *
 * Symmetry rule with opportunity-scanner: when both surface conflicts
 * on the same urgency band, risk wins the tie-break.
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
  readonly exposureAmount: number | null;
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

  // Cash flow
  readonly cashRunwayDays: number | null;
  readonly arOverdue60dPctOfMonthly: number | null;
  readonly payrollDueInDays: number | null;
  readonly payrollAmount: number | null;
  readonly cashOnHand: number | null;
  readonly mortgagePaymentDueInDays: number | null;
  readonly mortgagePaymentAmount: number | null;

  // Rent arrears (tenant delinquency 30/60/90+)
  readonly rentArrears30dCount: number;
  readonly rentArrears60dCount: number;
  readonly rentArrears90dCount: number;
  readonly rentArrearsTotalAmount: number | null;

  // Regulatory
  readonly insuranceCertDaysToExpiry: number | null;
  readonly fireSafetyCertDaysToExpiry: number | null;
  readonly gasSafetyCertDaysToExpiry: number | null;
  readonly housingFilingDaysOverdue: number | null;
  readonly housingPenaltyAccrual: number | null;
  readonly regulatorInspectionDueInDays: number | null;

  // Property tax
  readonly propertyTaxDaysOverdue: number | null;
  readonly propertyTaxAccruedAmount: number | null;

  // HOA dues
  readonly hoaDuesOverdueAmount: number | null;
  readonly hoaDuesDaysOverdue: number | null;

  // Operational
  readonly maintenanceTicketsOverSlaCount: number;
  readonly maintenanceTicketsOverSla7dCount: number;
  readonly avgTicketAgingDays: number | null;
  readonly contractorRepeatNonPerformances: ReadonlyArray<{
    readonly contractor: string;
    readonly failureCount: number;
    readonly windowDays: number;
  }>;

  // Lease expiry
  readonly leaseExpiryWithoutRenewalCount: number;
  readonly leaseExpiryWithoutRenewalAverageDaysOut: number | null;
  readonly evictionNoticeDeadlineRiskCount: number;
  readonly evictionDeadlineWithinDays: number | null;

  // HR
  readonly staffAttrition90d: number;
  readonly staffCertsExpiredActive: number;

  // Compliance
  readonly housingCompliancePoliciesAmber: boolean;
  readonly safetyCompliancePoliciesAmber: boolean;
  readonly openIncidents: number;

  // Counterparty
  readonly tenantsLatePayments: ReadonlyArray<{
    readonly tenantId: string;
    readonly tenantName: string;
    readonly latePaymentCount: number;
    readonly creditScoreDelta: number | null;
  }>;
  readonly contractorQualityIssues: ReadonlyArray<{
    readonly contractorId: string;
    readonly contractorName: string;
    readonly offSpecCount: number;
  }>;

  // Market
  readonly localMarketRentDropPct: number | null;
  readonly fxVolatilityPctIntraday: number | null;
  readonly monthlyRevenue: number | null;

  // Estate
  readonly successionReviewOverdueDays: number | null;
  readonly principalOwnerAgeYears: number | null;
  readonly insurancePoliciesExpiring30d: ReadonlyArray<{
    readonly policyId: string;
    readonly policyKind: string;
    readonly daysToExpiry: number;
  }>;
  readonly topTenantRevenuePct: number | null;
  readonly titleDeedRegistrationDriftDays: number | null;
  readonly propertiesWithoutInsuranceCount: number;
  readonly avgPropertyValuationForUninsured: number | null;

  // Security
  readonly accessAnomaliesLastHour: number;
  readonly failedAuthSpike: number;
  readonly suspiciousActionCount: number;

  // Reputational
  readonly tenantGrievances60d: number;
  readonly communityComplaintsOverdue: number;
  readonly disputeEscalatingCount: number;

  // Tax
  readonly withholdingTaxPayable: number | null;
  readonly withholdingProvision: number | null;
  readonly taxInquiryOpen: boolean;
  readonly taxFilingOverdueDays: number | null;

  // Legal
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
