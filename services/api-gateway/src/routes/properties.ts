import { Hono } from 'hono';
import { authMiddleware, type AuthContext } from '../middleware/hono-auth';
import { databaseMiddleware } from '../middleware/database';
import {
  mapPropertyRow,
  mapUnitRow,
  normalizePropertyStatusToDb,
  normalizePropertyTypeToDb,
  paginateArray,
} from './db-mappers';

type PropertyRow = Record<string, unknown> & { id: string; propertyId?: string };
type MappedProperty = ReturnType<typeof mapPropertyRow>;

function hasPropertyAccess(auth: AuthContext, propertyId: string) {
  return auth.propertyAccess?.includes('*') || auth.propertyAccess?.includes(propertyId);
}

function propertyCode(name: string) {
  return `PROP-${name.replace(/[^A-Z0-9]+/gi, '').slice(0, 6).toUpperCase()}-${Date.now().toString().slice(-4)}`;
}

const app = new Hono();
app.use('*', authMiddleware);
app.use('*', databaseMiddleware);

app.get('/', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const page = Number(c.req.query('page') || '1');
  const pageSize = Number(c.req.query('pageSize') || '20');
  const search = (c.req.query('search') || '').toLowerCase();
  const status = c.req.query('status');
  const type = c.req.query('type');
  const city = (c.req.query('city') || '').toLowerCase();

  const result = await repos.properties.findMany(auth.tenantId, { limit: 1000, offset: 0 });
  let items: MappedProperty[] = result.items
    .filter((row: PropertyRow) => hasPropertyAccess(auth, row.id))
    .map(mapPropertyRow);

  if (search) {
    items = items.filter((item) =>
      [item.name, item.propertyCode, item.address?.line1, item.address?.city].some((v) =>
        String(v || '').toLowerCase().includes(search)
      )
    );
  }
  if (status) items = items.filter((item) => item.status === status);
  if (type) items = items.filter((item) => item.type === type);
  if (city) items = items.filter((item) => String(item.address?.city || '').toLowerCase().includes(city));

  const paginated = paginateArray(items, page, pageSize);
  return c.json({ success: true, data: paginated.data, pagination: paginated.pagination });
});

app.get('/:id/units', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const id = c.req.param('id');
  if (!hasPropertyAccess(auth, id)) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient property access' } }, 403);
  }

  const page = Number(c.req.query('page') || '1');
  const pageSize = Number(c.req.query('pageSize') || '20');
  const status = c.req.query('status');
  const result = await repos.units.findByProperty(id, auth.tenantId, { limit: 1000, offset: 0 });
  let items = result.items.map(mapUnitRow);
  if (status) items = items.filter((item) => item.status === status);
  const paginated = paginateArray(items, page, pageSize);
  return c.json({ success: true, data: paginated.data, pagination: paginated.pagination });
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

app.post('/', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const body = await c.req.json();

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

app.put('/:id', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const id = c.req.param('id');
  if (!hasPropertyAccess(auth, id)) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient property access' } }, 403);
  }

  const body = await c.req.json();
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
