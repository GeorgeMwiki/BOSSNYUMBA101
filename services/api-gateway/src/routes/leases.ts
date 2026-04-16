// @ts-nocheck

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { authMiddleware } from '../middleware/hono-auth';
import { databaseMiddleware } from '../middleware/database';
import { mapLeaseRow, majorToMinor, paginateArray } from './db-mappers';
import { parseListPagination, buildListResponse } from './pagination';

const isoDate = z.string().refine((s) => !Number.isNaN(new Date(s).getTime()), 'invalid date');
const CreateLeaseSchema = z.object({
  unitId: z.string().min(1),
  customerId: z.string().min(1),
  startDate: isoDate,
  endDate: isoDate,
  rentAmount: z.number().nonnegative(),
  depositAmount: z.number().nonnegative().optional(),
  paymentDueDay: z.number().int().min(1).max(31).optional(),
  terms: z.object({
    gracePeriodDays: z.number().int().nonnegative().optional(),
    noticePeriodDays: z.number().int().nonnegative().optional(),
    utilitiesIncluded: z.array(z.string()).optional(),
  }).optional(),
}).refine((b) => new Date(b.endDate) >= new Date(b.startDate), {
  message: 'endDate must be on or after startDate',
  path: ['endDate'],
});
const UpdateLeaseSchema = z.object({
  startDate: isoDate.optional(),
  endDate: isoDate.optional(),
  rentAmount: z.number().nonnegative().optional(),
  depositAmount: z.number().nonnegative().optional(),
  paymentDueDay: z.number().int().min(1).max(31).optional(),
  terms: z.object({
    gracePeriodDays: z.number().int().nonnegative().optional(),
    noticePeriodDays: z.number().int().nonnegative().optional(),
    utilitiesIncluded: z.array(z.string()).optional(),
  }).optional(),
});
const TerminateLeaseSchema = z.object({
  reason: z.string().min(1).max(1000).optional(),
});
const RenewLeaseSchema = z.object({
  newEndDate: isoDate.optional(),
  extendMonths: z.number().int().min(1).max(60).optional(),
  rentAmount: z.number().nonnegative().optional(),
}).refine((b) => b.newEndDate || b.extendMonths, {
  message: 'either newEndDate or extendMonths is required',
});

function leaseNumber() {
  return `LSE-${Date.now().toString().slice(-6)}`;
}

async function enrichLease(repos: any, tenantId: string, row: any) {
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
  const lease = result.items.find((item: any) => String(item.status) === 'active') || result.items[0];
  if (!lease) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Current lease not found' } }, 404);
  }
  return c.json({ success: true, data: await enrichLease(repos, auth.tenantId, lease) });
});

app.get('/expiring', async (c) => {
  // "Expiring" still needs a full scan because the filter is post-DB
  // (endDate <= cutoff). We cap at 500 rows so a pathological tenant
  // with tens of thousands of active leases can't blow memory.
  const auth = c.get('auth');
  const repos = c.get('repos');
  const p = parseListPagination(c);
  const days = Number(c.req.query('days') || '60');
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + days);
  const result = await repos.leases.findMany(auth.tenantId, { limit: 500, offset: 0 }, { status: 'active' });
  const expiring = result.items.filter((row: any) => new Date(row.endDate) <= cutoff);
  const enriched = await Promise.all(expiring.map((row: any) => enrichLease(repos, auth.tenantId, row)));
  const pageSlice = enriched.slice(p.offset, p.offset + p.limit);
  return c.json({ success: true, ...buildListResponse(pageSlice, enriched.length, p) });
});

app.get('/', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const p = parseListPagination(c);
  const filters = {
    status: c.req.query('status')?.toLowerCase(),
    propertyId: c.req.query('propertyId'),
    customerId: c.req.query('customerId'),
  };
  const result = await repos.leases.findMany(auth.tenantId, { limit: p.limit, offset: p.offset }, filters);
  const enriched = await Promise.all(result.items.map((row: any) => enrichLease(repos, auth.tenantId, row)));
  return c.json({ success: true, ...buildListResponse(enriched, result.total ?? enriched.length, p) });
});

app.get('/:id', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const row = await repos.leases.findById(c.req.param('id'), auth.tenantId);
  if (!row) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Lease not found' } }, 404);
  return c.json({ success: true, data: await enrichLease(repos, auth.tenantId, row) });
});

app.post('/', zValidator('json', CreateLeaseSchema), async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const body = c.req.valid('json');
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

app.put('/:id', zValidator('json', UpdateLeaseSchema), async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const id = c.req.param('id');
  const existing = await repos.leases.findById(id, auth.tenantId);
  if (!existing) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Lease not found' } }, 404);
  const body = c.req.valid('json');
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

app.post('/:id/terminate', zValidator('json', TerminateLeaseSchema), async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const body = c.req.valid('json');
  const row = await repos.leases.update(
    c.req.param('id'),
    auth.tenantId,
    {
      status: 'terminated',
      terminatedAt: new Date(),
      terminationReason: body.reason ? 'other' : undefined,
      terminationNotes: body.reason,
      terminatedBy: auth.userId,
    },
    auth.userId
  );
  return c.json({ success: true, data: await enrichLease(repos, auth.tenantId, row) });
});

app.post('/:id/renew', zValidator('json', RenewLeaseSchema), async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const id = c.req.param('id');
  const existing = await repos.leases.findById(id, auth.tenantId);
  if (!existing) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Lease not found' } }, 404);
  const body = c.req.valid('json');
  const currentEnd = new Date(existing.endDate);
  const newEnd = body.newEndDate
    ? new Date(body.newEndDate)
    : new Date(currentEnd.getFullYear(), currentEnd.getMonth() + Number(body.extendMonths || 12), currentEnd.getDate());

  const row = await repos.leases.update(
    id,
    auth.tenantId,
    {
      status: 'renewed',
      endDate: newEnd,
      // Schema accepts `rentAmount`; also accept `newRentAmount` as a
      // back-compat alias for older clients. Either one (or neither)
      // is fine — absent means "keep existing rent".
      rentAmount: body.rentAmount != null
        ? majorToMinor(body.rentAmount)
        : (body as { newRentAmount?: number }).newRentAmount != null
          ? majorToMinor((body as { newRentAmount: number }).newRentAmount)
          : undefined,
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
