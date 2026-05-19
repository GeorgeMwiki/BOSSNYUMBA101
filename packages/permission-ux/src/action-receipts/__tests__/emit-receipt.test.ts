/**
 * emitReceipt — invariants + the terminal-state convenience.
 */

import { describe, it, expect } from 'vitest';
import { emitReceipt, emitTerminalReceipt } from '../emit-receipt.js';
import { InMemoryReceiptStore } from '../in-memory-store.js';
import type { NewReceiptInput } from '../types.js';

function baseInput(overrides: Partial<NewReceiptInput> = {}): NewReceiptInput {
  return {
    actionId: 'act_1',
    toolName: 'send_sms',
    tier: 'external-comm',
    tenantId: 't1',
    executedBy: 'u1',
    argsSummary: { headline: 'Send 1 SMS', fields: {} },
    affectedEntities: [],
    references: [],
    rollbackToken: 'tok_1',
    rollbackWindowMinutes: 5,
    ...overrides,
  };
}

describe('emitReceipt', () => {
  it('writes the receipt to the store and returns the entity', async () => {
    const store = new InMemoryReceiptStore();
    const r = await emitReceipt(baseInput(), { store });
    expect(r.type).toBe('receipt');
    expect(r.status).toBe('applied');
    expect(r.actionId).toBe('act_1');
    expect(r.rollbackToken).toBe('tok_1');
  });

  it('rejects negative rollbackWindowMinutes', async () => {
    const store = new InMemoryReceiptStore();
    await expect(
      emitReceipt(baseInput({ rollbackWindowMinutes: -1 }), { store }),
    ).rejects.toThrow(/>= 0/);
  });

  it('rejects rollbackToken on terminal-state action', async () => {
    const store = new InMemoryReceiptStore();
    await expect(
      emitReceipt(
        baseInput({ rollbackWindowMinutes: 0, rollbackToken: 'tok' }),
        { store },
      ),
    ).rejects.toThrow(/terminal-state/);
  });

  it('rejects missing rollbackToken on rollback-enabled action', async () => {
    const store = new InMemoryReceiptStore();
    await expect(
      emitReceipt(
        baseInput({ rollbackWindowMinutes: 5, rollbackToken: null }),
        { store },
      ),
    ).rejects.toThrow(/must have a rollbackToken/);
  });

  it('emitTerminalReceipt forces rollback fields off', async () => {
    const store = new InMemoryReceiptStore();
    const r = await emitTerminalReceipt(
      {
        actionId: 'act_2',
        toolName: 'charge_card',
        tier: 'billing',
        tenantId: 't1',
        executedBy: 'u1',
        argsSummary: { headline: 'Charge KES 100', fields: {} },
        affectedEntities: [],
        references: [],
      },
      { store },
    );
    expect(r.rollbackToken).toBeNull();
    expect(r.rollbackWindowMinutes).toBe(0);
  });
});
