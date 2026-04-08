import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  calculateVAT,
  calculateWHT,
  calculateMRI,
  getMriRate,
  MRI_DEFAULT_RATE,
  TZ_VAT_STANDARD_RATE,
} from '../engine/tax-calculator.js';

describe('calculateVAT', () => {
  // Table-driven: 5 cases covering commercial, residential, override, zero, rounding.
  const cases: Array<{
    name: string;
    amount: number;
    opts: { rate?: number; isCommercial: boolean };
    expected: { net: number; vat: number; gross: number };
  }> = [
    {
      name: 'commercial rent TZS 1,000,000 @ 18%',
      amount: 1_000_000,
      opts: { isCommercial: true },
      expected: { net: 1_000_000, vat: 180_000, gross: 1_180_000 },
    },
    {
      name: 'residential rent TZS 500,000 is exempt',
      amount: 500_000,
      opts: { isCommercial: false },
      expected: { net: 500_000, vat: 0, gross: 500_000 },
    },
    {
      name: 'zero amount returns all zeros',
      amount: 0,
      opts: { isCommercial: true },
      expected: { net: 0, vat: 0, gross: 0 },
    },
    {
      name: 'explicit rate override wins over commercial default',
      amount: 100_000,
      opts: { isCommercial: true, rate: 0 },
      expected: { net: 100_000, vat: 0, gross: 100_000 },
    },
    {
      name: 'rounds to 2dp on fractional input',
      amount: 333.33,
      opts: { isCommercial: true },
      expected: { net: 333.33, vat: 60, gross: 393.33 },
    },
  ];

  for (const tc of cases) {
    it(tc.name, () => {
      expect(calculateVAT(tc.amount, tc.opts)).toEqual(tc.expected);
    });
  }

  it('rejects negative amounts', () => {
    expect(() => calculateVAT(-1, { isCommercial: true })).toThrow(/non-negative/);
  });

  it('uses the 18% constant for commercial by default', () => {
    expect(TZ_VAT_STANDARD_RATE).toBe(0.18);
  });
});

describe('calculateWHT', () => {
  // Table-driven: 4 cases covering rent resident/non-resident and services.
  const cases: Array<{
    name: string;
    amount: number;
    opts: Parameters<typeof calculateWHT>[1];
    expected: { gross: number; wht: number; net: number };
  }> = [
    {
      name: 'resident rent TZS 1,000,000 @ 10%',
      amount: 1_000_000,
      opts: { residency: 'resident', category: 'rent' },
      expected: { gross: 1_000_000, wht: 100_000, net: 900_000 },
    },
    {
      name: 'non-resident rent TZS 1,000,000 @ 15%',
      amount: 1_000_000,
      opts: { residency: 'non-resident', category: 'rent' },
      expected: { gross: 1_000_000, wht: 150_000, net: 850_000 },
    },
    {
      name: 'resident services TZS 400,000 @ 5%',
      amount: 400_000,
      opts: { residency: 'resident', category: 'services' },
      expected: { gross: 400_000, wht: 20_000, net: 380_000 },
    },
    {
      name: 'non-resident services TZS 400,000 @ 15%',
      amount: 400_000,
      opts: { residency: 'non-resident', category: 'services' },
      expected: { gross: 400_000, wht: 60_000, net: 340_000 },
    },
  ];

  for (const tc of cases) {
    it(tc.name, () => {
      expect(calculateWHT(tc.amount, tc.opts)).toEqual(tc.expected);
    });
  }

  it('rejects negative amounts', () => {
    expect(() =>
      calculateWHT(-1, { residency: 'resident', category: 'rent' }),
    ).toThrow(/non-negative/);
  });
});

describe('calculateMRI', () => {
  const originalOverride = process.env.MRI_RATE_OVERRIDE;

  beforeEach(() => {
    delete process.env.MRI_RATE_OVERRIDE;
  });

  afterEach(() => {
    if (originalOverride === undefined) {
      delete process.env.MRI_RATE_OVERRIDE;
    } else {
      process.env.MRI_RATE_OVERRIDE = originalOverride;
    }
  });

  it('defaults to 7.5% per Finance Act 2023', () => {
    expect(MRI_DEFAULT_RATE).toBe(0.075);
    const result = calculateMRI(1_000_000);
    expect(result).toEqual({ gross: 1_000_000, mri: 75_000, net: 925_000 });
  });

  it('honors MRI_RATE_OVERRIDE env var', () => {
    process.env.MRI_RATE_OVERRIDE = '0.1';
    expect(getMriRate()).toBe(0.1);
    expect(calculateMRI(1_000_000)).toEqual({
      gross: 1_000_000,
      mri: 100_000,
      net: 900_000,
    });
  });

  it('ignores bogus MRI_RATE_OVERRIDE and falls back to default', () => {
    process.env.MRI_RATE_OVERRIDE = 'not-a-number';
    expect(getMriRate()).toBe(MRI_DEFAULT_RATE);
  });

  it('rejects negative amounts', () => {
    expect(() => calculateMRI(-1)).toThrow(/non-negative/);
  });
});
