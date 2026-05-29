/**
 * Mwikila handler-runtime — orchestration tests.
 *
 * Verifies that the runtime correctly:
 *   - skips null proposals
 *   - calls inviolable-rails with the right descriptor
 *   - falls through to recorder.recordBlocked on a rail block
 *   - falls through to recorder.recordAction on a pass
 *   - threads domesticCurrency from resolveDomesticCurrency port
 *   - threads killSwitchOpen from isKillSwitchOpen port
 */

import { describe, expect, it } from 'vitest';

import {
  createMwikilaHandlerRuntime,
  type MwikilaHandler,
} from '../handler-runtime.js';
import type {
  MwikilaDelegationStore,
} from '../delegation-store.js';
import type {
  MwikilaInboxRecorder,
} from '../inbox-recorder.js';

interface RecorderCallLog {
  actionCalls: Array<Record<string, unknown>>;
  blockedCalls: Array<Record<string, unknown>>;
}

function makeRecorder(): {
  recorder: MwikilaInboxRecorder;
  log: RecorderCallLog;
} {
  const log: RecorderCallLog = { actionCalls: [], blockedCalls: [] };
  const recorder: MwikilaInboxRecorder = {
    async recordAction(input) {
      log.actionCalls.push({ ...input });
      return makeInboxRow(input.actionKind, 'executed');
    },
    async recordBlocked(input) {
      log.blockedCalls.push({ ...input });
      return makeInboxRow(input.actionKind, 'blocked_by_inviolable');
    },
    async approveProposal() {
      return makeInboxRow('x', 'owner_approved');
    },
    async denyProposal() {
      return makeInboxRow('x', 'owner_denied');
    },
    async reverseExecution() {
      return makeInboxRow('x', 'reversed');
    },
    async listPending() {
      return [];
    },
    async listRecent() {
      return [];
    },
  };
  return { recorder, log };
}

function makeInboxRow(
  actionKind: string,
  status: 'executed' | 'proposed' | 'blocked_by_inviolable' | 'owner_approved' | 'owner_denied' | 'reversed',
) {
  return Object.freeze({
    id: 'row-1',
    tenantId: 'tnt-1',
    actingOnUserId: 'usr-1',
    actionKind,
    category: 'rent-scheduling' as const,
    delegationTier: 'T2' as const,
    status,
    summary: 's',
    summarySw: 's',
    rationale: 'r',
    payload: {},
    reversalToken: null,
    reversalUntil: null,
    proposedAt: '2026-05-29T00:00:00Z',
    proposalTtlAt: null,
    executedAt: null,
    ownerReviewedAt: null,
    ownerReviewedBy: null,
    reversedAt: null,
    committedAt: null,
    auditChainHash: null,
    decisionId: null,
    blockedReason: null,
    provenance: {},
    createdAt: '2026-05-29T00:00:00Z',
    updatedAt: '2026-05-29T00:00:00Z',
  });
}

function makeDelegationStore(
  tier: 'T0' | 'T1' | 'T2' | 'T3' = 'T2',
  envelopeThreshold: number | null = null,
): MwikilaDelegationStore {
  return {
    async list() {
      return [];
    },
    async get() {
      return null;
    },
    async resolve({ category }) {
      return Object.freeze({
        category,
        tier,
        reversalWindowHours: 24,
        envelopeThreshold,
        envelopeThresholdCurrency: 'TZS',
        source: 'owner' as const,
      });
    },
    async upsert() {
      throw new Error('not used in test');
    },
  };
}

const NOW = new Date('2026-05-29T12:00:00Z');

function makeHandler(
  proposal: ReturnType<MwikilaHandler['propose']> extends Promise<infer T> ? T : never,
): MwikilaHandler {
  return Object.freeze({
    actionKind: 'rent.next_period_invoice_draft',
    category: 'rent-scheduling',
    async propose() {
      return proposal;
    },
  });
}

describe('handler-runtime — null proposal short-circuits', () => {
  it('returns null without touching the recorder', async () => {
    const { recorder, log } = makeRecorder();
    const runtime = createMwikilaHandlerRuntime({
      recorder,
      delegations: makeDelegationStore(),
      now: () => NOW,
    });
    const out = await runtime.run({
      tenantId: 'tnt-1',
      actingOnUserId: 'usr-1',
      handler: makeHandler(null),
    });
    expect(out).toBeNull();
    expect(log.actionCalls.length).toBe(0);
    expect(log.blockedCalls.length).toBe(0);
  });
});

