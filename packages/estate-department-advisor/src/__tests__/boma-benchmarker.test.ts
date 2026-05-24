import { describe, it, expect } from 'vitest';
import {
  benchmarkBoma,
  BOMA_OFFICE_2024,
  __test__,
} from '../operations/boma-benchmarker.js';
import { makePortfolio } from './fixtures.js';

describe('boma-benchmarker', () => {
  it('returns empty report when no office in portfolio', () => {
    const p = makePortfolio({
      properties: makePortfolio()
        .properties.filter((x) => x.assetClass !== 'office'),
    });
    const r = benchmarkBoma({ portfolio: p });
    expect(r.opexPerSfActual).toBe(0);
    expect(r.opexPerSfPeerP50).toBe(0);
  });

  it('returns non-empty peer benchmark when "all" filter applied', () => {
    const r = benchmarkBoma({ portfolio: makePortfolio(), assetClassFilter: 'all' });
    expect(r.opexPerSfActual).toBeGreaterThan(0);
    expect(r.opexPerSfPeerP50).toBeGreaterThan(0);
  });

  it('emits "over peer" recommendation when controllable gap > 10%', () => {
    const portfolio = makePortfolio({
      properties: makePortfolio().properties.map((p) => ({
        ...p,
        annualOpexUsd: p.annualOpexUsd * 4,
      })),
    });
    const r = benchmarkBoma({ portfolio, assetClassFilter: 'all' });
    const overRec = r.recommendations.find((x) => x.id === 'boma.controllable.over');
    expect(overRec).toBeDefined();
  });

  it('BOMA office 2024 EA prices are below US median', () => {
    expect(BOMA_OFFICE_2024['KE-NAIROBI-A']?.totalOpex).toBeLessThan(BOMA_OFFICE_2024['US-NORTHEAST']?.totalOpex ?? Infinity);
    expect(BOMA_OFFICE_2024['TZ-DAR-A']?.totalOpex).toBeLessThan(BOMA_OFFICE_2024['US-WEST']?.totalOpex ?? Infinity);
  });

  it('bomaKey maps jurisdictions deterministically', () => {
    expect(__test__.bomaKey('KE', 'Nairobi')).toBe('KE-NAIROBI-A');
    expect(__test__.bomaKey('TZ', 'Dar es Salaam')).toBe('TZ-DAR-A');
    expect(__test__.bomaKey('US', 'Atlanta GA')).toBe('US-SOUTH');
    expect(__test__.bomaKey('US', 'New York NY')).toBe('US-NORTHEAST');
  });

  it('percentileOf maps lower opex to lower percentile', () => {
    expect(__test__.percentileOf(5, 10)).toBeLessThan(__test__.percentileOf(15, 10));
  });

  it('citations always present', () => {
    const r = benchmarkBoma({ portfolio: makePortfolio(), assetClassFilter: 'all' });
    expect(r.citations.length).toBeGreaterThan(0);
  });
});
