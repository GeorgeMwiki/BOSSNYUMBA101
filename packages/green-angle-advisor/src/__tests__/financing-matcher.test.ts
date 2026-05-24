/**
 * financing-matcher tests — covers green-finance catalog + matcher +
 * SLL modeler.
 */

import { describe, expect, it } from 'vitest';
import { classifyProject } from '../project-typer/project-classifier.js';
import { matchOpportunities } from '../opportunities/opportunity-matcher.js';
import {
  GREEN_FINANCE_CATALOG,
  findInstrumentById,
} from '../financing/green-finance-catalog.js';
import { matchFinancing } from '../financing/financing-matcher.js';
import { modelSll } from '../financing/sustainability-linked-loan-modeler.js';

describe('GREEN_FINANCE_CATALOG', () => {
  it('contains at least 20 instruments', () => {
    expect(GREEN_FINANCE_CATALOG.length).toBeGreaterThanOrEqual(20);
  });

  it('every instrument has a unique id', () => {
    const ids = GREEN_FINANCE_CATALOG.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every instrument has at least one region and one eligible project type', () => {
    for (const i of GREEN_FINANCE_CATALOG) {
      expect(i.regions.length).toBeGreaterThan(0);
      expect(i.eligibleProjectTypes.length).toBeGreaterThan(0);
    }
  });

  it('findInstrumentById finds GCF + EDGE + AfDB SEFA', () => {
    expect(findInstrumentById('gcf')?.sponsor).toBe('GCF');
    expect(findInstrumentById('ifc-edge')?.sponsor).toBe('IFC');
    expect(findInstrumentById('afdb-sefa')?.sponsor).toBe('AfDB');
  });

  it('findInstrumentById returns undefined for unknown id', () => {
    expect(findInstrumentById('no-such-instrument')).toBeUndefined();
  });
});

describe('matchFinancing — railway fixture', () => {
  const profile = classifyProject({
    description: "we're building a railway from Dar es Salaam to Dodoma",
    hints: { lengthKm: 450, jurisdictions: ['TZ'], signals: ['freight', 'critical-habitat-near'] },
  });
  const opps = matchOpportunities(profile);

  it('returns at least 5 matched instruments', () => {
    const fin = matchFinancing(profile, opps);
    expect(fin.length).toBeGreaterThanOrEqual(5);
  });

  it('matches green bonds + green loans + SLL + GCF for a rail project in TZ', () => {
    const fin = matchFinancing(profile, opps);
    const ids = fin.map((m) => m.instrument.id);
    expect(ids).toContain('icma-green-bond');
    expect(ids).toContain('lma-green-loan');
    expect(ids).toContain('icma-slb');
    expect(ids).toContain('gcf');
  });

  it('ranks results by score descending', () => {
    const fin = matchFinancing(profile, opps);
    for (let i = 1; i < fin.length; i++) {
      expect(fin[i]!.score).toBeLessThanOrEqual(fin[i - 1]!.score);
    }
  });

  it('surfaces gates-to-clear for green bond', () => {
    const fin = matchFinancing(profile, opps);
    const bond = fin.find((m) => m.instrument.id === 'icma-green-bond');
    expect(bond?.gatesToClear).toContain('Second-Party Opinion (SPO) from approved reviewer');
  });

  it('surfaces gates-to-clear for SLL', () => {
    const fin = matchFinancing(profile, opps);
    const sll = fin.find((m) => m.instrument.id === 'lma-sll');
    expect(sll?.gatesToClear).toContain('Material KPI selection with SBTi/TPT alignment');
  });

  it('EP5 picks up critical habitat gate when signal present', () => {
    const fin = matchFinancing(profile, opps);
    const ep5 = fin.find((m) => m.instrument.id === 'ep5');
    expect(ep5?.gatesToClear).toContain('IFC PS6 critical-habitat assessment');
  });

  it('honours minScore option', () => {
    const high = matchFinancing(profile, opps, { minScore: 0.9 });
    const low = matchFinancing(profile, opps, { minScore: 0.1 });
    expect(low.length).toBeGreaterThanOrEqual(high.length);
  });

  it('honours maxResults option', () => {
    const capped = matchFinancing(profile, opps, { maxResults: 3 });
    expect(capped.length).toBeLessThanOrEqual(3);
  });

  it('returns score in [0, 1]', () => {
    const fin = matchFinancing(profile, opps);
    for (const m of fin) {
      expect(m.score).toBeGreaterThanOrEqual(0);
      expect(m.score).toBeLessThanOrEqual(1);
    }
  });
});

