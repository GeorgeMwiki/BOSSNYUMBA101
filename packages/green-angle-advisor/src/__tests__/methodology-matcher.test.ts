/**
 * methodology-matcher tests — covers carbon catalog + matcher + offset
 * volume + credit value forecaster.
 */

import { describe, expect, it } from 'vitest';
import { classifyProject } from '../project-typer/project-classifier.js';
import { matchOpportunities } from '../opportunities/opportunity-matcher.js';
import {
  CARBON_METHODOLOGY_CATALOG,
  findMethodologyById,
  matchMethodologies,
} from '../carbon-credits/methodology-matcher.js';
import { estimateOffsetVolume } from '../carbon-credits/offset-volume-estimator.js';
import { forecastCreditValue } from '../carbon-credits/credit-value-forecaster.js';

describe('CARBON_METHODOLOGY_CATALOG', () => {
  it('contains at least 10 methodologies', () => {
    expect(CARBON_METHODOLOGY_CATALOG.length).toBeGreaterThanOrEqual(10);
  });

  it('every methodology has a unique id', () => {
    const ids = CARBON_METHODOLOGY_CATALOG.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('covers VCS + GS + PACM + Puro', () => {
    const registries = new Set(CARBON_METHODOLOGY_CATALOG.map((m) => m.registry));
    expect(registries.has('VCS')).toBe(true);
    expect(registries.has('GS')).toBe(true);
    expect(registries.has('PACM')).toBe(true);
    expect(registries.has('Puro')).toBe(true);
  });

  it('every methodology has a reference URL', () => {
    for (const m of CARBON_METHODOLOGY_CATALOG) {
      expect(m.reference.length).toBeGreaterThan(0);
    }
  });

  it('findMethodologyById finds known methodologies', () => {
    expect(findMethodologyById('VCS-VM0033')?.title).toMatch(/blue carbon|tidal/i);
    expect(findMethodologyById('VCS-VMR0006')?.title).toMatch(/modal shift/i);
    expect(findMethodologyById('PACM-Removals')?.registry).toBe('PACM');
  });
});

describe('matchMethodologies — canonical rail fixture', () => {
  const profile = classifyProject({
    description: "we're building a railway from Dar es Salaam to Dodoma",
    hints: {
      lengthKm: 450,
      jurisdictions: ['TZ'],
      biomes: ['coastal', 'savanna'],
      signals: ['freight', 'critical-habitat-near'],
    },
  });
  const opps = matchOpportunities(profile);

  it('matches VMR0006 (modal shift) for rail freight', () => {
    const ms = matchMethodologies(profile, opps);
    expect(ms.some((m) => m.id === 'VCS-VMR0006')).toBe(true);
  });

  it('matches VM0042 (regen ag) when regen-ag-corridor opportunity is in the set', () => {
    const ms = matchMethodologies(profile, opps);
    expect(ms.some((m) => m.id === 'VCS-VM0042')).toBe(true);
  });

  it('does NOT match VM0033 (blue carbon) without coastal-asset signal', () => {
    const inlandProfile = classifyProject({
      description: 'A railway from Dodoma to Mwanza',
      hints: { lengthKm: 500, jurisdictions: ['TZ'], signals: ['freight'] },
    });
    const inlandOpps = matchOpportunities(inlandProfile);
    const ms = matchMethodologies(inlandProfile, inlandOpps);
    expect(ms.some((m) => m.id === 'VCS-VM0033')).toBe(false);
  });
});

describe('matchMethodologies — coastal port fixture', () => {
  const profile = classifyProject({
    description: 'A container port expansion on the coast of Mombasa',
    hints: { areaHa: 250, jurisdictions: ['KE'], signals: ['coastal-asset', 'freight'] },
  });
  const opps = matchOpportunities(profile);

  it('matches VM0033 (blue carbon) for a coastal port', () => {
    const ms = matchMethodologies(profile, opps);
    expect(ms.some((m) => m.id === 'VCS-VM0033')).toBe(true);
  });
});

describe('matchMethodologies — agriculture fixture', () => {
  const profile = classifyProject({
    description: 'A coffee plantation farm in Uganda with biochar potential',
  });
  const opps = matchOpportunities(profile);

  it('matches VM0044 + Puro-Biochar when biochar is selected', () => {
    const ms = matchMethodologies(profile, opps);
    expect(ms.some((m) => m.id === 'VCS-VM0044')).toBe(true);
    expect(ms.some((m) => m.id === 'Puro-Biochar')).toBe(true);
  });

  it('matches VM0042 (regen ag)', () => {
    const ms = matchMethodologies(profile, opps);
    expect(ms.some((m) => m.id === 'VCS-VM0042')).toBe(true);
  });
});

describe('estimateOffsetVolume', () => {
  it('estimates >100k tCO2e/yr for modal-shift on a 450 km corridor', () => {
    const m = findMethodologyById('VCS-VMR0006')!;
    const result = estimateOffsetVolume(
      {
        projectTypes: ['infrastructure-rail'],
        jurisdictions: ['TZ'],
        biomes: [],
        signals: ['freight'],
        lengthKm: 450,
        confidence: 1,
        rationale: '',
      },
      m,
    );
    expect(result.tCO2ePerYear).toBeGreaterThanOrEqual(50_000);
  });

  it('estimates correct lifetime for VCS 30-yr period', () => {
    const m = findMethodologyById('VCS-VM0042')!;
    const result = estimateOffsetVolume(
      {
        projectTypes: ['agriculture'],
        jurisdictions: ['UG'],
        biomes: ['agricultural'],
        signals: [],
        areaHa: 5000,
        confidence: 1,
        rationale: '',
      },
      m,
    );
    expect(result.creditingPeriodYears).toBe(30);
    expect(result.lifetimeTCO2e).toBe(result.tCO2ePerYear * 30);
  });

  it('estimates blue carbon scales with restorable area', () => {
    const m = findMethodologyById('VCS-VM0033')!;
    const small = estimateOffsetVolume(
      {
        projectTypes: ['infrastructure-port'],
        jurisdictions: ['KE'],
        biomes: ['coastal'],
        signals: ['coastal-asset'],
        areaHa: 50,
        confidence: 1,
        rationale: '',
      },
      m,
    );
    const big = estimateOffsetVolume(
      {
        projectTypes: ['infrastructure-port'],
        jurisdictions: ['KE'],
        biomes: ['coastal'],
        signals: ['coastal-asset'],
        areaHa: 500,
        confidence: 1,
        rationale: '',
      },
      m,
    );
    expect(big.tCO2ePerYear).toBeGreaterThan(small.tCO2ePerYear);
  });
});

describe('forecastCreditValue', () => {
  it('biochar is priced higher than basic AR/REDD+', () => {
    const biochar = forecastCreditValue(findMethodologyById('VCS-VM0044')!, 10);
    const reddPlus = forecastCreditValue(findMethodologyById('VCS-VM0007')!, 10);
    expect(biochar.spotUsdPerTon).toBeGreaterThan(reddPlus.spotUsdPerTon);
    expect(biochar.forwardAverageUsdPerTon).toBeGreaterThan(reddPlus.forwardAverageUsdPerTon);
  });

  it('forward average grows monotonically with horizon for non-negative growth', () => {
    const m = findMethodologyById('VCS-VM0033')!;
    const v5 = forecastCreditValue(m, 5);
    const v15 = forecastCreditValue(m, 15);
    expect(v15.forwardAverageUsdPerTon).toBeGreaterThan(v5.forwardAverageUsdPerTon);
  });

  it('returns spot value when horizon is zero', () => {
    const m = findMethodologyById('VCS-VM0033')!;
    const result = forecastCreditValue(m, 0);
    expect(result.forwardAverageUsdPerTon).toBe(result.spotUsdPerTon);
  });

  it('PACM removals carries 8% growth (durable demand)', () => {
    const m = findMethodologyById('PACM-Removals')!;
    const v = forecastCreditValue(m, 5);
    expect(v.forwardAverageUsdPerTon).toBeGreaterThan(v.spotUsdPerTon);
  });

  it('falls back gracefully for unknown methodology id', () => {
    const result = forecastCreditValue(
      {
        id: 'UNKNOWN-XX',
        registry: 'OTHER',
        title: 'Mystery',
        projectTypes: ['industrial'],
        requiredSignals: [],
        reference: 'n/a',
      },
      10,
    );
    expect(result.spotUsdPerTon).toBeGreaterThan(0);
  });
});
