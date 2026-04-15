import { Hono } from 'hono';
import { authMiddleware } from '../middleware/hono-auth';
import { databaseMiddleware } from '../middleware/database';
import type { Repositories } from '../middleware/database';
import { mapLeaseRow, majorToMinor, paginateArray } from './db-mappers';

type LeaseRow = Record<string, unknown> & {
  unitId: string;
  customerId: string;
  propertyId: string;
  endDate: Date | string;
};

function leaseNumber() {
  return `LSE-${Date.now().toString().slice(-6)}`;
}

async function enrichLease(repos: Repositories, tenantId: string, row: LeaseRow) {
  const lease = mapLeaseRow(row);
  const [unit, customer, property] = await Promise.all([
    repos.units.findById(row.unitId, tenantId),
    repos.customers.findById(row.customerId, tenantId),
    repos.properties.findById(row.propertyId, tenantId),
  ]);

  return {
    ...lease,
    unit: unit ? { id: unit.id, unitNumber: unit.unitCode } : undefined,
    customer: customer ? { id: customer.id, name: `${customer.firstName} ${customer.lastName}` } : undefined,
    property: property ? { id: property.id, name: property.name } : undefined,
  };
}

const app = new Hono();
app.use('*', authMiddleware);
app.use('*', databaseMiddleware);

app.get('/current', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const result = await repos.leases.findByCustomer(auth.userId, auth.tenantId, { limit: 20, offset: 0 });
  const lease = result.items.find((item: LeaseRow & { status?: unknown }) => String(item.status) === 'active') || result.items[0];
  if (!lease) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Current lease not found' } }, 404);
  }
  return c.json({ success: true, data: await enrichLease(repos, auth.tenantId, lease) });
});

app.get('/expiring', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const page = Number(c.req.query('page') || '1');
  const pageSize = Number(c.req.query('pageSize') || '20');
  const days = Number(c.req.query('days') || '60');
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + days);
  const result = await repos.leases.findMany(auth.tenantId, { limit: 1000, offset: 0 }, { status: 'active' });
  const expiring = result.items.filter((row: LeaseRow) => new Date(row.endDate) <= cutoff);
  const enriched = await Promise.all(expiring.map((row: LeaseRow) => enrichLease(repos, auth.tenantId, row)));
  const paginated = paginateArray(enriched, page, pageSize);
  return c.json({ success: true, data: paginated.data, pagination: paginated.pagination });
});

app.get('/', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const page = Number(c.req.query('page') || '1');
  const pageSize = Number(c.req.query('pageSize') || '20');
  const filters = {
    status: c.req.query('status')?.toLowerCase(),
    propertyId: c.req.query('propertyId'),
    customerId: c.req.query('customerId'),
  };
  const result = await repos.leases.findMany(auth.tenantId, { limit: 1000, offset: 0 }, filters);
  const enriched = await Promise.all(result.items.map((row: LeaseRow) => enrichLease(repos, auth.tenantId, row)));
  const paginated = paginateArray(enriched, page, pageSize);
  return c.json({ success: true, data: paginated.data, pagination: paginated.pagination });
});

app.get('/:id', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const row = await repos.leases.findById(c.req.param('id'), auth.tenantId);
  if (!row) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Lease not found' } }, 404);
  return c.json({ success: true, data: await enrichLease(repos, auth.tenantId, row) });
});

app.post('/', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const body = await c.req.json();
  const unit = await repos.units.findById(body.unitId, auth.tenantId);
  if (!unit) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Unit not found' } }, 404);

  const row = await repos.leases.create(
    {
      id: crypto.randomUUID(),
      tenantId: auth.tenantId,
      propertyId: unit.propertyId,
      unitId: body.unitId,
      customerId: body.customerId,
      leaseNumber: leaseNumber(),
      leaseType: 'fixed_term',
      status: 'draft',
      startDate: new Date(body.startDate),
      endDate: new Date(body.endDate),
      rentAmount: majorToMinor(body.rentAmount),
      securityDepositAmount: majorToMinor(body.depositAmount),
      securityDepositPaid: 0,
      rentDueDay: body.paymentDueDay || 1,
      gracePeriodDays: body.terms?.gracePeriodDays || 5,
      noticePeriodDays: body.terms?.noticePeriodDays || 30,
      utilitiesIncludedInRent: body.terms?.utilitiesIncluded || [],
      primaryOccupant: { name: 'Primary Occupant', relationship: 'self' },
      createdBy: auth.userId,
      updatedBy: auth.userId,
    },
    auth.userId
  );

  return c.json({ success: true, data: await enrichLease(repos, auth.tenantId, row) }, 201);
});

