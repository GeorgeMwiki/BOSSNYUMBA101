import { describe, expect, it } from 'vitest';
import { forecastFailure } from '../predictive/failure-forecaster.js';

describe('failure-forecaster', () => {
  it('pristine asset has near-zero failure probability', () => {
    const r = forecastFailure({
      assetId: 'a1',
      family: 'elevator',
      vibrationMm: 0.5,
      tempC: 35,
      runHours: 50,
      lastServiceAgeDays: 10,
      spikeCount30d: 0,
    });
    expect(r.probabilityWithin.d30).toBeLessThan(0.05);
    expect(r.verdict).toBe('healthy');
  });

  it('stressed asset hits urgent verdict', () => {
    const r = forecastFailure({
      assetId: 'a2',
      family: 'hvac',
      vibrationMm: 11,
      tempC: 92,
      runHours: 29000,
      lastServiceAgeDays: 400,
      spikeCount30d: 8,
    });
    expect(r.probabilityWithin.d30).toBeGreaterThan(0.6);
    expect(r.verdict).toBe('urgent');
  });

  it('p(7d) <= p(30d) <= p(90d)', () => {
    const r = forecastFailure({
      assetId: 'a3',
      family: 'pump',
      vibrationMm: 4,
      tempC: 50,
      runHours: 10_000,
      lastServiceAgeDays: 90,
      spikeCount30d: 2,
    });
    expect(r.probabilityWithin.d7).toBeLessThanOrEqual(r.probabilityWithin.d30);
    expect(r.probabilityWithin.d30).toBeLessThanOrEqual(r.probabilityWithin.d90);
  });

  it('handles non-finite inputs gracefully', () => {
    const r = forecastFailure({
      assetId: 'a4',
      family: 'generator',
      vibrationMm: Number.NaN,
      tempC: 0,
      runHours: 0,
      lastServiceAgeDays: 0,
      spikeCount30d: 0,
    });
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(1);
  });

  it('asset family changes calibration', () => {
    const base = {
      vibrationMm: 4,
      tempC: 60,
      runHours: 10_000,
      lastServiceAgeDays: 100,
      spikeCount30d: 1,
    };
    const hvac = forecastFailure({ assetId: 'h', family: 'hvac', ...base });
    const elev = forecastFailure({ assetId: 'e', family: 'elevator', ...base });
    expect(hvac.probabilityWithin.d30).not.toBe(elev.probabilityWithin.d30);
  });
});
