import { describe, it, expect } from 'vitest';
import {
  FIRS_TOOLS,
  fileVatReturnTool,
  verifyTinTool,
  getPaymentStatusTool,
} from '../src/tools/index.js';
import { MockFirsAdapter } from '../src/adapter.js';

const deps = { firs: new MockFirsAdapter() };

describe('FIRS tool registry', () => {
  it('exposes 3 tools (file_vat_return, verify_tin, get_payment_status)', () => {
    expect(FIRS_TOOLS).toHaveLength(3);
    const names = FIRS_TOOLS.map((t) => t.name);
    expect(names).toContain('firs.file_vat_return');
    expect(names).toContain('firs.verify_tin');
    expect(names).toContain('firs.get_payment_status');
  });
});

describe('firs.file_vat_return', () => {
  it('computes output VAT at 7.5 % of gross sales', async () => {
    const result = await fileVatReturnTool.execute(
      {
        tenantId: 't1',
        tin: '123456789012',
        period: '2026-05',
        grossSalesKobo: 1_000_000_00, // 1 million NGN in kobo
        inputVatKobo: 0,
      },
      deps,
    );
    expect(result.filingStatus).toBe('accepted');
    expect(result.outputVatKobo).toBe(Math.round(1_000_000_00 * 0.075));
    expect(result.netPayableKobo).toBe(result.outputVatKobo);
  });

  it('nets off input-VAT credit (floors at zero)', async () => {
    const result = await fileVatReturnTool.execute(
      {
        tenantId: 't1',
        tin: '123456789012',
        period: '2026-05',
        grossSalesKobo: 1_000_00,
        inputVatKobo: 999_999_99,
      },
      deps,
    );
    expect(result.netPayableKobo).toBe(0);
  });
});

describe('firs.verify_tin', () => {
  it('recognises the legacy 12-digit FIRS TIN', async () => {
    const result = await verifyTinTool.execute(
      { tenantId: 't1', tin: '123456789012' },
      deps,
    );
    expect(result.verified).toBe(true);
    expect(result.issuer).toBe('firs');
  });

  it('recognises the 13-digit NRS Tax ID (Jan 2026+)', async () => {
    const result = await verifyTinTool.execute(
      { tenantId: 't1', tin: '1234567890123' },
      deps,
    );
    expect(result.verified).toBe(true);
    expect(result.issuer).toBe('nrs');
  });

  it('rejects a shape mismatch via Zod (CRITICAL-4)', async () => {
    // Post CRITICAL-4 fix: Zod rejects malformed TIN BEFORE the adapter
    // runs, so we get an INVALID_INPUT throw rather than an
    // invalid_shape result. The error path now contains 'tin'.
    await expect(
      verifyTinTool.execute({ tenantId: 't1', tin: 'A123456789B' }, deps),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });
});

describe('firs.get_payment_status', () => {
  it('returns a status enum + balance + timestamp', async () => {
    const result = await getPaymentStatusTool.execute(
      { tenantId: 't1', acknowledgementId: 'firs-mock-t1-9012-2026-05' },
      deps,
    );
    expect(['unpaid', 'paid', 'partial', 'overdue']).toContain(result.status);
    expect(result.balanceKobo).toBeGreaterThanOrEqual(0);
    expect(result.lastUpdated).toMatch(/2026-/);
  });
});
