/**
 * Integration tests for Payment endpoints (wave-5 contract).
 *
 * NEW contract under test:
 *   POST /payments/mpesa/stk-push   (replaces legacy POST /payments/mpesa)
 *     -> 202 { success: true, data: { paymentId, checkoutRequestId,
 *                                     merchantRequestId, status: 'PENDING',
 *                                     customerMessage } }
 *     Persists a PENDING payment row, fires Safaricom STK push, then bumps
 *     the row to processing with the providerTransactionId.
 *   GET  /payments/:id/status
 *     -> 200 { success: true, data: { paymentId, status (UPPERCASE),
 *                                     amount, currency, receiptNumber?,
 *                                     completedAt?, invoiceId?, invoiceStatus? } }
 *   GET  /payments/:id/receipt
 *     -> 200 when payment.status === 'completed'
 *     -> 409 RECEIPT_NOT_READY otherwise
 *   POST /webhooks/mpesa/callback
 *     -> 200 { ResultCode: 0 } when HMAC signature is valid (or in dev mode
 *        without MPESA_CALLBACK_SECRET)
 *     -> 401 UNAUTHORIZED when the secret is configured and the signature
 *        / token is invalid.
 *
 * Tests mock `../middleware/database` with an in-memory repository façade
 * that mirrors the Drizzle repositories' method signatures actually used by
 * routes/payments.ts and routes/webhooks.ts.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createHmac } from 'crypto';
import { Hono } from 'hono';
import { generateToken } from '../middleware/auth';
import { UserRole } from '../types/user-role';

// ---------------------------------------------------------------------------
// In-memory repositories
// ---------------------------------------------------------------------------

interface PaymentRow {
  id: string;
  tenantId: string;
  customerId: string;
  invoiceId: string | null;
  leaseId: string | null;
  paymentNumber: string;
  status: string;
  paymentMethod: string;
  amount: number;
  currency: string;
  netAmount: number;
  payerPhone?: string;
  provider?: string;
  externalReference?: string | null;
  providerTransactionId?: string | null;
  providerResponse?: unknown;
  receiptNumber?: string | null;
  description?: string;
  initiatedAt: Date;
  completedAt?: Date | null;
  failedAt?: Date | null;
  failureReason?: string | null;
  createdBy: string;
  updatedBy: string;
  updatedAt?: Date;
}

interface InvoiceRow {
  id: string;
  tenantId: string;
  invoiceNumber: string;
  customerId: string;
  leaseId?: string | null;
  status: string;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  currency: string;
}

const seed = () => ({
  payments: new Map<string, PaymentRow>(),
  invoices: new Map<string, InvoiceRow>([
    [
      'inv-001',
      {
        id: 'inv-001',
        tenantId: 'tenant-001',
        invoiceNumber: 'INV-0001',
        customerId: 'user-001',
        leaseId: 'lease-001',
        status: 'sent',
        totalAmount: 50000,
        paidAmount: 0,
        balanceAmount: 50000,
        currency: 'KES',
      },
    ],
  ]),
});

let store = seed();

const repos = {
  payments: {
    findMany: vi.fn(async (tenantId: string) => ({
      items: [...store.payments.values()].filter((p) => p.tenantId === tenantId),
    })),
    findById: vi.fn(async (id: string, tenantId: string) => {
      const row = store.payments.get(id);
      if (!row || row.tenantId !== tenantId) return null;
      return row;
    }),
    findByCustomer: vi.fn(async (customerId: string, tenantId: string) => ({
      items: [...store.payments.values()].filter(
        (p) => p.tenantId === tenantId && p.customerId === customerId
      ),
    })),
    findByStatus: vi.fn(async (status: string, tenantId: string) => ({
      items: [...store.payments.values()].filter(
        (p) => p.tenantId === tenantId && p.status === status
      ),
    })),
    findByProviderTransactionId: vi.fn(async (provider: string, providerTransactionId: string) => {
      for (const row of store.payments.values()) {
        if (row.provider === provider && row.providerTransactionId === providerTransactionId) {
          return row;
        }
      }
      return null;
    }),
    create: vi.fn(async (data: PaymentRow) => {
      const row: PaymentRow = { ...data };
      store.payments.set(row.id, row);
      return row;
    }),
    update: vi.fn(async (id: string, tenantId: string, patch: Partial<PaymentRow>) => {
      const existing = store.payments.get(id);
      if (!existing || existing.tenantId !== tenantId) return null;
      const merged = { ...existing, ...patch, updatedAt: new Date() };
      store.payments.set(id, merged);
      return merged;
    }),
  },
  invoices: {
    findById: vi.fn(async (id: string, tenantId: string) => {
      const row = store.invoices.get(id);
      if (!row || row.tenantId !== tenantId) return null;
      return row;
    }),
    findByCustomer: vi.fn(async (customerId: string, tenantId: string) => ({
      items: [...store.invoices.values()].filter(
        (i) => i.tenantId === tenantId && i.customerId === customerId
      ),
    })),
    update: vi.fn(async (id: string, tenantId: string, patch: Partial<InvoiceRow>) => {
      const existing = store.invoices.get(id);
      if (!existing || existing.tenantId !== tenantId) return null;
      const merged = { ...existing, ...patch };
      store.invoices.set(id, merged);
      return merged;
    }),
  },
};

// ---------------------------------------------------------------------------
// Mock the database middleware module.
// ---------------------------------------------------------------------------

vi.mock('../middleware/database', () => ({
  databaseMiddleware: async (c: any, next: any) => {
    c.set('db', {});
    c.set('repos', repos);
    c.set('useMockData', false);
    await next();
  },
  isUsingMockData: () => false,
  getDatabaseClient: () => ({}),
  generateId: () => crypto.randomUUID(),
}));

// ---------------------------------------------------------------------------
// Import routers AFTER mocks.
// ---------------------------------------------------------------------------

const { paymentsApp } = await import('../routes/payments');
const { webhooksApp } = await import('../routes/webhooks');

const api = new Hono().route('/payments', paymentsApp).route('/webhooks', webhooksApp);

beforeEach(() => {
  store = seed();
  for (const fn of Object.values(repos.payments)) (fn as any).mockClear?.();
  for (const fn of Object.values(repos.invoices)) (fn as any).mockClear?.();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function bearer(): string {
  return generateToken({
    userId: 'user-001',
    tenantId: 'tenant-001',
    role: UserRole.TENANT_ADMIN,
    permissions: ['*', 'payments:*'],
    propertyAccess: ['*'],
  });
}

function jsonReq(method: string, url: string, body?: unknown, headers: Record<string, string> = {}) {
  return new Request(`http://x${url}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

// ---------------------------------------------------------------------------
// POST /payments/mpesa/stk-push (NEW endpoint)
// ---------------------------------------------------------------------------

describe('POST /payments/mpesa/stk-push (wave-5)', () => {
  it('returns 202 + paymentId + checkoutRequestId + PENDING status on success', async () => {
    const res = await api.fetch(
      jsonReq(
        'POST',
        '/payments/mpesa/stk-push',
        {
          invoiceId: 'inv-001',
          amount: 500,
          phone: '0712345678',
        },
        { authorization: `Bearer ${bearer()}` }
      )
    );
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.paymentId).toEqual(expect.any(String));
    expect(body.data.checkoutRequestId).toEqual(expect.stringMatching(/^ws_CO_/));
    expect(body.data.merchantRequestId).toEqual(expect.any(String));
    expect(body.data.status).toBe('PENDING');

    // Persisted row exists with status='processing' after stub STK call.
    const stored = store.payments.get(body.data.paymentId);
    expect(stored?.provider).toBe('mpesa');
    expect(stored?.providerTransactionId).toBe(body.data.checkoutRequestId);
  });

  it('returns 400 INVALID_AMOUNT when amount is missing/non-positive', async () => {
    const res = await api.fetch(
      jsonReq(
        'POST',
        '/payments/mpesa/stk-push',
        { invoiceId: 'inv-001', amount: 0, phone: '0712345678' },
        { authorization: `Bearer ${bearer()}` }
      )
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_AMOUNT');
  });

  it('returns 400 INVALID_PHONE for malformed phone numbers', async () => {
    const res = await api.fetch(
      jsonReq(
        'POST',
        '/payments/mpesa/stk-push',
        { invoiceId: 'inv-001', amount: 500, phone: 'not-a-phone' },
        { authorization: `Bearer ${bearer()}` }
      )
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_PHONE');
  });

  it('returns 404 INVOICE_NOT_FOUND when invoiceId does not exist for tenant', async () => {
    const res = await api.fetch(
      jsonReq(
        'POST',
        '/payments/mpesa/stk-push',
        { invoiceId: 'inv-missing', amount: 500, phone: '0712345678' },
        { authorization: `Bearer ${bearer()}` }
      )
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('INVOICE_NOT_FOUND');
  });

  it('returns 401 without bearer token', async () => {
    const res = await api.fetch(
      jsonReq('POST', '/payments/mpesa/stk-push', {
        invoiceId: 'inv-001',
        amount: 500,
        phone: '0712345678',
      })
    );
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// GET /payments/:id/status
// ---------------------------------------------------------------------------

describe('GET /payments/:id/status', () => {
  it('returns the upper-cased payment status with amount/currency', async () => {
    store.payments.set('pay-1', {
      id: 'pay-1',
      tenantId: 'tenant-001',
      customerId: 'user-001',
      invoiceId: 'inv-001',
      leaseId: null,
      paymentNumber: 'PAY-001',
      status: 'completed',
      paymentMethod: 'mpesa',
      amount: 500,
      currency: 'KES',
      netAmount: 500,
      receiptNumber: 'RKE12345',
      completedAt: new Date('2026-01-01T00:00:00Z'),
      initiatedAt: new Date(),
      createdBy: 'u',
      updatedBy: 'u',
    });

    const res = await api.fetch(
      new Request('http://x/payments/pay-1/status', {
        method: 'GET',
        headers: { authorization: `Bearer ${bearer()}` },
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.paymentId).toBe('pay-1');
    expect(body.data.status).toBe('COMPLETED');
    expect(body.data.amount).toBe(500);
    expect(body.data.currency).toBe('KES');
    expect(body.data.receiptNumber).toBe('RKE12345');
    expect(body.data.invoiceId).toBe('inv-001');
  });

  it('returns 404 for unknown payment id', async () => {
    const res = await api.fetch(
      new Request('http://x/payments/missing/status', {
        method: 'GET',
        headers: { authorization: `Bearer ${bearer()}` },
      })
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_FOUND');
  });
});

// ---------------------------------------------------------------------------
// GET /payments/:id/receipt
// ---------------------------------------------------------------------------

describe('GET /payments/:id/receipt', () => {
  it('returns receipt when payment is completed', async () => {
    const completedAt = new Date('2026-02-15T10:00:00Z');
    store.payments.set('pay-2', {
      id: 'pay-2',
      tenantId: 'tenant-001',
      customerId: 'user-001',
      invoiceId: 'inv-001',
      leaseId: null,
      paymentNumber: 'PAY-002',
      status: 'completed',
      paymentMethod: 'mpesa',
      amount: 500,
      currency: 'KES',
      netAmount: 500,
      receiptNumber: 'RKE99999',
      completedAt,
      initiatedAt: new Date(),
      createdBy: 'u',
      updatedBy: 'u',
    });

    const res = await api.fetch(
      new Request('http://x/payments/pay-2/receipt', {
        method: 'GET',
        headers: { authorization: `Bearer ${bearer()}` },
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.paymentId).toBe('pay-2');
    expect(body.data.receiptNumber).toBe('RKE99999');
    expect(body.data.amount).toBe(500);
    expect(body.data.currency).toBe('KES');
    expect(body.data.invoiceNumber).toBe('INV-0001');
  });

  it('returns 409 RECEIPT_NOT_READY when payment is still pending', async () => {
    store.payments.set('pay-3', {
      id: 'pay-3',
      tenantId: 'tenant-001',
      customerId: 'user-001',
      invoiceId: 'inv-001',
      leaseId: null,
      paymentNumber: 'PAY-003',
      status: 'pending',
      paymentMethod: 'mpesa',
      amount: 500,
      currency: 'KES',
      netAmount: 500,
      initiatedAt: new Date(),
      createdBy: 'u',
      updatedBy: 'u',
    });
    const res = await api.fetch(
      new Request('http://x/payments/pay-3/receipt', {
        method: 'GET',
        headers: { authorization: `Bearer ${bearer()}` },
      })
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe('RECEIPT_NOT_READY');
  });

  it('returns 404 for unknown payment id', async () => {
    const res = await api.fetch(
      new Request('http://x/payments/missing/receipt', {
        method: 'GET',
        headers: { authorization: `Bearer ${bearer()}` },
      })
    );
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// POST /webhooks/mpesa/callback
// ---------------------------------------------------------------------------

describe('POST /webhooks/mpesa/callback', () => {
  function callbackPayload(checkoutRequestId: string, opts?: { resultCode?: number; receipt?: string }) {
    return {
      Body: {
        stkCallback: {
          MerchantRequestID: 'mr-123',
          CheckoutRequestID: checkoutRequestId,
          ResultCode: opts?.resultCode ?? 0,
          ResultDesc: opts?.resultCode === 0 || opts?.resultCode == null ? 'Success' : 'Failed',
          CallbackMetadata: {
            Item: [
              { Name: 'Amount', Value: 500 },
              { Name: 'MpesaReceiptNumber', Value: opts?.receipt ?? 'RKE_TEST_123' },
            ],
          },
        },
      },
    };
  }

  it('returns 200 with valid HMAC signature and updates the payment', async () => {
    const checkoutId = 'ws_CO_callback_1';
    store.payments.set('pay-cb-1', {
      id: 'pay-cb-1',
      tenantId: 'tenant-001',
      customerId: 'user-001',
      invoiceId: 'inv-001',
      leaseId: null,
      paymentNumber: 'PAY-CB-1',
      status: 'processing',
      paymentMethod: 'mpesa',
      amount: 500,
      currency: 'KES',
      netAmount: 500,
      provider: 'mpesa',
      providerTransactionId: checkoutId,
      initiatedAt: new Date(),
      createdBy: 'u',
      updatedBy: 'u',
    });

    process.env.MPESA_CALLBACK_SECRET = 'test-secret';
    const payload = callbackPayload(checkoutId, { receipt: 'RKE_OK_1' });
    const raw = JSON.stringify(payload);
    const sig = `sha256=${createHmac('sha256', 'test-secret').update(raw).digest('hex')}`;

    const res = await api.fetch(
      new Request('http://x/webhooks/mpesa/callback', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-mpesa-signature': sig },
        body: raw,
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ResultCode).toBe(0);

    const updated = store.payments.get('pay-cb-1');
    expect(updated?.status).toBe('completed');
    expect(updated?.receiptNumber).toBe('RKE_OK_1');

    delete process.env.MPESA_CALLBACK_SECRET;
  });

  it('returns 401 UNAUTHORIZED with invalid HMAC signature', async () => {
    process.env.MPESA_CALLBACK_SECRET = 'test-secret';
    const payload = callbackPayload('ws_CO_callback_2');
    const raw = JSON.stringify(payload);
    const sig = `sha256=${createHmac('sha256', 'WRONG-SECRET').update(raw).digest('hex')}`;

    const res = await api.fetch(
      new Request('http://x/webhooks/mpesa/callback', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-mpesa-signature': sig },
        body: raw,
      })
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('UNAUTHORIZED');

    delete process.env.MPESA_CALLBACK_SECRET;
  });

  it('returns 401 when secret is configured but no signature header is sent', async () => {
    process.env.MPESA_CALLBACK_SECRET = 'test-secret';
    const payload = callbackPayload('ws_CO_callback_3');
    const res = await api.fetch(
      new Request('http://x/webhooks/mpesa/callback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
    );
    expect(res.status).toBe(401);
    delete process.env.MPESA_CALLBACK_SECRET;
  });

  it('accepts the callback in dev mode (no MPESA_CALLBACK_SECRET) and returns 200', async () => {
    delete process.env.MPESA_CALLBACK_SECRET;
    const res = await api.fetch(
      new Request('http://x/webhooks/mpesa/callback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(callbackPayload('ws_CO_callback_dev')),
      })
    );
    expect(res.status).toBe(200);
  });

  it('returns 400 INVALID_JSON for malformed body', async () => {
    delete process.env.MPESA_CALLBACK_SECRET;
    const res = await api.fetch(
      new Request('http://x/webhooks/mpesa/callback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: 'not json',
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_JSON');
  });

  it('marks payment as cancelled on ResultCode 1032 (user cancelled)', async () => {
    const checkoutId = 'ws_CO_cancel_1';
    store.payments.set('pay-cancel-1', {
      id: 'pay-cancel-1',
      tenantId: 'tenant-001',
      customerId: 'user-001',
      invoiceId: null,
      leaseId: null,
      paymentNumber: 'PAY-CX-1',
      status: 'processing',
      paymentMethod: 'mpesa',
      amount: 500,
      currency: 'KES',
      netAmount: 500,
      provider: 'mpesa',
      providerTransactionId: checkoutId,
      initiatedAt: new Date(),
      createdBy: 'u',
      updatedBy: 'u',
    });
    delete process.env.MPESA_CALLBACK_SECRET;
    const res = await api.fetch(
      new Request('http://x/webhooks/mpesa/callback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(callbackPayload(checkoutId, { resultCode: 1032 })),
      })
    );
    expect(res.status).toBe(200);
    expect(store.payments.get('pay-cancel-1')?.status).toBe('cancelled');
  });
});
