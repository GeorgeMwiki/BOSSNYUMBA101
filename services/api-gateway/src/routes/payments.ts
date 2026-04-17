// @ts-nocheck

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { authMiddleware } from '../middleware/hono-auth';
import { databaseMiddleware } from '../middleware/database';
import { mapPaymentRow, majorToMinor, minorToMajor, paginateArray } from './db-mappers';
import { parseListPagination, buildListResponse } from './pagination';

const MoneySchema = z.object({
  amount: z.number().positive(),
  currency: z.string().length(3).optional(),
});
const PaymentCreateSchema = z.object({
  customerId: z.string().optional(),
  leaseId: z.string().optional(),
  amount: MoneySchema,
  description: z.string().max(500).optional(),
});
// Payment channel values must align with the DB enum
// (packages/database/src/schemas/payment.schema.ts:payment_method). Legacy
// client values 'bank' and 'manual' are accepted and normalized to the
// canonical 'bank_transfer' / 'cheque' before persistence.
const PAYMENT_CHANNEL_VALUES = ['mpesa', 'bank_transfer', 'card', 'cash', 'cheque', 'other'] as const;
const PaymentProcessSchema = z.object({
  channel: z
    .union([
      z.enum(PAYMENT_CHANNEL_VALUES),
      z.enum(['bank', 'manual']), // legacy aliases
    ])
    .optional(),
  paymentMethodId: z.string().optional(),
  phoneNumber: z.string().regex(/^[+0-9 \-()]+$/).max(24).optional(),
});
function normalizeChannel(raw: string | undefined): string {
  if (!raw) return 'other';
  if (raw === 'bank') return 'bank_transfer';
  if (raw === 'manual') return 'cheque';
  return raw;
}

function paymentNumber() {
  return `PAY-${Date.now().toString().slice(-6)}`;
}

const app = new Hono();
app.use('*', authMiddleware);
app.use('*', databaseMiddleware);

app.get('/', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const p = parseListPagination(c);
  const customerId = c.req.query('customerId');
  const status = c.req.query('status')?.toLowerCase();
  let result;
  if (customerId) result = await repos.payments.findByCustomer(customerId, auth.tenantId, p.limit, p.offset);
  else if (status) result = await repos.payments.findByStatus(status, auth.tenantId, p.limit, p.offset);
  else result = await repos.payments.findMany(auth.tenantId, p.limit, p.offset);
  const items = result.items.map(mapPaymentRow);
  return c.json({ success: true, ...buildListResponse(items, result.total ?? items.length, p) });
});

app.get('/pending', async (c) => {
  // Pending/processing is a small window per customer; cap at 100.
  const auth = c.get('auth');
  const repos = c.get('repos');
  const result = await repos.payments.findByCustomer(auth.userId, auth.tenantId, 100, 0);
  const items = result.items.filter((row: any) => ['pending', 'processing'].includes(String(row.status))).map(mapPaymentRow);
  return c.json({ success: true, data: items });
});

app.get('/history', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const p = parseListPagination(c);
  const result = await repos.payments.findByCustomer(auth.userId, auth.tenantId, p.limit, p.offset);
  const items = result.items.map(mapPaymentRow);
  return c.json({ success: true, ...buildListResponse(items, result.total ?? items.length, p) });
});

app.get('/balance', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const invoices = await repos.invoices.findByCustomer(auth.userId, auth.tenantId, 1000, 0);
  const totalDueMinor = invoices.items.reduce((sum: number, invoice: any) => sum + Number(invoice.balanceAmount || 0), 0);
  return c.json({
    success: true,
    data: {
      totalDue: { amount: minorToMajor(totalDueMinor), currency: invoices.items[0]?.currency || 'USD' },
      breakdown: invoices.items.map((invoice: any) => ({
        type: String(invoice.invoiceType || 'rent').toUpperCase(),
        amount: { amount: minorToMajor(invoice.balanceAmount), currency: invoice.currency || 'USD' },
      })),
    },
  });
});

app.get('/:id', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const row = await repos.payments.findById(c.req.param('id'), auth.tenantId);
  if (!row) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Payment not found' } }, 404);
  return c.json({ success: true, data: mapPaymentRow(row) });
});

