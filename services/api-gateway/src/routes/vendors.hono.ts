/**
 * Vendors API routes - Hono with Zod validation
 * Production-ready REST API for maintenance vendor management
 */

import type { Context } from 'hono';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { Vendor } from '../types/mock-types';
import {
  DEMO_VENDORS,
  getById,
  getByTenant,
  paginate,
  createVendor,
  updateVendor,
  softDeleteVendor,
} from '../data/mock-data';
import { authMiddleware } from '../middleware/hono-auth';
import { databaseMiddleware, generateId } from '../middleware/database';
import {
  listVendorsQuerySchema,
  createVendorSchema,
  updateVendorSchema,
  availableVendorsQuerySchema,
  idParamSchema,
  validationErrorHook,
} from './validators';

const app = new Hono();

app.use('*', authMiddleware);
app.use('*', databaseMiddleware);

function getActiveVendors(tenantId: string): Vendor[] {
  return getByTenant(DEMO_VENDORS, tenantId).filter((v) => !v.deletedAt);
}

function errorResponse(
  c: Context,
  status: 400 | 403 | 404 | 409,
  code: string,
  message: string
) {
  return c.json({ success: false, error: { code, message } }, status);
}

// GET /vendors/available - Must be before /:id
app.get(
  '/available',
  zValidator('query', availableVendorsQuerySchema),
  async (c) => {
    const auth = c.get('auth');
    const { category } = c.req.valid('query');
    const repos = c.get('repos');
    const useMockData = c.get('useMockData');

    if (!useMockData && repos) {
      try {
        const vendors = await repos.vendors.findAvailable(category, false, auth.tenantId);
        return c.json({ success: true, data: vendors });
      } catch (error) {
        console.error('Database error, falling back to mock data:', error);
      }
    }

    const vendors = getActiveVendors(auth.tenantId).filter(
      (v) => v.isAvailable && v.categories.includes(category)
    );
    return c.json({ success: true, data: vendors });
  }
);

