import { Hono } from 'hono';
import { authMiddleware } from '../middleware/hono-auth';
import { databaseMiddleware } from '../middleware/database';
import type { Repositories } from '../middleware/database';
import { majorToMinor, mapInvoiceRow, paginateArray } from './db-mappers';

type InvoiceRow = Record<string, unknown> & {
  customerId: string;
  leaseId?: string;
  unitId?: string;
};

function invoiceNumber() {
  return `INV-${Date.now().toString().slice(-6)}`;
}

async function enrichInvoice(repos: Repositories, tenantId: string, row: InvoiceRow) {
  const invoice = mapInvoiceRow(row);
  const [customer, lease, unit] = await Promise.all([
    repos.customers.findById(row.customerId, tenantId),
    row.leaseId ? repos.leases.findById(row.leaseId, tenantId) : null,
    row.unitId ? repos.units.findById(row.unitId, tenantId) : null,
  ]);
  return {
    ...invoice,
    customer: customer ? { id: customer.id, name: `${customer.firstName} ${customer.lastName}` } : undefined,
    unit: unit ? { id: unit.id, unitNumber: unit.unitCode } : undefined,
    leaseId: lease?.id ?? invoice.leaseId,
  };
}

const app = new Hono();
app.use('*', authMiddleware);
app.use('*', databaseMiddleware);

app.get('/', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const page = Number(c.req.query('page') || '1');
  const pageSize = Number(c.req.query('pageSize') || '20');
  const status = c.req.query('status')?.toLowerCase();
  const customerId = c.req.query('customerId');
  const leaseId = c.req.query('leaseId');

  let result;
  if (customerId) result = await repos.invoices.findByCustomer(customerId, auth.tenantId, 1000, 0);
  else if (leaseId) result = await repos.invoices.findByLease(leaseId, auth.tenantId, 1000, 0);
  else if (status) result = await repos.invoices.findByStatus(status, auth.tenantId, 1000, 0);
  else result = await repos.invoices.findMany(auth.tenantId, 1000, 0);

  const items = await Promise.all(result.items.map((row: InvoiceRow) => enrichInvoice(repos, auth.tenantId, row)));
  const paginated = paginateArray(items, page, pageSize);
  return c.json({ success: true, data: paginated.data, pagination: paginated.pagination });
});

app.get('/overdue', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const page = Number(c.req.query('page') || '1');
  const pageSize = Number(c.req.query('pageSize') || '20');
  const rows = await repos.invoices.findOverdue(auth.tenantId);
  const items = await Promise.all(rows.map((row: InvoiceRow) => enrichInvoice(repos, auth.tenantId, row)));
  const paginated = paginateArray(items, page, pageSize);
  return c.json({ success: true, data: paginated.data, pagination: paginated.pagination });
});

app.get('/:id', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const row = await repos.invoices.findById(c.req.param('id'), auth.tenantId);
  if (!row) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Invoice not found' } }, 404);
  return c.json({ success: true, data: await enrichInvoice(repos, auth.tenantId, row) });
});

app.post('/', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const body = await c.req.json();
  const lease = body.leaseId ? await repos.leases.findById(body.leaseId, auth.tenantId) : null;
  const unit = lease?.unitId ? await repos.units.findById(lease.unitId, auth.tenantId) : null;
  const subtotal = majorToMinor(body.subtotal);
  const tax = majorToMinor(body.tax || 0);
  const total = subtotal + tax;
  const row = await repos.invoices.create({
    id: crypto.randomUUID(),
    tenantId: auth.tenantId,
    customerId: body.customerId,
    leaseId: body.leaseId,
    propertyId: lease?.propertyId,
    unitId: unit?.id,
    invoiceNumber: invoiceNumber(),
    invoiceType: String(body.type || 'rent').toLowerCase(),
    status: 'draft',
    issueDate: new Date(),
    dueDate: new Date(body.dueDate),
    periodStart: body.periodStart ? new Date(body.periodStart) : undefined,
    periodEnd: body.periodEnd ? new Date(body.periodEnd) : undefined,
    subtotalAmount: subtotal,
    taxAmount: tax,
    totalAmount: total,
    paidAmount: 0,
    balanceAmount: total,
    currency: body.currency || 'KES',
    lineItems: body.lineItems || [],
    createdBy: auth.userId,
    updatedBy: auth.userId,
  });
  return c.json({ success: true, data: await enrichInvoice(repos, auth.tenantId, row) }, 201);
});

app.put('/:id', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const body = await c.req.json();
  const existing = await repos.invoices.findById(c.req.param('id'), auth.tenantId);
  if (!existing) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Invoice not found' } }, 404);
  const subtotal = body.subtotal != null ? majorToMinor(body.subtotal) : undefined;
  const tax = body.tax != null ? majorToMinor(body.tax) : undefined;
  const total = subtotal != null || tax != null ? (subtotal ?? existing.subtotalAmount) + (tax ?? existing.taxAmount) : undefined;
  const paid = existing.paidAmount ?? 0;
  const row = await repos.invoices.update(c.req.param('id'), auth.tenantId, {
    customerId: body.customerId,
    leaseId: body.leaseId,
    invoiceType: body.type ? String(body.type).toLowerCase() : undefined,
    dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
    periodStart: body.periodStart ? new Date(body.periodStart) : undefined,
    periodEnd: body.periodEnd ? new Date(body.periodEnd) : undefined,
    subtotalAmount: subtotal,
    taxAmount: tax,
    totalAmount: total,
    balanceAmount: total != null ? Math.max(total - paid, 0) : undefined,
    currency: body.currency,
    lineItems: body.lineItems,
    updatedBy: auth.userId,
  });
  return c.json({ success: true, data: await enrichInvoice(repos, auth.tenantId, row) });
});

app.post('/:id/send', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const row = await repos.invoices.update(c.req.param('id'), auth.tenantId, { status: 'sent', sentAt: new Date(), updatedBy: auth.userId });
  return c.json({ success: true, data: await enrichInvoice(repos, auth.tenantId, row) });
});

app.get('/:id/pdf', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const row = await repos.invoices.findById(c.req.param('id'), auth.tenantId);
  if (!row) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Invoice not found' } }, 404);
  return c.json({
    success: true,
    data: {
      pdfUrl: row.pdfUrl || undefined,
      invoiceNumber: row.invoiceNumber,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      contentType: 'application/pdf',
    },
  });
});

app.delete('/:id', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const row = await repos.invoices.update(c.req.param('id'), auth.tenantId, {
    status: 'cancelled',
    cancelledAt: new Date(),
    cancelledBy: auth.userId,
    updatedBy: auth.userId,
  });
  return c.json({ success: true, data: await enrichInvoice(repos, auth.tenantId, row) });
});

export const invoicesApp = app;
