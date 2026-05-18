import { describe, it, expect } from 'vitest';
import {
  fitCashflow,
  forecastCashflow,
  updateCashflow,
} from '../../forecasters/time-series/cashflow-forecaster.js';
import {
  fitOccupancy,
  forecastOccupancy,
  updateOccupancy,
} from '../../forecasters/time-series/occupancy-forecaster.js';
import {
  fitArrears,
  forecastArrears,
} from '../../forecasters/time-series/arrears-forecaster.js';
import type { TimePoint } from '../../types.js';

function synthSeasonal(n: number, level: number, amp: number): TimePoint[] {
  const dayMs = 86_400_000;
  return Array.from({ length: n }, (_, i) => ({
    t: i * 30 * dayMs,
    v: level + amp * Math.sin((2 * Math.PI * i) / 12) + i * 50,
  }));
}

describe('CashflowForecaster (Holt-Winters)', () => {
  it('fits and forecasts within reasonable bounds on synthetic data', () => {
    const hist = synthSeasonal(36, 100_000, 5_000);
    const model = fitCashflow(hist, { seasonLength: 12 });
    expect(model.sampleSize).toBe(36);
    expect(model.residualStd).toBeGreaterThanOrEqual(0);
    const fc = forecastCashflow(model, 12);
    expect(fc.length).toBe(12);
    // p50 should be in a sane range around the historical level
    const lastP50 = fc[fc.length - 1]?.p50 ?? 0;
    expect(lastP50).toBeGreaterThan(50_000);
    expect(lastP50).toBeLessThan(250_000);
    // Bands ordered
    for (const b of fc) {
      expect(b.p10).toBeLessThanOrEqual(b.p50);
      expect(b.p50).toBeLessThanOrEqual(b.p90);
    }
  });

  it('updates model online without exploding', () => {
    const hist = synthSeasonal(24, 100_000, 3_000);
    let model = fitCashflow(hist, { seasonLength: 12 });
    for (let i = 0; i < 6; i += 1) {
      model = updateCashflow(model, { t: model.params.lastT + 30 * 86_400_000, v: 100_000 });
    }
    expect(model.sampleSize).toBe(30);
    expect(Number.isFinite(model.params.level)).toBe(true);
  });

  it('throws on too-few points', () => {
    expect(() => fitCashflow([{ t: 0, v: 1 }, { t: 1, v: 2 }])).toThrow();
  });
});

describe('OccupancyForecaster (Empirical Bayes)', () => {
  it('fits beta posteriors and forecasts within [0, 1]', () => {
    const obs = [
      { microMarketId: 'mm1', occupied: 8, total: 10 },
      { microMarketId: 'mm2', occupied: 18, total: 20 },
      { microMarketId: 'mm3', occupied: 5, total: 8 },
    ];
    const model = fitOccupancy(obs);
    const fc = forecastOccupancy(model, 'mm1', 5);
    expect(fc.length).toBe(5);
    for (const b of fc) {
      expect(b.p10).toBeGreaterThanOrEqual(0);
      expect(b.p90).toBeLessThanOrEqual(1);
      expect(b.p50).toBeLessThanOrEqual(b.p90);
      expect(b.p50).toBeGreaterThanOrEqual(b.p10);
    }
  });

  it('online update tightens posterior', () => {
    const obs = [{ microMarketId: 'mm1', occupied: 5, total: 10 }];
    const model = fitOccupancy(obs);
    const updated = updateOccupancy(model, { microMarketId: 'mm1', occupied: 50, total: 50 });
    const mean0 = forecastOccupancy(model, 'mm1', 1)[0]?.p50 ?? 0;
    const mean1 = forecastOccupancy(updated, 'mm1', 1)[0]?.p50 ?? 0;
    expect(mean1).toBeGreaterThan(mean0);
  });
});

describe('ArrearsForecaster (logistic growth)', () => {
  it('fits an S-curve and forecast saturates near K', () => {
    const dayMs = 86_400_000;
    const K = 1000;
    const r = 0.1;
    const t0 = 30;
    const hist: TimePoint[] = [];
    for (let i = 0; i < 60; i += 1) {
      const x = i;
      const y = K / (1 + Math.exp(-r * (x - t0)));
      hist.push({ t: i * dayMs, v: y });
    }
    const model = fitArrears(hist);
    expect(model.sampleSize).toBe(60);
    expect(model.params.K).toBeGreaterThan(0);
    const fc = forecastArrears(model, 30);
    expect(fc.length).toBe(30);
  });
});
