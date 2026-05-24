import { describe, expect, it } from 'vitest';
import {
  DEFAULT_IMPACT_BY_TYPE,
  readAltaCommitment,
} from '../title/alta-commitment-reader.js';
import { modelEasementImpact } from '../title/easement-encumbrance-modeler.js';
import { modelCovenantImpact } from '../title/restrictive-covenant-impact.js';
import type { ScheduleBException } from '../types.js';

describe('readAltaCommitment', () => {
  it('clean when only utility easements', () => {
    const exceptions: ScheduleBException[] = [
      {
        id: 'b1',
        type: 'utilityEasement',
        description: 'Power easement along rear',
        impactScore: DEFAULT_IMPACT_BY_TYPE.utilityEasement,
        curableAtClose: false,
      },
    ];
    const r = readAltaCommitment({
      exceptions,
      standardExceptionsDeletable: true,
    });
    expect(r.verdict).toBe('clean');
  });

  it('unworkable when lis pendens present', () => {
    const exceptions: ScheduleBException[] = [
      {
        id: 'l1',
        type: 'lisPendens',
        description: 'Pending quiet-title action filed 2024',
        impactScore: DEFAULT_IMPACT_BY_TYPE.lisPendens,
        curableAtClose: false,
      },
    ];
    const r = readAltaCommitment({
      exceptions,
      standardExceptionsDeletable: true,
    });
    expect(r.verdict).toBe('unworkable');
  });

  it('requires-cure when mortgage + tax lien (both curable)', () => {
    const exceptions: ScheduleBException[] = [
      {
        id: 'mort',
        type: 'mortgage',
        description: 'First mortgage',
        impactScore: 4,
        curableAtClose: true,
        amount: 5_000_000,
      },
      {
        id: 'tax',
        type: 'taxLien',
        description: 'Tax lien 2023',
        impactScore: 9,
        curableAtClose: true,
        amount: 250_000,
      },
    ];
    const r = readAltaCommitment({
      exceptions,
      standardExceptionsDeletable: true,
    });
    expect(r.verdict).toBe('requires-cure');
  });

  it('always-curable types are marked curable even if input says false', () => {
    const exceptions: ScheduleBException[] = [
      {
        id: 'mort',
        type: 'mortgage',
        description: 'First mortgage',
        impactScore: 4,
        curableAtClose: false,
      },
    ];
    const r = readAltaCommitment({
      exceptions,
      standardExceptionsDeletable: true,
    });
    expect(r.exceptions[0].curableAtClose).toBe(true);
  });

  it('counts critical-score exceptions correctly', () => {
    const exceptions: ScheduleBException[] = [
      { id: 'a', type: 'taxLien', description: '', impactScore: 9, curableAtClose: true },
      { id: 'b', type: 'mineralReservation', description: '', impactScore: 8, curableAtClose: false },
      { id: 'c', type: 'utilityEasement', description: '', impactScore: 1, curableAtClose: false },
    ];
    const r = readAltaCommitment({
      exceptions,
      standardExceptionsDeletable: true,
    });
    expect(r.criticalCount).toBe(2);
  });
});

describe('easement encumbrance modeler', () => {
  it('valuation impact > 0 when surface easement burdens area', () => {
    const r = modelEasementImpact({
      easementId: 'e1',
      scope: 'surface',
      term: 'perpetual',
      exclusivity: 'exclusive',
      affectedAreaSqm: 200,
      subjectValuePerSqm: 1000,
      buildAroundProbability: 0.2,
    });
    expect(r.valuationImpact).toBeGreaterThan(0);
    expect(r.buildAroundFeasible).toBe(false);
  });

  it('buildAround feasible reduces effective loss', () => {
    const big = modelEasementImpact({
      easementId: 'e2',
      scope: 'surface',
      term: 'perpetual',
      exclusivity: 'exclusive',
      affectedAreaSqm: 200,
      subjectValuePerSqm: 1000,
      buildAroundProbability: 0.1,
    });
    const small = modelEasementImpact({
      easementId: 'e3',
      scope: 'surface',
      term: 'perpetual',
      exclusivity: 'exclusive',
      affectedAreaSqm: 200,
      subjectValuePerSqm: 1000,
      buildAroundProbability: 0.95,
    });
    expect(small.valuationImpact).toBeLessThan(big.valuationImpact);
  });

  it('rejects invalid probability', () => {
    expect(() =>
      modelEasementImpact({
        easementId: 'x',
        scope: 'surface',
        term: 'perpetual',
        exclusivity: 'exclusive',
        affectedAreaSqm: 100,
        subjectValuePerSqm: 500,
        buildAroundProbability: 1.5,
      }),
    ).toThrow(/buildAroundProbability/);
  });
});

describe('restrictive covenant impact', () => {
  it('expected loss = P × cost × Penforce', () => {
    const r = modelCovenantImpact({
      covenantId: 'c1',
      category: 'use',
      probabilityOfBreach: 0.5,
      probabilityOfEnforcement: 0.8,
    });
    expect(r.expectedLoss).toBeCloseTo(0.5 * 0.8 * 250_000, 0);
  });

  it('honors costOfCureOverride', () => {
    const r = modelCovenantImpact({
      covenantId: 'c2',
      category: 'aesthetics',
      probabilityOfBreach: 0.4,
      probabilityOfEnforcement: 0.5,
      costOfCureOverride: 100_000,
    });
    expect(r.costOfCure).toBe(100_000);
    expect(r.expectedLoss).toBeCloseTo(0.4 * 0.5 * 100_000, 0);
  });

  it('rejects out-of-range probability', () => {
    expect(() =>
      modelCovenantImpact({
        covenantId: 'c3',
        category: 'use',
        probabilityOfBreach: 1.5,
        probabilityOfEnforcement: 0.5,
      }),
    ).toThrow();
  });
});