describe('handler-runtime — kill-switch blocks before recording', () => {
  it('records as blocked when kill-switch is open', async () => {
    const { recorder, log } = makeRecorder();
    const runtime = createMwikilaHandlerRuntime({
      recorder,
      delegations: makeDelegationStore(),
      isKillSwitchOpen: () => true,
      now: () => NOW,
    });
    await runtime.run({
      tenantId: 'tnt-1',
      actingOnUserId: 'usr-1',
      handler: makeHandler({
        actionKind: 'rent.next_period_invoice_draft',
        category: 'rent-scheduling',
        summary: 's',
        summarySw: 's',
        rationale: 'r',
        payload: {},
      }),
    });
    expect(log.blockedCalls.length).toBe(1);
    expect(log.blockedCalls[0]!['blockedReason']).toBe('kill_switch_open');
  });
});

describe('handler-runtime — envelope-exceeded blocks payroll', () => {
  it('records as blocked when amount > envelope', async () => {
    const { recorder, log } = makeRecorder();
    const runtime = createMwikilaHandlerRuntime({
      recorder,
      delegations: makeDelegationStore('T2', 100_000),
      now: () => NOW,
    });
    await runtime.run({
      tenantId: 'tnt-1',
      actingOnUserId: 'usr-1',
      handler: makeHandler({
        actionKind: 'payroll.monthly_batch_prep',
        category: 'payroll-prep',
        summary: 's',
        summarySw: 's',
        rationale: 'r',
        payload: {},
        amount: 1_000_000,
        currency: 'TZS',
        targetRelation: 'staff',
      }),
    });
    expect(log.blockedCalls.length).toBe(1);
    expect(log.blockedCalls[0]!['blockedReason']).toBe('envelope_exceeded');
  });
});

describe('handler-runtime — passing proposal records action', () => {
  it('records action with resolved tier + reversal window', async () => {
    const { recorder, log } = makeRecorder();
    const runtime = createMwikilaHandlerRuntime({
      recorder,
      delegations: makeDelegationStore('T2', 5_000_000),
      now: () => NOW,
    });
    await runtime.run({
      tenantId: 'tnt-1',
      actingOnUserId: 'usr-1',
      handler: makeHandler({
        actionKind: 'rent.next_period_invoice_draft',
        category: 'rent-scheduling',
        summary: 's',
        summarySw: 's',
        rationale: 'r',
        payload: {},
        amount: 0,
        currency: 'TZS',
      }),
    });
    expect(log.actionCalls.length).toBe(1);
    expect(log.actionCalls[0]!['delegationTier']).toBe('T2');
    expect(log.actionCalls[0]!['reversalWindowHours']).toBe(24);
  });
});

describe('handler-runtime — domesticCurrency threading', () => {
  it('blocks non-domestic payroll when port returns a different currency', async () => {
    const { recorder, log } = makeRecorder();
    const runtime = createMwikilaHandlerRuntime({
      recorder,
      delegations: makeDelegationStore('T2', 5_000_000),
      resolveDomesticCurrency: () => 'KES',
      now: () => NOW,
    });
    await runtime.run({
      tenantId: 'tnt-1',
      actingOnUserId: 'usr-1',
      handler: makeHandler({
        actionKind: 'payroll.monthly_batch_prep',
        category: 'payroll-prep',
        summary: 's',
        summarySw: 's',
        rationale: 'r',
        payload: {},
        amount: 100_000,
        currency: 'USD',
        targetRelation: 'staff',
      }),
    });
    expect(log.blockedCalls[0]!['blockedReason']).toBe('non_domestic_currency');
  });
});

describe('handler-runtime — evictions are categorically refused', () => {
  it('blocks evictions-initial-notice even at T3', async () => {
    const { recorder, log } = makeRecorder();
    const runtime = createMwikilaHandlerRuntime({
      recorder,
      delegations: makeDelegationStore('T3', 5_000_000),
      now: () => NOW,
    });
    await runtime.run({
      tenantId: 'tnt-1',
      actingOnUserId: 'usr-1',
      handler: makeHandler({
        actionKind: 'eviction.initial_notice',
        category: 'evictions-initial-notice',
        summary: 's',
        summarySw: 's',
        rationale: 'r',
        payload: {},
        targetRelation: 'tenant',
      }),
    });
    expect(log.blockedCalls[0]!['blockedReason']).toBe(
      'eviction_autonomy_refused',
    );
  });
});
