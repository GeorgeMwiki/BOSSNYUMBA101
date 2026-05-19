/**
 * executeRollback — every error path + the happy path.
 */

import { describe, it, expect, vi } from 'vitest';
import { emitReceipt } from '../emit-receipt.js';
import { executeRollback } from '../execute-rollback.js';
import {
  InMemoryReceiptStore,
  InMemorySovereignLedger,
} from '../in-memory-store.js';
import type { InverseExecutorPort, InverseResult } from '../types.js';

function deps(opts?: { now?: () => Date }) {
  const now = opts?.now ?? (() => new Date());
  const receipts = new InMemoryReceiptStore({ now });
  const ledger = new InMemorySovereignLedger();
  const inverse: InverseExecutorPort = {
    async execute(_inv): Promise<InverseResult> {
      return { ok: true };
    },
  };
  return {
    receipts,
    ledger,
    inverseExecutor: inverse,
    now,
  };
}

describe('executeRollback — happy path', () => {
  it('marks the receipt rolled-back + appends a ledger event', async () => {
    const d = deps();
    const receipt = await emitReceipt(
      {
        actionId: 'act_1',
        toolName: 'send_email',
        tier: 'external-comm',
        tenantId: 't1',
        executedBy: 'u1',
        argsSummary: { headline: 'sent', fields: {} },
        affectedEntities: [],
        references: [],
        rollbackToken: 'tok_1',
        rollbackWindowMinutes: 5,
      },
      { store: d.receipts },
    );
    d.ledger.setRollbackPayload({
      actionId: 'act_1',
      rollbackToken: 'tok_1',
      inverse: { kind: 'recall_email', args: { id: 'msg_1' } },
    });

    const result = await executeRollback(
      {
        actionId: 'act_1',
        receiptId: receipt.id,
        rollbackToken: 'tok_1',
        rolledBackBy: 'u1',
      },
      d,
    );
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.receipt.status).toBe('rolled-back');
      expect(result.receipt.rolledBackBy).toBe('u1');
    }
    expect(d.ledger.events.length).toBe(1);
    expect(d.ledger.events[0]?.actionId).toBe('act_1');
  });

  it('invokes the inverse executor with the right payload', async () => {
    const d = deps();
    const spy = vi.spyOn(d.inverseExecutor, 'execute');
    const receipt = await emitReceipt(
      {
        actionId: 'act_2',
        toolName: 'create_invoice',
        tier: 'mutate',
        tenantId: 't1',
        executedBy: 'u1',
        argsSummary: { headline: 'invoice 5', fields: {} },
        affectedEntities: [],
        references: [],
        rollbackToken: 'tok_2',
        rollbackWindowMinutes: 5,
      },
      { store: d.receipts },
    );
    d.ledger.setRollbackPayload({
      actionId: 'act_2',
      rollbackToken: 'tok_2',
      inverse: { kind: 'void_invoice', args: { invoiceId: 5 } },
    });

    await executeRollback(
      {
        actionId: 'act_2',
        receiptId: receipt.id,
        rollbackToken: 'tok_2',
        rolledBackBy: 'u1',
      },
      d,
    );
    expect(spy).toHaveBeenCalledWith({
      kind: 'void_invoice',
      args: { invoiceId: 5 },
    });
  });
});