describe('matchFinancing — other project shapes', () => {
  it('IFC EDGE matches a residential project', () => {
    const profile = classifyProject({
      description: 'A new residential apartments tower in Kampala',
    });
    const opps = matchOpportunities(profile);
    const fin = matchFinancing(profile, opps);
    expect(fin.some((m) => m.instrument.id === 'ifc-edge')).toBe(true);
  });

  it('AfDB SEFA matches an energy project', () => {
    const profile = classifyProject({
      description: 'A 100 MW solar farm in Tanzania',
    });
    const opps = matchOpportunities(profile);
    const fin = matchFinancing(profile, opps);
    expect(fin.some((m) => m.instrument.id === 'afdb-sefa')).toBe(true);
  });

  it('returns empty list when no opportunities match', () => {
    const profile = classifyProject({
      description: 'project',
      hints: { jurisdictions: ['OTHER'] },
    });
    const opps = matchOpportunities(profile);
    // No type / no jurisdiction → most instruments below minScore
    const fin = matchFinancing(profile, opps, { minScore: 0.7 });
    expect(fin).toEqual([]);
  });
});

describe('modelSll', () => {
  it('computes expected margin between best and worst case', () => {
    const result = modelSll({
      principalUsdMillions: 100,
      baseMarginBps: 300,
      stepDownBps: 10,
      stepUpBps: 10,
      pSptMet: 0.5,
      tenorYears: 7,
    });
    expect(result.bestCaseMarginBps).toBe(290);
    expect(result.worstCaseMarginBps).toBe(310);
    expect(result.expectedMarginBps).toBe(300);
  });

  it('returns negative expected savings when SPT is unlikely', () => {
    const result = modelSll({
      principalUsdMillions: 100,
      baseMarginBps: 300,
      stepDownBps: 10,
      stepUpBps: 10,
      pSptMet: 0.1,
      tenorYears: 7,
    });
    expect(result.expectedInterestSavingsUsd).toBeLessThan(0);
  });

  it('returns positive savings when SPT is likely', () => {
    const result = modelSll({
      principalUsdMillions: 200,
      baseMarginBps: 350,
      stepDownBps: 15,
      stepUpBps: 5,
      pSptMet: 0.9,
      tenorYears: 10,
    });
    expect(result.expectedInterestSavingsUsd).toBeGreaterThan(0);
  });

  it('throws on out-of-range pSptMet', () => {
    expect(() =>
      modelSll({
        principalUsdMillions: 100,
        baseMarginBps: 300,
        stepDownBps: 10,
        stepUpBps: 10,
        pSptMet: 1.5,
        tenorYears: 7,
      }),
    ).toThrow();
  });

  it('worst-case add-on scales with tenor', () => {
    const a = modelSll({
      principalUsdMillions: 100,
      baseMarginBps: 300,
      stepDownBps: 10,
      stepUpBps: 10,
      pSptMet: 0,
      tenorYears: 5,
    });
    const b = modelSll({
      principalUsdMillions: 100,
      baseMarginBps: 300,
      stepDownBps: 10,
      stepUpBps: 10,
      pSptMet: 0,
      tenorYears: 10,
    });
    expect(b.worstCaseInterestAddOnUsd).toBeGreaterThan(a.worstCaseInterestAddOnUsd);
  });
});
