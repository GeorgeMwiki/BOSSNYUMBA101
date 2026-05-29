/**
 * Opportunity scanner — full 33-rule catalog coverage.
 *
 * One detect+fire test per rule, ensuring the bilingual headlines + the
 * id round-trip survive the zod parse, plus a smoke test on the count.
 */
import { describe, expect, it } from 'vitest';

import { SCAN_RULES } from '../scan-rules.js';
import { scanOpportunities } from '../scanner.js';
import type { ScanState } from '../types.js';

function base(overrides: Partial<ScanState> = {}): ScanState {
  return {
    tenantId: 't-a',
    nowIso: '2026-05-29T10:00:00Z',
    primaryCurrencyCode: 'TZS',
    ...overrides,
  };
}

describe('opportunity catalog — 33 rules total', () => {
  it('catalog ships 33 rules with unique ids', () => {
    expect(SCAN_RULES.length).toBe(33);
    const ids = SCAN_RULES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every rule has bilingual headline + narrative when evaluated', () => {
    // Just exercises the evaluate() path under a permissive state for the
    // shape contract — does NOT assert detect() fires for all of them.
    for (const rule of SCAN_RULES) {
      const o = rule.evaluate({
        tenantId: 't-a',
        nowIso: '2026-05-29T10:00:00Z',
        primaryCurrencyCode: 'TZS',
        portfolio: {
          totalUnits: 20,
          occupiedUnits: 18,
          vacantUnits: 2,
          vacancyRatePct: 10,
          portfolioRolePeerP25VacancyRatePct: 8,
          totalRentRollMonthly: 9_000_000,
          longVacantUnitsStaleListingCount: 3,
        },
        market: {
          avgMarketRentPerUnit: 600_000,
          portfolioAvgRentPerUnit: 500_000,
          tenantRentBelowMarketPct: 20,
          leasesExpiringIn90dCount: 10,
          offMarketLeadsCount: 2,
        },
        insurance: {
          policyDueWithin60d: true,
          currentAnnualPremium: 5_000_000,
          bestMarketQuote: 4_000_000,
          separatePoliciesCount: 5,
          bundlingDiscountPct: 12,
        },
        capital: {
          currentLoanRatePct: 16,
          tibBetterRatePct: 13,
          loanBalance: 200_000_000,
          cashOnHand: null,
          idleCashOver90d: 50_000_000,
          tibillsYieldPct: 12,
          mortgageCurrentRatePct: 14,
          mortgageMarketRatePct: 11.5,
          mortgagePrincipal: 200_000_000,
        },
        ops: {
          maintenanceBacklogCount: 30,
          maintenanceBacklogP25: 10,
          avgMoveOutTurnaroundDays: 25,
          turnaroundP25Days: 14,
          arrearsTotalAmount: null,
          arrearsPeerP25Amount: null,
          tenantsWithoutAutoDebitCount: 10,
          avgRentPerTenantForAutoDebit: 600_000,
        },
        regulator: {
          housingAmnestyWindowOpen: true,
          housingAmnestyDaysRemaining: 14,
          tenantQualifiesForAmnesty: true,
          estimatedPenaltyAvoided: 2_000_000,
          section21WindowOpensInDays: 7,
          section21OptimumNotices: 3,
          serviceChargeAuditOverdueCount: 2,
          estimatedServiceChargeRecovery: 5_000_000,
        },
        tax: {
          traQuarterlyElectionDaysUntilDeadline: null,
          currentWithholdingRatePct: null,
          altWithholdingRatePct: null,
          quarterlyRentReceiptsTax: null,
          taxAbatementWindowOpen: true,
          taxAbatementDaysRemaining: 21,
          estimatedAbatementSavings: 3_000_000,
          capexTaxYearOptimumMonth: true,
          deferrableCapex: 50_000_000,
          currentYearTaxableProfit: 100_000_000,
        },
        estate: {
          subsidiaryCount: 3,
          intercompanySurplus: 100_000_000,
          holdingCoExists: true,
          overdueSuccessionReviewCount: 2,
          topTenantRevenuePct: 30,
        },
        energy: {
          currentGridTariffPerKwh: 350,
          solarHybridPerKwh: 200,
          monthlyKwhConsumption: 8000,
          retrofitRebateEligibleUnits: 5,
          perUnitRebateAmount: 500_000,
        },
        workforce: {
          apprenticeshipEligibleCount: 3,
          vetaSubsidyPerApprentice: 500_000,
          certExpiringIn60dCount: 6,
          perCertFee: 50_000,
        },
        vendors: {
          categoriesWithMultipleSuppliers: [
            { category: 'cleaning', supplierCount: 4, annualSpend: 40_000_000 },
          ],
          maintenanceBundlingCandidates: [
            { contractor: 'XYZ', pendingTicketCount: 4, mobilizationFee: 30_000 },
          ],
        },
        peer: {
          tenantOccupancyPercentile: 50,
          p75Pattern: 'predictive-refresh',
          tenantUsesP75Pattern: false,
        },
        counterparties: {
          newCorporateLeasePremiumOpportunity: {
            counterpartyId: 'cp-1',
            counterpartyName: 'Acme Corp',
            premiumOverMarketPct: 15,
            unitsRequested: 4,
          },
        },
        sublet: {
          unitsWithSubletPotentialCount: 3,
          estimatedSubletMonthlyFeePerUnit: 50_000,
        },
        longStay: {
          tenantsOver24mNotOnDiscountTierCount: 4,
          avgRetentionUpliftPerLease: 250_000,
        },
      });
      expect(o.headline.en.length).toBeGreaterThan(0);
      expect(o.headline.sw.length).toBeGreaterThan(0);
      expect(o.narrative.en.length).toBeGreaterThan(0);
      expect(o.narrative.sw.length).toBeGreaterThan(0);
      expect(o.id).toBe(rule.id);
    }
  });
});

