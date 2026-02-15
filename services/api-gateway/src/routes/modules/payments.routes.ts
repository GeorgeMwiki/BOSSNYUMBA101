/**
 * Payments API Routes - Module E
 * GET /api/invoices, POST /api/invoices
 * POST /api/payments/initiate, POST /api/payments/callback
 * POST /api/reconciliation/match, GET /api/statements/:customerId
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { authMiddleware } from '../../middleware/hono-auth';
import { validationErrorHook } from '../validators';

const app = new Hono();

// Schemas
const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const listInvoicesSchema = paginationSchema.extend({
  status: z.enum(['draft', 'sent', 'paid', 'partially_paid', 'overdue', 'cancelled']).optional(),
  customerId: z.string().optional(),
  leaseId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

const createInvoiceSchema = z.object({
  customerId: z.string().min(1),
  leaseId: z.string().optional(),
  propertyId: z.string().min(1),
  unitId: z.string().optional(),
  dueDate: z.string().min(1),
  periodStart: z.string().min(1),
  periodEnd: z.string().min(1),
  lineItems: z.array(z.object({
    type: z.enum(['rent', 'deposit', 'late_fee', 'utility', 'service_charge', 'maintenance', 'other']),
    description: z.string().min(1),
    quantity: z.number().min(1).default(1),
    unitPrice: z.number().min(0),
    taxRate: z.number().min(0).max(100).optional(),
  })).min(1),
  notes: z.string().max(2000).optional(),
});

const initiatePaymentSchema = z.object({
  invoiceId: z.string().optional(),
  customerId: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().length(3).default('KES'),
  method: z.enum(['mpesa', 'bank_transfer', 'card', 'cash']),
  phone: z.string().optional(),
  description: z.string().max(255).optional(),
});

const paymentCallbackSchema = z.object({
  provider: z.enum(['mpesa', 'pesapal', 'flutterwave']),
  transactionId: z.string(),
  status: z.enum(['success', 'failed', 'pending']),
  amount: z.number().optional(),
  reference: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const reconcileSchema = z.object({
  paymentId: z.string().min(1),
  invoiceId: z.string().min(1),
  notes: z.string().max(500).optional(),
});

const customerIdSchema = z.object({ customerId: z.string().min(1) });

// In-memory storage
const invoices: Record<string, unknown> = {};
const payments: Record<string, unknown> = {};

app.use('*', authMiddleware);

// GET /invoices - List invoices
app.get('/', zValidator('query', listInvoicesSchema, validationErrorHook), (c) => {
  const auth = c.get('auth');
  const query = c.req.valid('query');
  
  const demoInvoices = [
    { id: 'inv-001', tenantId: auth.tenantId, customerId: 'cust-1', status: 'sent', total: { amount: 50000, currency: 'KES' }, dueDate: '2026-02-28', periodStart: '2026-02-01', periodEnd: '2026-02-28' },
    { id: 'inv-002', tenantId: auth.tenantId, customerId: 'cust-2', status: 'paid', total: { amount: 75000, currency: 'KES' }, dueDate: '2026-02-28', paidAt: '2026-02-15' },
    { id: 'inv-003', tenantId: auth.tenantId, customerId: 'cust-1', status: 'overdue', total: { amount: 50000, currency: 'KES' }, dueDate: '2026-01-31' },
  ];

  let filtered = demoInvoices;
  if (query.status) filtered = filtered.filter(i => i.status === query.status);
  if (query.customerId) filtered = filtered.filter(i => i.customerId === query.customerId);

  return c.json({
    success: true,
    data: filtered,
    pagination: { page: query.page, pageSize: query.pageSize, total: filtered.length },
  });
});

// POST /invoices - Create invoice
app.post('/', zValidator('json', createInvoiceSchema, validationErrorHook), (c) => {
  const auth = c.get('auth');
  const body = c.req.valid('json');
  const now = new Date().toISOString();
  const id = `inv_${Date.now()}`;

  let subtotal = 0;
  let taxTotal = 0;
  const lineItems = body.lineItems.map((item, idx) => {
    const amount = item.quantity * item.unitPrice;
    const tax = amount * ((item.taxRate ?? 0) / 100);
    subtotal += amount;
    taxTotal += tax;
    return { id: `item_${idx}`, ...item, amount, taxAmount: tax };
  });

  const invoice = {
    id,
    tenantId: auth.tenantId,
    invoiceNumber: `INV-${new Date().getFullYear()}-${Date.now() % 10000}`,
    customerId: body.customerId,
    leaseId: body.leaseId,
    propertyId: body.propertyId,
    unitId: body.unitId,
    status: 'draft',
    issueDate: now,
    dueDate: body.dueDate,
    periodStart: body.periodStart,
    periodEnd: body.periodEnd,
    lineItems,
    subtotal: { amount: subtotal, currency: 'KES' },
    taxTotal: { amount: taxTotal, currency: 'KES' },
    total: { amount: subtotal + taxTotal, currency: 'KES' },
    amountPaid: { amount: 0, currency: 'KES' },
    amountDue: { amount: subtotal + taxTotal, currency: 'KES' },
    notes: body.notes,
    createdAt: now,
    createdBy: auth.userId,
  };

  invoices[id] = invoice;

  return c.json({ success: true, data: invoice }, 201);
});

export const invoicesRouter = app;

// Separate Hono app for payments
const paymentsApp = new Hono();
paymentsApp.use('*', authMiddleware);

// POST /payments/initiate - Initiate payment
paymentsApp.post('/initiate', zValidator('json', initiatePaymentSchema, validationErrorHook), (c) => {
  const auth = c.get('auth');
  const body = c.req.valid('json');
  const now = new Date().toISOString();
  const id = `pay_${Date.now()}`;

  const payment = {
    id,
    tenantId: auth.tenantId,
    paymentNumber: `PAY-${new Date().getFullYear()}-${Date.now() % 10000}`,
    invoiceId: body.invoiceId,
    customerId: body.customerId,
    status: body.method === 'cash' ? 'completed' : 'pending',
    method: body.method,
    amount: { amount: body.amount, currency: body.currency },
    phone: body.phone,
    description: body.description,
    externalId: body.method === 'mpesa' ? `ws_CO_${Date.now()}` : null,
    createdAt: now,
    createdBy: auth.userId,
  };

  payments[id] = payment;

  if (body.method === 'mpesa') {
    return c.json({
      success: true,
      data: {
        paymentId: id,
        checkoutRequestId: payment.externalId,
        status: 'pending',
        message: 'STK push sent. Please check your phone to complete payment.',
      },
    }, 202);
  }

  return c.json({ success: true, data: payment }, 201);
});

// POST /payments/callback - Payment gateway callback
paymentsApp.post('/callback', async (c) => {
  const rawBody = await c.req.text();
  let parsed: unknown;
  
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return c.json({ success: false, error: { code: 'INVALID_JSON', message: 'Invalid JSON body' } }, 400);
  }

  const result = paymentCallbackSchema.safeParse(parsed);
  if (!result.success) {
    return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid callback payload' } }, 400);
  }

  const callback = result.data;
  
  // In production, find payment by transactionId and update
  console.log('Payment callback received:', callback);

  return c.json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

export const paymentsRouter = paymentsApp;

// Separate app for reconciliation
const reconciliationApp = new Hono();
reconciliationApp.use('*', authMiddleware);

// POST /reconciliation/match - Match payment to invoice
reconciliationApp.post('/match', zValidator('json', reconcileSchema, validationErrorHook), (c) => {
  const auth = c.get('auth');
  const body = c.req.valid('json');
  const now = new Date().toISOString();

  const reconciliation = {
    id: `rec_${Date.now()}`,
    tenantId: auth.tenantId,
    paymentId: body.paymentId,
    invoiceId: body.invoiceId,
    status: 'matched',
    matchedAt: now,
    matchedBy: auth.userId,
    notes: body.notes,
  };

  return c.json({
    success: true,
    data: {
      reconciliation,
      message: 'Payment matched to invoice successfully',
    },
  });
});

export const reconciliationRouter = reconciliationApp;

// Separate app for statements
const statementsApp = new Hono();
statementsApp.use('*', authMiddleware);

// GET /statements/:customerId - Get customer statement
statementsApp.get('/:customerId', zValidator('param', customerIdSchema), (c) => {
  const auth = c.get('auth');
  const { customerId } = c.req.valid('param');

  const statement = {
    customerId,
    tenantId: auth.tenantId,
    generatedAt: new Date().toISOString(),
    periodStart: '2026-01-01',
    periodEnd: '2026-02-13',
    openingBalance: { amount: 0, currency: 'KES' },
    closingBalance: { amount: 25000, currency: 'KES' },
    transactions: [
      { date: '2026-01-05', type: 'invoice', description: 'Rent Jan 2026', debit: 50000, credit: 0, balance: 50000, reference: 'INV-2026-001' },
      { date: '2026-01-10', type: 'payment', description: 'M-Pesa Payment', debit: 0, credit: 50000, balance: 0, reference: 'PAY-2026-001' },
      { date: '2026-02-05', type: 'invoice', description: 'Rent Feb 2026', debit: 50000, credit: 0, balance: 50000, reference: 'INV-2026-002' },
      { date: '2026-02-10', type: 'payment', description: 'Bank Transfer', debit: 0, credit: 25000, balance: 25000, reference: 'PAY-2026-002' },
    ],
    summary: {
      totalInvoiced: { amount: 100000, currency: 'KES' },
      totalPaid: { amount: 75000, currency: 'KES' },
      totalOutstanding: { amount: 25000, currency: 'KES' },
    },
  };

  return c.json({ success: true, data: statement });
});

export const statementsRouter = statementsApp;
