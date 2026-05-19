import { describe, expect, it } from 'vitest';
import { createVendorReconcile } from '../verticals/bossnyumba-internal/vendor-reconcile.js';
import type { ReconcileRow } from '../primitives/reconcile.js';
import { makeCtx } from './_helpers.js';

function invoice(id: string, vendorId: string, amount: number, atMs: number): ReconcileRow {
  return {
    id,
    amountMinor: amount,
    currency: 'TZS',
    occurredAtMs: atMs,
    metadata: { vendorId, kind: 'invoice' },
  };
}

function payment(
  id: string,
  vendorId: string,
  amount: number,
  atMs: number,
  invoiceRef?: string,
): ReconcileRow {
  return {
    id,
    amountMinor: amount,
    currency: 'TZS',
    occurredAtMs: atMs,
    metadata: {
      vendorId,
      kind: 'payment',
      ...(invoiceRef !== undefined ? { invoiceRef } : {}),
    },
  };
}

describe('vendor.reconcile', () => {
  it('exact-matches invoice ref to payment', async () => {
    const sub = createVendorReconcile();
    const { ctx } = makeCtx();
    const r = await sub.reconcile.run({
      left: [invoice('inv-1', 'v-A', 100_000, 0)],
      right: [payment('pmt-1', 'v-A', 100_000, 86_400_000, 'inv-1')],
      inputTenantId: 'tenant-1',
      ctx,
    });
    expect(r.output.matches.length).toBe(1);
    expect(r.output.matches[0]!.confidence).toBe(1);
  });

  it('fuzzy-matches by vendor + amount + time window', async () => {
    const sub = createVendorReconcile();
    const { ctx } = makeCtx();
    const r = await sub.reconcile.run({
      left: [invoice('inv-1', 'v-A', 100_000, 0)],
      right: [payment('pmt-1', 'v-A', 100_500, 5 * 86_400_000)], // 0.5% diff, 5d apart
      inputTenantId: 'tenant-1',
      ctx,
    });
    expect(r.output.matches.length).toBe(1);
    expect(r.output.matches[0]!.confidence).toBe(0.8);
  });

  it('flags right-only as fraud-investigation candidate', async () => {
    const sub = createVendorReconcile();
    const { ctx } = makeCtx();
    const r = await sub.reconcile.run({
      left: [],
      right: [payment('pmt-rogue', 'v-A', 50_000, 0)],
      inputTenantId: 'tenant-1',
      ctx,
    });
    expect(r.output.rightOnly.length).toBe(1);
    expect(
      r.output.suggestedActions.some(
        (a) => a.kind === 'investigate-right-only' && a.rationale.includes('fraud'),
      ),
    ).toBe(true);
  });

  it('flags left-only as unpaid invoice', async () => {
    const sub = createVendorReconcile();
    const { ctx } = makeCtx();
    const r = await sub.reconcile.run({
      left: [invoice('inv-1', 'v-A', 25_000, 0)],
      right: [],
      inputTenantId: 'tenant-1',
      ctx,
    });
    expect(r.output.leftOnly.length).toBe(1);
    expect(
      r.output.suggestedActions.some((a) => a.kind === 'investigate-left-only'),
    ).toBe(true);
  });

  it('refuses to match across different vendors', async () => {
    const sub = createVendorReconcile();
    const { ctx } = makeCtx();
    const r = await sub.reconcile.run({
      left: [invoice('inv-1', 'v-A', 100_000, 0)],
      right: [payment('pmt-1', 'v-B', 100_000, 0)],
      inputTenantId: 'tenant-1',
      ctx,
    });
    expect(r.output.matches.length).toBe(0);
    expect(r.output.leftOnly.length).toBe(1);
    expect(r.output.rightOnly.length).toBe(1);
  });

  it('records amount-delta actions', async () => {
    const sub = createVendorReconcile();
    const { ctx } = makeCtx();
    const r = await sub.reconcile.run({
      left: [invoice('inv-1', 'v-A', 100_000, 0)],
      right: [payment('pmt-1', 'v-A', 99_000, 0, 'inv-1')],
      inputTenantId: 'tenant-1',
      ctx,
    });
    expect(r.output.matches.length).toBe(1);
    expect(r.output.suggestedActions.some((a) => a.kind === 'accept-delta')).toBe(true);
  });
});
