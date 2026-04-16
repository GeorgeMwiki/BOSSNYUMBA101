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
const PaymentProcessSchema = z.object({
  channel: z.enum(['mpesa', 'bank', 'card', 'cash', 'manual', 'other']).optional(),
  paymentMethodId: z.string().optional(),
  phoneNumber: z.string().regex(/^[+0-9 \-()]+$/).max(24).optional(),
});

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
      totalDue: { amount: minorToMajor(totalDueMinor), currency: invoices.items[0]?.currency || 'KES' },
      breakdown: invoices.items.map((invoice: any) => ({
        type: String(invoice.invoiceType || 'rent').toUpperCase(),
        amount: { amount: minorToMajor(invoice.balanceAmount), currency: invoice.currency || 'KES' },
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
  const currency = body.amount?.currency || 'KES';
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

app.post('/:id/process', zValidator('json', PaymentProcessSchema), async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const body = c.req.valid('json');
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
