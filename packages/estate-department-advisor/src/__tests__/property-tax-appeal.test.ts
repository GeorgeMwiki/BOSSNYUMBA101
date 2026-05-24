import { describe, it, expect } from 'vitest';
import { adviseAppeal, __test__ } from '../tax/property-tax-appeal-advisor.js';
import { NOW_MS } from './fixtures.js';

const baseAppeal = {
  propertyId: 'p',
  propertyName: 'Property',
  assessedValueUsd: 10_000_000,
  marketValueUsd: 8_000_000,
  compMedianUsd: 8_000_000,
  assessmentNoticeMs: NOW_MS - 5 * 24 * 60 * 60 * 1000,
  currentMs: NOW_MS,
  annualTaxUsd: 100_000,
};

describe('property-tax-appeal-advisor', () => {
  it('recommends skip when below 15% over-assessment', () => {
    const out = adviseAppeal({
      ...baseAppeal,
      jurisdiction: 'KE',
      assessedValueUsd: 9_000_000,
      compMedianUsd: 8_500_000,
    });
    expect(out.headline).toContain('not warranted');
    expect(out.estimatedSavingsUsd).toBe(0);
  });

  it('recommends appeal when over-assessed by > 15%', () => {
    const out = adviseAppeal({ ...baseAppeal, jurisdiction: 'KE' });
    expect(out.estimatedSavingsUsd).toBeGreaterThan(0);
    expect(out.windowEndsAtMs).toBeDefined();
  });

  it('window correctly computed for KE (30-day window)', () => {
    const out = adviseAppeal({ ...baseAppeal, jurisdiction: 'KE' });
    if (!out.windowEndsAtMs) throw new Error('missing window');
    const days = (out.windowEndsAtMs - baseAppeal.assessmentNoticeMs) / (24 * 60 * 60 * 1000);
    expect(Math.round(days)).toBe(30);
  });

  it('window correctly computed for UG (60-day window)', () => {
    const out = adviseAppeal({ ...baseAppeal, jurisdiction: 'UG' });
    if (!out.windowEndsAtMs) throw new Error('missing window');
    const days = (out.windowEndsAtMs - baseAppeal.assessmentNoticeMs) / (24 * 60 * 60 * 1000);
    expect(Math.round(days)).toBe(60);
  });

  it('citation per-jurisdiction', () => {
    const ke = adviseAppeal({ ...baseAppeal, jurisdiction: 'KE' });
    expect(ke.citation).toContain('Kenya');
    const za = adviseAppeal({ ...baseAppeal, jurisdiction: 'ZA' });
    expect(za.citation).toContain('Property Rates');
  });

  it('APPEAL_RULES cover all listed jurisdictions', () => {
    expect(Object.keys(__test__.APPEAL_RULES).length).toBe(7);
  });
});
