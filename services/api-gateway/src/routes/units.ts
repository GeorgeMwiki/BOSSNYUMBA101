// @ts-nocheck

import { Hono } from 'hono';
import { authMiddleware, type AuthContext } from '../middleware/hono-auth';
import { databaseMiddleware } from '../middleware/database';
import {
  mapUnitRow,
  normalizeUnitStatusToDb,
  normalizeUnitTypeToDb,
  paginateArray,
  majorToMinor,
} from './db-mappers';

type UnitRow = Record<string, unknown> & { propertyId: string };
type MappedUnit = ReturnType<typeof mapUnitRow>;

function hasPropertyAccess(auth: AuthContext, propertyId: string) {
  return auth.propertyAccess?.includes('*') || auth.propertyAccess?.includes(propertyId);
}

const app = new Hono();
app.use('*', authMiddleware);
app.use('*', databaseMiddleware);

app.get('/', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const page = Number(c.req.query('page') || '1');
  const pageSize = Number(c.req.query('pageSize') || '20');
  const propertyId = c.req.query('propertyId');
  const status = c.req.query('status');
  const search = (c.req.query('search') || '').toLowerCase();

  const result = propertyId
    ? await repos.units.findByProperty(propertyId, auth.tenantId, { limit: 1000, offset: 0 })
    : await repos.units.findMany(auth.tenantId, { limit: 1000, offset: 0 });

  let items: MappedUnit[] = result.items
    .filter((row: UnitRow) => hasPropertyAccess(auth, row.propertyId))
    .map(mapUnitRow);

  if (status) items = items.filter((item) => item.status === status);
  if (search) {
    items = items.filter((item) =>
      [item.unitNumber, item.name, item.type].some((v) => String(v || '').toLowerCase().includes(search))
    );
  }

  const paginated = paginateArray(items, page, pageSize);
  return c.json({ success: true, data: paginated.data, pagination: paginated.pagination });
});

app.get('/:id', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const row = await repos.units.findById(c.req.param('id'), auth.tenantId);
  if (!row) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Unit not found' } }, 404);
  if (!hasPropertyAccess(auth, row.propertyId)) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient property access' } }, 403);
  }
  return c.json({ success: true, data: mapUnitRow(row) });
});

app.post('/', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const body = await c.req.json();
  if (!hasPropertyAccess(auth, body.propertyId)) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient property access' } }, 403);
  }

  const row = await repos.units.create(
    {
      id: crypto.randomUUID(),
      tenantId: auth.tenantId,
      propertyId: body.propertyId,
      unitCode: body.unitNumber,
      name: body.unitNumber,
      type: normalizeUnitTypeToDb(body.type),
      status: normalizeUnitStatusToDb(body.status),
      floor: body.floor,
      bedrooms: body.bedrooms,
      bathrooms: String(body.bathrooms ?? 0),
      squareMeters: body.squareMeters != null ? String(body.squareMeters) : undefined,
      baseRentAmount: majorToMinor(body.rentAmount),
      depositAmount: majorToMinor(body.depositAmount),
      amenities: body.amenities || [],
      images: body.images || [],
      createdBy: auth.userId,
      updatedBy: auth.userId,
    },
    auth.userId
  );

  return c.json({ success: true, data: mapUnitRow(row) }, 201);
});

app.put('/:id', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const id = c.req.param('id');
  const existing = await repos.units.findById(id, auth.tenantId);
  if (!existing) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Unit not found' } }, 404);
  if (!hasPropertyAccess(auth, existing.propertyId)) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient property access' } }, 403);
  }
  const body = await c.req.json();
  const row = await repos.units.update(
    id,
    auth.tenantId,
    {
      unitCode: body.unitNumber,
      name: body.name || body.unitNumber,
      type: body.type ? normalizeUnitTypeToDb(body.type) : undefined,
      status: body.status ? normalizeUnitStatusToDb(body.status) : undefined,
      floor: body.floor,
      bedrooms: body.bedrooms,
      bathrooms: body.bathrooms != null ? String(body.bathrooms) : undefined,
      squareMeters: body.squareMeters != null ? String(body.squareMeters) : undefined,
      baseRentAmount: body.rentAmount != null ? majorToMinor(body.rentAmount) : undefined,
      depositAmount: body.depositAmount != null ? majorToMinor(body.depositAmount) : undefined,
      amenities: body.amenities,
      images: body.images,
      updatedBy: auth.userId,
    },
    auth.userId
  );
  return c.json({ success: true, data: mapUnitRow(row) });
});

app.put('/:id/status', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const id = c.req.param('id');
  const existing = await repos.units.findById(id, auth.tenantId);
  if (!existing) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Unit not found' } }, 404);
  const body = await c.req.json();
  const row = await repos.units.update(id, auth.tenantId, { status: normalizeUnitStatusToDb(body.status) }, auth.userId);
  return c.json({ success: true, data: mapUnitRow(row) });
});

app.delete('/:id', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const id = c.req.param('id');
  const existing = await repos.units.findById(id, auth.tenantId);
  if (!existing) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Unit not found' } }, 404);
  await repos.units.delete(id, auth.tenantId, auth.userId);
  return c.json({ success: true, data: { message: 'Unit deleted' } });
});

export const unitsRouter = app;
