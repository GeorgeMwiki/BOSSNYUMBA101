/**
 * skill-curation tests.
 *
 * Covers rule evaluation + auto-quarantine + HITL-gated promotion.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  evaluateSkill,
  runSkillCuration,
  PROMOTION_MIN_RUNS,
  PROMOTION_MIN_FEEDBACK_RATIO,
  QUARANTINE_CATASTROPHIC_FAILURES,
  QUARANTINE_CONFIDENCE_DROP_PCT,
  type SkillRegistryPort,
  type SkillPromotionGatePort,
  type SkillCurationPorts,
  type SkillRecord,
} from '../skill-curation/index.js';
import type { SkillLifecycle } from '../types.js';

const TENANT = '11111111-1111-1111-1111-111111111111';

function mkRegistry(records: SkillRecord[]): SkillRegistryPort & {
  __updates: Array<{ skillId: string; lifecycle: SkillLifecycle; reason: string }>;
} {
  const updates: Array<{
    skillId: string;
    lifecycle: SkillLifecycle;
    reason: string;
  }> = [];
  return {
    __updates: updates,
    listCurationCandidates: async () => records,
    setLifecycle: async (args) => {
      updates.push(args);
    },
  };
}

function mkGate(approveDefault = true): SkillPromotionGatePort & {
  __calls: number;
  setApprove: (b: boolean) => void;
} {
  let approve = approveDefault;
  let calls = 0;
  return {
    get __calls() {
      return calls;
    },
    setApprove: (b: boolean) => {
      approve = b;
    },
    requestPromotion: vi.fn(async () => {
      calls += 1;
      return approve;
    }),
  };
}

function mkPorts(opts: {
  registry: ReturnType<typeof mkRegistry>;
  gate?: ReturnType<typeof mkGate>;
}): SkillCurationPorts & {
  __registry: ReturnType<typeof mkRegistry>;
  __gate: ReturnType<typeof mkGate>;
} {
  const gate = opts.gate ?? mkGate(true);
  return {
    registry: opts.registry,
    gate,
    clock: () => new Date('2026-05-19T08:00:00Z'),
    __registry: opts.registry,
    __gate: gate,
  };
}

// ──────────────────── evaluateSkill rules ─────────────────────────

describe('evaluateSkill — quarantine triggers', () => {
  it('catastrophic failures ≥ threshold → quarantined', () => {
    const verdict = evaluateSkill({
      skillId: 's1',
      tenantId: TENANT,
      currentLifecycle: 'promoted',
      stats: {
        successfulRuns: 100,
        catastrophicFailures: QUARANTINE_CATASTROPHIC_FAILURES,
        positiveFeedbackRatio: 0.95,
        confidenceTrend: 0.05,
      },
    });
    expect(verdict.proposedLifecycle).toBe('quarantined');
    expect(verdict.gatedByHitl).toBe(false);
  });

  it('confidence trend < -20% → quarantined', () => {
    const verdict = evaluateSkill({
      skillId: 's2',
      tenantId: TENANT,
      currentLifecycle: 'promoted',
      stats: {
        successfulRuns: 100,
        catastrophicFailures: 0,
        positiveFeedbackRatio: 0.95,
        confidenceTrend: -0.25,
      },
    });
    expect(verdict.proposedLifecycle).toBe('quarantined');
    expect(verdict.gatedByHitl).toBe(false);
  });
});

describe('evaluateSkill — promotion (HITL-gated)', () => {
  it('draft + ≥10 runs + 0 catastrophic + ≥0.8 feedback → promoted (gated)', () => {
    const verdict = evaluateSkill({
      skillId: 's3',
      tenantId: TENANT,
      currentLifecycle: 'draft',
      stats: {
        successfulRuns: PROMOTION_MIN_RUNS,
        catastrophicFailures: 0,
        positiveFeedbackRatio: PROMOTION_MIN_FEEDBACK_RATIO,
        confidenceTrend: 0.05,
      },
    });
    expect(verdict.proposedLifecycle).toBe('promoted');
    expect(verdict.gatedByHitl).toBe(true); // M-F hard HITL required
  });

  it('draft + 9 runs (just below) → no promotion', () => {
    const verdict = evaluateSkill({
      skillId: 's4',
      tenantId: TENANT,
      currentLifecycle: 'draft',
      stats: {
        successfulRuns: PROMOTION_MIN_RUNS - 1,
        catastrophicFailures: 0,
        positiveFeedbackRatio: 0.9,
        confidenceTrend: 0.05,
      },
    });
    expect(verdict.proposedLifecycle).toBe('draft');
  });

  it('draft + feedback below 0.8 → no promotion', () => {
    const verdict = evaluateSkill({
      skillId: 's5',
      tenantId: TENANT,
      currentLifecycle: 'draft',
      stats: {
        successfulRuns: 50,
        catastrophicFailures: 0,
        positiveFeedbackRatio: 0.7,
        confidenceTrend: 0.05,
      },
    });
    expect(verdict.proposedLifecycle).toBe('draft');
  });

  it('promoted (already) + meets promotion bar → no change', () => {
    const verdict = evaluateSkill({
      skillId: 's6',
      tenantId: TENANT,
      currentLifecycle: 'promoted',
      stats: {
        successfulRuns: 100,
        catastrophicFailures: 0,
        positiveFeedbackRatio: 0.9,
        confidenceTrend: 0.02,
      },
    });
    expect(verdict.proposedLifecycle).toBe('promoted');
    expect(verdict.gatedByHitl).toBe(false);
  });
});

describe('threshold constants exposed', () => {
  it('PROMOTION_MIN_RUNS = 10', () => {
    expect(PROMOTION_MIN_RUNS).toBe(10);
  });
  it('PROMOTION_MIN_FEEDBACK_RATIO = 0.8', () => {
    expect(PROMOTION_MIN_FEEDBACK_RATIO).toBe(0.8);
  });
  it('QUARANTINE_CATASTROPHIC_FAILURES = 3', () => {
    expect(QUARANTINE_CATASTROPHIC_FAILURES).toBe(3);
  });
  it('QUARANTINE_CONFIDENCE_DROP_PCT = 0.2', () => {
    expect(QUARANTINE_CONFIDENCE_DROP_PCT).toBe(0.2);
  });
});

// ──────────────────── runSkillCuration ────────────────────────────

describe('runSkillCuration', () => {
  it('quarantines automatically without HITL', async () => {
    const registry = mkRegistry([
      mkSkill('s1', 'promoted', { catastrophicFailures: 5 }),
    ]);
    const ports = mkPorts({ registry });
    const result = await runSkillCuration(ports);
    expect(result.quarantined).toBe(1);
    expect(ports.__registry.__updates.length).toBe(1);
    expect(ports.__registry.__updates[0].lifecycle).toBe('quarantined');
    expect(ports.__gate.__calls).toBe(0); // no HITL for quarantine
  });

  it('promotion requires HITL approval — applies only when gate approves', async () => {
    const registry = mkRegistry([
      mkSkill('s1', 'draft', {
        successfulRuns: 50,
        catastrophicFailures: 0,
        positiveFeedbackRatio: 0.9,
      }),
    ]);
    const gate = mkGate(true);
    const ports = mkPorts({ registry, gate });
    const result = await runSkillCuration(ports);
    expect(result.promoted).toBe(1);
    expect(result.promotionsQueuedForHitl).toBe(0);
    expect(ports.__gate.__calls).toBe(1);
    expect(ports.__registry.__updates[0].lifecycle).toBe('promoted');
  });

  it('promotion BLOCKED when gate denies', async () => {
    const registry = mkRegistry([
      mkSkill('s1', 'draft', {
        successfulRuns: 50,
        catastrophicFailures: 0,
        positiveFeedbackRatio: 0.9,
      }),
    ]);
    const gate = mkGate(false);
    const ports = mkPorts({ registry, gate });
    const result = await runSkillCuration(ports);
    expect(result.promoted).toBe(0);
    expect(result.promotionsQueuedForHitl).toBe(1);
    expect(ports.__registry.__updates.length).toBe(0); // no registry write
  });

  it('mixed: 1 promote + 1 quarantine + 1 unchanged', async () => {
    const registry = mkRegistry([
      mkSkill('p1', 'draft', { successfulRuns: 50, positiveFeedbackRatio: 0.9 }),
      mkSkill('q1', 'promoted', { catastrophicFailures: 4 }),
      mkSkill('u1', 'draft', { successfulRuns: 3, positiveFeedbackRatio: 0.9 }),
    ]);
    const ports = mkPorts({ registry });
    const result = await runSkillCuration(ports);
    expect(result.evaluated).toBe(3);
    expect(result.promoted).toBe(1);
    expect(result.quarantined).toBe(1);
    expect(result.unchanged).toBe(1);
  });
});

function mkSkill(
  skillId: string,
  lifecycle: SkillLifecycle,
  overrides?: Partial<SkillRecord['stats']>,
): SkillRecord {
  return {
    skillId,
    tenantId: TENANT,
    lifecycle,
    stats: {
      successfulRuns: 0,
      catastrophicFailures: 0,
      positiveFeedbackRatio: 0,
      confidenceTrend: 0,
      ...overrides,
    },
  };
}
