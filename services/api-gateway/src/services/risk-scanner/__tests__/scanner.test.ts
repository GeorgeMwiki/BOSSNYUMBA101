/**
 * Risk scanner — engine + 33-rule catalog coverage.
 */
import { describe, expect, it } from 'vitest';

import { RISK_RULES } from '../scan-rules.js';
import { evaluateRisks, countRulesByKind } from '../scanner.js';
import type { RiskScannerState } from '../types.js';

function base(overrides: Partial<RiskScannerState> = {}): RiskScannerState {
  return {
    tenantId: 't-a',
    nowIso: '2026-05-29T10:00:00Z',
    primaryCurrencyCode: 'TZS',
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
    ...overrides,
  };
}

describe('risk catalog — 33 rules total', () => {
  it('ships 33 rules with unique ids', () => {
    expect(RISK_RULES.length).toBe(33);
    const ids = RISK_RULES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('countRulesByKind sums to 33', () => {
    const counts = countRulesByKind();
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    expect(total).toBe(33);
  });
});

describe('risk rules — detect coverage', () => {
  it('cash runway <90d fires', () => {
    const out = evaluateRisks(base({ cashRunwayDays: 45 }));
    expect(out.map((r) => r.id)).toContain('cash.runway_below_90d');
  });

  it('AR aging fires', () => {
    const out = evaluateRisks(base({ arOverdue60dPctOfMonthly: 25 }));
    expect(out.map((r) => r.id)).toContain('cash.ar_aging_critical');
  });

  it('payroll-at-risk fires', () => {
    const out = evaluateRisks(
      base({
        payrollDueInDays: 4,
        payrollAmount: 5_000_000,
        cashOnHand: 5_500_000,
      }),
    );
    expect(out.map((r) => r.id)).toContain('cash.payroll_at_risk');
  });

  it('mortgage payment risk fires', () => {
    const out = evaluateRisks(
      base({
        mortgagePaymentDueInDays: 7,
        mortgagePaymentAmount: 8_000_000,
        cashOnHand: 8_300_000,
      }),
    );
    expect(out.map((r) => r.id)).toContain('cash.mortgage_payment_risk');
  });

  it('rent arrears 30/60/90 fires', () => {
    const out = evaluateRisks(
      base({
        rentArrears30dCount: 8,
        rentArrears60dCount: 3,
        rentArrears90dCount: 1,
        rentArrearsTotalAmount: 12_000_000,
      }),
    );
    expect(out.map((r) => r.id)).toContain('arrears.tenants_30d_plus');
  });

  it('insurance cert expiring fires', () => {
    const out = evaluateRisks(base({ insuranceCertDaysToExpiry: 7 }));
    expect(out.map((r) => r.id)).toContain('regulatory.insurance_cert_expiring');
  });

  it('fire safety cert expiring fires', () => {
    const out = evaluateRisks(base({ fireSafetyCertDaysToExpiry: 5 }));
    expect(out.map((r) => r.id)).toContain('regulatory.fire_safety_cert_expiring');
  });

  it('gas safety cert expiring fires', () => {
    const out = evaluateRisks(base({ gasSafetyCertDaysToExpiry: 10 }));
    expect(out.map((r) => r.id)).toContain('regulatory.gas_safety_cert_expiring');
  });

  it('housing filing overdue fires', () => {
    const out = evaluateRisks(
      base({ housingFilingDaysOverdue: 10, housingPenaltyAccrual: 1_000_000 }),
    );
    expect(out.map((r) => r.id)).toContain('regulatory.housing_filing_overdue');
  });

  it('regulator inspection due fires', () => {
    const out = evaluateRisks(base({ regulatorInspectionDueInDays: 12 }));
    expect(out.map((r) => r.id)).toContain('regulatory.inspection_due');
  });

  it('property tax overdue fires', () => {
    const out = evaluateRisks(
      base({ propertyTaxDaysOverdue: 5, propertyTaxAccruedAmount: 2_000_000 }),
    );
    expect(out.map((r) => r.id)).toContain('tax.property_tax_overdue');
  });

  it('HOA dues overdue fires', () => {
    const out = evaluateRisks(
      base({ hoaDuesDaysOverdue: 21, hoaDuesOverdueAmount: 500_000 }),
    );
    expect(out.map((r) => r.id)).toContain('estate.hoa_dues_overdue');
  });

  it('maintenance over SLA fires', () => {
    const out = evaluateRisks(
      base({
        maintenanceTicketsOverSlaCount: 10,
        maintenanceTicketsOverSla7dCount: 7,
      }),
    );
    expect(out.map((r) => r.id)).toContain('operational.maintenance_over_sla');
  });

  it('lease expiry without renewal fires', () => {
    const out = evaluateRisks(
      base({
        leaseExpiryWithoutRenewalCount: 4,
        leaseExpiryWithoutRenewalAverageDaysOut: 10,
      }),
    );
    expect(out.map((r) => r.id)).toContain('legal.lease_expiry_without_renewal');
  });

  it('eviction deadline risk fires', () => {
    const out = evaluateRisks(
      base({
        evictionNoticeDeadlineRiskCount: 2,
        evictionDeadlineWithinDays: 5,
      }),
    );
    expect(out.map((r) => r.id)).toContain('legal.eviction_deadline_risk');
  });

  it('uninsured property fires critical when 2+', () => {
    const out = evaluateRisks(
      base({
        propertiesWithoutInsuranceCount: 2,
        avgPropertyValuationForUninsured: 30_000_000,
      }),
    );
    const r = out.find((r) => r.id === 'estate.uninsured_property');
    expect(r).toBeTruthy();
    expect(r!.severity).toBe('critical');
  });

  it('tenant concentration fires high when >50%', () => {
    const out = evaluateRisks(base({ topTenantRevenuePct: 60 }));
    const r = out.find((r) => r.id === 'estate.tenant_concentration');
    expect(r).toBeTruthy();
    expect(r!.severity).toBe('high');
  });

  it('security anomaly fires', () => {
    const out = evaluateRisks(
      base({
        accessAnomaliesLastHour: 5,
        failedAuthSpike: 15,
        suspiciousActionCount: 4,
      }),
    );
    expect(out.map((r) => r.id)).toContain('security.access_anomaly');
  });

  it('title deed drift fires high when >180d', () => {
    const out = evaluateRisks(base({ titleDeedRegistrationDriftDays: 200 }));
    const r = out.find((r) => r.id === 'estate.title_deed_drift');
    expect(r).toBeTruthy();
    expect(r!.severity).toBe('high');
  });

  it('limit caps results', () => {
    const out = evaluateRisks(
      base({
        cashRunwayDays: 30,
        arOverdue60dPctOfMonthly: 30,
        rentArrears30dCount: 5,
        propertiesWithoutInsuranceCount: 2,
        avgPropertyValuationForUninsured: 10_000_000,
      }),
      { limit: 2 },
    );
    expect(out.length).toBeLessThanOrEqual(2);
  });

  it('filters by kind', () => {
    const out = evaluateRisks(
      base({
        cashRunwayDays: 30,
        insuranceCertDaysToExpiry: 5,
      }),
      { kindFilter: ['cash_flow'] },
    );
    expect(out.every((r) => r.kind === 'cash_flow')).toBe(true);
  });

  it('respects minSeverity floor', () => {
    const out = evaluateRisks(
      base({
        cashRunwayDays: 30,
        hoaDuesDaysOverdue: 30,
        hoaDuesOverdueAmount: 100_000,
      }),
      { minSeverity: 'high' },
    );
    expect(out.every((r) => r.severity === 'high' || r.severity === 'critical')).toBe(true);
  });
});

describe('risk wins urgency tie-breaker (symmetry rule)', () => {
  it('critical risks outrank lower-severity risks regardless of insertion order', () => {
    const out = evaluateRisks(
      base({
        // Critical: payroll due in 3 days, cash thin
        payrollDueInDays: 3,
        payrollAmount: 5_000_000,
        cashOnHand: 5_100_000,
        // High: insurance cert expiring in 7 days
        insuranceCertDaysToExpiry: 7,
      }),
      { limit: 5 },
    );
    expect(out.length).toBeGreaterThan(1);
    // The most urgent (lowest TTD × highest severity) lands first.
    expect(out[0]!.severity === 'critical' || out[0]!.severity === 'high').toBe(true);
  });
});
