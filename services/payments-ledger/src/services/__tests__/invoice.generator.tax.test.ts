/**
 * Tests for KRA eTIMS routing in InvoiceGenerator.issueInvoice.
 *
 * Verifies that:
 *   - KE tenants with triggering invoice types route through eTIMS before
 *     becoming authoritative
 *   - eTIMS failure leaves the invoice in PENDING_TAX_SUBMISSION and
 *     enqueues a retry job
 *   - TZ tenants do NOT call eTIMS (TZ uses TRA, not the same flow)
 *   - Non-triggering invoice types do NOT call eTIMS
 *   - shouldSubmitToEtims helper is country + type aware
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  InvoiceGenerator,
  shouldSubmitToEtims,
  type InvoiceGeneratorDeps,
  type KraEtimsClientPort,
  type TaxSubmissionRetryQueue,
} from '../invoice.generator';
import type { Invoice, InvoiceId, TenantId, MoneyData } from '../../types';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const money = (amount: number, currency = 'KES'): MoneyData => ({
  amount,
  currency,
} as MoneyData);

const draftInvoice = (overrides: Partial<Invoice> = {}): Invoice =>
  ({
    id: 'inv-1' as InvoiceId,
    tenantId: 't-ke-1' as TenantId,
    invoiceNumber: 'INV-2026-04-000001',
    type: 'RENT',
    status: 'DRAFT',
    customerId: 'cust-1' as any,
    customerName: 'Acme Tenant Ltd',
    currency: 'KES',
    issueDate: new Date('2026-04-08T00:00:00Z'),
    dueDate: new Date('2026-04-30T00:00:00Z'),
    lineItems: [
      {
        id: 'li-1',
        description: 'Commercial unit 4B — April rent',
        quantity: 1,
        unitPrice: money(50000),
        amount: money(50000),
        taxAmount: money(8000),
        totalAmount: money(58000),
      } as any,
    ],
    subtotal: money(50000),
    taxBreakdown: [],
    totalTax: money(8000),
    totalAmount: money(58000),
    amountPaid: money(0),
    amountDue: money(58000),
    payments: [],
    createdAt: new Date('2026-04-01T00:00:00Z'),
    createdBy: 'system',
    updatedAt: new Date('2026-04-01T00:00:00Z'),
    updatedBy: 'system',
    ...overrides,
  }) as Invoice;

const buildDeps = (
  overrides: Partial<InvoiceGeneratorDeps> = {},
): { deps: InvoiceGeneratorDeps; updateInvoice: ReturnType<typeof vi.fn> } => {
  const updateInvoice = vi.fn(async (inv: Invoice) => inv);
  const deps: InvoiceGeneratorDeps = {
    getNextInvoiceNumber: vi.fn(async () => 1),
    saveInvoice: vi.fn(async (inv) => inv),
    getInvoice: vi.fn(),
    updateInvoice,
    logger: {
      info: vi.fn(),
      error: vi.fn(),
    },
    ...overrides,
  };
  return { deps, updateInvoice };
};

// ---------------------------------------------------------------------------
// shouldSubmitToEtims helper
// ---------------------------------------------------------------------------

describe('shouldSubmitToEtims', () => {
  it('returns true for KE + RENT', () => {
    expect(shouldSubmitToEtims('KE', 'RENT')).toBe(true);
  });

  it('returns true for KE + UTILITY (case-insensitive country)', () => {
    expect(shouldSubmitToEtims('ke', 'UTILITY')).toBe(true);
  });

  it('returns true for KE + MAINTENANCE and OTHER', () => {
    expect(shouldSubmitToEtims('KE', 'MAINTENANCE')).toBe(true);
    expect(shouldSubmitToEtims('KE', 'OTHER')).toBe(true);
  });

  it('returns false for KE + DEPOSIT (refundable, not a sale)', () => {
    expect(shouldSubmitToEtims('KE', 'DEPOSIT')).toBe(false);
  });

  it('returns false for KE + LATE_FEE', () => {
    expect(shouldSubmitToEtims('KE', 'LATE_FEE')).toBe(false);
  });

  it('returns false for TZ regardless of type (TZ uses TRA)', () => {
    expect(shouldSubmitToEtims('TZ', 'RENT')).toBe(false);
    expect(shouldSubmitToEtims('TZ', 'UTILITY')).toBe(false);
  });

  it('returns false for US tenants', () => {
    expect(shouldSubmitToEtims('US', 'RENT')).toBe(false);
  });

  it('returns false when country is undefined', () => {
    expect(shouldSubmitToEtims(undefined, 'RENT')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// issueInvoice + KRA eTIMS routing
// ---------------------------------------------------------------------------

describe('InvoiceGenerator.issueInvoice with KRA eTIMS', () => {
  let mockEtimsClient: KraEtimsClientPort;
  let mockRetryQueue: TaxSubmissionRetryQueue;

  beforeEach(() => {
    mockEtimsClient = {
      submitInvoice: vi.fn(async () => ({
        invoiceNumber: 'KRA-INV-9999',
        qrUrl: 'https://itax.kra.go.ke/qr/abc123',
        signedAt: new Date('2026-04-08T10:00:00Z'),
        kraReceiptNo: 'KRA-RCT-77777',
      })),
    };
    mockRetryQueue = {
      enqueue: vi.fn(async () => undefined),
    };
  });

  it('KE rental invoice -> calls eTIMS, marks ISSUED, stores receipt fields', async () => {
    const invoice = draftInvoice();
    const { deps, updateInvoice } = buildDeps({
      getInvoice: vi.fn(async () => invoice),
      kraEtimsClient: mockEtimsClient,
    });

    const generator = new InvoiceGenerator(deps);
    const result = await generator.issueInvoice(invoice.id, invoice.tenantId, 'KE');

    expect(mockEtimsClient.submitInvoice).toHaveBeenCalledOnce();
    expect(updateInvoice).toHaveBeenCalledOnce();
    expect(result.status).toBe('ISSUED');
    expect(result.taxSubmissionStatus).toBe('SUBMITTED');
    expect(result.kraReceiptNo).toBe('KRA-RCT-77777');
    expect(result.kraQrUrl).toBe('https://itax.kra.go.ke/qr/abc123');
    expect(result.kraInvoiceNumber).toBe('KRA-INV-9999');
    expect(result.taxSubmittedAt).toBeInstanceOf(Date);
  });

  it('KE rental invoice + eTIMS failure -> PENDING_TAX_SUBMISSION + retry enqueued', async () => {
    const invoice = draftInvoice();
    mockEtimsClient.submitInvoice = vi.fn(async () => {
      throw new Error('KRA gateway timeout');
    });

    const { deps, updateInvoice } = buildDeps({
      getInvoice: vi.fn(async () => invoice),
      kraEtimsClient: mockEtimsClient,
      taxRetryQueue: mockRetryQueue,
    });

    const generator = new InvoiceGenerator(deps);
    const result = await generator.issueInvoice(invoice.id, invoice.tenantId, 'KE');

    expect(mockEtimsClient.submitInvoice).toHaveBeenCalledOnce();
    expect(updateInvoice).toHaveBeenCalledOnce();
    expect(result.status).toBe('PENDING_TAX_SUBMISSION');
    expect(result.taxSubmissionStatus).toBe('FAILED');
    expect(result.taxSubmissionError).toBe('KRA gateway timeout');
    expect(result.kraReceiptNo).toBeUndefined();
    expect(mockRetryQueue.enqueue).toHaveBeenCalledOnce();
    const enqueueCall = (mockRetryQueue.enqueue as any).mock.calls[0][0];
    expect(enqueueCall.invoiceId).toBe(invoice.id);
    expect(enqueueCall.reason).toBe('KRA gateway timeout');
  });

  it('KE eTIMS failure with NO retry queue -> throws to caller', async () => {
    const invoice = draftInvoice();
    mockEtimsClient.submitInvoice = vi.fn(async () => {
      throw new Error('signature rejected');
    });

    const { deps } = buildDeps({
      getInvoice: vi.fn(async () => invoice),
      kraEtimsClient: mockEtimsClient,
      // taxRetryQueue intentionally omitted
    });

    const generator = new InvoiceGenerator(deps);
    await expect(
      generator.issueInvoice(invoice.id, invoice.tenantId, 'KE'),
    ).rejects.toThrow('signature rejected');
  });

  it('TZ rental invoice -> does NOT call eTIMS, marks ISSUED with NOT_REQUIRED', async () => {
    const invoice = draftInvoice({ tenantId: 't-tz-1' as TenantId });
    const { deps, updateInvoice } = buildDeps({
      getInvoice: vi.fn(async () => invoice),
      kraEtimsClient: mockEtimsClient,
    });

    const generator = new InvoiceGenerator(deps);
    const result = await generator.issueInvoice(invoice.id, invoice.tenantId, 'TZ');

    expect(mockEtimsClient.submitInvoice).not.toHaveBeenCalled();
    expect(result.status).toBe('ISSUED');
    expect(result.taxSubmissionStatus).toBe('NOT_REQUIRED');
    expect(updateInvoice).toHaveBeenCalledOnce();
  });

  it('KE DEPOSIT invoice -> does NOT call eTIMS (deposit is refundable)', async () => {
    const invoice = draftInvoice({ type: 'DEPOSIT' });
    const { deps } = buildDeps({
      getInvoice: vi.fn(async () => invoice),
      kraEtimsClient: mockEtimsClient,
    });

    const generator = new InvoiceGenerator(deps);
    const result = await generator.issueInvoice(invoice.id, invoice.tenantId, 'KE');

    expect(mockEtimsClient.submitInvoice).not.toHaveBeenCalled();
    expect(result.status).toBe('ISSUED');
    expect(result.taxSubmissionStatus).toBe('NOT_REQUIRED');
  });

  it('KE rental invoice with NO eTIMS client wired -> ISSUED, NOT_REQUIRED', async () => {
    const invoice = draftInvoice();
    const { deps } = buildDeps({
      getInvoice: vi.fn(async () => invoice),
      // kraEtimsClient intentionally omitted
    });

    const generator = new InvoiceGenerator(deps);
    const result = await generator.issueInvoice(invoice.id, invoice.tenantId, 'KE');

    expect(result.status).toBe('ISSUED');
    expect(result.taxSubmissionStatus).toBe('NOT_REQUIRED');
  });

  it('uses deps.getTenantCountry when explicit country override is omitted', async () => {
    const invoice = draftInvoice();
    const getTenantCountry = vi.fn(async () => 'KE');
    const { deps } = buildDeps({
      getInvoice: vi.fn(async () => invoice),
      kraEtimsClient: mockEtimsClient,
      getTenantCountry,
    });

    const generator = new InvoiceGenerator(deps);
    const result = await generator.issueInvoice(invoice.id, invoice.tenantId);

    expect(getTenantCountry).toHaveBeenCalledWith(invoice.tenantId);
    expect(mockEtimsClient.submitInvoice).toHaveBeenCalledOnce();
    expect(result.taxSubmissionStatus).toBe('SUBMITTED');
  });

  it('non-DRAFT invoices cannot be issued (existing guard preserved)', async () => {
    const invoice = draftInvoice({ status: 'ISSUED' });
    const { deps } = buildDeps({
      getInvoice: vi.fn(async () => invoice),
      kraEtimsClient: mockEtimsClient,
    });

    const generator = new InvoiceGenerator(deps);
    await expect(
      generator.issueInvoice(invoice.id, invoice.tenantId, 'KE'),
    ).rejects.toThrow('not in DRAFT status');
    expect(mockEtimsClient.submitInvoice).not.toHaveBeenCalled();
  });
});
