/**
 * Phase K-B integration tests.
 *
 * These exercise modules together to cover the contract the kernel
 * relies on:
 *
 *   1. classify(borderline) -> AskUserQuestion -> typed answer
 *   2. classify(unsafe) -> deny + recommend plan mode
 *   3. 3 borderlines in a row -> plan-mode fallback engages
 *   4. canUseTool sees a persisted rule -> short-circuits policy
 *   5. accepted PermissionUpdate suggestion -> persisted rule
 *   6. emitReceipt -> renderReceiptCard -> schema-validated
 *   7. full action -> receipt -> undo -> rollback receipt -> ledger
 *   8. safe-mode trips -> message has three buttons + reasons
 *   9. take-over choice -> pause-agent next step
 *  10. terminal-state action -> undo button disabled in card
 */

import { describe, it, expect } from 'vitest';
import {
  classifyAction,
  InMemoryVerdictCache,
  verdictToAction,
  advanceBoundaryState,
  INITIAL_BOUNDARY_STATE,
  type ClassifierPort,
  type ClassifierVerdict,
} from '../auto-mode/index.js';
import {
  AskUserQuestionInputSchema,
  marshalAnswer,
  type AskUserQuestionInput,
  type AnswerEnvelope,
} from '../ask-user-question/index.js';
import {
  createCanUseTool,
  InMemoryPermissionRuleStore,
  persistPermissionUpdate,
  type CanUseToolContext,
  type CanUseToolFn,
} from '../permission-callback/index.js';
import {
  emitReceipt,
  emitTerminalReceipt,
  executeRollback,
  InMemoryReceiptStore,
  InMemorySovereignLedger,
  renderReceiptCard,
  ReceiptCardPartSchema,
  type InverseExecutorPort,
} from '../action-receipts/index.js';
import {
  advanceSafeModeState,
  buildSafeModeMessage,
  resolveSafeModeChoice,
  INITIAL_SAFE_MODE_STATE,
} from '../safe-mode/index.js';

const CTX: CanUseToolContext = {
  tenantId: 't1',
  userId: 'u1',
  sessionId: 's1',
};

function mkPort(v: ClassifierVerdict): ClassifierPort {
  return { async classify() { return v; } };
}

