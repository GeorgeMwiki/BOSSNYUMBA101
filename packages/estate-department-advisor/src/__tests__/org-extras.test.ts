import { describe, it, expect } from 'vitest';
import { decideSourcing } from '../org/insource-outsource-decider.js';
import {
  checkCompensation,
  CEL_2024_US,
  EA_FACTORS,
} from '../org/compensation-benchmarker.js';

describe('insource-outsource-decider', () => {
  it('legal: in-source when > 50 hrs/wk', () => {
    const out = decideSourcing({
      fn: 'legal',
      portfolioDoors: 200,
      portfolioRentableSf: 100_000,
      portfolioGavUsd: 50_000_000,
      weeklyLegalHours: 60,
    });
    expect(out.decision).toBe('in-source');
  });

  it('legal: outsource when < 50 hrs/wk', () => {
    const out = decideSourcing({
      fn: 'legal',
      portfolioDoors: 200,
      portfolioRentableSf: 100_000,
      portfolioGavUsd: 50_000_000,
      weeklyLegalHours: 20,
    });
    expect(out.decision).toBe('outsource');
  });

  it('maintenance: in-source for > 200 doors + 24x7', () => {
    const out = decideSourcing({
      fn: 'maintenance',
      portfolioDoors: 300,
      portfolioRentableSf: 200_000,
      portfolioGavUsd: 50_000_000,
      is24x7Maintenance: true,
    });
    expect(out.decision).toBe('in-source');
  });

  it('maintenance: hybrid for > 200 doors without 24x7', () => {
    const out = decideSourcing({
      fn: 'maintenance',
      portfolioDoors: 300,
      portfolioRentableSf: 200_000,
      portfolioGavUsd: 50_000_000,
    });
    expect(out.decision).toBe('hybrid');
  });

  it('accounting: in-source for > $50M GAV', () => {
    const out = decideSourcing({
      fn: 'accounting',
      portfolioDoors: 100,
      portfolioRentableSf: 50_000,
      portfolioGavUsd: 100_000_000,
    });
    expect(out.decision).toBe('in-source');
  });

  it('it: in-source for PII-heavy', () => {
    const out = decideSourcing({
      fn: 'it',
      portfolioDoors: 200,
      portfolioRentableSf: 100_000,
      portfolioGavUsd: 50_000_000,
      piiHeavy: true,
    });
    expect(out.decision).toBe('in-source');
  });

  it('janitorial: in-source only for luxury/hospital-grade', () => {
    const a = decideSourcing({
      fn: 'janitorial',
      portfolioDoors: 200,
      portfolioRentableSf: 100_000,
      portfolioGavUsd: 50_000_000,
      isLuxuryOrHospitalGrade: true,
    });
    expect(a.decision).toBe('in-source');
    const b = decideSourcing({
      fn: 'janitorial',
      portfolioDoors: 200,
      portfolioRentableSf: 100_000,
      portfolioGavUsd: 50_000_000,
    });
    expect(b.decision).toBe('outsource');
  });

  it('leasing: hybrid in mid-scale', () => {
    const out = decideSourcing({
      fn: 'leasing',
      portfolioDoors: 350,
      portfolioRentableSf: 100_000,
      portfolioGavUsd: 50_000_000,
      isBrandCritical: false,
    });
    expect(out.decision).toBe('hybrid');
  });
});

describe('compensation-benchmarker', () => {
  it('CEL US PM P50 = $85k', () => {
    expect(CEL_2024_US['property-manager'].baseP50).toBe(85_000);
  });

  it('EA factors are below US factor', () => {
    for (const j of ['KE', 'TZ', 'UG', 'NG', 'RW', 'ZA'] as const) {
      expect(EA_FACTORS[j]).toBeLessThan(EA_FACTORS.US);
    }
  });

  it('flags under-paid when > 15% below P50', () => {
    const out = checkCompensation({
      role: 'property-manager',
      actualBaseUsd: 30_000,
      jurisdiction: 'KE',
    });
    expect(out.recommendations.find((r) => r.id.includes('underpaid'))).toBeDefined();
  });

  it('flags over-paid when > 15% above P50', () => {
    const out = checkCompensation({
      role: 'property-manager',
      actualBaseUsd: 50_000,
      jurisdiction: 'KE',
    });
    expect(out.recommendations.find((r) => r.id.includes('overpaid'))).toBeDefined();
  });

  it('band classification descends from below-P25 to above-P75', () => {
    const a = checkCompensation({
      role: 'property-manager',
      actualBaseUsd: 20_000,
      jurisdiction: 'KE',
    });
    expect(a.band).toBe('below-P25');
    const b = checkCompensation({
      role: 'property-manager',
      actualBaseUsd: 100_000,
      jurisdiction: 'KE',
    });
    expect(b.band).toBe('above-P75');
  });

  it('no recommendation when within ±15% of P50', () => {
    const out = checkCompensation({
      role: 'property-manager',
      actualBaseUsd: 85_000 * 0.45, // KE factor → P50
      jurisdiction: 'KE',
    });
    expect(out.recommendations.length).toBe(0);
  });
});
