/**
 * Calibration-monitor (tracker + alerter + brain-tool) tests.
 *
 * The tracker is exercised against an in-memory db stub returning
 * sampled prediction rows; the alerter is exercised against fixed
 * scores. Both stay pure-functions of their inputs.
 */

import { describe, expect, it } from 'vitest';
import {
  createCalibrationTracker,
  createCalibrationAlerter,
} from '../index.js';

const TENANT = 'tnt-1';

function makeDb(rows: Array<Record<string, unknown>>) {
  return {
    async execute() {
      return { rows };
    },
  };
}

describe('calibration tracker — scoring rules', () => {
  it('accuracy = matched / (matched + divergent), drops undetermined + expired from denom', async () => {
    const db = makeDb([
      { prediction_confidence: 0.8, status: 'matched', drift_score: 0.1 },
      { prediction_confidence: 0.8, status: 'matched', drift_score: 0.1 },
      { prediction_confidence: 0.8, status: 'divergent', drift_score: 0.5 },
      { prediction_confidence: 0.8, status: 'undetermined', drift_score: 0 },
      { prediction_confidence: 0.8, status: 'expired', drift_score: 0 },
    ]);
    const tracker = createCalibrationTracker({ db });
    const out = await tracker.getCalibrationScore({ tenantId: TENANT });
    expect(out.matchedCount).toBe(2);
    expect(out.divergentCount).toBe(1);
    expect(out.undeterminedCount).toBe(1);
    expect(out.expiredCount).toBe(1);
    expect(out.accuracy).toBe(0.6667);
  });

  it('accuracy = 1 when no verdicts yet', async () => {
    const tracker = createCalibrationTracker({ db: makeDb([]) });
    const out = await tracker.getCalibrationScore({ tenantId: TENANT });
    expect(out.accuracy).toBe(1);
  });

  it('curve builds five fixed bands of width 0.2', async () => {
    const tracker = createCalibrationTracker({ db: makeDb([]) });
    const out = await tracker.getCalibrationScore({ tenantId: TENANT });
    expect(out.calibrationCurve.length).toBe(5);
    expect(out.calibrationCurve[0]).toMatchObject({
      confidenceLower: 0,
      confidenceUpper: 0.2,
    });
    expect(out.calibrationCurve[4]).toMatchObject({
      confidenceLower: 0.8,
      confidenceUpper: 1,
    });
  });

  it('falls back to empty envelope when DB throws', async () => {
    const tracker = createCalibrationTracker({
      db: {
        async execute() {
          throw new Error('db down');
        },
      },
    });
    const out = await tracker.getCalibrationScore({ tenantId: TENANT });
    expect(out.predictedCount).toBe(0);
    expect(out.accuracy).toBe(1);
  });
});

describe('calibration alerter — floor crossing', () => {
  it('emits when accuracy < floor and verdicts >= minSamples', () => {
    const events: Array<unknown> = [];
    const alerter = createCalibrationAlerter({
      sink: (e) => events.push(e),
      accuracyFloor: 0.7,
      minSamples: 3,
    });
    const emitted = alerter.inspect({
      tenantId: TENANT,
      sinceDays: 30,
      actorKindFilter: null,
      actionKindPrefix: null,
      predictedCount: 10,
      matchedCount: 4,
      divergentCount: 6,
      undeterminedCount: 0,
      expiredCount: 0,
      accuracy: 0.4,
      meanDrift: 0.5,
      calibrationCurve: [],
      computedAt: '2026-05-29T00:00:00Z',
    });
    expect(emitted).toBe(true);
    expect(events.length).toBe(1);
  });

  it('does not emit when accuracy >= floor', () => {
    const events: Array<unknown> = [];
    const alerter = createCalibrationAlerter({
      sink: (e) => events.push(e),
      accuracyFloor: 0.6,
      minSamples: 1,
    });
    const emitted = alerter.inspect({
      tenantId: TENANT,
      sinceDays: 30,
      actorKindFilter: null,
      actionKindPrefix: null,
      predictedCount: 10,
      matchedCount: 9,
      divergentCount: 1,
      undeterminedCount: 0,
      expiredCount: 0,
      accuracy: 0.9,
      meanDrift: 0.1,
      calibrationCurve: [],
      computedAt: '2026-05-29T00:00:00Z',
    });
    expect(emitted).toBe(false);
    expect(events.length).toBe(0);
  });

  it('does not emit on small verdict population', () => {
    const events: Array<unknown> = [];
    const alerter = createCalibrationAlerter({
      sink: (e) => events.push(e),
      accuracyFloor: 0.6,
      minSamples: 10,
    });
    const emitted = alerter.inspect({
      tenantId: TENANT,
      sinceDays: 30,
      actorKindFilter: null,
      actionKindPrefix: null,
      predictedCount: 3,
      matchedCount: 1,
      divergentCount: 2,
      undeterminedCount: 0,
      expiredCount: 0,
      accuracy: 0.33,
      meanDrift: 0.6,
      calibrationCurve: [],
      computedAt: '2026-05-29T00:00:00Z',
    });
    expect(emitted).toBe(false);
  });
});