describe('K-B integration', () => {
  it('1. classify(borderline) flows into AskUserQuestion + typed answer', async () => {
    const verdict: ClassifierVerdict = {
      verdict: 'borderline',
      reason: 'late-fee on one tenant — confirm',
      recommendPlanMode: false,
    };
    const r = await classifyAction(
      {
        toolName: 'apply_late_fee',
        args: { tenancyId: 'tn1', feeKesCents: 50_000 },
        tier: 'billing',
        recentTurns: ['Asha is 3 days late'],
        statedBoundaries: [],
        tenantId: 't1',
      },
      { port: mkPort(verdict), cache: new InMemoryVerdictCache() },
    );
    expect(verdictToAction(r)).toBe('ask-owner');

    // Build the typed question + parse the typed answer:
    const q: AskUserQuestionInput = {
      questions: [
        {
          id: 'q-late',
          question: 'Apply KES 500 late fee to Asha?',
          options: [
            { id: 'yes', label: 'Apply now' },
            { id: 'no', label: 'Skip' },
          ],
        },
      ],
    };
    expect(AskUserQuestionInputSchema.safeParse(q).success).toBe(true);

    const a: AnswerEnvelope = {
      answers: [{ questionId: 'q-late', selectedOptionIds: ['yes'] }],
    };
    const marshal = marshalAnswer(q, a);
    expect(marshal.ok).toBe(true);
    if (marshal.ok) expect(marshal.text).toContain('Apply now');
  });

  it('2. classify(unsafe) -> deny + recommend plan mode', async () => {
    const v: ClassifierVerdict = {
      verdict: 'unsafe',
      reason: 'mass-comm overlaps stated boundary',
      recommendPlanMode: true,
    };
    const r = await classifyAction(
      {
        toolName: 'send_sms_blast',
        args: { audience: 'all' },
        tier: 'external-comm',
        recentTurns: [],
        statedBoundaries: ['do not contact tenants with active disputes'],
        tenantId: 't1',
      },
      { port: mkPort(v), cache: new InMemoryVerdictCache() },
    );
    expect(verdictToAction(r)).toBe('deny-and-escalate');
    expect(r.recommendPlanMode).toBe(true);
  });

  it('3. 3 borderlines in a row engages plan-mode fallback', () => {
    let state = INITIAL_BOUNDARY_STATE;
    state = advanceBoundaryState(state, 'borderline');
    expect(state.inPlanModeFallback).toBe(false);
    state = advanceBoundaryState(state, 'borderline');
    expect(state.inPlanModeFallback).toBe(false);
    state = advanceBoundaryState(state, 'borderline');
    expect(state.inPlanModeFallback).toBe(true);
  });

  it('4. canUseTool sees a persisted rule -> short-circuits policy', async () => {
    const store = new InMemoryPermissionRuleStore();
    await store.put({
      scope: 'session',
      tenantId: null,
      userId: null,
      sessionId: 's1',
      toolName: 'send_sms',
      predicate: null,
      verdict: 'allow',
      reason: null,
    });
    const policy: CanUseToolFn = async () => ({
      kind: 'deny',
      message: 'should not reach me',
    });
    const can = createCanUseTool({ store, policy });
    const d = await can('send_sms', {}, CTX);
    expect(d.kind).toBe('allow');
  });

  it('5. accepted PermissionUpdate -> persisted rule', async () => {
    const store = new InMemoryPermissionRuleStore();
    await persistPermissionUpdate(
      {
        kind: 'persist-allow',
        scope: 'tenant',
        toolName: 'send_sms',
        predicate: { 'args.channel': 'sms' },
        reason: 'opted-in',
      },
      CTX,
      store,
    );
    const policy: CanUseToolFn = async () => ({
      kind: 'deny',
      message: 'should not be called',
    });
    const can = createCanUseTool({ store, policy });
    const d = await can('send_sms', { channel: 'sms' }, CTX);
    expect(d.kind).toBe('allow');
  });

  it('6. emitReceipt -> renderReceiptCard -> schema validated', async () => {
    const receipts = new InMemoryReceiptStore();
    const r = await emitReceipt(
      {
        actionId: 'act_int_1',
        toolName: 'create_invoice',
        tier: 'mutate',
        tenantId: 't1',
        executedBy: 'u1',
        argsSummary: { headline: 'invoice for unit 4A', fields: {} },
        affectedEntities: [
          { entityType: 'invoice', entityId: 'inv-99', label: 'May rent' },
        ],
        references: ['lease://l1'],
        rollbackToken: 'tk',
        rollbackWindowMinutes: 5,
      },
      { store: receipts },
    );
    const card = renderReceiptCard(r, { title: 'Invoice created' });
    expect(ReceiptCardPartSchema.safeParse(card).success).toBe(true);
    expect(card.rollbackEnabled).toBe(true);
  });

  it('7. full action -> receipt -> undo -> rollback receipt + ledger', async () => {
    const receipts = new InMemoryReceiptStore();
    const ledger = new InMemorySovereignLedger();
    const inverseExec: InverseExecutorPort = {
      async execute() { return { ok: true }; },
    };

    const receipt = await emitReceipt(
      {
        actionId: 'act_full',
        toolName: 'create_invoice',
        tier: 'mutate',
        tenantId: 't1',
        executedBy: 'u1',
        argsSummary: { headline: 'invoice for 4A', fields: {} },
        affectedEntities: [],
        references: [],
        rollbackToken: 'tok-full',
        rollbackWindowMinutes: 5,
      },
      { store: receipts },
    );
    ledger.setRollbackPayload({
      actionId: 'act_full',
      rollbackToken: 'tok-full',
      inverse: { kind: 'void_invoice', args: { invoiceId: 'inv-99' } },
    });

    const undo = await executeRollback(
      {
        actionId: 'act_full',
        receiptId: receipt.id,
        rollbackToken: 'tok-full',
        rolledBackBy: 'u1',
      },
      { receipts, ledger, inverseExecutor: inverseExec },
    );
    expect(undo.kind).toBe('ok');
    if (undo.kind === 'ok') {
      expect(undo.receipt.status).toBe('rolled-back');
    }
    expect(ledger.events.length).toBe(1);

    const stored = await receipts.getReceipt(receipt.id);
    expect(stored?.status).toBe('rolled-back');
  });

  it('8. safe-mode trips -> message has three buttons + reasons', () => {
    const r = advanceSafeModeState({
      prev: INITIAL_SAFE_MODE_STATE,
      sample: {
        perplexity: 0.9,
        toolFailure: true,
        borderlineStreak: 3,
      },
    });
    expect(r.state.tripped).toBe(true);
    const msg = buildSafeModeMessage({ reasons: r.reasons });
    expect(msg.buttons.length).toBe(3);
    expect(msg.reasons.length).toBeGreaterThan(0);
  });

  it('9. take-over choice -> pause-agent next step', () => {
    expect(resolveSafeModeChoice('take-over')).toEqual({
      kind: 'pause-agent',
    });
  });

  it('10. terminal-state action -> undo disabled in card', async () => {
    const receipts = new InMemoryReceiptStore();
    const r = await emitTerminalReceipt(
      {
        actionId: 'act_terminal',
        toolName: 'charge_card',
        tier: 'billing',
        tenantId: 't1',
        executedBy: 'u1',
        argsSummary: { headline: 'Charged KES 10', fields: {} },
        affectedEntities: [],
        references: [],
      },
      { store: receipts },
    );
    const card = renderReceiptCard(r);
    expect(card.rollbackEnabled).toBe(false);
    expect(card.rollbackWindowMinutes).toBe(0);
  });
});
