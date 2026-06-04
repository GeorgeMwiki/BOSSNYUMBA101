/**
 * Reward-model tests. Verifies each component scorer + the weighted blend +
 * the [-1,1] clamp.
 */

import { describe, it, expect } from 'vitest';

import { scoreAction, rewardOf, DEFAULT_WEIGHTS } from './reward-model';
import type { ActionEvent, OutcomeEvent } from './types';

function action(): ActionEvent {
  return {
    id: 'a-1',
    kind: 'decide',
    capturedAt: '2026-06-03T00:00:00.000Z',
    actorId: 'mgr-1',
    actorTier: 'manager',
    payload: {},
  };
}

function outcome(overrides: Partial<OutcomeEvent> = {}): OutcomeEvent {
  return {
    id: 'o-1',
    actionRef: 'a-1',
    observedAt: '2026-06-03T00:05:00.000Z',
    ...overrides,
  };
}

describe('reward-model', () => {
  it('scores a clean SLA hit as neutral-to-positive', () => {
    const r = scoreAction({ action: action(), outcome: outcome({ slaHit: true }) });
    expect(r.components.sla).toBe(0); // on-time = 0
    expect(r.reward).toBe(0);
  });

  it('rewards an early SLA delivery', () => {
    const r = scoreAction({
      action: action(),
      outcome: outcome({ slaDelaySeconds: -300 }),
    });
    expect(r.components.sla).toBe(1);
    expect(r.reward).toBeGreaterThan(0);
  });

  it('saturates a hard SLA miss (slaHit false, no measured delay) at -1', () => {
    const r = scoreAction({
      action: action(),
      outcome: outcome({ slaHit: false }),
    });
    expect(r.components.sla).toBe(-1);
    expect(r.reward).toBeCloseTo(-DEFAULT_WEIGHTS.sla, 5);
  });

  it('penalises a manager override hard', () => {
    const r = scoreAction({
      action: action(),
      outcome: outcome({ managerOverride: true }),
    });
    expect(r.components.override).toBe(-1);
    expect(r.reward).toBeCloseTo(-DEFAULT_WEIGHTS.override, 5);
  });

  it('penalises an owner complaint + compliance finding', () => {
    const r = scoreAction({
      action: action(),
      outcome: outcome({ ownerComplaint: true, complianceFinding: true }),
    });
    expect(r.components.complaint).toBe(-1);
    expect(r.components.compliance).toBe(-1);
    expect(r.reward).toBeLessThan(0);
  });

  it('rewards under-budget cost, penalises over-budget', () => {
    const under = scoreAction({
      action: action(),
      outcome: outcome({ costMinor: 40, budgetMinor: 100 }),
    });
    expect(under.components.cost).toBe(0.5);
    const over = scoreAction({
      action: action(),
      outcome: outcome({ costMinor: 250, budgetMinor: 100 }),
    });
    expect(over.components.cost).toBe(-1);
  });

  it('clamps the blended reward to [-1, 1]', () => {
    const r = scoreAction({
      action: action(),
      outcome: outcome({
        slaDelaySeconds: 1200,
        managerOverride: true,
        ownerComplaint: true,
        complianceFinding: true,
        costMinor: 1000,
        budgetMinor: 100,
        explicitSatisfaction: -1,
      }),
    });
    expect(r.reward).toBeGreaterThanOrEqual(-1);
    expect(r.reward).toBeLessThanOrEqual(1);
  });

  it('rewardOf returns the scalar reward', () => {
    expect(rewardOf({ action: action(), outcome: outcome({ slaHit: true }) })).toBe(0);
  });

  it('returns 0 components when inputs are missing', () => {
    // @ts-expect-error — deliberately pass an empty input to test the guard.
    const r = scoreAction({ action: undefined, outcome: undefined });
    expect(r.reward).toBe(0);
  });
});
