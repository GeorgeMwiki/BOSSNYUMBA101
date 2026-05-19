import { describe, it, expect } from 'vitest';
import {
  OPAY_TOOLS,
  initiatePaymentTool,
  verifyPaymentTool,
  cashflowLookupTool,
} from '../src/tools/index.js';
import { MockOpayAdapter } from '../src/adapter.js';

const deps = { opay: new MockOpayAdapter() };

describe('OPay tool registry', () => {
  it('exposes 3 tools (initiate_payment + verify_payment + cashflow_lookup)', () => {
    expect(OPAY_TOOLS).toHaveLength(3);
    const names = OPAY_TOOLS.map((t) => t.name);
    expect(names).toContain('opay.initiate_payment');
    expect(names).toContain('opay.verify_payment');
    expect(names).toContain('opay.cashflow_lookup');
  });
});

describe('opay.initiate_payment', () => {
  it('returns pending status for a valid Nigerian E.164 wallet', async () => {
    const result = await initiatePaymentTool.execute(
      {
        tenantId: 't1',
        payerPhone: '+2348012345678',
        amountKobo: 50_000,
        reference: 'rent-may-2026',
      },
      deps,
    );
    expect(result.status).toBe('pending');
    expect(result.transactionId).toMatch(/^opay-mock-rent-may-2026/);
  });

  it('rejects a non-Nigerian phone via Zod (CRITICAL-4)', async () => {
    // Post CRITICAL-4 fix: the Zod schema requires Nigerian E.164
    // (+234XXXXXXXXXX) and rejects everything else BEFORE the adapter
    // runs, throwing INVALID_INPUT with path='payerPhone'.
    await expect(
      initiatePaymentTool.execute(
        {
          tenantId: 't1',
          payerPhone: '+254712345678',
          amountKobo: 50_000,
          reference: 'rent-may-2026',
        },
        deps,
      ),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });
});

describe('opay.verify_payment', () => {
  it('returns succeeded for an OPay mock txn id', async () => {
    const result = await verifyPaymentTool.execute(
      { tenantId: 't1', transactionId: 'opay-mock-ref1-12345' },
      deps,
    );
    expect(result.status).toBe('succeeded');
    expect(result.amountKobo).toBe(12345);
    expect(result.settledAt).toBeDefined();
  });

  it('returns failed for an unknown txn id', async () => {
    const result = await verifyPaymentTool.execute(
      { tenantId: 't1', transactionId: 'random-12345' },
      deps,
    );
    expect(result.status).toBe('failed');
  });
});

describe('opay.cashflow_lookup', () => {
  it('returns 3 daily samples and totals matching the per-day sum', async () => {
    const result = await cashflowLookupTool.execute(
      {
        tenantId: 't1',
        payerPhone: '+2348012345678',
        fromDate: '2026-05-15',
        toDate: '2026-05-17',
      },
      deps,
    );
    expect(result.samples).toHaveLength(3);
    const inflowSum = result.samples.reduce(
      (acc, s) => acc + s.inflowsKobo,
      0,
    );
    const outflowSum = result.samples.reduce(
      (acc, s) => acc + s.outflowsKobo,
      0,
    );
    expect(result.totalInflowsKobo).toBe(inflowSum);
    expect(result.totalOutflowsKobo).toBe(outflowSum);
  });
});