app.put('/:id', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const id = c.req.param('id');
  const existing = await repos.leases.findById(id, auth.tenantId);
  if (!existing) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Lease not found' } }, 404);
  const body = await c.req.json();
  const row = await repos.leases.update(
    id,
    auth.tenantId,
    {
      startDate: body.startDate ? new Date(body.startDate) : undefined,
      endDate: body.endDate ? new Date(body.endDate) : undefined,
      rentAmount: body.rentAmount != null ? majorToMinor(body.rentAmount) : undefined,
      securityDepositAmount: body.depositAmount != null ? majorToMinor(body.depositAmount) : undefined,
      rentDueDay: body.paymentDueDay,
      gracePeriodDays: body.terms?.gracePeriodDays,
      noticePeriodDays: body.terms?.noticePeriodDays,
      utilitiesIncludedInRent: body.terms?.utilitiesIncluded,
      updatedBy: auth.userId,
    },
    auth.userId
  );
  return c.json({ success: true, data: await enrichLease(repos, auth.tenantId, row) });
});

app.post('/:id/activate', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const row = await repos.leases.update(c.req.param('id'), auth.tenantId, { status: 'active', activatedAt: new Date(), activatedBy: auth.userId }, auth.userId);
  return c.json({ success: true, data: await enrichLease(repos, auth.tenantId, row) });
});

app.post('/:id/terminate', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const body = await c.req.json().catch(() => null);
  if (body !== null && typeof body !== 'object') {
    return c.json({ success: false, error: { code: 'INVALID_BODY', message: 'Invalid JSON body' } }, 400);
  }
  const safeBody = (body ?? {}) as Record<string, unknown>;
  const row = await repos.leases.update(
    c.req.param('id'),
    auth.tenantId,
    {
      status: 'terminated',
      terminatedAt: new Date(),
      terminationReason: safeBody.reason ? 'other' : undefined,
      terminationNotes: safeBody.reason as string | undefined,
      terminatedBy: auth.userId,
    },
    auth.userId
  );
  return c.json({ success: true, data: await enrichLease(repos, auth.tenantId, row) });
});

app.post('/:id/renew', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const id = c.req.param('id');
  const existing = await repos.leases.findById(id, auth.tenantId);
  if (!existing) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Lease not found' } }, 404);
  const body = await c.req.json().catch(() => null);
  if (body !== null && typeof body !== 'object') {
    return c.json({ success: false, error: { code: 'INVALID_BODY', message: 'Invalid JSON body' } }, 400);
  }
  const renewBody = (body ?? {}) as {
    newEndDate?: string;
    extendMonths?: number | string;
    newRentAmount?: number;
  };
  const currentEnd = new Date(existing.endDate);
  const newEnd = renewBody.newEndDate
    ? new Date(renewBody.newEndDate)
    : new Date(currentEnd.getFullYear(), currentEnd.getMonth() + Number(renewBody.extendMonths || 12), currentEnd.getDate());

  const row = await repos.leases.update(
    id,
    auth.tenantId,
    {
      status: 'renewed',
      endDate: newEnd,
      rentAmount: renewBody.newRentAmount != null ? majorToMinor(renewBody.newRentAmount) : undefined,
      updatedBy: auth.userId,
    },
    auth.userId
  );
  return c.json({ success: true, data: await enrichLease(repos, auth.tenantId, row) });
});

app.delete('/:id', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  await repos.leases.delete(c.req.param('id'), auth.tenantId, auth.userId);
  return c.json({ success: true, data: { message: 'Lease deleted' } });
});

export const leasesRouter = app;
