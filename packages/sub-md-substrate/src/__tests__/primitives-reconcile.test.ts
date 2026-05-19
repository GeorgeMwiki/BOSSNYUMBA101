import { describe, expect, it } from 'vitest';
import {
  createReconcile,
  type ReconcileRow,
  type ReconcileStrategy,
} from '../primitives/reconcile.js';
import { makeCtx } from './_helpers.js';

const passthroughStrategy: ReconcileStrategy = {
  async reconcile({ left, right }) {
    return {
      matches: [],
      leftOnly: left,
      rightOnly: right,
      suggestedActions: [],
      totalLeft: left.reduce((s, r) => s + r.amountMinor, 0),
      totalRight: right.reduce((s, r) => s + r.amountMinor, 0),
    };
  },
};

function row(id: string, amount: number, cur = 'USD'): ReconcileRow {
  return {
    id,
    amountMinor: amount,
    currency: cur,
    occurredAtMs: 0,
    metadata: {},
  };
}

describe('createReconcile', () => {
  it('runs the strategy and seals an entry', async () => {
    const r = createReconcile({ name: 'r.basic', strategy: passthroughStrategy });
    const { ctx, recorder } = makeCtx();
    const res = await r.run({
      left: [row('a', 100), row('b', 200)],
      right: [row('p1', 50)],
      inputTenantId: 'tenant-1',
      ctx,
    });
    expect(res.output.totalLeft).toBe(300);
    expect(res.output.totalRight).toBe(50);
    expect(recorder.entries[0]!.summary).toMatch(/matched, 2 left-only, 1 right-only/);
  });

  it('rejects mixed-currency inputs', async () => {
    const r = createReconcile({ name: 'r.mix', strategy: passthroughStrategy });
    const { ctx, recorder } = makeCtx();
    await r.run({
      left: [row('a', 100, 'USD')],
      right: [row('p1', 100, 'KES')],
      inputTenantId: 'tenant-1',
      ctx,
    });
    expect(recorder.entries[0]!.status).toBe('rejected');
    expect(recorder.entries[0]!.summary).toMatch(/mixed currencies/);
  });

  it('rejects when row-count exceeds maxRowsPerSide', async () => {
    const r = createReconcile({
      name: 'r.bigside',
      strategy: passthroughStrategy,
      maxRowsPerSide: 1,
    });
    const { ctx, recorder } = makeCtx();
    await r.run({
      left: [row('a', 1), row('b', 2)],
      right: [],
      inputTenantId: 'tenant-1',
      ctx,
    });
    expect(recorder.entries[0]!.status).toBe('rejected');
  });

  it('rejects cross-tenant input', async () => {
    const r = createReconcile({ name: 'r.scope', strategy: passthroughStrategy });
    const { ctx, recorder } = makeCtx({ tenantId: 'tenant-1' });
    await r.run({
      left: [row('a', 1)],
      right: [row('p1', 1)],
      inputTenantId: 'tenant-other',
      ctx,
    });
    expect(recorder.entries[0]!.status).toBe('rejected');
  });
});
