/**
 * /api/v1/budgets/forecasts — real-data assertions.
 *
 * Tests the Holt-Winters forecasting model directly so we lock in the
 * contract that a real seasonal+trend series produces a non-trivial,
 * non-constant projection with a calibrated 95% interval — never the
 * `last_value * 1.1` stub.
 */

import { describe, it, expect } from 'vitest';
import {
  createHoltWintersForecaster,
  type TimeSeries,
} from '@bossnyumba/forecasting';

const Z_95 = 1.96;

describe('BN budget-forecast — Holt-Winters layer', () => {
  it('captures monthly trend on 24 months of real-looking revenue', async () => {
    // 24 monthly points: trend $100k → $150k linearly + seasonal swing
    // ±$10k (annual). The forecaster must project beyond just the
    // last observation.
    const points = Array.from({ length: 24 }, (_, i) => {
      const t = new Date(Date.UTC(2024, i, 1)).toISOString();
      const trend = 100_000 + i * 2_000;
      const seasonal = 10_000 * Math.sin((2 * Math.PI * i) / 12);
      return { t, y: trend + seasonal };
    });
    const series: TimeSeries = {
      id: 'test::revenue',
      frequency: 'monthly',
      points,
    };
    const fc = createHoltWintersForecaster({ intervalZ: Z_95 });
    const result = await fc.predict({
      series,
      horizon: { steps: 6 },
      opts: { alpha: 0.05, seasonality: 12 },
    });

    expect(result.points.length).toBe(6);
    expect(result.modelKind).toBe('holt-winters');
    expect(result.modelVersion).toBe('holt-winters-1');

    // The point projection at step 6 should be HIGHER than at step 1
    // because the trend is positive.
    const first = result.points[0]!;
    const last = result.points[5]!;
    expect(last.point).toBeGreaterThan(first.point);

    // The projection 6 months out must be meaningfully different from
    // the last observation — forbids `return lastValue * 1.05` stubs.
    const lastObs = points[points.length - 1]!.y;
    expect(Math.abs(last.point - lastObs)).toBeGreaterThan(1000);
  });

  it('produces a non-trivial 95% interval that straddles the point', async () => {
    const rng = mulberry32(7);
    const points = Array.from({ length: 24 }, (_, i) => ({
      t: new Date(Date.UTC(2024, i, 1)).toISOString(),
      y: 50_000 + (rng() - 0.5) * 8_000,
    }));
    const series: TimeSeries = {
      id: 'test::noisy-monthly',
      frequency: 'monthly',
      points,
    };
    const fc = createHoltWintersForecaster({ intervalZ: Z_95 });
    const result = await fc.predict({
      series,
      horizon: { steps: 4 },
      opts: { alpha: 0.05, seasonality: 12 },
    });
    for (const p of result.points) {
      expect(p.lower).toBeLessThan(p.point);
      expect(p.upper).toBeGreaterThan(p.point);
      expect(p.upper - p.lower).toBeGreaterThan(0);
    }
  });
});

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
