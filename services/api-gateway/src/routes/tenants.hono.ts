/**
 * Tenants routes - Hono with full CRUD, Zod validation, pagination
 * Uses database repositories with mock data fallback
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { UserRole } from '../types/user-role';
import {
  DEMO_TENANT,
  getById,
  paginate,
} from '../data/mock-data';
import {
  authMiddleware,
  requireRole,
} from '../middleware/hono-auth';
import { databaseMiddleware, generateId } from '../middleware/database';
import {
  listTenantsQuerySchema,
  createTenantSchema,
  updateTenantSchema,
  updateTenantSettingsSchema,
  idParamSchema,
} from './validators';
import { TenantStatus } from '../types/mock-types';
import type { Tenant } from '../types/mock-types';

function toTenantListItemDto(tenant: Record<string, unknown>) {
  return {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    status: tenant.status,
    contactEmail: tenant.contactEmail ?? tenant.primaryEmail,
    createdAt: tenant.createdAt,
  };
}

function toTenantDetailDto(tenant: Record<string, unknown>) {
  return {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    status: tenant.status,
    contactEmail: tenant.contactEmail ?? tenant.primaryEmail,
    contactPhone: tenant.contactPhone,
    settings: tenant.settings,
    subscription: tenant.subscription,
    createdAt: tenant.createdAt,
    updatedAt: tenant.updatedAt,
  };
}

// Mock tenant store (fallback when no database)
const TENANTS = [DEMO_TENANT];

const app = new Hono();

// All tenant routes require auth + database middleware
app.use('*', authMiddleware);
app.use('*', databaseMiddleware);

// GET /tenants - List tenants (SUPER_ADMIN only, with pagination)
app.get(
  '/',
  requireRole(UserRole.SUPER_ADMIN),
  zValidator('query', listTenantsQuerySchema),
  async (c) => {
    const { page, pageSize, status, search } = c.req.valid('query');
    const repos = c.get('repos');
    const useMockData = c.get('useMockData');

    if (!useMockData && repos) {
      try {
        const offset = (page - 1) * pageSize;
        const result = await repos.tenants.findMany({ limit: pageSize, offset });

        let items = [...result.items] as Record<string, unknown>[];
        if (status) {
          items = items.filter((t) => t.status === status.toLowerCase());
        }
        if (search) {
          const s = search.toLowerCase();
          items = items.filter(
            (t) =>
              String(t.name ?? '').toLowerCase().includes(s) ||
              String(t.slug ?? '').toLowerCase().includes(s)
          );
        }

        return c.json({
          success: true,
          data: items.map(toTenantListItemDto),
          pagination: {
            page,
            pageSize,
            totalItems: result.total,
            totalPages: Math.ceil(result.total / pageSize),
            hasNextPage: page < Math.ceil(result.total / pageSize),
            hasPreviousPage: page > 1,
          },
        });
      } catch (error) {
        console.error('Database error, falling back to mock data:', error);
      }
    }

    // Fallback to mock data
    let tenants = [...TENANTS];
    if (status) {
      tenants = tenants.filter((t) => t.status === status);
    }
    if (search) {
      const s = search.toLowerCase();
      tenants = tenants.filter(
        (t) =>
          t.name.toLowerCase().includes(s) ||
          t.slug.toLowerCase().includes(s) ||
          (t.contactEmail || '').toLowerCase().includes(s)
      );
    }
    const result = paginate(tenants, page, pageSize);
    return c.json({
      success: true,
      data: result.data.map((t) => toTenantListItemDto(t as unknown as Record<string, unknown>)),
      pagination: result.pagination,
    });
  }
);

// POST /tenants - Create tenant (SUPER_ADMIN only)
app.post(
  '/',
  requireRole(UserRole.SUPER_ADMIN),
  zValidator('json', createTenantSchema),
  async (c) => {
    const data = c.req.valid('json');
    const auth = c.get('auth');
    const repos = c.get('repos');
    const useMockData = c.get('useMockData');

    if (!useMockData && repos) {
      try {
        // Check for duplicate slug
        const existing = await repos.tenants.findBySlug(data.slug);
        if (existing) {
          return c.json(
            {
              success: false,
              error: {
                code: 'CONFLICT',
                message: `Tenant with slug '${data.slug}' already exists`,
              },
            },
            409
          );
        }

        const id = generateId();
        const tenant = await repos.tenants.create(
          {
            id,
            name: data.name,
            slug: data.slug,
            status: (data.status?.toLowerCase() ?? 'pending') as any,
            primaryEmail: data.primaryEmail,
            contactPhone: data.contactPhone,
            settings: data.settings ?? {},
            createdBy: auth.userId,
            updatedBy: auth.userId,
          },
          auth.userId
        );

        return c.json(
          {
            success: true,
            data: toTenantListItemDto(tenant as unknown as Record<string, unknown>),
          },
          201
        );
      } catch (error) {
        console.error('Database error, falling back to mock data:', error);
      }
    }

    // Fallback to mock data
    const existingSlug = TENANTS.some((t) => t.slug.toLowerCase() === data.slug.toLowerCase());
    if (existingSlug) {
      return c.json(
        {
          success: false,
          error: {
            code: 'CONFLICT',
            message: `Tenant with slug '${data.slug}' already exists`,
          },
        },
        409
      );
    }

    const id = `tenant-${Date.now()}`;
    const now = new Date();
    const tenant = {
      id,
      name: data.name,
      slug: data.slug,
      status: (data.status as TenantStatus) ?? TenantStatus.PENDING,
      contactEmail: data.primaryEmail,
      contactPhone: data.contactPhone,
      settings: data.settings ?? {},
      subscription: { plan: 'STARTER', status: 'PENDING', maxUnits: 10, maxUsers: 5 },
      createdAt: now,
      createdBy: auth.userId,
      updatedAt: now,
      updatedBy: auth.userId,
    };
    TENANTS.push(tenant);
    return c.json(
      {
        success: true,
        data: toTenantListItemDto(tenant as unknown as Record<string, unknown>),
      },
      201
    );
  }
);

// GET /tenants/current - Get current tenant
app.get('/current', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const useMockData = c.get('useMockData');

  if (auth.tenantId === 'platform') {
    return c.json(
      {
        success: false,
        error: { code: 'NOT_FOUND', message: 'No tenant context for platform admin' },
      },
      404
    );
  }

  if (!useMockData && repos) {
    try {
      const tenant = await repos.tenants.findById(auth.tenantId);
      if (!tenant) {
        return c.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Tenant not found' } },
          404
        );
      }
      return c.json({
        success: true,
        data: toTenantDetailDto(tenant as unknown as Record<string, unknown>),
      });
    } catch (error) {
      console.error('Database error, falling back to mock data:', error);
    }
  }

  // Fallback to mock data
  const tenant = getById(TENANTS, auth.tenantId);
  if (!tenant) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Tenant not found' } },
      404
    );
  }
  return c.json({
    success: true,
    data: toTenantDetailDto(tenant as unknown as Record<string, unknown>),
  });
});

// PATCH /tenants/current - Update current tenant
app.patch(
  '/current',
  requireRole(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN),
  zValidator('json', updateTenantSchema),
  async (c) => {
    const auth = c.get('auth');
    const updates = c.req.valid('json');
    const repos = c.get('repos');
    const useMockData = c.get('useMockData');

    if (!useMockData && repos) {
      try {
        const existing = await repos.tenants.findById(auth.tenantId);
        if (!existing) {
          return c.json(
            { success: false, error: { code: 'NOT_FOUND', message: 'Tenant not found' } },
            404
          );
        }

        const updateData: Record<string, unknown> = {};
        if (updates.name) updateData.name = updates.name;
        if (updates.slug) updateData.slug = updates.slug;
        if (updates.primaryEmail) updateData.primaryEmail = updates.primaryEmail;
        if (updates.contactPhone !== undefined) updateData.contactPhone = updates.contactPhone;
        if (updates.status) updateData.status = updates.status.toLowerCase();
        if (updates.settings) updateData.settings = { ...(existing as any).settings, ...updates.settings };

        const updated = await repos.tenants.update(auth.tenantId, updateData as any, auth.userId);
        return c.json({
          success: true,
          data: toTenantDetailDto(updated as unknown as Record<string, unknown>),
        });
      } catch (error) {
        console.error('Database error, falling back to mock data:', error);
      }
    }

    // Fallback to mock data
    const tenant = getById(TENANTS, auth.tenantId);
    if (!tenant) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Tenant not found' } },
        404
      );
    }
    const updated = {
      ...tenant,
      ...(updates.name && { name: updates.name }),
      ...(updates.slug && { slug: updates.slug }),
      ...(updates.primaryEmail && { contactEmail: updates.primaryEmail }),
      ...(updates.contactPhone !== undefined && { contactPhone: updates.contactPhone }),
      ...(updates.status && { status: updates.status }),
      ...(updates.settings && { settings: { ...tenant.settings, ...updates.settings } }),
      updatedAt: new Date(),
      updatedBy: auth.userId,
    };
    const idx = TENANTS.findIndex((t) => t.id === tenant.id);
    if (idx >= 0) TENANTS[idx] = updated;
    return c.json({
      success: true,
      data: toTenantDetailDto(updated as unknown as Record<string, unknown>),
    });
  }
);

// GET /tenants/current/settings
app.get('/current/settings', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const useMockData = c.get('useMockData');

  if (!useMockData && repos) {
    try {
      const tenant = await repos.tenants.findById(auth.tenantId);
      if (!tenant) {
        return c.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Tenant not found' } },
          404
        );
      }
      return c.json({ success: true, data: (tenant as any).settings ?? {} });
    } catch (error) {
      console.error('Database error, falling back to mock data:', error);
    }
  }

  const tenant = getById(TENANTS, auth.tenantId);
  if (!tenant) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Tenant not found' } },
      404
    );
  }
  return c.json({ success: true, data: tenant.settings });
});

// PATCH /tenants/current/settings
app.patch(
  '/current/settings',
  requireRole(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN),
  zValidator('json', updateTenantSettingsSchema),
  async (c) => {
    const auth = c.get('auth');
    const updates = c.req.valid('json');
    const repos = c.get('repos');
    const useMockData = c.get('useMockData');

    if (!useMockData && repos) {
      try {
        const tenant = await repos.tenants.findById(auth.tenantId);
        if (!tenant) {
          return c.json(
            { success: false, error: { code: 'NOT_FOUND', message: 'Tenant not found' } },
            404
          );
        }
        const newSettings = { ...(tenant as any).settings, ...updates };
        await repos.tenants.update(auth.tenantId, { settings: newSettings } as any, auth.userId);
        return c.json({ success: true, data: newSettings });
      } catch (error) {
        console.error('Database error, falling back to mock data:', error);
      }
    }

    const tenant = getById(TENANTS, auth.tenantId);
    if (!tenant) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Tenant not found' } },
        404
      );
    }
    const newSettings = { ...tenant.settings, ...updates };
    const idx = TENANTS.findIndex((t) => t.id === tenant.id);
    if (idx >= 0) TENANTS[idx] = { ...tenant, settings: newSettings };
    return c.json({ success: true, data: newSettings });
  }
);

// GET /tenants/current/subscription
app.get('/current/subscription', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const useMockData = c.get('useMockData');

  if (!useMockData && repos) {
    try {
      const tenant = await repos.tenants.findById(auth.tenantId);
      if (!tenant) {
        return c.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Tenant not found' } },
          404
        );
      }
      return c.json({ success: true, data: (tenant as any).subscription ?? {} });
    } catch (error) {
      console.error('Database error, falling back to mock data:', error);
    }
  }

  const tenant = getById(TENANTS, auth.tenantId);
  if (!tenant) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Tenant not found' } },
      404
    );
  }
  return c.json({ success: true, data: tenant.subscription });
});

// GET /tenants/:id - Get tenant by ID (SUPER_ADMIN or own tenant)
app.get('/:id', zValidator('param', idParamSchema), async (c) => {
  const auth = c.get('auth');
  const { id } = c.req.valid('param');
  const repos = c.get('repos');
  const useMockData = c.get('useMockData');

  if (auth.tenantId !== id && auth.role !== UserRole.SUPER_ADMIN) {
    return c.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
      403
    );
  }

  if (!useMockData && repos) {
    try {
      const tenant = await repos.tenants.findById(id);
      if (!tenant) {
        return c.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Tenant not found' } },
          404
        );
      }
      return c.json({ success: true, data: toTenantDetailDto(tenant as unknown as Record<string, unknown>) });
    } catch (error) {
      console.error('Database error, falling back to mock data:', error);
    }
  }

  const tenant = getById(TENANTS, id);
  if (!tenant) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Tenant not found' } },
      404
    );
  }
  return c.json({ success: true, data: toTenantDetailDto(tenant as unknown as Record<string, unknown>) });
});

// PATCH /tenants/:id - Update tenant (SUPER_ADMIN or TENANT_ADMIN for own)
app.patch(
  '/:id',
  requireRole(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN),
  zValidator('param', idParamSchema),
  zValidator('json', updateTenantSchema),
  async (c) => {
    const auth = c.get('auth');
    const { id } = c.req.valid('param');
    const updates = c.req.valid('json');
    const repos = c.get('repos');
    const useMockData = c.get('useMockData');

    if (auth.tenantId !== id && auth.role !== UserRole.SUPER_ADMIN) {
      return c.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
        403
      );
    }

    if (!useMockData && repos) {
      try {
        const existing = await repos.tenants.findById(id);
        if (!existing) {
          return c.json(
            { success: false, error: { code: 'NOT_FOUND', message: 'Tenant not found' } },
            404
          );
        }

        const updateData: Record<string, unknown> = {};
        if (updates.name) updateData.name = updates.name;
        if (updates.slug) updateData.slug = updates.slug;
        if (updates.primaryEmail) updateData.primaryEmail = updates.primaryEmail;
        if (updates.contactPhone !== undefined) updateData.contactPhone = updates.contactPhone;
        if (updates.status) updateData.status = updates.status.toLowerCase();
        if (updates.settings) updateData.settings = { ...(existing as any).settings, ...updates.settings };

        const updated = await repos.tenants.update(id, updateData as any, auth.userId);
        return c.json({ success: true, data: toTenantDetailDto(updated as unknown as Record<string, unknown>) });
      } catch (error) {
        console.error('Database error, falling back to mock data:', error);
      }
    }

    const tenant = getById(TENANTS, id);
    if (!tenant) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Tenant not found' } },
        404
      );
    }
    const updated = {
      ...tenant,
      ...(updates.name && { name: updates.name }),
      ...(updates.slug && { slug: updates.slug }),
      ...(updates.primaryEmail && { contactEmail: updates.primaryEmail }),
      ...(updates.contactPhone !== undefined && { contactPhone: updates.contactPhone }),
      ...(updates.status && { status: updates.status }),
      ...(updates.settings && { settings: { ...tenant.settings, ...updates.settings } }),
      updatedAt: new Date(),
      updatedBy: auth.userId,
    };
    const idx = TENANTS.findIndex((t) => t.id === id);
    if (idx >= 0) TENANTS[idx] = updated;
    return c.json({ success: true, data: toTenantDetailDto(updated as unknown as Record<string, unknown>) });
  }
);

// DELETE /tenants/:id - Soft delete (SUPER_ADMIN only)
app.delete('/:id', requireRole(UserRole.SUPER_ADMIN), zValidator('param', idParamSchema), async (c) => {
  const { id } = c.req.valid('param');
  const auth = c.get('auth');
  const repos = c.get('repos');
  const useMockData = c.get('useMockData');

  if (!useMockData && repos) {
    try {
      const tenant = await repos.tenants.findById(id);
      if (!tenant) {
        return c.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Tenant not found' } },
          404
        );
      }
      await repos.tenants.delete(id, auth.userId);
      return c.json({ success: true, data: { id, message: 'Tenant deactivated' } }, 200);
    } catch (error) {
      console.error('Database error, falling back to mock data:', error);
    }
  }

  const tenant = getById(TENANTS, id);
  if (!tenant) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Tenant not found' } },
      404
    );
  }
  const idx = TENANTS.findIndex((t) => t.id === id);
  if (idx >= 0) {
    TENANTS[idx] = { ...tenant, status: TenantStatus.CHURNED, updatedAt: new Date() };
  }
  return c.json({ success: true, data: { id, message: 'Tenant deactivated' } }, 200);
});

export const tenantsRouter = app;
