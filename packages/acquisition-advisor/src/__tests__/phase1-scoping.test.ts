import { describe, expect, it } from 'vitest';
import { scopePhase1 } from '../environmental/phase1-scoping.js';
import { triggerPhase2 } from '../environmental/phase2-trigger.js';
import { modelVaporIntrusion } from '../environmental/vapor-intrusion-modeler.js';
import type { RECFinding } from '../types.js';

describe('scopePhase1', () => {
  it('returns zeros for empty findings', () => {
    const r = scopePhase1({ findings: [] });
    expect(r.severity).toBe(0);
    expect(r.recommendPhase2).toBe(false);
  });

  it('recommends Phase II when any REC present', () => {
    const findings: RECFinding[] = [
      {
        id: 'rec1',
        category: 'REC',
        contaminant: 'TCE',
        mediaAffected: ['soilVapor', 'groundwater'],
        historicalUse: 'dry cleaner 1985-2010',
        distanceMetres: 30,
        recommendedNextStep: 'phase2',
      },
    ];
    const r = scopePhase1({ findings });
    expect(r.recommendPhase2).toBe(true);
    expect(r.priorityContaminants).toContain('TCE');
  });

  it('does not recommend Phase II for HREC alone unless carrier strict', () => {
    const findings: RECFinding[] = [
      {
        id: 'hrec1',
        category: 'HREC',
        contaminant: 'naphthalene',
        mediaAffected: ['soil'],
        historicalUse: 'closed UST',
        distanceMetres: 80,
        recommendedNextStep: 'noAction',
      },
    ];
    const lax = scopePhase1({ findings, insuranceCarrierStrict: false });
    expect(lax.recommendPhase2).toBe(false);
    const strict = scopePhase1({ findings, insuranceCarrierStrict: true });
    expect(strict.recommendPhase2).toBe(true);
    expect(strict.insuranceCarrierWillRequirePhase2).toBe(true);
  });

  it('severity is bounded [0,1]', () => {
    const findings: RECFinding[] = [
      { id: 'a', category: 'REC', contaminant: 'TCE', mediaAffected: ['soilVapor'], historicalUse: 'x', distanceMetres: 10, recommendedNextStep: 'phase2' },
      { id: 'b', category: 'CREC', contaminant: 'lead', mediaAffected: ['soil'], historicalUse: 'y', distanceMetres: 20, recommendedNextStep: 'phase2' },
    ];
    const r = scopePhase1({ findings });
    expect(r.severity).toBeGreaterThanOrEqual(0);
    expect(r.severity).toBeLessThanOrEqual(1);
  });
});

describe('triggerPhase2', () => {
  it('triggered with REC; cost > baseline', () => {
    const findings: RECFinding[] = [
      {
        id: 'rec1',
        category: 'REC',
        contaminant: 'benzene',
        mediaAffected: ['soil', 'groundwater'],
        historicalUse: 'service station',
        distanceMetres: 25,
        recommendedNextStep: 'phase2',
      },
    ];
    const phase1 = scopePhase1({ findings });
    const t = triggerPhase2({ phase1 });
    expect(t.triggered).toBe(true);
    expect(t.mediaToSample.length).toBeGreaterThan(0);
    expect(t.estimatedCostUsd).toBeGreaterThanOrEqual(18_000);
  });

  it('industrial site adds premium', () => {
    const findings: RECFinding[] = [
      {
        id: 'rec2',
        category: 'REC',
        contaminant: 'PCB',
        mediaAffected: ['soil'],
        historicalUse: 'manufacturing',
        distanceMetres: 5,
        recommendedNextStep: 'phase2',
      },
    ];
    const phase1 = scopePhase1({ findings });
    const t = triggerPhase2({ phase1, siteIsIndustrial: true });
    expect(t.estimatedCostUsd).toBeGreaterThanOrEqual(68_000);
  });

  it('not triggered when no REC and no carrier strict', () => {
    const phase1 = scopePhase1({ findings: [] });
    const t = triggerPhase2({ phase1 });
    expect(t.triggered).toBe(false);
    expect(t.estimatedCostUsd).toBe(0);
  });
});

describe('vapor intrusion modeler', () => {
  it('mitigation required at close distance + clay basement', () => {
    const m = modelVaporIntrusion({
      distanceFromSourceMetres: 2,
      contaminant: 'TCE',
      soilType: 'sand',
      buildingType: 'basement',
    });
    expect(m.mitigationRequired).toBe(true);
    expect(m.mitigationCostUsd).toBeGreaterThan(0);
  });

  it('mitigation not required at very far distance', () => {
    const m = modelVaporIntrusion({
      distanceFromSourceMetres: 500,
      contaminant: 'TCE',
      soilType: 'clay',
      buildingType: 'slab-on-grade',
    });
    expect(m.mitigationRequired).toBe(false);
    expect(m.attenuationFactor).toBeGreaterThan(0);
  });

  it('rejects negative distance', () => {
    expect(() =>
      modelVaporIntrusion({
        distanceFromSourceMetres: -5,
        contaminant: 'PCE',
        soilType: 'sand',
        buildingType: 'basement',
      }),
    ).toThrow();
  });
});
