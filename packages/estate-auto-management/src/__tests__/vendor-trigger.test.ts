import { describe, expect, it } from 'vitest';
import { maybeTriggerDispatch } from '../predictive/vendor-trigger.js';
import type { FailureForecast } from '../types.js';

const baseForecast = (over: Partial<FailureForecast> = {}): FailureForecast => ({
  assetId: 'a1',
  family: 'pump',
  score: 0.5,
  probabilityWithin: { d7: 0.1, d30: 0.4, d90: 0.7 },
  verdict: 'service',
  ...over,
});

describe('vendor-trigger', () => {
  it('returns null below threshold', () => {
    const t = maybeTriggerDispatch(baseForecast({ probabilityWithin: { d7: 0, d30: 0.1, d90: 0.2 }, verdict: 'monitor' }), {
      dispatchAtProb30d: 0.3,
    });
    expect(t).toBeNull();
  });

  it('returns dispatch above threshold', () => {
    const t = maybeTriggerDispatch(baseForecast(), { dispatchAtProb30d: 0.3 });
    expect(t).not.toBeNull();
    expect(t?.priority).toBe('high');
    expect(t?.slaHours).toBe(24);
  });

  it('uses critical priority for urgent verdict', () => {
    const t = maybeTriggerDispatch(
      baseForecast({ probabilityWithin: { d7: 0.5, d30: 0.8, d90: 0.95 }, verdict: 'urgent' }),
      { dispatchAtProb30d: 0.3 },
    );
    expect(t?.priority).toBe('critical');
    expect(t?.slaHours).toBe(4);
  });

  it('honours custom SLA mapping', () => {
    const t = maybeTriggerDispatch(baseForecast(), {
      dispatchAtProb30d: 0.3,
      slaHoursByVerdict: {
        healthy: 1000,
        monitor: 500,
        service: 99,
        urgent: 1,
      },
    });
    expect(t?.slaHours).toBe(99);
  });

  it('returns ISO timestamp', () => {
    const t = maybeTriggerDispatch(baseForecast(), { dispatchAtProb30d: 0.3 }, new Date('2026-01-01T00:00:00Z'));
    expect(t?.dispatchedAt).toBe('2026-01-01T00:00:00.000Z');
  });
});