// GET /vendors - List vendors
app.get('/', zValidator('query', listVendorsQuerySchema), async (c) => {
  const auth = c.get('auth');
  const { page, pageSize, category, available, search } = c.req.valid('query');
  const repos = c.get('repos');
  const useMockData = c.get('useMockData');

  if (!useMockData && repos) {
    try {
      const offset = (page - 1) * pageSize;
      const result = await repos.vendors.findMany(auth.tenantId, pageSize, offset);

      let items = [...result.items] as any[];
      if (category) {
        items = items.filter((v: any) =>
          v.specializations?.includes(category) || v.categories?.includes(category)
        );
      }
      if (available !== undefined) {
        items = items.filter((v: any) => v.status === (available ? 'active' : 'inactive'));
      }
      if (search) {
        const s = search.toLowerCase();
        items = items.filter(
          (v: any) =>
            String(v.name ?? '').toLowerCase().includes(s) ||
            String(v.companyName ?? '').toLowerCase().includes(s) ||
            String(v.email ?? '').toLowerCase().includes(s)
        );
      }

      return c.json({
        success: true,
        data: items,
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
  let vendors = getActiveVendors(auth.tenantId);
  if (category) {
    vendors = vendors.filter((v) => v.categories.includes(category));
  }
  if (available !== undefined) {
    vendors = vendors.filter((v) => v.isAvailable === available);
  }
  if (search) {
    const s = search.toLowerCase();
    vendors = vendors.filter(
      (v) =>
        v.name.toLowerCase().includes(s) ||
        (v.companyName?.toLowerCase().includes(s) ?? false) ||
        v.email.toLowerCase().includes(s) ||
        v.phone.includes(search)
    );
  }
  vendors.sort((a, b) => a.name.localeCompare(b.name));
  const result = paginate(vendors, page, pageSize);
  return c.json({ success: true, data: result.data, pagination: result.pagination });
});

// POST /vendors - Create vendor
app.post('/', zValidator('json', createVendorSchema, validationErrorHook), async (c) => {
  const auth = c.get('auth');
  const body = c.req.valid('json');
  const repos = c.get('repos');
  const useMockData = c.get('useMockData');

  if (!useMockData && repos) {
    try {
      const id = generateId();
      const vendorCode = `VND-${Date.now().toString(36).toUpperCase()}`;

      const vendor = await repos.vendors.create({
        id,
        tenantId: auth.tenantId,
        vendorCode,
        name: body.name,
        companyName: body.companyName,
        email: body.email,
        phone: body.phone,
        specializations: body.categories ?? [],
        status: 'active',
        isPreferred: false,
        emergencyAvailable: false,
        createdBy: auth.userId,
        updatedBy: auth.userId,
      });

      return c.json({ success: true, data: vendor }, 201);
    } catch (error) {
      console.error('Database error, falling back to mock data:', error);
    }
  }

  // Fallback to mock data
  const existing = DEMO_VENDORS.find(
    (v) =>
      v.tenantId === auth.tenantId &&
      !v.deletedAt &&
      v.email.toLowerCase() === body.email.toLowerCase()
  );
  if (existing) {
    return errorResponse(c, 409, 'CONFLICT', 'Vendor with this email already exists');
  }
  const vendor = createVendor(
    {
      name: body.name,
      companyName: body.companyName,
      email: body.email,
      phone: body.phone,
      categories: body.categories,
      isAvailable: body.isAvailable ?? true,
    },
    auth.tenantId,
    auth.userId
  );
  return c.json({ success: true, data: vendor }, 201);
});

// GET /vendors/:id - Get vendor by ID
app.get('/:id', zValidator('param', idParamSchema), async (c) => {
  const { id } = c.req.valid('param');
  const auth = c.get('auth');
  const repos = c.get('repos');
  const useMockData = c.get('useMockData');

  if (!useMockData && repos) {
    try {
      const vendor = await repos.vendors.findById(id, auth.tenantId);
      if (!vendor) {
        return errorResponse(c, 404, 'NOT_FOUND', 'Vendor not found');
      }
      return c.json({ success: true, data: vendor });
    } catch (error) {
      console.error('Database error, falling back to mock data:', error);
    }
  }

  const vendor = getById(DEMO_VENDORS, id);
  if (!vendor || vendor.tenantId !== auth.tenantId || vendor.deletedAt) {
    return errorResponse(c, 404, 'NOT_FOUND', 'Vendor not found');
  }
  return c.json({ success: true, data: vendor });
});

// PUT /vendors/:id - Update vendor
app.put(
  '/:id',
  zValidator('param', idParamSchema),
  zValidator('json', updateVendorSchema, validationErrorHook),
  async (c) => {
    const { id } = c.req.valid('param');
    const auth = c.get('auth');
    const body = c.req.valid('json');
    const repos = c.get('repos');
    const useMockData = c.get('useMockData');

    if (!useMockData && repos) {
      try {
        const existing = await repos.vendors.findById(id, auth.tenantId);
        if (!existing) {
          return errorResponse(c, 404, 'NOT_FOUND', 'Vendor not found');
        }

        const updateData: Record<string, unknown> = {};
        if (body.name) updateData.name = body.name;
        if (body.companyName !== undefined) updateData.companyName = body.companyName;
        if (body.email) updateData.email = body.email;
        if (body.phone) updateData.phone = body.phone;
        if (body.categories) updateData.specializations = body.categories;
        if (body.isAvailable !== undefined) updateData.status = body.isAvailable ? 'active' : 'inactive';

        const updated = await repos.vendors.update(id, auth.tenantId, updateData as any);
        return c.json({ success: true, data: updated });
      } catch (error) {
        console.error('Database error, falling back to mock data:', error);
      }
    }

    // Fallback to mock data
    const vendor = getById(DEMO_VENDORS, id);
    if (!vendor || vendor.tenantId !== auth.tenantId || vendor.deletedAt) {
      return errorResponse(c, 404, 'NOT_FOUND', 'Vendor not found');
    }
    const updated = updateVendor(id, body, auth.userId);
    return c.json({ success: true, data: updated });
  }
);

// DELETE /vendors/:id - Delete vendor (soft delete)
app.delete('/:id', zValidator('param', idParamSchema), async (c) => {
  const { id } = c.req.valid('param');
  const auth = c.get('auth');
  const repos = c.get('repos');
  const useMockData = c.get('useMockData');

  if (!useMockData && repos) {
    try {
      const vendor = await repos.vendors.findById(id, auth.tenantId);
      if (!vendor) {
        return errorResponse(c, 404, 'NOT_FOUND', 'Vendor not found');
      }
      await repos.vendors.delete(id, auth.tenantId, auth.userId);
      return c.json({ success: true, data: { id, message: 'Vendor deleted successfully' } });
    } catch (error) {
      console.error('Database error, falling back to mock data:', error);
    }
  }

  const vendor = getById(DEMO_VENDORS, id);
  if (!vendor || vendor.tenantId !== auth.tenantId || vendor.deletedAt) {
    return errorResponse(c, 404, 'NOT_FOUND', 'Vendor not found');
  }
  softDeleteVendor(id);
  return c.json({ success: true, data: { id, message: 'Vendor deleted successfully' } });
});

export const vendorsRouter = app;
