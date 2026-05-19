/**
 * Skill-promotion HARD gate tests.
 *
 * 8 promotion scenarios:
 *   - 4 approved (metrics pass + matching human approval)
 *   - 4 denied  (one of: metric threshold / missing approval / scope mismatch / quarantine)
 */

import { describe, it, expect } from 'vitest';
import { evaluateSkillPromotion } from '../skill-promotion-gate/index.js';
import type {
  SkillPromotionApproval,
  SkillPromotionApprovalPort,
  SkillPromotionCandidate,
} from '../types.js';

const TENANT = '22222222-2222-2222-2222-222222222222';

function candidate(overrides: Partial<SkillPromotionCandidate>): SkillPromotionCandidate {
  return Object.freeze({
    skillId: 'skill-1',
    scope: 'tenant',
    tenantId: TENANT,
    successfulRuns: 10,
    catastrophicFailures: 0,
    ownerFeedback: 'positive',
    proposedBy: 'brain',
    proposedAt: '2026-03-01T00:00:00.000Z',
    ...overrides,
  });
}

function tenantApproval(): SkillPromotionApproval {
  return Object.freeze({
    approverId: 'owner-1',
    approverRole: 'tenant-owner',
    approverScope: 'tenant',
    approvedAt: '2026-03-02T00:00:00.000Z',
    approvalNote: 'looks safe',
  });
}

function platformApproval(): SkillPromotionApproval {
  return Object.freeze({
    approverId: 'admin-1',
    approverRole: 'platform-admin',
    approverScope: 'platform',
    approvedAt: '2026-03-02T00:00:00.000Z',
    approvalNote: 'platform-wide',
  });
}

function port(approval: SkillPromotionApproval | null): SkillPromotionApprovalPort {
  return { findApproval: async () => approval };
}

describe('skill-promotion gate — 4 APPROVED scenarios', () => {
  it('tenant skill, all metrics pass, matching tenant-owner approval', async () => {
    const v = await evaluateSkillPromotion({
      candidate: candidate({}),
      approvals: port(tenantApproval()),
    });
    expect(v.kind).toBe('approve');
  });

  it('platform skill, all metrics pass, matching platform-admin approval', async () => {
    const v = await evaluateSkillPromotion({
      candidate: candidate({
        scope: 'platform',
        tenantId: null,
        ownerFeedback: 'neutral',
      }),
      approvals: port(platformApproval()),
    });
    expect(v.kind).toBe('approve');
  });

  it('tenant skill with many runs + positive feedback approved', async () => {
    const v = await evaluateSkillPromotion({
      candidate: candidate({ successfulRuns: 100 }),
      approvals: port(tenantApproval()),
    });
    expect(v.kind).toBe('approve');
  });

  it('platform skill with neutral feedback approved (platform tolerates neutral)', async () => {
    const v = await evaluateSkillPromotion({
      candidate: candidate({
        scope: 'platform',
        tenantId: null,
        ownerFeedback: 'neutral',
        successfulRuns: 25,
      }),
      approvals: port(platformApproval()),
    });
    expect(v.kind).toBe('approve');
  });
});

describe('skill-promotion gate — 4 DENIED scenarios', () => {
  it('insufficient successful runs → deny-metric-threshold', async () => {
    const v = await evaluateSkillPromotion({
      candidate: candidate({ successfulRuns: 5 }),
      approvals: port(tenantApproval()),
    });
    expect(v.kind).toBe('deny-metric-threshold');
  });

  it('any catastrophic failure (1) but below quarantine → deny-metric-threshold', async () => {
    const v = await evaluateSkillPromotion({
      candidate: candidate({ catastrophicFailures: 1 }),
      approvals: port(tenantApproval()),
    });
    expect(v.kind).toBe('deny-metric-threshold');
  });

  it('metrics pass but no human approval → deny-missing-human-approval', async () => {
    const v = await evaluateSkillPromotion({
      candidate: candidate({}),
      approvals: port(null),
    });
    expect(v.kind).toBe('deny-missing-human-approval');
  });

  it('tenant skill with platform-admin approval → deny-scope-mismatch', async () => {
    const v = await evaluateSkillPromotion({
      candidate: candidate({}),
      approvals: port(platformApproval()),
    });
    expect(v.kind).toBe('deny-scope-mismatch');
  });

  it('catastrophic failures > 3 → quarantine (precedes all other checks)', async () => {
    const v = await evaluateSkillPromotion({
      candidate: candidate({ catastrophicFailures: 4, successfulRuns: 100 }),
      approvals: port(tenantApproval()),
    });
    expect(v.kind).toBe('quarantine');
  });

  it('platform skill with tenant-owner approval → deny-scope-mismatch', async () => {
    const v = await evaluateSkillPromotion({
      candidate: candidate({
        scope: 'platform',
        tenantId: null,
        ownerFeedback: 'neutral',
      }),
      approvals: port(tenantApproval()),
    });
    expect(v.kind).toBe('deny-scope-mismatch');
  });
});
