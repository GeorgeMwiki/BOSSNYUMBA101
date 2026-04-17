// @ts-nocheck

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { authMiddleware } from '../middleware/hono-auth';
import { databaseMiddleware } from '../middleware/database';
import { mapCustomerRow, mapUnitRow, paginateArray } from './db-mappers';
import { parseListPagination, buildListResponse } from './pagination';

const phoneSchema = z.string().min(6).max(24).regex(/^[+0-9 \-()]+$/, 'invalid phone');
const CustomerCreateSchema = z.object({
  email: z.string().email().max(255).optional(),
  phone: phoneSchema.optional(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
}).refine((b) => b.email || b.phone, {
  message: 'email or phone is required',
});
const CustomerUpdateSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  email: z.string().email().max(255).optional(),
  phone: phoneSchema.optional(),
  alternatePhone: phoneSchema.optional(),
  status: z.string().optional(),
  kycStatus: z.string().optional(),
  verificationStatus: z.string().optional(),
  preferredContactMethod: z.enum(['email', 'sms', 'whatsapp', 'phone']).optional(),
  avatarUrl: z.string().url().optional(),
});

function customerCode(email: string) {
  return `CUST-${email.split('@')[0].replace(/[^A-Z0-9]+/gi, '').slice(0, 6).toUpperCase()}-${Date.now().toString().slice(-4)}`;
}

async function enrichCustomer(repos: any, tenantId: string, row: any) {
  const base = mapCustomerRow(row);
  const leases = await repos.leases.findByCustomer(row.id, tenantId, { limit: 20, offset: 0 });
  const activeLease = leases.items.find((lease: any) => String(lease.status) === 'active');
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

app.put('/me', zValidator('json', CustomerUpdateSchema), async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const existing = await repos.customers.findById(auth.userId, auth.tenantId);
  if (!existing) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Customer profile not found' } }, 404);
  }
  const body = c.req.valid('json');
  const row = await repos.customers.update(
    auth.userId,
    auth.tenantId,
    {
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email?.trim().toLowerCase(),
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
  const p = parseListPagination(c);
  const search = c.req.query('search');
  const status = c.req.query('status');

  const result = await repos.customers.findMany(
    auth.tenantId,
    { limit: p.limit, offset: p.offset },
    { search, status: status?.toLowerCase() }
  );
  const enriched = await Promise.all(
    result.items.map((row: any) => enrichCustomer(repos, auth.tenantId, row))
  );
  return c.json({ success: true, ...buildListResponse(enriched, result.total ?? enriched.length, p) });
});

app.get('/:id', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const row = await repos.customers.findById(c.req.param('id'), auth.tenantId);
  if (!row) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } }, 404);
  return c.json({ success: true, data: await enrichCustomer(repos, auth.tenantId, row) });
});

app.post('/', zValidator('json', CustomerCreateSchema), async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const body = c.req.valid('json');
  const row = await repos.customers.create(
    {
      id: crypto.randomUUID(),
      tenantId: auth.tenantId,
      customerCode: customerCode(body.email || body.phone || 'customer'),
      email: body.email?.trim().toLowerCase(),
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

app.put('/:id', zValidator('json', CustomerUpdateSchema), async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const id = c.req.param('id');
  const existing = await repos.customers.findById(id, auth.tenantId);
  if (!existing) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } }, 404);
  const body = c.req.valid('json');
  const row = await repos.customers.update(
    id,
    auth.tenantId,
    {
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email?.trim().toLowerCase(),
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
