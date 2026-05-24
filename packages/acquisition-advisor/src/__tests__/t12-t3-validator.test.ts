import { describe, expect, it } from 'vitest';
import { reconcileExpenses } from '../financial/expense-reconciler.js';
import { checkRentRollIntegrity } from '../financial/rent-roll-integrity.js';
import { validateT12T3 } from '../financial/t12-t3-validator.js';
import type { RentRollUnit } from '../types.js';

describe('validateT12T3', () => {
  it('passes a clean reconciliation', () => {
    const r = validateT12T3({
      t12Egi: 1_000_000,
      t12Opex: 400_000,
      t12NoiReported: 600_000,
      t3EgiAnnualized: 1_020_000,
      t3OpexAnnualized: 408_000,
      t3NoiAnnualizedReported: 612_000,
      rentRollGpr: 1_100_000,
      rentRollEgi: 1_000_000,
      hasStudentHousingSeasonality: false,
    });
    expect(r.pass).toBe(true);
    expect(r.findings.length).toBe(0);
  });

  it('flags T-12 NOI math mismatch as critical', () => {
    const r = validateT12T3({
      t12Egi: 1_000_000,
      t12Opex: 400_000,
      t12NoiReported: 700_000, // wrong
      t3EgiAnnualized: 1_000_000,
      t3OpexAnnualized: 400_000,
      t3NoiAnnualizedReported: 600_000,
      rentRollGpr: 1_100_000,
      rentRollEgi: 1_000_000,
      hasStudentHousingSeasonality: false,
    });
    expect(r.pass).toBe(false);
    expect(r.findings.some((f) => f.code === 't12_noi_mismatch')).toBe(true);
  });

  it('warns on T-3 vs T-12 drift > 5%', () => {
    const r = validateT12T3({
      t12Egi: 1_000_000,
      t12Opex: 400_000,
      t12NoiReported: 600_000,
      t3EgiAnnualized: 1_200_000,
      t3OpexAnnualized: 480_000,
      t3NoiAnnualizedReported: 720_000,
      rentRollGpr: 1_100_000,
      rentRollEgi: 1_000_000,
      hasStudentHousingSeasonality: false,
    });
    expect(r.findings.some((f) => f.code === 't3_t12_drift')).toBe(true);
  });

  it('does NOT warn on T-3 drift for student housing seasonality', () => {
    const r = validateT12T3({
      t12Egi: 1_000_000,
      t12Opex: 400_000,
      t12NoiReported: 600_000,
      t3EgiAnnualized: 1_300_000,
      t3OpexAnnualized: 520_000,
      t3NoiAnnualizedReported: 780_000,
      rentRollGpr: 1_400_000,
      rentRollEgi: 1_300_000,
      hasStudentHousingSeasonality: true,
    });
    expect(r.findings.some((f) => f.code === 't3_t12_drift')).toBe(false);
  });

  it('flags rent-roll EGI variance > 20% as critical', () => {
    const r = validateT12T3({
      t12Egi: 1_000_000,
      t12Opex: 400_000,
      t12NoiReported: 600_000,
      t3EgiAnnualized: 1_000_000,
      t3OpexAnnualized: 400_000,
      t3NoiAnnualizedReported: 600_000,
      rentRollGpr: 1_400_000,
      rentRollEgi: 1_350_000,
      hasStudentHousingSeasonality: false,
    });
    expect(r.findings.some((f) => f.code === 'rent_roll_variance_critical')).toBe(true);
    expect(r.pass).toBe(false);
  });

  it('flags GPR < EGI as critical', () => {
    const r = validateT12T3({
      t12Egi: 1_000_000,
      t12Opex: 400_000,
      t12NoiReported: 600_000,
      t3EgiAnnualized: 1_000_000,
      t3OpexAnnualized: 400_000,
      t3NoiAnnualizedReported: 600_000,
      rentRollGpr: 900_000,
      rentRollEgi: 1_000_000,
      hasStudentHousingSeasonality: false,
    });
    expect(r.findings.some((f) => f.code === 'gpr_below_egi')).toBe(true);
  });
});

