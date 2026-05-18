import { describe, it, expect } from 'vitest';
import {
  computeDelta,
  createPredictionStore,
} from '../../feedback/predicted-vs-actual.js';
import { lessonFromDelta } from '../../feedback/reflexion-update.js';
import { proposeCurveUpdate } from '../../feedback/world-model-update.js';

describe('computeDelta', () => {
  it('flags when actual falls inside band', () => {
    const d = computeDelta(
      {
        id: 'p1',
        metric: 'cashflow',
        band: { t: 0, p10: 80, p50: 100, p90: 120 },
        createdAtMs: 0,
      },
      105,
    );
    expect(d.withinP10P90).toBe(true);
    expect(d.absoluteError).toBe(5);
    expect(d.relativeError).toBeCloseTo(0.05, 6);
  });

  it('flags when actual falls outside band', () => {
    const d = computeDelta(
      {
        id: 'p2',
        metric: 'occupancy',
        band: { t: 0, p10: 0.7, p50: 0.8, p90: 0.85 },
        createdAtMs: 0,
      },
      0.5,
    );
    expect(d.withinP10P90).toBe(false);
    expect(d.relativeError).toBeGreaterThan(0.3);
  });
});

describe('lessonFromDelta', () => {
  it('returns null for accurate predictions', () => {
    const d = computeDelta(
      {
        id: 'p3',
        metric: 'cashflow',
        band: { t: 0, p10: 90, p50: 100, p90: 110 },
        createdAtMs: 0,
      },
      102,
    );
    expect(lessonFromDelta(d)).toBeNull();
  });

  it('produces a lesson for out-of-band predictions', () => {
    const d = computeDelta(
      {
        id: 'p4',
        metric: 'noi',
        band: { t: 0, p10: 1000, p50: 1200, p90: 1400 },
        createdAtMs: 0,
      },
      2000,
    );
    const lesson = lessonFromDelta(d, 12345);
    expect(lesson).not.toBeNull();
    expect(lesson?.forMetric).toBe('noi');
    expect(lesson?.summary).toContain('underestimated');
    expect(lesson?.createdAt).toBe(12345);
  });
});

describe('proposeCurveUpdate', () => {
  it('proposes variance widening when out of band', () => {
    const d = computeDelta(
      {
        id: 'p5',
        metric: 'retention',
        band: { t: 0, p10: 0.7, p50: 0.8, p90: 0.85 },
        createdAtMs: 0,
      },
      0.4,
    );
    const proposal = proposeCurveUpdate('retention.curve.v1', d);
    expect(proposal.suggestedShift.kind).toBe('variance');
  });

  it('proposes mean shift when in band but biased', () => {
    const d = computeDelta(
      {
        id: 'p6',
        metric: 'cashflow',
        band: { t: 0, p10: 70, p50: 100, p90: 150 },
        createdAtMs: 0,
      },
      130,
    );
    const proposal = proposeCurveUpdate('cashflow.holt-winters.v1', d);
    expect(proposal.suggestedShift.kind).toBe('mean');
    if (proposal.suggestedShift.kind === 'mean') {
      expect(proposal.suggestedShift.direction).toBe('up');
    }
  });

  it('proposes noop when accurate', () => {
    const d = computeDelta(
      {
        id: 'p7',
        metric: 'cashflow',
        band: { t: 0, p10: 95, p50: 100, p90: 105 },
        createdAtMs: 0,
      },
      101,
    );
    const proposal = proposeCurveUpdate('cashflow.holt-winters.v1', d);
    expect(proposal.suggestedShift.kind).toBe('noop');
  });
});

describe('PredictionStore', () => {
  it('puts and gets', () => {
    const store = createPredictionStore();
    store.put({
      id: 'a',
      metric: 'x',
      band: { t: 0, p10: 1, p50: 2, p90: 3 },
      createdAtMs: 0,
    });
    expect(store.get('a')?.metric).toBe('x');
    expect(store.list().length).toBe(1);
  });
});
