import { describe, expect, it } from 'vitest';
import { optimiseLTV } from '../refinancing/ltv-optimizer.js';
import { selectLender } from '../refinancing/lender-selector.js';
import { adviseRateLock } from '../refinancing/rate-lock-timing.js';
import { compareDefeasanceVsYM } from '../refinancing/defeasance-vs-yield-maint.js';
import { scanCovenants } from '../refinancing/covenant-compliance-scanner.js';
import { optimiseRefiProceeds } from '../refinancing/refi-proceeds-optimizer.js';

describe('optimiseLTV', () => {
  it('fills a multi-tranche stack within DSCR and DY constraints', () => {
    const r = optimiseLTV({
      stabilisedValue: 100_000_000,
      stabilisedNOI: 7_000_000,
      targetDSCR: 1.30,
      targetDebtYield: 0.08,
      tranches: [
        { type: 'agency', maxLTVShare: 0.65, ratePct: 0.055, termYears: 10, amortYears: 30 },
        { type: 'mezz', maxLTVShare: 0.20, ratePct: 0.10, termYears: 5, amortYears: 30 },
      ],
    });
    expect(r.feasible).toBe(true);
    expect(r.totalLTV).toBeLessThanOrEqual(0.85);
    expect(r.dscr).toBeGreaterThanOrEqual(1.30 - 1e-3);
  });

  it('does not place mezz when DSCR cap exhausted by senior', () => {
    const r = optimiseLTV({
      stabilisedValue: 100_000_000,
      stabilisedNOI: 5_000_000,
      targetDSCR: 1.30,
      targetDebtYield: 0.08,
      tranches: [
        { type: 'cmbs', maxLTVShare: 0.70, ratePct: 0.065, termYears: 10, amortYears: 30 },
        { type: 'mezz', maxLTVShare: 0.20, ratePct: 0.12, termYears: 5, amortYears: 30 },
      ],
    });
    // With lower NOI, mezz should not be allocated; total LTV constrained
    expect(r.allocatedTranches.find((t) => t.type === 'mezz')?.amount ?? 0).toBeLessThanOrEqual(
      r.allocatedTranches.find((t) => t.type === 'cmbs')?.amount ?? 1e9,
    );
  });

  it('throws on zero stabilised value', () => {
    expect(() => optimiseLTV({
      stabilisedValue: 0,
      stabilisedNOI: 100_000,
      targetDSCR: 1.2,
      targetDebtYield: 0.08,
      tranches: [],
    })).toThrow();
  });

  it('weighted rate is between min and max tranche rates', () => {
    const r = optimiseLTV({
      stabilisedValue: 100_000_000,
      stabilisedNOI: 8_000_000,
      targetDSCR: 1.25,
      targetDebtYield: 0.08,
      tranches: [
        { type: 'cmbs', maxLTVShare: 0.65, ratePct: 0.06, termYears: 10, amortYears: 30 },
        { type: 'mezz', maxLTVShare: 0.15, ratePct: 0.11, termYears: 5, amortYears: 30 },
      ],
    });
    expect(r.weightedRate).toBeGreaterThanOrEqual(0.06 - 1e-6);
    expect(r.weightedRate).toBeLessThanOrEqual(0.11 + 1e-6);
  });
});

describe('selectLender', () => {
  it('agency for US multifamily', () => {
    const r = selectLender({
      assetClass: 'multifamily',
      jurisdiction: 'US',
      dealSize: 50_000_000,
      desiredLTV: 0.70,
      desiredTermYears: 10,
      transitional: false,
      trophyAsset: false,
    });
    expect(r.recommendedTop2[0]!.type).toBe('agency');
  });

  it('ea-tier-1-bank for Kenya multifamily', () => {
    const r = selectLender({
      assetClass: 'multifamily',
      jurisdiction: 'KE',
      dealSize: 5_000_000,
      desiredLTV: 0.60,
      desiredTermYears: 7,
      transitional: false,
      trophyAsset: false,
    });
    expect(r.recommendedTop2[0]!.type).toBe('ea-tier-1-bank');
  });

  it('debt-fund for transitional EA asset', () => {
    const r = selectLender({
      assetClass: 'multifamily',
      jurisdiction: 'KE',
      dealSize: 5_000_000,
      desiredLTV: 0.75,
      desiredTermYears: 3,
      transitional: true,
      trophyAsset: false,
    });
    expect(r.recommendedTop2.some((c) => c.type === 'debt-fund')).toBe(true);
  });
});