describe('executeRollback — error paths', () => {
  it('returns receipt-not-found for an unknown receipt id', async () => {
    const d = deps();
    const r = await executeRollback(
      {
        actionId: 'a',
        receiptId: 'nope',
        rollbackToken: 't',
        rolledBackBy: 'u1',
      },
      d,
    );
    expect(r.kind).toBe('receipt-not-found');
  });

  it('returns receipt-action-mismatch when actionId disagrees', async () => {
    const d = deps();
    const receipt = await emitReceipt(
      {
        actionId: 'act_x',
        toolName: 't',
        tier: 'mutate',
        tenantId: 't1',
        executedBy: 'u1',
        argsSummary: { headline: 'h', fields: {} },
        affectedEntities: [],
        references: [],
        rollbackToken: 'tok',
        rollbackWindowMinutes: 5,
      },
      { store: d.receipts },
    );
    const r = await executeRollback(
      {
        actionId: 'act_other',
        receiptId: receipt.id,
        rollbackToken: 'tok',
        rolledBackBy: 'u1',
      },
      d,
    );
    expect(r.kind).toBe('receipt-action-mismatch');
  });

  it('returns terminal-state for a non-undoable action', async () => {
    const d = deps();
    const receipt = await emitReceipt(
      {
        actionId: 'act_t',
        toolName: 'charge_card',
        tier: 'billing',
        tenantId: 't1',
        executedBy: 'u1',
        argsSummary: { headline: 'charge', fields: {} },
        affectedEntities: [],
        references: [],
        rollbackToken: null,
        rollbackWindowMinutes: 0,
      },
      { store: d.receipts },
    );
    const r = await executeRollback(
      {
        actionId: 'act_t',
        receiptId: receipt.id,
        rollbackToken: 'tok',
        rolledBackBy: 'u1',
      },
      d,
    );
    expect(r.kind).toBe('terminal-state');
  });

  it('returns token-mismatch when receipt token differs', async () => {
    const d = deps();
    const receipt = await emitReceipt(
      {
        actionId: 'act_z',
        toolName: 't',
        tier: 'mutate',
        tenantId: 't1',
        executedBy: 'u1',
        argsSummary: { headline: 'h', fields: {} },
        affectedEntities: [],
        references: [],
        rollbackToken: 'good',
        rollbackWindowMinutes: 5,
      },
      { store: d.receipts },
    );
    const r = await executeRollback(
      {
        actionId: 'act_z',
        receiptId: receipt.id,
        rollbackToken: 'bad',
        rolledBackBy: 'u1',
      },
      d,
    );
    expect(r.kind).toBe('token-mismatch');
  });

  it('returns window-expired after the window passes', async () => {
    let now = 1_000_000;
    const d = deps({ now: () => new Date(now) });
    const receipt = await emitReceipt(
      {
        actionId: 'act_w',
        toolName: 't',
        tier: 'mutate',
        tenantId: 't1',
        executedBy: 'u1',
        argsSummary: { headline: 'h', fields: {} },
        affectedEntities: [],
        references: [],
        rollbackToken: 'tok',
        rollbackWindowMinutes: 1,
      },
      { store: d.receipts },
    );
    d.ledger.setRollbackPayload({
      actionId: 'act_w',
      rollbackToken: 'tok',
      inverse: { kind: 'x', args: {} },
    });
    now = now + 61_000;
    const r = await executeRollback(
      {
        actionId: 'act_w',
        receiptId: receipt.id,
        rollbackToken: 'tok',
        rolledBackBy: 'u1',
      },
      d,
    );
    expect(r.kind).toBe('window-expired');
  });

  it('returns payload-missing when ledger has no payload', async () => {
    const d = deps();
    const receipt = await emitReceipt(
      {
        actionId: 'act_p',
        toolName: 't',
        tier: 'mutate',
        tenantId: 't1',
        executedBy: 'u1',
        argsSummary: { headline: 'h', fields: {} },
        affectedEntities: [],
        references: [],
        rollbackToken: 'tok',
        rollbackWindowMinutes: 5,
      },
      { store: d.receipts },
    );
    const r = await executeRollback(
      {
        actionId: 'act_p',
        receiptId: receipt.id,
        rollbackToken: 'tok',
        rolledBackBy: 'u1',
      },
      d,
    );
    expect(r.kind).toBe('payload-missing');
  });

  it('returns inverse-failed when the inverse executor reports a failure', async () => {
    const d = deps();
    (d.inverseExecutor as { execute: () => Promise<InverseResult> }).execute =
      async () => ({ ok: false, reason: 'network down' });

    const receipt = await emitReceipt(
      {
        actionId: 'act_f',
        toolName: 't',
        tier: 'mutate',
        tenantId: 't1',
        executedBy: 'u1',
        argsSummary: { headline: 'h', fields: {} },
        affectedEntities: [],
        references: [],
        rollbackToken: 'tok',
        rollbackWindowMinutes: 5,
      },
      { store: d.receipts },
    );
    d.ledger.setRollbackPayload({
      actionId: 'act_f',
      rollbackToken: 'tok',
      inverse: { kind: 'x', args: {} },
    });

    const r = await executeRollback(
      {
        actionId: 'act_f',
        receiptId: receipt.id,
        rollbackToken: 'tok',
        rolledBackBy: 'u1',
      },
      d,
    );
    expect(r.kind).toBe('inverse-failed');
    if (r.kind === 'inverse-failed') {
      expect(r.reason).toBe('network down');
    }
  });

  it('returns already-rolled-back on second attempt', async () => {
    const d = deps();
    const receipt = await emitReceipt(
      {
        actionId: 'act_2x',
        toolName: 't',
        tier: 'mutate',
        tenantId: 't1',
        executedBy: 'u1',
        argsSummary: { headline: 'h', fields: {} },
        affectedEntities: [],
        references: [],
        rollbackToken: 'tok',
        rollbackWindowMinutes: 5,
      },
      { store: d.receipts },
    );
    d.ledger.setRollbackPayload({
      actionId: 'act_2x',
      rollbackToken: 'tok',
      inverse: { kind: 'x', args: {} },
    });
    const first = await executeRollback(
      {
        actionId: 'act_2x',
        receiptId: receipt.id,
        rollbackToken: 'tok',
        rolledBackBy: 'u1',
      },
      d,
    );
    expect(first.kind).toBe('ok');
    const second = await executeRollback(
      {
        actionId: 'act_2x',
        receiptId: receipt.id,
        rollbackToken: 'tok',
        rolledBackBy: 'u1',
      },
      d,
    );
    expect(second.kind).toBe('already-rolled-back');
  });
});
