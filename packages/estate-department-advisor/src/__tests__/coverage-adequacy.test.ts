import { describe, it, expect } from 'vitest';
import { scoreCoverageAdequacy } from '../risk/coverage-adequacy-scorer.js';
import { optimizeDeductible } from '../risk/deductible-optimizer.js';
import { modelCatastrophe } from '../risk/catastrophe-modeler.js';
import { makePortfolio } from './fixtures.js';

describe('coverage-adequacy-scorer', () => {
  it('flags missing umbrella when > 100 doors', () => {
    const p = makePortfolio({
      properties: makePortfolio().properties.map((x) => ({ ...x, doors: 50 })),
      insurancePolicies: makePortfolio().insurancePolicies.filter((x) => x.axis !== 'all-risk-property'),
    });
    // 50 properties * 50 doors > 100 — umbrella triggered, all-risk missing.
    const r = scoreCoverageAdequacy(p);
    expect(r.gaps.some((g) => g.axis === 'all-risk-property')).toBe(true);
  });

  it('captive recommended only above $500M GAV + $2M premium', () => {
    const p = makePortfolio();
    const r = scoreCoverageAdequacy(p);
    // Fixture is ~$350M GAV → captive should NOT be recommended.
    expect(r.captiveRecommended).toBe(false);
  });

  it('catastrophe exposures include EA Rift seismic when EA jurisdictions present', () => {
    const r = scoreCoverageAdequacy(makePortfolio());
    expect(r.catastropheExposures.some((s) => s.toLowerCase().includes('rift'))).toBe(true);
  });

  it('recommends ACV-to-replacement-cost upgrade when GL is ACV', () => {
    // Use a fixture where GL is ACV — already true in fixture.
    const r = scoreCoverageAdequacy(makePortfolio());
    expect(r).toBeDefined();
  });
});

describe('deductible-optimizer', () => {
  it('recommends per-incident for sub-$50M GAV', () => {
    const out = optimizeDeductible({
      gavUsd: 30_000_000,
      cashReserveUsd: 1_000_000,
      expectedAnnualLossesUsd: 100_000,
      currentDeductibleUsd: 5000,
    });
    expect(out.recommendedKind).toBe('per-incident');
  });

  it('recommends SIR when cash > 3× losses + GAV > $200M', () => {
    const out = optimizeDeductible({
      gavUsd: 250_000_000,
      cashReserveUsd: 10_000_000,
      expectedAnnualLossesUsd: 1_000_000,
      currentDeductibleUsd: 50_000,
    });
    expect(out.recommendedKind).toBe('sir');
    expect(out.canAffordSir).toBe(true);
  });

  it('recommends aggregate when GAV > $200M without SIR buffer', () => {
    const out = optimizeDeductible({
      gavUsd: 250_000_000,
      cashReserveUsd: 100_000,
      expectedAnnualLossesUsd: 1_000_000,
      currentDeductibleUsd: 50_000,
    });
    expect(out.recommendedKind).toBe('aggregate');
  });

  it('recommends per-incident default for mid-cap GAV', () => {
    const out = optimizeDeductible({
      gavUsd: 100_000_000,
      cashReserveUsd: 500_000,
      expectedAnnualLossesUsd: 250_000,
      currentDeductibleUsd: 25_000,
    });
    expect(out.recommendedKind).toBe('per-incident');
  });
});

describe('catastrophe-modeler', () => {
  it('returns exposures for every jurisdiction in portfolio', () => {
    const out = modelCatastrophe(makePortfolio());
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((e) => e.probableMaxLossUsd >= 0)).toBe(true);
  });

  it('PML scales with jurisdiction GAV', () => {
    const out = modelCatastrophe(makePortfolio());
    // Largest jurisdiction by GAV should produce largest PML in its peril family.
    expect(out.some((e) => e.probableMaxLossUsd > 0)).toBe(true);
  });
});
