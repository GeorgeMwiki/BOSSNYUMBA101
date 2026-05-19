/**
 * confidence-monitor — threshold tripping + sticky semantics + window
 * rolling.
 */

import { describe, it, expect } from 'vitest';
import {
  advanceSafeModeState,
  resetSafeModeState,
} from '../confidence-monitor.js';
import { DEFAULT_THRESHOLDS, INITIAL_SAFE_MODE_STATE } from '../types.js';

const lowSample = {
  perplexity: 0.3,
  toolFailure: false,
  borderlineStreak: 0,
};

describe('advanceSafeModeState — base case', () => {
  it('does not trip with calm signals', () => {
    const r = advanceSafeModeState({
      prev: INITIAL_SAFE_MODE_STATE,
      sample: lowSample,
    });
    expect(r.state.tripped).toBe(false);
    expect(r.justTripped).toBe(false);
    expect(r.reasons).toEqual([]);
  });

  it('trips with 2 of 3 signals high (perplexity + borderline)', () => {
    const r = advanceSafeModeState({
      prev: INITIAL_SAFE_MODE_STATE,
      sample: {
        perplexity: 0.9,
        toolFailure: false,
        borderlineStreak: 3,
      },
    });
    expect(r.state.tripped).toBe(true);
    expect(r.justTripped).toBe(true);
    expect(r.reasons.length).toBe(2);
  });

  it('does NOT trip with only 1 signal', () => {
    const r = advanceSafeModeState({
      prev: INITIAL_SAFE_MODE_STATE,
      sample: {
        perplexity: 0.9,
        toolFailure: false,
        borderlineStreak: 0,
      },
    });
    expect(r.state.tripped).toBe(false);
  });

  it('trips after enough failures accumulate (failure-rate signal)', () => {
    let state = INITIAL_SAFE_MODE_STATE;
    // Window size 5; rate ceiling 0.4 -> need 3 failures in 5 = 0.6
    const failing = {
      perplexity: 0.9, // also high perplexity so we cross 2/3
      toolFailure: true,
      borderlineStreak: 0,
    };
    for (let i = 0; i < 3; i++) {
      const r = advanceSafeModeState({ prev: state, sample: failing });
      state = r.state;
    }
    expect(state.tripped).toBe(true);
  });
});

describe('advanceSafeModeState — stickiness + reset', () => {
  it('stays tripped on subsequent calm samples', () => {
    let state = advanceSafeModeState({
      prev: INITIAL_SAFE_MODE_STATE,
      sample: { perplexity: 0.9, toolFailure: true, borderlineStreak: 3 },
    }).state;
    expect(state.tripped).toBe(true);

    const after = advanceSafeModeState({
      prev: state,
      sample: lowSample,
    });
    expect(after.state.tripped).toBe(true);
    expect(after.justTripped).toBe(false);
  });

  it('resetSafeModeState returns initial', () => {
    let state = advanceSafeModeState({
      prev: INITIAL_SAFE_MODE_STATE,
      sample: { perplexity: 0.9, toolFailure: true, borderlineStreak: 3 },
    }).state;
    expect(state.tripped).toBe(true);
    state = resetSafeModeState();
    expect(state.tripped).toBe(false);
    expect(state.window.length).toBe(0);
  });
});

describe('advanceSafeModeState — windowing', () => {
  it('caps the window at windowSize', () => {
    let state = INITIAL_SAFE_MODE_STATE;
    for (let i = 0; i < 10; i++) {
      state = advanceSafeModeState({
        prev: state,
        sample: { perplexity: 0.1, toolFailure: false, borderlineStreak: 0 },
      }).state;
    }
    expect(state.window.length).toBe(DEFAULT_THRESHOLDS.windowSize);
  });

  it('respects custom thresholds', () => {
    const r = advanceSafeModeState({
      prev: INITIAL_SAFE_MODE_STATE,
      sample: { perplexity: 0.5, toolFailure: false, borderlineStreak: 1 },
      thresholds: {
        perplexityCeiling: 0.3,
        borderlineStreakCeiling: 1,
        minTrippedSignals: 2,
      },
    });
    expect(r.state.tripped).toBe(true);
  });

  it('returns frozen state', () => {
    const r = advanceSafeModeState({
      prev: INITIAL_SAFE_MODE_STATE,
      sample: lowSample,
    });
    expect(Object.isFrozen(r.state)).toBe(true);
  });
});
