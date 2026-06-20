/**
 * Fail-CLOSED governance-gate tests for createExecutor
 * (class-halfwired-dormant remediation).
 *
 *   1. A policy DENY (`authorized:false`) BLOCKS the step before any
 *      tool invocation, marks it failed, and audits `policy-denied`.
 *   2. `requiresApproval:true` with NO ApprovalGate wired fails CLOSED
 *      (the step is refused, the tool never runs) instead of silently
 *      falling through to autonomous execution.
 *
 * These two branches are the safety invariant: a missing/denying gate
 * must never authorize an action — the executor refuses, it does not
 * auto-execute.
 */
import { describe, it, expect } from 'vitest';
import {
  createExecutor,
  createInMemoryActionAuditSink,
} from '../executor/index.js';
import { createInMemoryGoalsPort } from '../goals/goal-tracker.js';
import {
  createActionToolRegistry,
  WORK_ORDER_CREATE_TOOL,
  type ActionToolDef,
} from '../action-tools/index.js';
import type { AutonomyPolicyPort } from '../executor/autonomy-policy.js';

/** Policy that hard-DENIES every action (`authorized:false`). */
function denyPolicy(): AutonomyPolicyPort {
  return {
    async decide() {
      return {
        authorized: false,
        requiresApproval: false,
        reason: 'denied-by-policy-stub',
      };
    },
  };
}

/** Policy that demands four-eye approval for every action. */
function approvalRequiredPolicy(): AutonomyPolicyPort {
  return {
    async decide() {
      return {
        authorized: true,
        requiresApproval: true,
        reason: 'requires-approval-stub',
      };
    },
  };
}

/** Wraps WORK_ORDER_CREATE_TOOL so the test can count invocations. */
function trackingTool(counter: { n: number }): ActionToolDef {
  return {
    ...WORK_ORDER_CREATE_TOOL,
    async invoke(input, ctx) {
      counter.n += 1;
      return WORK_ORDER_CREATE_TOOL.invoke(input as never, ctx);
    },
  };
}

const woStep = {
  seq: 0,
  description: 'create work order',
  toolName: 'work-order.create',
  toolPayload: {
    propertyId: 'P1',
    unitId: 'U1',
    description: 'leak',
    priority: 'medium' as const,
  },
};

describe('createExecutor — fail-closed governance gates', () => {
  it('policy DENY (authorized:false) blocks the step, no tool invocation', async () => {
    const goals = createInMemoryGoalsPort();
    const tools = createActionToolRegistry();
    const counter = { n: 0 };
    tools.register(trackingTool(counter));
    const auditSink = createInMemoryActionAuditSink();
    const exec = createExecutor({
      goals,
      tools,
      auditSink,
      autonomyPolicy: denyPolicy(),
    });

    const { id } = await goals.open({
      tenantId: 't',
      userId: 'u',
      threadId: 'th',
      title: 'denied',
      description: '',
      status: 'active',
      priority: 'medium',
      steps: [woStep],
    });

    const out = await exec.executeGoal(id);

    expect(out.stepsFailed).toBe(1);
    expect(out.stepsSucceeded).toBe(0);
    // The denied tool must NEVER run.
    expect(counter.n).toBe(0);
    const g = await goals.get(id);
    expect(g?.steps[0]?.status).toBe('failed');
    const outcomes = auditSink.entries.map((e) => e.outcome);
    expect(outcomes).toContain('policy-denied');
    expect(out.failureMessages.join(' ')).toContain('policy denied');
  });

  it('requiresApproval:true with NO ApprovalGate fails closed (no auto-execute)', async () => {
    const goals = createInMemoryGoalsPort();
    const tools = createActionToolRegistry();
    const counter = { n: 0 };
    tools.register(trackingTool(counter));
    const auditSink = createInMemoryActionAuditSink();
    // NOTE: deliberately NO approvalGate wired.
    const exec = createExecutor({
      goals,
      tools,
      auditSink,
      autonomyPolicy: approvalRequiredPolicy(),
    });

    const { id } = await goals.open({
      tenantId: 't',
      userId: 'u',
      threadId: 'th',
      title: 'unbound-gate',
      description: '',
      status: 'active',
      priority: 'medium',
      steps: [woStep],
    });

    const out = await exec.executeGoal(id);

    expect(out.stepsFailed).toBe(1);
    expect(out.stepsAwaitingApproval).toBe(0);
    // A missing gate must refuse the step, never auto-execute.
    expect(counter.n).toBe(0);
    const g = await goals.get(id);
    expect(g?.steps[0]?.status).toBe('failed');
    const outcomes = auditSink.entries.map((e) => e.outcome);
    expect(outcomes).toContain('approval-gate-unbound');
  });
});
