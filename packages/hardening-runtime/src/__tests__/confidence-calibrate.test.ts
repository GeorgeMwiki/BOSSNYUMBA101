/**
 * Calibration unit tests — verifies the L3 calibration curve and the
 * verbalized + logprob combination logic.
 */

import { describe, it, expect } from 'vitest';
import {
  calibrateVerbalized,
  combineCalibrated,
  VERBALIZED_CALIBRATION_CURVE,
} from '../confidence/calibrate.js';

describe('VERBALIZED_CALIBRATION_CURVE', () => {
  it('is frozen and monotonically non-decreasing', () => {
    expect(Object.isFrozen(VERBALIZED_CALIBRATION_CURVE)).toBe(true);
    for (let i = 1; i < VERBALIZED_CALIBRATION_CURVE.length; i += 1) {
      const prev = VERBALIZED_CALIBRATION_CURVE[i - 1];
      const cur = VERBALIZED_CALIBRATION_CURVE[i];
      expect(prev).toBeDefined();
      expect(cur).toBeDefined();
      if (prev && cur) {
        // x ascending
        expect(cur[0]).toBeGreaterThanOrEqual(prev[0]);
        // y non-decreasing
        expect(cur[1]).toBeGreaterThanOrEqual(prev[1]);
      }
    }
  });
});

describe('calibrateVerbalized — L3 published curve fixtures', () => {
  // 12 calibration fixtures — sourced from L3 §4.2 example.
  const fixtures: ReadonlyArray<{ v: number; min: number; max: number; label: string }> = [
    { v: 0.0, min: 0.0, max: 0.001, label: '0.0 → 0.0' },
    { v: 0.1, min: 0.04, max: 0.06, label: '0.1 → 0.05' },
    { v: 0.2, min: 0.09, max: 0.11, label: '0.2 → 0.10' },
    { v: 0.3, min: 0.14, max: 0.16, label: '0.3 → 0.15' },
    { v: 0.5, min: 0.31, max: 0.33, label: '0.5 → 0.32' },
    { v: 0.6, min: 0.44, max: 0.46, label: '0.6 → 0.45' },
    { v: 0.7, min: 0.54, max: 0.56, label: '0.7 → 0.55' },
    { v: 0.8, min: 0.64, max: 0.66, label: '0.8 → 0.65 (verbatim from L3)' },
    { v: 0.9, min: 0.74, max: 0.76, label: '0.9 → 0.75' },
    { v: 1.0, min: 0.84, max: 0.86, label: '1.0 → 0.85' },
    { v: 0.55, min: 0.38, max: 0.40, label: '0.55 (interpolated) ≈ 0.385' },
    { v: 0.75, min: 0.59, max: 0.61, label: '0.75 (interpolated) ≈ 0.60' },
  ];

  for (const fx of fixtures) {
    it(fx.label, () => {
      const result = calibrateVerbalized(fx.v);
      expect(result).toBeGreaterThanOrEqual(fx.min);
      expect(result).toBeLessThanOrEqual(fx.max);
    });
  }

  it('clamps verbalized > 1 to 1', () => {
    expect(calibrateVerbalized(1.5)).toBeCloseTo(0.85, 2);
  });

  it('clamps verbalized < 0 to 0', () => {
    expect(calibrateVerbalized(-0.3)).toBe(0);
  });

  it('returns 0 for NaN / Infinity', () => {
    expect(calibrateVerbalized(NaN)).toBe(0);
    expect(calibrateVerbalized(Infinity)).toBe(0);
    expect(calibrateVerbalized(-Infinity)).toBe(0);
  });
});

describe('combineCalibrated', () => {
  it('returns 0.5 when both signals are absent', () => {
    expect(combineCalibrated(null, null)).toBe(0.5);
  });

  it('uses verbalized-calibrated when logprob is missing', () => {
    // verbalized 0.8 calibrates to ~0.65
    expect(combineCalibrated(0.8, null)).toBeCloseTo(0.65, 1);
  });

  it('uses logprob directly when verbalized is missing', () => {
    expect(combineCalibrated(null, 0.75)).toBeCloseTo(0.75, 2);
  });

  it('weights logprob 70/30 when both present', () => {
    // verbalized 0.8 → 0.65
    // logprob 0.40
    // combined = 0.7 * 0.40 + 0.3 * 0.65 = 0.28 + 0.195 = 0.475
    expect(combineCalibrated(0.8, 0.40)).toBeCloseTo(0.475, 2);
  });

  it('clamps logprob > 1 to 1', () => {
    expect(combineCalibrated(null, 1.5)).toBe(1);
  });

  it('returns 0 for NaN logprob', () => {
    // verbalized null + logprob NaN → falls through both nulls → 0.5
    // But our normaliseLogprob in extract-confidence treats NaN as null;
    // here combineCalibrated treats it as a real number then clamp01.
    // clamp01(NaN) returns 0; with null verbalized, the result is
    // therefore 0 (NOT 0.5 because logprob is not null).
    expect(combineCalibrated(null, NaN)).toBe(0);
  });
});
