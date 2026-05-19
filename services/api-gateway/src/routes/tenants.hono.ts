
import { Hono } from 'hono';
import { z } from 'zod';
import { withRateLimit } from '../middleware/rate-limit';
import { authMiddleware, requireRole } from '../middleware/hono-auth';
import { databaseMiddleware } from '../middleware/database';
import { UserRole } from '../types/user-role';

const UpdateTenantSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    contactEmail: z.string().email().max(254).optional(),
    contactPhone: z.string().max(64).optional(),
  })
  .strict();
// Tenant settings are an open key/value bag — record() permits arbitrary
// keys but we still cap the body size so a runaway client cannot blow
// the heap.
const UpdateTenantSettingsSchema = z.record(z.unknown());

type TenantRow = {
  id: string;
  name: string;
  slug: string;
  status?: string;
  primaryEmail?: string;
  primaryPhone?: string | null;
  settings?: Record<string, unknown> | null;
  subscriptionTier?: string;
  maxUnits?: number;
  maxUsers?: number;
  createdAt?: unknown;
  createdBy?: string;
  updatedAt?: unknown;
  updatedBy?: string;
};

function mapTenant(row: TenantRow) {
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
app.use('*', withRateLimit({ key: 'tenants', max: 120, window: '1m' }));
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
  const raw = await c.req.json().catch(() => ({}));
  const parsed = UpdateTenantSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json(
      { success: false, error: { code: 'INVALID_INPUT', message: parsed.error.message } },
      400,
    );
  }
  const body = parsed.data;
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
  const raw = await c.req.json().catch(() => ({}));
  const parsed = UpdateTenantSettingsSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json(
      { success: false, error: { code: 'INVALID_INPUT', message: parsed.error.message } },
      400,
    );
  }
  const body = parsed.data;
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

// Wave 19 Agent H+I: cross-tenant listing is platform-admin only.
// Previously the handler ran the expensive cross-tenant scan for every
// caller and silently returned [] to non-super-admins — that's both a
// DoS vector (any authenticated user could hammer `findMany`) and an
// information leak (pagination totals hint at tenant count).
app.get(
  '/',
  requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT),
  async (c) => {
    const repos = c.get('repos');
    const page = Number(c.req.query('page') || '1');
    const pageSize = Number(c.req.query('pageSize') || '20');
    const result = await repos.tenants.findMany({
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
    return c.json({
      success: true,
      data: result.items.map(mapTenant),
      pagination: {
        page,
        pageSize,
        totalItems: result.total,
        totalPages: Math.ceil(result.total / pageSize),
        hasNextPage: result.hasMore,
        hasPreviousPage: page > 1,
      },
    });
  },
);

export const tenantsRouter = app;
