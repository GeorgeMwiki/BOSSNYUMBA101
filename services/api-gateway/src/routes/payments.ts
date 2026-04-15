import { Hono } from 'hono';
import { authMiddleware } from '../middleware/hono-auth';
import { databaseMiddleware } from '../middleware/database';
import { mapPaymentRow, majorToMinor, minorToMajor, paginateArray } from './db-mappers';
import { publishPaymentEvent } from '../events/payment-events';

type PaymentRow = Record<string, unknown> & { status: unknown };
type InvoiceRow = Record<string, unknown> & {
  balanceAmount: unknown;
  currency?: unknown;
  invoiceType?: unknown;
};
type ConfirmBody = { externalReference?: unknown; transactionId?: unknown; provider?: unknown };

function paymentNumber() {
  return `PAY-${Date.now().toString().slice(-6)}`;
}

const app = new Hono();
app.use('*', authMiddleware);
app.use('*', databaseMiddleware);

app.get('/', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const page = Number(c.req.query('page') || '1');
  const pageSize = Number(c.req.query('limit') || c.req.query('pageSize') || '20');
  const customerId = c.req.query('customerId');
  const status = c.req.query('status')?.toLowerCase();
  let result;
  if (customerId) result = await repos.payments.findByCustomer(customerId, auth.tenantId, 1000, 0);
  else if (status) result = await repos.payments.findByStatus(status, auth.tenantId, 1000, 0);
  else result = await repos.payments.findMany(auth.tenantId, 1000, 0);
  const items = result.items.map(mapPaymentRow);
  const paginated = paginateArray(items, page, pageSize);
  return c.json({ success: true, data: paginated.data, pagination: paginated.pagination });
});

app.get('/pending', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const result = await repos.payments.findByCustomer(auth.userId, auth.tenantId, 1000, 0);
  const items = result.items.filter((row: PaymentRow) => ['pending', 'processing'].includes(String(row.status))).map(mapPaymentRow);
  return c.json({ success: true, data: items });
});

app.get('/history', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const page = Number(c.req.query('page') || '1');
  const limit = Number(c.req.query('limit') || '20');
  const result = await repos.payments.findByCustomer(auth.userId, auth.tenantId, 1000, 0);
  const items = result.items.map(mapPaymentRow);
  const paginated = paginateArray(items, page, limit);
  return c.json({ success: true, data: paginated.data, pagination: paginated.pagination });
});

app.get('/balance', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const invoices = await repos.invoices.findByCustomer(auth.userId, auth.tenantId, 1000, 0);
  const totalDueMinor = invoices.items.reduce((sum: number, invoice: InvoiceRow) => sum + Number(invoice.balanceAmount || 0), 0);
  return c.json({
    success: true,
    data: {
      totalDue: { amount: minorToMajor(totalDueMinor), currency: invoices.items[0]?.currency || 'KES' },
      breakdown: invoices.items.map((invoice: InvoiceRow) => ({
        type: String(invoice.invoiceType || 'rent').toUpperCase(),
        amount: { amount: minorToMajor(invoice.balanceAmount), currency: invoice.currency || 'KES' },
      })),
    },
  });
});

// TODO: wire to real store — payment plans (instalment agreements). The
// customer app lists available plans and lets a tenant start a new one.
// Declared BEFORE `/:id` so the static "plans" segment wins.
app.get('/plans', (c) => {
  return c.json({ success: true, data: [] });
});

app.post('/plans', async (c) => {
  const auth = c.get('auth');
  const body = await c.req.json().catch(() => ({}));
  return c.json(
    {
      success: true,
      data: {
        id: `plan-${Date.now()}`,
        tenantId: auth.tenantId,
        userId: auth.userId,
        status: 'pending',
        createdAt: new Date().toISOString(),
        ...body,
      },
    },
    201
  );
});

app.get('/plans/:id', (c) => {
  const id = c.req.param('id');
  return c.json({
    success: true,
    data: { id, status: 'pending', instalments: [] },
  });
});

app.get('/:id', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const row = await repos.payments.findById(c.req.param('id'), auth.tenantId);
  if (!row) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Payment not found' } }, 404);
  return c.json({ success: true, data: mapPaymentRow(row) });
});

app.post('/', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const body = await c.req.json();
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
  const created = mapPaymentRow(row);
  // Fan out domain event AFTER the DB write commits. Fire-and-forget:
  // webhook + ledger delivery must not block the HTTP response.
  publishPaymentEvent({
    type: 'payment.created',
    tenantId: auth.tenantId,
    payload: {
      paymentId: row.id,
      paymentNumber: row.paymentNumber,
      customerId: row.customerId,
      leaseId: row.leaseId,
      amount: { amount: minorToMajor(amountMinor), currency },
      amountMinor,
      currency,
      status: row.status,
      description: row.description,
      createdBy: auth.userId,
    },
  });
  return c.json({ success: true, data: created }, 201);
});

app.post('/:id/process', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const body = await c.req.json();
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

app.post('/:id/confirm', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const body = (await c.req.json().catch(() => ({}))) as ConfirmBody;
  const row = await repos.payments.update(c.req.param('id'), auth.tenantId, {
    status: 'succeeded',
    completedAt: new Date(),
    externalReference: body?.externalReference ?? body?.transactionId,
    provider: body?.provider ? String(body.provider).toLowerCase() : undefined,
    updatedBy: auth.userId,
  });
  const mapped = mapPaymentRow(row);
  // Publish payment.succeeded AFTER the DB write commits so webhook
  // subscribers and the payments-ledger service can record the journal entry.
  publishPaymentEvent({
    type: 'payment.succeeded',
    tenantId: auth.tenantId,
    payload: {
      paymentId: row.id,
      paymentNumber: row.paymentNumber,
      customerId: row.customerId,
      leaseId: row.leaseId,
      amount: { amount: minorToMajor(row.amount), currency: row.currency },
      amountMinor: row.amount,
      currency: row.currency,
      status: row.status,
      externalReference: row.externalReference,
      provider: row.provider,
      confirmedBy: auth.userId,
    },
  });
  return c.json({ success: true, data: mapped });
});

export const paymentsApp = app;