describe('checkRentRollIntegrity', () => {
  const units: RentRollUnit[] = [
    {
      unitId: '101',
      tenant: 'Tenant A',
      leaseStart: '2024-01-01',
      leaseEnd: '2025-12-31',
      monthlyRent: 1500,
      marketRent: 1800,
      securityDeposit: 1500,
      concessionMonths: 0,
    },
    {
      unitId: '102',
      tenant: 'Tenant B',
      leaseStart: '2023-06-01',
      leaseEnd: '2025-05-31',
      monthlyRent: 1600,
      marketRent: 1700,
      securityDeposit: 1600,
      concessionMonths: 0,
    },
  ];

  it('passes a clean rent roll', () => {
    const r = checkRentRollIntegrity(units);
    expect(r.pass).toBe(true);
  });

  it('flags duplicate units as critical', () => {
    const r = checkRentRollIntegrity([
      ...units,
      { ...units[0], tenant: 'Duplicate Tenant' },
    ]);
    expect(r.findings.some((f) => f.code === 'duplicate_unit')).toBe(true);
    expect(r.pass).toBe(false);
  });

  it('computes mark-to-market upside', () => {
    const r = checkRentRollIntegrity(units);
    expect(r.markToMarketUpsidePct).toBeGreaterThan(0);
  });

  it('flags lease overlap for same unit', () => {
    const r = checkRentRollIntegrity([
      {
        unitId: '200',
        tenant: 'Tenant X',
        leaseStart: '2024-01-01',
        leaseEnd: '2025-06-30',
        monthlyRent: 1000,
        marketRent: 1200,
        securityDeposit: 1000,
        concessionMonths: 0,
      },
      {
        unitId: '200',
        tenant: 'Tenant Y',
        leaseStart: '2025-01-01',
        leaseEnd: '2026-12-31',
        monthlyRent: 1100,
        marketRent: 1200,
        securityDeposit: 1100,
        concessionMonths: 0,
      },
    ]);
    expect(r.findings.some((f) => f.code === 'lease_overlap')).toBe(true);
  });

  it('flags negative deposit as critical', () => {
    const r = checkRentRollIntegrity([
      { ...units[0], securityDeposit: -100 },
    ]);
    expect(r.findings.some((f) => f.code === 'negative_deposit')).toBe(true);
    expect(r.pass).toBe(false);
  });
});

describe('reconcileExpenses', () => {
  it('flags under-reported R&M as red flag', () => {
    const r = reconcileExpenses({
      assetClass: 'multifamily',
      nlaSqm: 10_000,
      egi: 1_500_000,
      items: [
        { category: 'repairsMaintenance', t12Reported: 10_000 }, // very low
        { category: 'propertyTax', t12Reported: 60_000 },
      ],
    });
    const rm = r.find((x) => x.category === 'repairsMaintenance');
    expect(rm?.redFlag).toBe(true);
  });

  it('within band for healthy expenses', () => {
    const r = reconcileExpenses({
      assetClass: 'multifamily',
      nlaSqm: 10_000,
      egi: 1_500_000,
      items: [{ category: 'repairsMaintenance', t12Reported: 50_000 }],
    });
    expect(r[0].redFlag).toBe(false);
  });

  it('handles unknown category gracefully', () => {
    const r = reconcileExpenses({
      assetClass: 'multifamily',
      nlaSqm: 10_000,
      egi: 1_500_000,
      items: [{ category: 'eldritch_fees', t12Reported: 25_000 }],
    });
    expect(r[0].notes).toMatch(/no benchmark/);
  });

  it('rejects nlaSqm = 0', () => {
    expect(() =>
      reconcileExpenses({
        assetClass: 'office',
        nlaSqm: 0,
        egi: 100_000,
        items: [],
      }),
    ).toThrow();
  });
});