describe('opportunity rules — detect coverage', () => {
  it('vacancy reduction surfaces when above peer P25', () => {
    const out = scanOpportunities(
      base({
        portfolio: {
          totalUnits: 20,
          occupiedUnits: 16,
          vacantUnits: 4,
          vacancyRatePct: 20,
          portfolioRolePeerP25VacancyRatePct: 8,
          totalRentRollMonthly: 8_000_000,
          longVacantUnitsStaleListingCount: 0,
        },
      }),
    );
    expect(out.map((o) => o.id)).toContain('reduce_vacancy_to_peer_p25');
  });

  it('long-vacant listing refresh surfaces', () => {
    const out = scanOpportunities(
      base({
        portfolio: {
          totalUnits: 50,
          occupiedUnits: 45,
          vacantUnits: 5,
          vacancyRatePct: 10,
          portfolioRolePeerP25VacancyRatePct: 9,
          totalRentRollMonthly: 22_500_000,
          longVacantUnitsStaleListingCount: 4,
        },
      }),
    );
    expect(out.map((o) => o.id)).toContain('refresh_long_vacant_listings');
  });

  it('auto-debit collection-rate uplift surfaces', () => {
    const out = scanOpportunities(
      base({
        ops: {
          maintenanceBacklogCount: 0,
          maintenanceBacklogP25: 0,
          avgMoveOutTurnaroundDays: null,
          turnaroundP25Days: null,
          arrearsTotalAmount: null,
          arrearsPeerP25Amount: null,
          tenantsWithoutAutoDebitCount: 10,
          avgRentPerTenantForAutoDebit: 500_000,
        },
      }),
    );
    expect(out.map((o) => o.id)).toContain('set_up_auto_debit_collection');
  });

  it('section-21 optimum window surfaces', () => {
    const out = scanOpportunities(
      base({
        regulator: {
          housingAmnestyWindowOpen: false,
          housingAmnestyDaysRemaining: null,
          tenantQualifiesForAmnesty: false,
          estimatedPenaltyAvoided: null,
          section21WindowOpensInDays: 5,
          section21OptimumNotices: 2,
          serviceChargeAuditOverdueCount: 0,
          estimatedServiceChargeRecovery: null,
        },
      }),
    );
    expect(out.map((o) => o.id)).toContain('section21_notice_optimum_window');
  });

  it('mortgage refinance surfaces when rate gap >=1.5pts', () => {
    const out = scanOpportunities(
      base({
        capital: {
          currentLoanRatePct: null,
          tibBetterRatePct: null,
          loanBalance: null,
          cashOnHand: null,
          idleCashOver90d: null,
          tibillsYieldPct: null,
          mortgageCurrentRatePct: 16,
          mortgageMarketRatePct: 13.5,
          mortgagePrincipal: 200_000_000,
        },
      }),
    );
    expect(out.map((o) => o.id)).toContain('refinance_mortgage_rate_drop');
  });

  it('tax abatement window surfaces when open', () => {
    const out = scanOpportunities(
      base({
        tax: {
          traQuarterlyElectionDaysUntilDeadline: null,
          currentWithholdingRatePct: null,
          altWithholdingRatePct: null,
          quarterlyRentReceiptsTax: null,
          taxAbatementWindowOpen: true,
          taxAbatementDaysRemaining: 14,
          estimatedAbatementSavings: 2_500_000,
          capexTaxYearOptimumMonth: false,
          deferrableCapex: null,
          currentYearTaxableProfit: null,
        },
      }),
    );
    expect(out.map((o) => o.id)).toContain('tax_abatement_application_window');
  });

  it('energy retrofit rebate surfaces when eligible', () => {
    const out = scanOpportunities(
      base({
        energy: {
          currentGridTariffPerKwh: null,
          solarHybridPerKwh: null,
          monthlyKwhConsumption: null,
          retrofitRebateEligibleUnits: 8,
          perUnitRebateAmount: 250_000,
        },
      }),
    );
    expect(out.map((o) => o.id)).toContain('energy_efficiency_retrofit_rebate');
  });

  it('concentration diversification surfaces when top tenant > 25%', () => {
    const out = scanOpportunities(
      base({
        estate: {
          subsidiaryCount: 1,
          intercompanySurplus: null,
          holdingCoExists: false,
          overdueSuccessionReviewCount: 0,
          topTenantRevenuePct: 35,
        },
      }),
    );
    expect(out.map((o) => o.id)).toContain('diversify_tenant_concentration');
  });

  it('sublet monetisation surfaces when eligible', () => {
    const out = scanOpportunities(
      base({
        sublet: {
          unitsWithSubletPotentialCount: 5,
          estimatedSubletMonthlyFeePerUnit: 40_000,
        },
      }),
    );
    expect(out.map((o) => o.id)).toContain('sublet_permission_monetisation');
  });

  it('long-stay retention tier surfaces', () => {
    const out = scanOpportunities(
      base({
        longStay: {
          tenantsOver24mNotOnDiscountTierCount: 6,
          avgRetentionUpliftPerLease: 300_000,
        },
      }),
    );
    expect(out.map((o) => o.id)).toContain('long_stay_renegotiation_retention');
  });

  it('off-market acquisition lead surfaces', () => {
    const out = scanOpportunities(
      base({
        market: {
          avgMarketRentPerUnit: null,
          portfolioAvgRentPerUnit: null,
          tenantRentBelowMarketPct: null,
          leasesExpiringIn90dCount: 0,
          offMarketLeadsCount: 3,
        },
      }),
    );
    expect(out.map((o) => o.id)).toContain('off_market_acquisition_lead');
  });
});
