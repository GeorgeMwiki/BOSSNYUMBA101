/**
 * Opportunity scanner — smoke + rule-coverage tests.
 */
import { describe, expect, it } from 'vitest';

import { scanOpportunities } from '../scanner.js';
import type { ScanState } from '../types.js';

function baseState(overrides: Partial<ScanState> = {}): ScanState {
  return {
    tenantId: 'tenant-a',
    nowIso: '2026-05-29T10:00:00Z',
    primaryCurrencyCode: 'TZS',
    ...overrides,
  };
}

describe('scanOpportunities', () => {
  it('returns empty for a tenant with no signals', () => {
    const out = scanOpportunities(baseState());
    expect(out).toHaveLength(0);
  });

  it('surfaces rent-uplift opportunity when below market', () => {
    const out = scanOpportunities(
      baseState({
        portfolio: {
          totalUnits: 20,
          occupiedUnits: 18,
          vacantUnits: 2,
          vacancyRatePct: 10,
          portfolioRolePeerP25VacancyRatePct: 8,
          totalRentRollMonthly: 9_000_000,
        },
        market: {
          avgMarketRentPerUnit: 600_000,
          portfolioAvgRentPerUnit: 500_000,
          tenantRentBelowMarketPct: 20,
          leasesExpiringIn90dCount: 2,
        },
      }),
    );
    expect(out.length).toBeGreaterThan(0);
    const ids = out.map((o) => o.id);
    expect(ids).toContain('lift_rent_to_market');
  });

  it('surfaces batch-renewals opportunity when 5+ leases expiring', () => {
    const out = scanOpportunities(
      baseState({
        market: {
          avgMarketRentPerUnit: 500_000,
          portfolioAvgRentPerUnit: 500_000,
          tenantRentBelowMarketPct: 0,
          leasesExpiringIn90dCount: 7,
        },
      }),
    );
    const ids = out.map((o) => o.id);
    expect(ids).toContain('batch_lease_renewals_90d');
  });

  it('surfaces treasury-yield opportunity when idle cash + yield', () => {
    const out = scanOpportunities(
      baseState({
        capital: {
          currentLoanRatePct: null,
          tibBetterRatePct: null,
          loanBalance: null,
          cashOnHand: null,
          idleCashOver90d: 50_000_000,
          tibillsYieldPct: 12.5,
        },
      }),
    );
    const ids = out.map((o) => o.id);
    expect(ids).toContain('park_idle_cash_in_tbills');
  });

  it('caps results at maxResults', () => {
    const out = scanOpportunities(
      baseState({
        portfolio: {
          totalUnits: 50,
          occupiedUnits: 35,
          vacantUnits: 15,
          vacancyRatePct: 30,
          portfolioRolePeerP25VacancyRatePct: 8,
          totalRentRollMonthly: 17_500_000,
        },
        market: {
          avgMarketRentPerUnit: 700_000,
          portfolioAvgRentPerUnit: 500_000,
          tenantRentBelowMarketPct: 40,
          leasesExpiringIn90dCount: 12,
        },
        capital: {
          currentLoanRatePct: null,
          tibBetterRatePct: null,
          loanBalance: null,
          cashOnHand: null,
          idleCashOver90d: 100_000_000,
          tibillsYieldPct: 12,
        },
      }),
      { maxResults: 2 },
    );
    expect(out).toHaveLength(2);
  });

  it('respects kindFilter', () => {
    const out = scanOpportunities(
      baseState({
        market: {
          avgMarketRentPerUnit: 500_000,
          portfolioAvgRentPerUnit: 500_000,
          tenantRentBelowMarketPct: 0,
          leasesExpiringIn90dCount: 8,
        },
        capital: {
          currentLoanRatePct: null,
          tibBetterRatePct: null,
          loanBalance: null,
          cashOnHand: null,
          idleCashOver90d: 50_000_000,
          tibillsYieldPct: 12,
        },
      }),
      { kindFilter: ['capital'] },
    );
    const ids = out.map((o) => o.id);
    expect(ids).toContain('park_idle_cash_in_tbills');
    expect(ids).not.toContain('batch_lease_renewals_90d');
  });

  it('produces bilingual headlines + narratives', () => {
    const out = scanOpportunities(
      baseState({
        capital: {
          currentLoanRatePct: null,
          tibBetterRatePct: null,
          loanBalance: null,
          cashOnHand: null,
          idleCashOver90d: 30_000_000,
          tibillsYieldPct: 12,
        },
      }),
    );
    expect(out[0]?.headline.en.length).toBeGreaterThan(0);
    expect(out[0]?.headline.sw.length).toBeGreaterThan(0);
    expect(out[0]?.narrative.en.length).toBeGreaterThan(0);
    expect(out[0]?.narrative.sw.length).toBeGreaterThan(0);
  });
});
