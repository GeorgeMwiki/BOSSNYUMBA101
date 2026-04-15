import { Hono } from 'hono';
import { authMiddleware } from '../middleware/hono-auth';
import { databaseMiddleware } from '../middleware/database';
import { mapVendorRow, paginateArray } from './db-mappers';

function vendorCode(name: string) {
  return `VEN-${name.replace(/[^A-Z0-9]+/gi, '').slice(0, 6).toUpperCase()}-${Date.now().toString().slice(-4)}`;
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
  const specialization = c.req.query('specialization');
  const rows = specialization
    ? await repos.vendors.findBySpecialization(specialization, auth.tenantId)
    : (status
        ? (await repos.vendors.findMany(auth.tenantId, 1000, 0)).items.filter((row: any) => row.status === status)
        : (await repos.vendors.findMany(auth.tenantId, 1000, 0)).items);
  const items = rows.map(mapVendorRow);
  const paginated = paginateArray(items, page, pageSize);
  return c.json({ success: true, data: paginated.data, pagination: paginated.pagination });
});

// TODO: wire to real store — vendor contracts collection used by the
// owner portal. Declared before `/:id` so the static segment wins.
app.get('/contracts', (c) => {
  return c.json({ success: true, data: [] });
});

app.get('/available', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const category = c.req.query('category');
  const rows = category
    ? await repos.vendors.findAvailable(String(category).toLowerCase(), false, auth.tenantId)
    : await repos.vendors.findPreferred(auth.tenantId);
  return c.json({ success: true, data: rows.map(mapVendorRow) });
});

app.get('/:id', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const row = await repos.vendors.findById(c.req.param('id'), auth.tenantId);
  if (!row) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Vendor not found' } }, 404);
  return c.json({ success: true, data: mapVendorRow(row) });
});

app.post('/', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const body = await c.req.json();
  const row = await repos.vendors.create({
    id: crypto.randomUUID(),
    tenantId: auth.tenantId,
    vendorCode: vendorCode(body.companyName || body.name || 'vendor'),
    companyName: body.companyName || body.name,
    status: String(body.status || 'active').toLowerCase(),
    specializations: body.specializations || [],
    serviceAreas: body.serviceAreas || [],
    contacts: body.contacts || [{
      name: body.contactPerson,
      email: body.email,
      phone: body.phone,
      type: 'primary',
    }],
    isPreferred: Boolean(body.isPreferred),
    emergencyAvailable: Boolean(body.emergencyAvailable),
    notes: body.notes,
    createdBy: auth.userId,
    updatedBy: auth.userId,
  });
  return c.json({ success: true, data: mapVendorRow(row) }, 201);
});

app.put('/:id', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const body = await c.req.json();
  const row = await repos.vendors.update(c.req.param('id'), auth.tenantId, {
    companyName: body.companyName || body.name,
    status: body.status ? String(body.status).toLowerCase() : undefined,
    specializations: body.specializations,
    serviceAreas: body.serviceAreas,
    contacts: body.contacts,
    isPreferred: body.isPreferred,
    emergencyAvailable: body.emergencyAvailable,
    notes: body.notes,
    updatedBy: auth.userId,
  });
  if (!row) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Vendor not found' } }, 404);
  return c.json({ success: true, data: mapVendorRow(row) });
});

app.delete('/:id', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  await repos.vendors.delete(c.req.param('id'), auth.tenantId, auth.userId);
  return c.json({ success: true, data: { message: 'Vendor deleted' } });
});

export const vendorsRouter = app;