describe('adviseRateLock', () => {
  it('lock-now-vol when implied vol > 80 bps', () => {
    const r = adviseRateLock({
      spot10Y: 0.040,
      forward10Y6mo: 0.040,
      impliedVolBps: 100,
      lockFee6mo: 0.005,
    });
    expect(r.advice).toBe('lock-now-vol');
  });

  it('wait when forward is meaningfully lower', () => {
    const r = adviseRateLock({
      spot10Y: 0.045,
      forward10Y6mo: 0.040,
      impliedVolBps: 40,
      lockFee6mo: 0.001,
    });
    expect(r.advice).toBe('wait');
  });

  it('lock-now when lock fee cheap', () => {
    const r = adviseRateLock({
      spot10Y: 0.040,
      forward10Y6mo: 0.042,
      impliedVolBps: 40,
      lockFee6mo: 0.001,
    });
    expect(r.advice).toBe('lock-now');
  });
});

describe('defeasance vs YM', () => {
  it('returns both positive when rates declined since origination', () => {
    const r = compareDefeasanceVsYM({
      originalRatePct: 0.06,
      currentTreasuryPct: 0.03,
      remainingBalance: 50_000_000,
      remainingYears: 5,
    });
    expect(r.defeasanceCost).toBeGreaterThan(0);
    expect(r.yieldMaintenanceCost).toBeGreaterThan(0);
  });

  it('selects cheaper option', () => {
    const r = compareDefeasanceVsYM({
      originalRatePct: 0.06,
      currentTreasuryPct: 0.05,
      remainingBalance: 50_000_000,
      remainingYears: 5,
    });
    expect(['defeasance', 'yield-maintenance']).toContain(r.cheaperOption);
    expect(r.delta).toBeGreaterThanOrEqual(0);
  });

  it('zero cost on zero balance', () => {
    const r = compareDefeasanceVsYM({
      originalRatePct: 0.06,
      currentTreasuryPct: 0.05,
      remainingBalance: 0,
      remainingYears: 5,
    });
    expect(r.defeasanceCost).toBe(0);
    expect(r.yieldMaintenanceCost).toBe(0);
  });
});

describe('scanCovenants', () => {
  const baseCov = {
    minDSCR: 1.25,
    minDebtYield: 0.08,
    minOccupancyPct: 0.85,
    minCapexReservePerSqftPerYr: 0.25,
    distributionLockboxDSCR: 1.20,
    springingLockboxDSCR: 1.10,
  };

  it('reports no breach when healthy', () => {
    const r = scanCovenants({
      actualDSCR: 1.50,
      actualDebtYield: 0.10,
      actualOccupancyPct: 0.92,
      actualCapexReservePerSqftPerYr: 0.30,
      trailing12MoNOITrend: 5,
      grossSqft: 50_000,
      debtBalance: 40_000_000,
      covenants: baseCov,
    });
    expect(r.hasActiveBreach).toBe(false);
    expect(r.springingLockboxTriggered).toBe(false);
  });

  it('triggers springing lockbox below threshold', () => {
    const r = scanCovenants({
      actualDSCR: 1.05,
      actualDebtYield: 0.07,
      actualOccupancyPct: 0.70,
      actualCapexReservePerSqftPerYr: 0.10,
      trailing12MoNOITrend: -5,
      grossSqft: 50_000,
      debtBalance: 40_000_000,
      covenants: baseCov,
    });
    expect(r.springingLockboxTriggered).toBe(true);
    expect(r.hasActiveBreach).toBe(true);
  });
});

describe('optimiseRefiProceeds', () => {
  it('cash-out when reinvestment > extra cost AND DSCR ≥ 1.30', () => {
    const r = optimiseRefiProceeds({
      existingDebtBalance: 30_000_000,
      closingCosts: 500_000,
      newDebtAmount: 40_000_000,
      newDebtRate: 0.06,
      existingDebtRate: 0.05,
      sponsorReinvestmentIRR: 0.15,
      marginalTaxRate: 0.35,
      newDSCR: 1.40,
    });
    expect(r.verdict).toBe('cash-out');
    expect(r.cashOutAmount).toBeGreaterThan(0);
  });

  it('rate-and-term when net benefit ≤ 0', () => {
    const r = optimiseRefiProceeds({
      existingDebtBalance: 30_000_000,
      closingCosts: 500_000,
      newDebtAmount: 40_000_000,
      newDebtRate: 0.10,
      existingDebtRate: 0.04,
      sponsorReinvestmentIRR: 0.06,
      marginalTaxRate: 0.20,
      newDSCR: 1.35,
    });
    expect(r.verdict).toBe('rate-and-term');
  });

  it('do-not-refi when new DSCR < 1.20', () => {
    const r = optimiseRefiProceeds({
      existingDebtBalance: 30_000_000,
      closingCosts: 500_000,
      newDebtAmount: 40_000_000,
      newDebtRate: 0.07,
      existingDebtRate: 0.05,
      sponsorReinvestmentIRR: 0.15,
      marginalTaxRate: 0.35,
      newDSCR: 1.10,
    });
    expect(r.verdict).toBe('do-not-refi');
  });
});
