// @ts-nocheck

import { Hono } from 'hono';
import { authMiddleware } from '../middleware/hono-auth';
import { databaseMiddleware } from '../middleware/database';
import type { Repositories } from '../middleware/database';
import { mapCustomerRow, mapUnitRow, paginateArray } from './db-mappers';

type CustomerRow = Record<string, unknown> & { id: string };
type LeaseRow = Record<string, unknown> & {
  id: string;
  status: unknown;
  startDate: unknown;
  endDate: unknown;
  rentAmount: unknown;
  unitId?: string;
};

function customerCode(email: string) {
  return `CUST-${email.split('@')[0].replace(/[^A-Z0-9]+/gi, '').slice(0, 6).toUpperCase()}-${Date.now().toString().slice(-4)}`;
}

async function enrichCustomer(repos: Repositories, tenantId: string, row: CustomerRow) {
  const base = mapCustomerRow(row);
  const leases = await repos.leases.findByCustomer(row.id, tenantId, { limit: 20, offset: 0 });
  const activeLease = leases.items.find((lease: LeaseRow) => String(lease.status) === 'active');
  let currentUnit = null;
  if (activeLease?.unitId) {
    const unit = await repos.units.findById(activeLease.unitId, tenantId);
    if (unit) currentUnit = mapUnitRow(unit);
  }

  return {
    ...base,
    currentLease: activeLease
      ? {
          id: activeLease.id,
          status: String(activeLease.status).toUpperCase(),
          startDate: activeLease.startDate,
          endDate: activeLease.endDate,
          rentAmount: activeLease.rentAmount,
          unitId: activeLease.unitId,
        }
      : null,
    currentUnit:
      currentUnit && {
        id: currentUnit.id,
        unitNumber: currentUnit.unitNumber,
        propertyId: currentUnit.propertyId,
      },
  };
}

const app = new Hono();
app.use('*', authMiddleware);
app.use('*', databaseMiddleware);

app.get('/me', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const row = await repos.customers.findById(auth.userId, auth.tenantId);
  if (!row) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Customer profile not found' } }, 404);
  }
  return c.json({ success: true, data: await enrichCustomer(repos, auth.tenantId, row) });
});

app.put('/me', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const existing = await repos.customers.findById(auth.userId, auth.tenantId);
  if (!existing) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Customer profile not found' } }, 404);
  }
  const body = await c.req.json();
  const row = await repos.customers.update(
    auth.userId,
    auth.tenantId,
    {
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email,
      phone: body.phone,
      alternatePhone: body.alternatePhone,
      preferredContactMethod: body.preferredContactMethod,
      avatarUrl: body.avatarUrl,
      updatedBy: auth.userId,
    },
    auth.userId
  );
  return c.json({ success: true, data: await enrichCustomer(repos, auth.tenantId, row) });
});

app.get('/', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const page = Number(c.req.query('page') || '1');
  const pageSize = Number(c.req.query('pageSize') || '20');
  const search = c.req.query('search');
  const status = c.req.query('status');

  const result = await repos.customers.findMany(auth.tenantId, { limit: 1000, offset: 0 }, { search, status: status?.toLowerCase() });
  const enriched = await Promise.all(result.items.map((row: CustomerRow) => enrichCustomer(repos, auth.tenantId, row)));
  const paginated = paginateArray(enriched, page, pageSize);
  return c.json({ success: true, data: paginated.data, pagination: paginated.pagination });
});

app.get('/:id', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const row = await repos.customers.findById(c.req.param('id'), auth.tenantId);
  if (!row) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } }, 404);
  return c.json({ success: true, data: await enrichCustomer(repos, auth.tenantId, row) });
});

app.post('/', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const body = await c.req.json();
  const row = await repos.customers.create(
    {
      id: crypto.randomUUID(),
      tenantId: auth.tenantId,
      customerCode: customerCode(body.email || body.phone || 'customer'),
      email: body.email,
      phone: body.phone,
      firstName: body.firstName,
      lastName: body.lastName,
      status: 'active',
      kycStatus: 'pending',
      createdBy: auth.userId,
      updatedBy: auth.userId,
    },
    auth.userId
  );
  return c.json({ success: true, data: await enrichCustomer(repos, auth.tenantId, row) }, 201);
});

app.put('/:id', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const id = c.req.param('id');
  const existing = await repos.customers.findById(id, auth.tenantId);
  if (!existing) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } }, 404);
  const body = await c.req.json();
  const row = await repos.customers.update(
    id,
    auth.tenantId,
    {
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email,
      phone: body.phone,
      alternatePhone: body.alternatePhone,
      status: body.status?.toLowerCase(),
      kycStatus: body.verificationStatus?.toLowerCase(),
      updatedBy: auth.userId,
    },
    auth.userId
  );
  return c.json({ success: true, data: await enrichCustomer(repos, auth.tenantId, row) });
});

app.delete('/:id', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const id = c.req.param('id');
  await repos.customers.delete(id, auth.tenantId, auth.userId);
  return c.json({ success: true, data: { message: 'Customer deleted' } });
});

export const customersRouter = app;
