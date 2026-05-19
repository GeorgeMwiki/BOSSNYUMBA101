/**
 * ReceiptCardPartSchema + renderReceiptCard — wire-shape contract.
 */

import { describe, it, expect } from 'vitest';
import { ReceiptCardPartSchema } from '../receipt-card.js';
import { renderReceiptCard } from '../render.js';
import type { ReceiptEntity } from '../types.js';

function mkReceipt(overrides: Partial<ReceiptEntity> = {}): ReceiptEntity {
  return Object.freeze({
    id: 'rcpt_1',
    type: 'receipt',
    actionId: 'act_1',
    toolName: 'send_sms',
    tier: 'external-comm',
    tenantId: 't1',
    executedBy: 'u1',
    executedAt: '2026-05-19T10:00:00.000Z',
    status: 'applied',
    argsSummary: { headline: 'Sent 1 SMS', fields: {} },
    affectedEntities: [],
    references: [],
    rollbackToken: 'tok',
    rollbackWindowMinutes: 5,
    ...overrides,
  } as ReceiptEntity);
}

describe('ReceiptCardPartSchema', () => {
  it('accepts a fully-populated rolled-back card', () => {
    const r = ReceiptCardPartSchema.safeParse({
      kind: 'receipt-card',
      receiptId: 'r1',
      actionId: 'a1',
      toolName: 'send_email',
      tier: 'external-comm',
      tenantId: 't1',
      executedBy: 'u1',
      executedAt: '2026-05-19T10:00:00.000Z',
      status: 'rolled-back',
      argsSummary: { headline: 'send 1 email', fields: { count: 1 } },
      affectedEntities: [],
      references: [],
      rollbackEnabled: false,
      rollbackWindowMinutes: 5,
      rolledBackAt: '2026-05-19T10:01:00.000Z',
      rolledBackBy: 'u1',
    });
    expect(r.success).toBe(true);
  });

  it('rejects bad tier', () => {
    const r = ReceiptCardPartSchema.safeParse({
      kind: 'receipt-card',
      receiptId: 'r1',
      actionId: 'a1',
      toolName: 't',
      tier: 'nope',
      tenantId: 't1',
      executedBy: 'u1',
      executedAt: '2026-05-19T10:00:00.000Z',
      status: 'applied',
      argsSummary: { headline: 'h', fields: {} },
      affectedEntities: [],
      references: [],
      rollbackEnabled: true,
      rollbackWindowMinutes: 5,
    });
    expect(r.success).toBe(false);
  });
});

describe('renderReceiptCard', () => {
  it('marks rollbackEnabled when status is applied + token + window', () => {
    const card = renderReceiptCard(mkReceipt());
    expect(card.kind).toBe('receipt-card');
    expect(card.rollbackEnabled).toBe(true);
    expect(card.rollbackExpiresAt).toBeDefined();
  });

  it('disables rollback when terminal-state', () => {
    const card = renderReceiptCard(
      mkReceipt({ rollbackToken: null, rollbackWindowMinutes: 0 }),
    );
    expect(card.rollbackEnabled).toBe(false);
    expect(card.rollbackExpiresAt).toBeUndefined();
  });

  it('disables rollback after rolled-back', () => {
    const card = renderReceiptCard(
      mkReceipt({
        status: 'rolled-back',
        rolledBackAt: '2026-05-19T10:01:00.000Z',
        rolledBackBy: 'u1',
      }),
    );
    expect(card.rollbackEnabled).toBe(false);
    expect(card.rolledBackAt).toBe('2026-05-19T10:01:00.000Z');
  });

  it('computes rollbackExpiresAt = executedAt + window', () => {
    const card = renderReceiptCard(
      mkReceipt({
        executedAt: '2026-05-19T10:00:00.000Z',
        rollbackWindowMinutes: 10,
      }),
    );
    expect(card.rollbackExpiresAt).toBe('2026-05-19T10:10:00.000Z');
  });

  it('round-trips through the schema', () => {
    const card = renderReceiptCard(mkReceipt());
    const parsed = ReceiptCardPartSchema.safeParse(card);
    expect(parsed.success).toBe(true);
  });
});
