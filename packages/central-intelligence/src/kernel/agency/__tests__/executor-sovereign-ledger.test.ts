/**
 * Executor — sovereign action ledger integration tests (K7 wave-K).
 *
 * The executor must append a hash-chained ledger entry for every
 * sovereign-tier tool invocation (success AND failure). Non-sovereign
 * invocations must NOT touch the ledger. A missing or throwing ledger
 * port must NEVER bring down the executor itself.
 *
 * Sovereign-tier discrimination is dual:
 *   1. `tool.stakes === 'critical'`, OR
 *   2. `tool.name` appears in `SOVEREIGN_TIER_ACTION_NAMES`.
 *
 * Coverage:
 *   1. Sovereign-tier (critical-stakes) success → 1 ledger entry,
 *      payload.outcome = 'success'.
 *   2. Sovereign-tier (deny-list name) failure → 1 ledger entry,
 *      payload.outcome = 'failure', payload.error set.
 *   3. Non-sovereign tier → ledger UNTOUCHED.
 *   4. Missing `sovereignLedger` dep → executor runs, no throw, no write.
 *   5. Ledger `appendLedgerEntry` throws → executor still records the
 *      goal/audit transitions; the error is logged via `deps.logger`.
 *   6. Multi-step sequence of sovereign successes appends one ledger
 *      entry per step in invocation order.
 *   7. `isSovereignTier` helper agrees with the executor's behaviour
 *      for both discriminator paths.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  createExecutor,
  createInMemoryActionAuditSink,
  isSovereignTier,
  SOVEREIGN_TIER_ACTION_NAMES,
  type SovereignActionLedgerPort,
} from '../executor/index.js';
import { createInMemoryGoalsPort } from '../goals/goal-tracker.js';
import {
  createActionToolRegistry,
  type ActionToolDef,
} from '../action-tools/index.js';

interface CapturedLedgerCall {
  readonly tenantId: string;
  readonly actionType: string;
  readonly payloadJson: Record<string, unknown>;
  readonly proposer: string;
  readonly approvers: ReadonlyArray<string>;
  readonly executedAt: Date;
}

interface RecordingLedger extends SovereignActionLedgerPort {
  readonly calls: ReadonlyArray<CapturedLedgerCall>;
}

function recordingLedger(): RecordingLedger {
  const calls: CapturedLedgerCall[] = [];
  return {
    calls,
    async appendLedgerEntry(args) {
      calls.push({
        tenantId: args.tenantId,
        actionType: args.actionType,
        payloadJson: args.payloadJson,
        proposer: args.proposer,
        approvers: args.approvers,
        executedAt: args.executedAt,
      });
      return { id: `led_${calls.length}`, thisHash: 'hash', prevHash: 'prev' };
    },
  };
}

function throwingLedger(): SovereignActionLedgerPort {
  return {
    async appendLedgerEntry() {
      throw new Error('ledger down');
    },
  };
}

function criticalStakesTool(name = 'critical.tool'): ActionToolDef<
  Record<string, unknown>,
  { id: string }
> {
  return {
    name,
    description: 'Critical-stakes tool used to exercise the sovereign ledger.',
    stakes: 'critical',
    inputSchema: {},
    async invoke() {
      return { ok: true as const, output: { id: 'out_1' } };
    },
  };
}

function denyListNamedTool(): ActionToolDef<
  Record<string, unknown>,
  { id: string }
> {
  // Use the first deny-list entry — stake intentionally NOT critical so
  // the deny-list path is the only thing that flips this to sovereign.
  return {
    name: 'tenant-eviction-proposed',
    description: 'Deny-listed sovereign-tier action with non-critical stakes.',
    stakes: 'high',
    inputSchema: {},
    async invoke() {
      return { ok: false as const, message: 'eviction service unavailable' };
    },
  };
}

function lowStakesTool(): ActionToolDef<Record<string, unknown>, { id: string }> {
  return {
    name: 'rent.send-reminder-stub',
    description: 'Low-stakes tool — must NOT hit the ledger.',
    stakes: 'low',
    inputSchema: {},
    async invoke() {
      return { ok: true as const, output: { id: 'r_1' } };
    },
  };
}

describe('createExecutor — sovereign action ledger', () => {
  beforeEachSilenceConsole();

  it('isSovereignTier flags critical stakes AND deny-list names', () => {
    expect(isSovereignTier({ name: 'arbitrary', stakes: 'critical' })).toBe(true);
    expect(
      isSovereignTier({ name: 'tenant-eviction-proposed', stakes: 'high' }),
    ).toBe(true);
    expect(
      isSovereignTier({ name: 'rent.send-reminder', stakes: 'low' }),
    ).toBe(false);
    expect(SOVEREIGN_TIER_ACTION_NAMES.length).toBeGreaterThan(0);
  });

  it('sovereign-tier critical-stakes success writes one ledger entry', async () => {
    const goals = createInMemoryGoalsPort();
    const tools = createActionToolRegistry();
    const ledger = recordingLedger();
    const tool = criticalStakesTool('owner-payout-executed');
    tools.register(tool);

    const exec = createExecutor({
      goals,
      tools,
      auditSink: createInMemoryActionAuditSink(),
      sovereignLedger: ledger,
    });
    const { id } = await goals.open({
      tenantId: 't1',
      userId: 'u1',
      threadId: 'th',
      title: 'sov-success',
      description: '',
      status: 'active',
      priority: 'high',
      steps: [
        {
          seq: 0,
          description: 'payout',
          toolName: tool.name,
          toolPayload: { ownerId: 'o_1', amountMinor: 100000 },
        },
      ],
    });
    const out = await exec.executeGoal(id);
    expect(out.stepsSucceeded).toBe(1);
    expect(ledger.calls).toHaveLength(1);
    const entry = ledger.calls[0];
    expect(entry?.tenantId).toBe('t1');
    expect(entry?.actionType).toBe(tool.name);
    expect(entry?.proposer).toBe('u1');
    expect(entry?.approvers).toEqual([]);
    expect(entry?.payloadJson.outcome).toBe('success');
    expect(entry?.payloadJson.input).toEqual({ ownerId: 'o_1', amountMinor: 100000 });
    expect(entry?.payloadJson.output).toEqual({ id: 'out_1' });
    expect(entry?.payloadJson.error).toBeUndefined();
    expect(entry?.executedAt).toBeInstanceOf(Date);
  });

  it('sovereign-tier failure (deny-list name) writes one failure entry', async () => {
    const goals = createInMemoryGoalsPort();
    const tools = createActionToolRegistry();
    const ledger = recordingLedger();
    const tool = denyListNamedTool();
    tools.register(tool);

    const exec = createExecutor({
      goals,
      tools,
      auditSink: createInMemoryActionAuditSink(),
      sovereignLedger: ledger,
    });
    const { id } = await goals.open({
      tenantId: 't2',
      userId: 'u2',
      threadId: 'th2',
      title: 'sov-fail',
      description: '',
      status: 'active',
      priority: 'critical',
      steps: [
        {
          seq: 0,
          description: 'propose eviction',
          toolName: tool.name,
          toolPayload: { leaseId: 'l_1' },
        },
      ],
    });
    const out = await exec.executeGoal(id);
    expect(out.stepsFailed).toBe(1);
    expect(ledger.calls).toHaveLength(1);
    const entry = ledger.calls[0];
    expect(entry?.actionType).toBe('tenant-eviction-proposed');
    expect(entry?.payloadJson.outcome).toBe('failure');
    expect(entry?.payloadJson.error).toBe('eviction service unavailable');
    expect(entry?.payloadJson.output).toBeNull();
  });

  it('non-sovereign tool invocation does NOT write to the ledger', async () => {
    const goals = createInMemoryGoalsPort();
    const tools = createActionToolRegistry();
    const ledger = recordingLedger();
    const tool = lowStakesTool();
    tools.register(tool);

    const exec = createExecutor({
      goals,
      tools,
      auditSink: createInMemoryActionAuditSink(),
      sovereignLedger: ledger,
    });
    const { id } = await goals.open({
      tenantId: 't3',
      userId: 'u3',
      threadId: 'th3',
      title: 'non-sov',
      description: '',
      status: 'active',
      priority: 'low',
      steps: [
        {
          seq: 0,
          description: 'send reminder',
          toolName: tool.name,
          toolPayload: { leaseId: 'l_2' },
        },
      ],
    });
    const out = await exec.executeGoal(id);
    expect(out.stepsSucceeded).toBe(1);
    expect(ledger.calls).toHaveLength(0);
  });

  it('missing sovereignLedger dep → no write, no throw (degraded path)', async () => {
    const goals = createInMemoryGoalsPort();
    const tools = createActionToolRegistry();
    const tool = criticalStakesTool('kra-mri-filed');
    tools.register(tool);

    const exec = createExecutor({
      goals,
      tools,
      auditSink: createInMemoryActionAuditSink(),
      // sovereignLedger intentionally omitted
    });
    const { id } = await goals.open({
      tenantId: 't4',
      userId: 'u4',
      threadId: 'th4',
      title: 'no-ledger-dep',
      description: '',
      status: 'active',
      priority: 'critical',
      steps: [
        {
          seq: 0,
          description: 'file mri',
          toolName: tool.name,
          toolPayload: { month: '2026-04' },
        },
      ],
    });
    const out = await exec.executeGoal(id);
    expect(out.stepsSucceeded).toBe(1);
  });

  it('ledger write error swallowed; executor still completes the step', async () => {
    const goals = createInMemoryGoalsPort();
    const tools = createActionToolRegistry();
    const tool = criticalStakesTool('gepg-control-number-revoked');
    tools.register(tool);
    const logged: Array<{ obj: Record<string, unknown>; msg?: string }> = [];

    const exec = createExecutor({
      goals,
      tools,
      auditSink: createInMemoryActionAuditSink(),
      sovereignLedger: throwingLedger(),
      logger: {
        error: (obj, msg) => logged.push({ obj, msg }),
      },
    });
    const { id } = await goals.open({
      tenantId: 't5',
      userId: 'u5',
      threadId: 'th5',
      title: 'ledger-error',
      description: '',
      status: 'active',
      priority: 'critical',
      steps: [
        {
          seq: 0,
          description: 'revoke cn',
          toolName: tool.name,
          toolPayload: { controlNumber: '999' },
        },
      ],
    });
    const out = await exec.executeGoal(id);
    expect(out.stepsSucceeded).toBe(1);
    expect(out.stepsFailed).toBe(0);
    expect(logged).toHaveLength(1);
    expect(logged[0]?.obj.actionType).toBe('gepg-control-number-revoked');
    expect(logged[0]?.obj.err).toMatch(/ledger down/);
  });

  it('multi-step sovereign sequence appends one ledger entry per step', async () => {
    const goals = createInMemoryGoalsPort();
    const tools = createActionToolRegistry();
    const ledger = recordingLedger();
    const tool = criticalStakesTool('market-rate-band-overridden');
    tools.register(tool);

    const exec = createExecutor({
      goals,
      tools,
      auditSink: createInMemoryActionAuditSink(),
      sovereignLedger: ledger,
    });
    const { id } = await goals.open({
      tenantId: 't6',
      userId: 'u6',
      threadId: 'th6',
      title: 'multi-sov',
      description: '',
      status: 'active',
      priority: 'critical',
      steps: [
        {
          seq: 0,
          description: 'override A',
          toolName: tool.name,
          toolPayload: { unitId: 'A' },
        },
        {
          seq: 1,
          description: 'override B',
          toolName: tool.name,
          toolPayload: { unitId: 'B' },
        },
      ],
    });
    const out = await exec.executeGoal(id);
    expect(out.stepsSucceeded).toBe(2);
    expect(ledger.calls).toHaveLength(2);
    expect(ledger.calls[0]?.payloadJson.input).toEqual({ unitId: 'A' });
    expect(ledger.calls[1]?.payloadJson.input).toEqual({ unitId: 'B' });
    // Verify executedAt monotonic — chain ordering will be derived from
    // executedAt server-side; the executor must call the ledger in step
    // order so the hash chain has a stable backstop.
    expect(
      (ledger.calls[1]?.executedAt.getTime() ?? 0) >=
        (ledger.calls[0]?.executedAt.getTime() ?? 0),
    ).toBe(true);
  });
});

function beforeEachSilenceConsole(): void {
  // Silence console.error from the executor's own swallowed-error logs
  // so the test output stays clean.
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
}
