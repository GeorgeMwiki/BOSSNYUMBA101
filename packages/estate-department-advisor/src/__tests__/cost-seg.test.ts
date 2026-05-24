import { describe, it, expect } from 'vitest';
import { estimateCostSeg, __test__ } from '../tax/cost-seg-advisor.js';
import { scan1031Opportunity } from '../tax/1031-scanner.js';
import { adviseStructure } from '../tax/structure-advisor.js';
import { makePortfolio, NOW_MS } from './fixtures.js';

const property = makePortfolio().properties[0];
if (!property) throw new Error('no fixture property');

describe('cost-seg-advisor', () => {
  it('produces positive NPV for fresh acquisition', () => {
    const out = estimateCostSeg({
      property,
      ownerMarginalTaxRate: 0.37,
      discountRate: 0.08,
      placedInServiceMs: NOW_MS - 365 * 24 * 60 * 60 * 1000,
      nowMs: NOW_MS,
    });
    expect(out.estimatedSavingsUsd).toBeGreaterThan(0);
  });

  it('reduces NPV as years held grow', () => {
    const oneYear = estimateCostSeg({
      property,
      ownerMarginalTaxRate: 0.37,
      discountRate: 0.08,
      placedInServiceMs: NOW_MS - 365 * 24 * 60 * 60 * 1000,
      nowMs: NOW_MS,
    });
    const twentyYears = estimateCostSeg({
      property,
      ownerMarginalTaxRate: 0.37,
      discountRate: 0.08,
      placedInServiceMs: NOW_MS - 20 * 365 * 24 * 60 * 60 * 1000,
      nowMs: NOW_MS,
    });
    expect(twentyYears.estimatedSavingsUsd).toBeLessThan(oneYear.estimatedSavingsUsd);
  });

  it('returns citation', () => {
    const out = estimateCostSeg({
      property,
      ownerMarginalTaxRate: 0.21,
      discountRate: 0.08,
      placedInServiceMs: NOW_MS,
      nowMs: NOW_MS,
    });
    expect(out.citation).toContain('ASCSP');
  });

  it('5-yr + 7-yr + 15-yr percentages sum to typical reclass band', () => {
    const total = __test__.FIVE_YR_PCT + __test__.SEVEN_YR_PCT + __test__.FIFTEEN_YR_PCT;
    expect(total).toBeGreaterThan(0.35);
    expect(total).toBeLessThan(0.45);
  });
});

describe('1031-scanner', () => {
  it('returns 1031 opportunity for US property', () => {
    const out = scan1031Opportunity({
      property: { ...property, jurisdiction: 'US' },
      capitalGainUsd: 1_000_000,
      marginalCapGainsRate: 0.20,
      nowMs: NOW_MS,
    });
    expect(out.kind).toBe('1031');
    expect(out.estimatedSavingsUsd).toBe(200_000);
  });

  it('returns TZ rollover for TZ property', () => {
    const out = scan1031Opportunity({
      property: { ...property, jurisdiction: 'TZ' },
      capitalGainUsd: 1_000_000,
      marginalCapGainsRate: 0.20,
      nowMs: NOW_MS,
    });
    expect(out.jurisdiction).toBe('TZ');
    expect(out.citation).toContain('Tanzania Land Act');
  });

  it('returns zero-deferral note for non-US/TZ jurisdictions', () => {
    const out = scan1031Opportunity({
      property: { ...property, jurisdiction: 'KE' },
      capitalGainUsd: 1_000_000,
      marginalCapGainsRate: 0.20,
      nowMs: NOW_MS,
    });
    expect(out.estimatedSavingsUsd).toBe(0);
  });

  it('flags 45-day window when within 45 days of sale', () => {
    const out = scan1031Opportunity({
      property: { ...property, jurisdiction: 'US' },
      capitalGainUsd: 1_000_000,
      marginalCapGainsRate: 0.20,
      soldOnMs: NOW_MS - 10 * 24 * 60 * 60 * 1000,
      nowMs: NOW_MS,
    });
    expect(out.windowEndsAtMs).toBeDefined();
    expect(out.rationale).toContain('45-day');
  });
});

describe('structure-advisor', () => {
  it('recommends REIT at > $250M GAV + external investors', () => {
    const out = adviseStructure({
      portfolioGavUsd: 300_000_000,
      ownerArchetype: 'institutional',
      jurisdiction: 'KE',
      hasExternalInvestors: true,
      hasGenerationalPlanning: false,
      numProperties: 25,
    });
    expect(out.recommended).toBe('reit');
  });

  it('recommends trust for generational planning', () => {
    const out = adviseStructure({
      portfolioGavUsd: 10_000_000,
      ownerArchetype: 'preservation-legacy',
      jurisdiction: 'US',
      hasExternalInvestors: false,
      hasGenerationalPlanning: true,
      numProperties: 3,
    });
    expect(out.recommended).toBe('trust');
  });

  it('recommends LLC for single-asset hold', () => {
    const out = adviseStructure({
      portfolioGavUsd: 5_000_000,
      ownerArchetype: 'passive-landlord',
      jurisdiction: 'KE',
      hasExternalInvestors: false,
      hasGenerationalPlanning: false,
      numProperties: 1,
    });
    expect(out.recommended).toBe('llc');
  });

  it('recommends GP-LP for co-investor mid-cap', () => {
    const out = adviseStructure({
      portfolioGavUsd: 50_000_000,
      ownerArchetype: 'active-investor',
      jurisdiction: 'TZ',
      hasExternalInvestors: true,
      hasGenerationalPlanning: false,
      numProperties: 10,
    });
    expect(out.recommended).toBe('gp-lp');
  });
});
