// @ts-nocheck

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { authMiddleware } from '../middleware/hono-auth';
import { databaseMiddleware } from '../middleware/database';
import {
  mapPropertyRow,
  mapUnitRow,
  normalizePropertyStatusToDb,
  normalizePropertyTypeToDb,
  paginateArray,
} from './db-mappers';
import { parseListPagination, buildListResponse } from './pagination';

const AddressSchema = z.object({
  line1: z.string().max(200).optional(),
  line2: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  region: z.string().max(100).optional(),
  postalCode: z.string().max(20).optional(),
  country: z.string().length(2).optional(),
  coordinates: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }).optional(),
}).partial();
const PropertyCreateSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.string().max(50).optional(),
  status: z.string().max(30).optional(),
  description: z.string().max(2000).optional(),
  address: AddressSchema.optional(),
  amenities: z.array(z.string()).optional(),
  images: z.array(z.string().url()).optional(),
  settings: z.record(z.unknown()).optional(),
  managerId: z.string().optional(),
  totalUnits: z.number().int().nonnegative().optional(),
  occupiedUnits: z.number().int().nonnegative().optional(),
});
const PropertyUpdateSchema = PropertyCreateSchema.partial();

function hasPropertyAccess(auth: any, propertyId: string) {
  return auth.propertyAccess?.includes('*') || auth.propertyAccess?.includes(propertyId);
}

function propertyCode(name: string) {
  return `PROP-${name.replace(/[^A-Z0-9]+/gi, '').slice(0, 6).toUpperCase()}-${Date.now().toString().slice(-4)}`;
}

const app = new Hono();
app.use('*', authMiddleware);
app.use('*', databaseMiddleware);

app.get('/', async (c) => {
  // search/status/type/city filters are applied in-memory after the DB
  // fetch because the repo doesn't expose them yet. Cap the fetch at
  // 500 so a tenant with many properties still gets a sane response.
  // TODO: push these filters into repos.properties.findMany.
  const auth = c.get('auth');
  const repos = c.get('repos');
  const p = parseListPagination(c);
  const search = (c.req.query('search') || '').toLowerCase();
  const status = c.req.query('status');
  const type = c.req.query('type');
  const city = (c.req.query('city') || '').toLowerCase();

  const result = await repos.properties.findMany(auth.tenantId, { limit: 500, offset: 0 });
  let items = result.items.filter((row: any) => hasPropertyAccess(auth, row.id)).map(mapPropertyRow);

  if (search) {
    items = items.filter((item: any) =>
      [item.name, item.propertyCode, item.address?.line1, item.address?.city].some((v) =>
        String(v || '').toLowerCase().includes(search)
      )
    );
  }
  if (status) items = items.filter((item: any) => item.status === status);
  if (type) items = items.filter((item: any) => item.type === type);
  if (city) items = items.filter((item: any) => String(item.address?.city || '').toLowerCase().includes(city));

  const pageSlice = items.slice(p.offset, p.offset + p.limit);
  return c.json({ success: true, ...buildListResponse(pageSlice, items.length, p) });
});

app.get('/:id/units', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const id = c.req.param('id');
  if (!hasPropertyAccess(auth, id)) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient property access' } }, 403);
  }

  const p = parseListPagination(c);
  const status = c.req.query('status');
  // Status filter is in-memory; push it into repos.units.findByProperty
  // when the repo gains a filters param.
  const result = await repos.units.findByProperty(id, auth.tenantId, { limit: 500, offset: 0 });
  let items = result.items.map(mapUnitRow);
  if (status) items = items.filter((item: any) => item.status === status);
  const pageSlice = items.slice(p.offset, p.offset + p.limit);
  return c.json({ success: true, ...buildListResponse(pageSlice, items.length, p) });
});

app.get('/:id', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const id = c.req.param('id');
  if (!hasPropertyAccess(auth, id)) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient property access' } }, 403);
  }

  const row = await repos.properties.findById(id, auth.tenantId);
  if (!row) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Property not found' } }, 404);
  }

  return c.json({ success: true, data: mapPropertyRow(row) });
});

app.post('/', zValidator('json', PropertyCreateSchema), async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const body = c.req.valid('json');

  const row = await repos.properties.create(
    {
      id: crypto.randomUUID(),
      tenantId: auth.tenantId,
      ownerId: auth.userId,
      propertyCode: propertyCode(body.name || 'PROPERTY'),
      name: body.name,
      type: normalizePropertyTypeToDb(body.type),
      status: normalizePropertyStatusToDb(body.status),
      description: body.description,
      addressLine1: body.address?.line1,
      addressLine2: body.address?.line2,
      city: body.address?.city,
      state: body.address?.region,
      postalCode: body.address?.postalCode,
      country: body.address?.country || 'KE',
      latitude: body.address?.coordinates?.latitude?.toString(),
      longitude: body.address?.coordinates?.longitude?.toString(),
      amenities: body.amenities || [],
      images: body.images || [],
      features: body.settings || {},
      managerId: body.managerId,
      totalUnits: body.totalUnits || 0,
      occupiedUnits: body.occupiedUnits || 0,
      vacantUnits: Math.max((body.totalUnits || 0) - (body.occupiedUnits || 0), 0),
      createdBy: auth.userId,
      updatedBy: auth.userId,
    },
    auth.userId
  );

  return c.json({ success: true, data: mapPropertyRow(row) }, 201);
});

app.put('/:id', zValidator('json', PropertyUpdateSchema), async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const id = c.req.param('id');
  if (!hasPropertyAccess(auth, id)) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient property access' } }, 403);
  }

  const body = c.req.valid('json');
  const row = await repos.properties.update(
    id,
    auth.tenantId,
    {
      name: body.name,
      type: body.type ? normalizePropertyTypeToDb(body.type) : undefined,
      status: body.status ? normalizePropertyStatusToDb(body.status) : undefined,
      description: body.description,
      addressLine1: body.address?.line1,
      addressLine2: body.address?.line2,
      city: body.address?.city,
      state: body.address?.region,
      postalCode: body.address?.postalCode,
      country: body.address?.country,
      latitude: body.address?.coordinates?.latitude?.toString(),
      longitude: body.address?.coordinates?.longitude?.toString(),
      amenities: body.amenities,
      images: body.images,
      features: body.settings,
      managerId: body.managerId,
      totalUnits: body.totalUnits,
      occupiedUnits: body.occupiedUnits,
      vacantUnits:
        body.totalUnits != null || body.occupiedUnits != null
          ? Math.max((body.totalUnits ?? 0) - (body.occupiedUnits ?? 0), 0)
          : undefined,
      updatedBy: auth.userId,
    },
    auth.userId
  );

  return c.json({ success: true, data: mapPropertyRow(row) });
});

app.delete('/:id', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const id = c.req.param('id');
  if (!hasPropertyAccess(auth, id)) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient property access' } }, 403);
  }
  await repos.properties.delete(id, auth.tenantId, auth.userId);
  return c.json({ success: true, data: { message: 'Property deleted' } });
});

export const propertiesRouter = app;