app.post('/', zValidator('json', PaymentCreateSchema), async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const body = c.req.valid('json');
  const currency = body.amount?.currency || 'USD';
  const amountMinor = majorToMinor(body.amount?.amount);
  const row = await repos.payments.create({
    id: crypto.randomUUID(),
    tenantId: auth.tenantId,
    customerId: body.customerId || auth.userId,
    leaseId: body.leaseId,
    paymentNumber: paymentNumber(),
    status: 'pending',
    paymentMethod: 'other',
    amount: amountMinor,
    currency,
    netAmount: amountMinor,
    description: body.description,
    initiatedAt: new Date(),
    createdBy: auth.userId,
    updatedBy: auth.userId,
  });
  return c.json({ success: true, data: mapPaymentRow(row) }, 201);
});

// Payment plans — allow tenants in arrears to set up instalment
// schedules. These are shallow wrappers over the payments repo; the
// orchestration lives in services/domain-services.
const PaymentPlanCreateSchema = z.object({
  invoiceId: z.string().optional(),
  totalAmount: z.number().positive(),
  currency: z.string().length(3).default('USD'),
  instalments: z.number().int().min(1).max(24),
  firstInstalmentDate: z.string().refine(
    (s) => !Number.isNaN(new Date(s).getTime()),
    'invalid date'
  ),
  notes: z.string().max(500).optional(),
});

app.post('/plans', zValidator('json', PaymentPlanCreateSchema), async (c) => {
  const auth = c.get('auth');
  const body = c.req.valid('json');
  // Compute the equal-instalment amount. Last instalment absorbs
  // rounding so the sum equals totalAmount exactly.
  const totalMinor = majorToMinor(body.totalAmount);
  const per = Math.floor(totalMinor / body.instalments);
  const remainder = totalMinor - per * body.instalments;
  const schedule: Array<{ instalment: number; dueDate: string; amountMinor: number }> = [];
  const firstDate = new Date(body.firstInstalmentDate);
  for (let i = 0; i < body.instalments; i++) {
    const amountMinor = i === body.instalments - 1 ? per + remainder : per;
    const due = new Date(firstDate.getFullYear(), firstDate.getMonth() + i, firstDate.getDate());
    schedule.push({
      instalment: i + 1,
      dueDate: due.toISOString(),
      amountMinor,
    });
  }
  const plan = {
    id: `plan_${crypto.randomUUID()}`,
    tenantId: auth.tenantId,
    customerId: auth.userId,
    invoiceId: body.invoiceId,
    status: 'proposed' as const,
    totalAmount: { amount: body.totalAmount, currency: body.currency },
    instalments: body.instalments,
    firstInstalmentDate: body.firstInstalmentDate,
    schedule,
    notes: body.notes,
    createdBy: auth.userId,
    createdAt: new Date().toISOString(),
  };
  return c.json({ success: true, data: plan }, 201);
});

app.get('/plans', async (c) => {
  const auth = c.get('auth');
  // Live data lives in domain-services payment-plan repo; until that
  // wiring is complete, return an empty envelope so the client UI can
  // render its empty state instead of throwing on the missing route.
  return c.json({
    success: true,
    data: [],
    pagination: {
      page: 1,
      pageSize: 20,
      totalItems: 0,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    },
    meta: { tenantId: auth.tenantId, note: 'payment-plans repo wiring pending' },
  });
});

app.get('/plans/:id', async (c) => {
  const id = c.req.param('id');
  // Same placeholder until the repo is wired.
  return c.json(
    { success: false, error: { code: 'NOT_FOUND', message: `Payment plan ${id} not found` } },
    404
  );
});

app.post('/:id/process', zValidator('json', PaymentProcessSchema), async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const raw = c.req.valid('json');
  const body = { ...raw, channel: normalizeChannel(String(raw.channel ?? '')) };
  const row = await repos.payments.update(c.req.param('id'), auth.tenantId, {
    status: 'processing',
    paymentMethod: String(body.channel || body.paymentMethodId || 'other').toLowerCase(),
    payerPhone: body.phoneNumber,
    provider: String(body.channel || 'manual').toLowerCase(),
    externalReference: body.paymentMethodId,
    updatedBy: auth.userId,
  });
  return c.json({ success: true, data: mapPaymentRow(row) });
});

export const paymentsApp = app;
