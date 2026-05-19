/**
 * Boundary detector — 3 borderline in a row escalates to plan mode.
 */

import { describe, it, expect } from 'vitest';
import {
  advanceBoundaryState,
  resetBoundaryState,
  INITIAL_BOUNDARY_STATE,
} from '../boundary-detector.js';

describe('boundary-detector', () => {
  it('initial state has zero streak + no fallback', () => {
    expect(INITIAL_BOUNDARY_STATE.borderlineStreak).toBe(0);
    expect(INITIAL_BOUNDARY_STATE.inPlanModeFallback).toBe(false);
  });

  it('safe verdict resets streak', () => {
    const s1 = advanceBoundaryState(INITIAL_BOUNDARY_STATE, 'borderline');
    expect(s1.borderlineStreak).toBe(1);
    const s2 = advanceBoundaryState(s1, 'safe');
    expect(s2.borderlineStreak).toBe(0);
    expect(s2.inPlanModeFallback).toBe(false);
  });

  it('unsafe verdict resets streak (but does not engage fallback by itself)', () => {
    const s1 = advanceBoundaryState(INITIAL_BOUNDARY_STATE, 'borderline');
    const s2 = advanceBoundaryState(s1, 'unsafe');
    expect(s2.borderlineStreak).toBe(0);
    expect(s2.inPlanModeFallback).toBe(false);
  });

  it('3 borderline in a row engages plan-mode fallback', () => {
    let s = INITIAL_BOUNDARY_STATE;
    s = advanceBoundaryState(s, 'borderline');
    expect(s.inPlanModeFallback).toBe(false);
    s = advanceBoundaryState(s, 'borderline');
    expect(s.inPlanModeFallback).toBe(false);
    s = advanceBoundaryState(s, 'borderline');
    expect(s.borderlineStreak).toBe(3);
    expect(s.inPlanModeFallback).toBe(true);
  });

  it('respects a custom threshold', () => {
    let s = INITIAL_BOUNDARY_STATE;
    s = advanceBoundaryState(s, 'borderline', { threshold: 2 });
    expect(s.inPlanModeFallback).toBe(false);
    s = advanceBoundaryState(s, 'borderline', { threshold: 2 });
    expect(s.inPlanModeFallback).toBe(true);
  });

  it('fallback stays sticky once engaged until reset', () => {
    let s = INITIAL_BOUNDARY_STATE;
    s = advanceBoundaryState(s, 'borderline');
    s = advanceBoundaryState(s, 'borderline');
    s = advanceBoundaryState(s, 'borderline');
    expect(s.inPlanModeFallback).toBe(true);
    s = advanceBoundaryState(s, 'safe');
    expect(s.borderlineStreak).toBe(0);
    expect(s.inPlanModeFallback).toBe(true);
    s = resetBoundaryState();
    expect(s.inPlanModeFallback).toBe(false);
  });

  it('returns frozen objects', () => {
    const s = advanceBoundaryState(INITIAL_BOUNDARY_STATE, 'borderline');
    expect(Object.isFrozen(s)).toBe(true);
  });
});
