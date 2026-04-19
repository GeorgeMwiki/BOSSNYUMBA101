
import { Hono } from 'hono';
import { authMiddleware } from '../middleware/hono-auth';
import { databaseMiddleware } from '../middleware/database';

function mapTenant(row: any) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: String(row.status || 'pending').toUpperCase(),
    contactEmail: row.primaryEmail,
    contactPhone: row.primaryPhone ?? undefined,
    settings: row.settings ?? {},
    subscription: {
      plan: row.subscriptionTier,
      status: String(row.status || 'pending').toUpperCase(),
      maxUnits: row.maxUnits,
      maxUsers: row.maxUsers,
    },
    createdAt: row.createdAt,
    createdBy: row.createdBy,
    updatedAt: row.updatedAt,
    updatedBy: row.updatedBy,
  };
}

const app = new Hono();
app.use('*', authMiddleware);
app.use('*', databaseMiddleware);

app.get('/current', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const tenant = await repos.tenants.findById(auth.tenantId);
  if (!tenant) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Tenant not found' } }, 404);
  return c.json({ success: true, data: mapTenant(tenant) });
});

app.patch('/current', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const body = await c.req.json();
  const tenant = await repos.tenants.update(
    auth.tenantId,
    {
      name: body.name,
      primaryEmail: body.contactEmail,
      primaryPhone: body.contactPhone,
      updatedBy: auth.userId,
    },
    auth.userId
  );
  return c.json({ success: true, data: mapTenant(tenant) });
});

app.get('/current/settings', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const tenant = await repos.tenants.findById(auth.tenantId);
  if (!tenant) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Tenant not found' } }, 404);
  return c.json({ success: true, data: tenant.settings ?? {} });
});

app.patch('/current/settings', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const body = await c.req.json();
  const existing = await repos.tenants.findById(auth.tenantId);
  const tenant = await repos.tenants.update(
    auth.tenantId,
    {
      settings: {
        ...(existing?.settings ?? {}),
        ...body,
      },
      updatedBy: auth.userId,
    },
    auth.userId
  );
  return c.json({ success: true, data: tenant.settings ?? {} });
});

app.get('/current/subscription', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const tenant = await repos.tenants.findById(auth.tenantId);
  if (!tenant) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Tenant not found' } }, 404);
  return c.json({
    success: true,
    data: {
      plan: tenant.subscriptionTier,
      status: String(tenant.status || 'pending').toUpperCase(),
      maxUnits: tenant.maxUnits,
      maxUsers: tenant.maxUsers,
      currentPeriodEndsAt: tenant.trialEndsAt,
    },
  });
});

app.get('/', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const page = Number(c.req.query('page') || '1');
  const pageSize = Number(c.req.query('pageSize') || '20');
  const result = await repos.tenants.findMany({ limit: pageSize, offset: (page - 1) * pageSize });
  const items = auth.role === 'SUPER_ADMIN' ? result.items.map(mapTenant) : [];
  return c.json({
    success: true,
    data: items,
    pagination: {
      page,
      pageSize,
      totalItems: auth.role === 'SUPER_ADMIN' ? result.total : 0,
      totalPages: auth.role === 'SUPER_ADMIN' ? Math.ceil(result.total / pageSize) : 0,
      hasNextPage: auth.role === 'SUPER_ADMIN' ? result.hasMore : false,
      hasPreviousPage: page > 1,
    },
  });
});

export const tenantsRouter = app;
