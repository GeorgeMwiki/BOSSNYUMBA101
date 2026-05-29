/**
 * Risk scanner — smoke + rule-coverage tests.
 */
import { describe, expect, it } from 'vitest';

import { scanRisks } from '../scanner.js';
import type { RiskScannerState } from '../types.js';

function baseState(overrides: Partial<RiskScannerState> = {}): RiskScannerState {
  return {
    tenantId: 'tenant-a',
    nowIso: '2026-05-29T10:00:00Z',
    primaryCurrencyCode: 'TZS',
    cashRunwayDays: null,
    arrearsOver60dPctOfMonthly: null,
    payrollDueInDays: null,
    payrollAmount: null,
    cashOnHand: null,
    housingPermitDaysToExpiry: null,
    buildingComplianceDaysToExpiry: null,
    traFilingDaysOverdue: null,
    traPenaltyAccrual: null,
    maintenanceBacklogMomMonthsUp: 0,
    maintenanceBacklogMomDeltaPct: null,
    avgTurnaroundDaysOverP75: null,
    equipmentRepeatFailures: [],
    managerAttrition90d: 0,
    staffWithExpiredCertActive: 0,
    rentReceiptDraftPctDeviation: null,
    housingBoardAmber: false,
    safetyAmber: false,
    openIncidents: 0,
    tenantLatePayments: [],
    vendorQualityIssues: [],
    localRentIndexDelta30dSigma: null,
    fxUsdLocalVolatilityPctIntraday: null,
    monthlyRevenue: null,
    successionReviewOverdueDays: null,
    principalOwnerAgeYears: null,
    insurancePoliciesExpiring30d: [],
    accessAnomaliesLastHour: 0,
    failedAuthSpike: 0,
    suspiciousActionCount: 0,
    tenantComplaints60d: 0,
    communityMilestonesOverdue: 0,
    withholdingTaxPayable: null,
    withholdingProvision: null,
    traInquiryOpen: false,
    traFilingOverdueDays: null,
    top3ContractsExpiring60d: [],
    disputeEscalations: [],
    knownScopes: [],
    ...overrides,
  };
}

describe('scanRisks', () => {
  it('returns empty for a quiet tenant', () => {
    expect(scanRisks(baseState())).toHaveLength(0);
  });

  it('surfaces arrears risk when over 60d > 15%', () => {
    const out = scanRisks(
      baseState({
        arrearsOver60dPctOfMonthly: 22,
        monthlyRevenue: 10_000_000,
      }),
    );
    const ids = out.map((r) => r.id);
    expect(ids).toContain('arrears_over_60d_spike');
    const arrears = out.find((r) => r.id === 'arrears_over_60d_spike')!;
    expect(arrears.exposure).toBe(10_000_000 * 0.22);
  });

  it('surfaces critical regulatory risk when permit expires in <=30d', () => {
    const out = scanRisks(
      baseState({ housingPermitDaysToExpiry: 14 }),
    );
    const flagged = out.find((r) => r.id === 'housing_permit_expiry_30d')!;
    expect(flagged).toBeDefined();
    expect(flagged.severity).toBe('critical');
  });

  it('respects minSeverity filter', () => {
    const out = scanRisks(
      baseState({
        tenantComplaints60d: 15,
        arrearsOver60dPctOfMonthly: 22,
        monthlyRevenue: 10_000_000,
      }),
      { minSeverity: 'high' },
    );
    const ids = out.map((r) => r.id);
    expect(ids).toContain('arrears_over_60d_spike');
    expect(ids).not.toContain('tenant_complaints_60d_spike');
  });

  it('ranks critical before high before medium', () => {
    const out = scanRisks(
      baseState({
        housingPermitDaysToExpiry: 20,
        arrearsOver60dPctOfMonthly: 20,
        monthlyRevenue: 10_000_000,
        tenantComplaints60d: 15,
      }),
    );
    expect(out[0]?.severity).toBe('critical');
  });

  it('caps results at limit', () => {
    const out = scanRisks(
      baseState({
        arrearsOver60dPctOfMonthly: 20,
        monthlyRevenue: 10_000_000,
        housingPermitDaysToExpiry: 14,
        maintenanceBacklogMomMonthsUp: 4,
        tenantComplaints60d: 12,
      }),
      { limit: 2 },
    );
    expect(out).toHaveLength(2);
  });
});
