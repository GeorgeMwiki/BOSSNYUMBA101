/**
 * Properties API routes - Hono with Zod validation
 * Production-ready REST API with tenant scoping and error handling
 * Uses database queries with mock data fallback
 */

import type { Context } from 'hono';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { Property } from '../types/mock-types';
import {
  DEMO_PROPERTIES,
  DEMO_UNITS,
  DEMO_USERS,
  DEMO_TENANT_USERS,
  DEMO_INVOICES,
  DEMO_LEASES,
  getActiveById,
  getActiveByTenant,
  paginate,
  createProperty as createPropertyMock,
  updateProperty as updatePropertyMock,
  softDeleteProperty as softDeletePropertyMock,
} from '../data/mock-data';
import { authMiddleware } from '../middleware/hono-auth';
import { databaseMiddleware, generateId, buildPaginationResponse } from '../middleware/database';
import {
  listPropertiesQuerySchema,
  createPropertySchema,
  updatePropertySchema,
  assignManagerSchema,
  idParamSchema,
  paginationQuerySchema,
  unitStatusSchema,
  validationErrorHook,
} from './validators';

const app = new Hono();

// Apply auth and database middleware to all routes
app.use('*', authMiddleware);
app.use('*', databaseMiddleware);

// Helper: check property access for tenant
function canAccessProperty(
  propertyId: string,
  propertyAccess: string[]
): boolean {
  return (
    propertyAccess.includes('*') || propertyAccess.includes(propertyId)
  );
}

/** Consistent error response helper */
function errorResponse(
  c: Context,
  status: 400 | 403 | 404 | 409,
  code: 'NOT_FOUND' | 'FORBIDDEN' | 'BAD_REQUEST' | 'CONFLICT',
  message: string
) {
  return c.json(
    { success: false, error: { code, message } },
    status
  );
}

// GET /properties - List all properties (pagination, filters: status, type, city)
app.get('/', zValidator('query', listPropertiesQuerySchema), async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const useMockData = c.get('useMockData');
  const { page, pageSize, status, type, city, search, sortBy, sortOrder } = c.req.valid('query');

  // Use database if available
  if (!useMockData && repos) {
    try {
      const offset = (page - 1) * pageSize;
      const result = await repos.properties.findMany(auth.tenantId, { limit: pageSize, offset });

      // Filter by property access
      let items = result.items;
      if (!canAccessProperty('*', auth.propertyAccess)) {
        items = items.filter((p) => auth.propertyAccess.includes(p.id));
      }

      // Apply additional filters (status, type, city, search)
      if (status) {
        items = items.filter((p) => p.status === status.toLowerCase());
      }
      if (type) {
        items = items.filter((p) => p.type === type.toLowerCase());
      }
      if (city) {
        const cityLower = city.toLowerCase();
        items = items.filter((p) => p.city.toLowerCase() === cityLower);
      }
      if (search) {
        const searchLower = search.toLowerCase();
        items = items.filter(
          (p) =>
            p.name.toLowerCase().includes(searchLower) ||
            p.city.toLowerCase().includes(searchLower)
        );
      }

      return c.json({
        success: true,
        data: items,
        pagination: buildPaginationResponse(page, pageSize, result.total),
      });
    } catch (error) {
      console.error('Database error, falling back to mock data:', error);
    }
  }

  // Fallback to mock data
  let properties = getActiveByTenant(DEMO_PROPERTIES, auth.tenantId);

  if (!canAccessProperty('*', auth.propertyAccess)) {
    properties = properties.filter((p) =>
      auth.propertyAccess.includes(p.id)
    );
  }

  if (status) {
    properties = properties.filter((p) => p.status === status);
  }

  if (type) {
    properties = properties.filter((p) => p.type === type);
  }

  if (city) {
    const cityLower = city.toLowerCase();
    properties = properties.filter(
      (p) => p.address.city.toLowerCase() === cityLower
    );
  }

  if (search) {
    const searchLower = search.toLowerCase();
    properties = properties.filter(
      (p) =>
        p.name.toLowerCase().includes(searchLower) ||
        p.address.city.toLowerCase().includes(searchLower) ||
        (p.address.region?.toLowerCase().includes(searchLower) ?? false)
    );
  }

  // Sort
  properties = [...properties].sort((a, b) => {
    let cmp = 0;
    switch (sortBy) {
      case 'name':
        cmp = a.name.localeCompare(b.name);
        break;
      case 'createdAt':
        cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        break;
      case 'updatedAt':
        cmp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
        break;
      case 'city':
        cmp = (a.address.city ?? '').localeCompare(b.address.city ?? '');
        break;
      case 'status':
        cmp = a.status.localeCompare(b.status);
        break;
      default:
        cmp = a.name.localeCompare(b.name);
    }
    return sortOrder === 'desc' ? -cmp : cmp;
  });

  const result = paginate(properties, page, pageSize);

  return c.json({
    success: true,
    data: result.data,
    pagination: result.pagination,
  });
});

// POST /properties - Create property
app.post('/', zValidator('json', createPropertySchema, validationErrorHook), async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const useMockData = c.get('useMockData');
  const body = c.req.valid('json');

  // Use database if available
  if (!useMockData && repos) {
    try {
      const id = generateId();
      const propertyCode = `PROP-${Date.now().toString(36).toUpperCase()}`;
      
      const property = await repos.properties.create(
        {
          id,
          tenantId: auth.tenantId,
          ownerId: auth.userId, // Default to current user as owner
          propertyCode,
          name: body.name,
          type: (body.type?.toLowerCase() ?? 'apartment_complex') as any,
          status: (body.status?.toLowerCase() ?? 'active') as any,
          description: body.description,
          addressLine1: body.address.line1,
          addressLine2: body.address.line2,
          city: body.address.city,
          state: body.address.region,
          country: body.address.country ?? 'KE',
          latitude: body.address.coordinates?.latitude?.toString(),
          longitude: body.address.coordinates?.longitude?.toString(),
          amenities: body.amenities ?? [],
          images: body.images ?? [],
          managerId: body.managerId,
          totalUnits: body.totalUnits ?? 0,
          occupiedUnits: body.occupiedUnits ?? 0,
          vacantUnits: (body.totalUnits ?? 0) - (body.occupiedUnits ?? 0),
          createdBy: auth.userId,
          updatedBy: auth.userId,
        },
        auth.userId
      );

      return c.json({ success: true, data: property }, 201);
    } catch (error) {
      console.error('Database error, falling back to mock data:', error);
    }
  }

  // Fallback to mock data
  const property = createPropertyMock(
    {
      name: body.name,
      type: body.type,
      status: body.status ?? 'ACTIVE',
      address: body.address,
      description: body.description,
      amenities: body.amenities ?? [],
      images: body.images ?? [],
      managerId: body.managerId,
      totalUnits: body.totalUnits ?? 0,
      occupiedUnits: body.occupiedUnits ?? 0,
      settings: body.settings ?? {},
    },
    auth.tenantId,
    auth.userId
  );

  return c.json(
    {
      success: true,
      data: property,
    },
    201
  );
});

// GET /properties/:id/units - List units for property (must be before /:id)
app.get(
  '/:id/units',
  zValidator('param', idParamSchema),
  zValidator('query', paginationQuerySchema.extend({ status: unitStatusSchema.optional() })),
  async (c) => {
    const id = c.req.param('id');
    const auth = c.get('auth');
    const repos = c.get('repos');
    const useMockData = c.get('useMockData');
    const { page, pageSize, status } = c.req.valid('query');

    // Use database if available
    if (!useMockData && repos) {
      try {
        // First verify property exists and user has access
        const property = await repos.properties.findById(id, auth.tenantId);
        if (!property) {
          return errorResponse(c, 404, 'NOT_FOUND', 'Property not found');
        }
        if (!canAccessProperty(id, auth.propertyAccess)) {
          return errorResponse(c, 403, 'FORBIDDEN', 'Access denied');
        }

        const offset = (page - 1) * pageSize;
        const result = await repos.units.findByProperty(id, auth.tenantId, { limit: pageSize, offset });

        let items = result.items;
        if (status) {
          items = items.filter((u) => u.status === status.toLowerCase());
        }

        return c.json({
          success: true,
          data: items,
          pagination: buildPaginationResponse(page, pageSize, result.total),
        });
      } catch (error) {
        console.error('Database error, falling back to mock data:', error);
      }
    }

    // Fallback to mock data
    const property = getActiveById(DEMO_PROPERTIES, id);
    if (!property || property.tenantId !== auth.tenantId) {
      return errorResponse(c, 404, 'NOT_FOUND', 'Property not found');
    }
    if (!canAccessProperty(id, auth.propertyAccess)) {
      return errorResponse(c, 403, 'FORBIDDEN', 'Access denied');
    }

    let units = DEMO_UNITS.filter(
      (u) => u.propertyId === id && !u.deletedAt && u.tenantId === auth.tenantId
    );

    if (status) {
      units = units.filter((u) => u.status === status);
    }

    const result = paginate(units, page, pageSize);

    return c.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  }
);

// PUT /properties/:id/manager - Assign or unassign manager
app.put(
  '/:id/manager',
  zValidator('param', idParamSchema),
  zValidator('json', assignManagerSchema, validationErrorHook),
  async (c) => {
    const id = c.req.param('id');
    const auth = c.get('auth');
    const repos = c.get('repos');
    const useMockData = c.get('useMockData');
    const { managerId } = c.req.valid('json');

    // Use database if available
    if (!useMockData && repos) {
      try {
        const property = await repos.properties.findById(id, auth.tenantId);
        if (!property) {
          return errorResponse(c, 404, 'NOT_FOUND', 'Property not found');
        }
        if (!canAccessProperty(id, auth.propertyAccess)) {
          return errorResponse(c, 403, 'FORBIDDEN', 'Access denied');
        }

        const updated = await repos.properties.update(
          id,
          auth.tenantId,
          { managerId: managerId ?? undefined },
          auth.userId
        );

        return c.json({ success: true, data: updated });
      } catch (error) {
        console.error('Database error, falling back to mock data:', error);
      }
    }

    // Fallback to mock data
    const property = getActiveById(DEMO_PROPERTIES, id);
    if (!property || property.tenantId !== auth.tenantId) {
      return errorResponse(c, 404, 'NOT_FOUND', 'Property not found');
    }
    if (!canAccessProperty(id, auth.propertyAccess)) {
      return errorResponse(c, 403, 'FORBIDDEN', 'Access denied');
    }

    // When assigning, validate manager exists and belongs to tenant
    if (managerId !== null) {
      const tenantUser = DEMO_TENANT_USERS.find(
        (tu) => tu.tenantId === auth.tenantId && tu.userId === managerId
      );
      const user = DEMO_USERS.find((u) => u.id === managerId);
      if (!user || !tenantUser) {
        return errorResponse(c, 404, 'NOT_FOUND', 'Manager user not found or not in tenant');
      }
      if (user.status !== 'ACTIVE') {
        return c.json(
          { success: false, error: { code: 'BAD_REQUEST', message: 'Manager user must be active' } },
          400
        );
      }
    }

    const managerUpdate = managerId === null ? { managerId: undefined } : { managerId };
    const updated = updatePropertyMock(id, managerUpdate, auth.userId);
    if (!updated) {
      return errorResponse(c, 404, 'NOT_FOUND', 'Property not found');
    }

    return c.json({
      success: true,
      data: updated,
    });
  }
);

// GET /properties/:id/stats - Get property statistics (occupancy, revenue)
app.get('/:id/stats', zValidator('param', idParamSchema), async (c) => {
  const id = c.req.param('id');
  const auth = c.get('auth');
  const repos = c.get('repos');
  const useMockData = c.get('useMockData');

  // Use database if available
  if (!useMockData && repos) {
    try {
      const property = await repos.properties.findById(id, auth.tenantId);
      if (!property) {
        return errorResponse(c, 404, 'NOT_FOUND', 'Property not found');
      }
      if (!canAccessProperty(id, auth.propertyAccess)) {
        return errorResponse(c, 403, 'FORBIDDEN', 'Access denied');
      }

      const unitsResult = await repos.units.findByProperty(id, auth.tenantId, { limit: 1000, offset: 0 });
      const units = unitsResult.items;
      
      const occupiedUnits = units.filter((u) => u.status === 'occupied');
      const totalUnits = units.length;
      const occupancyRate = totalUnits > 0 ? (occupiedUnits.length / totalUnits) * 100 : 0;

      const expectedMonthlyRevenue = occupiedUnits.reduce(
        (sum, u) => sum + (u.baseRentAmount ?? 0),
        0
      );
      const totalPotentialRent = units.reduce((sum, u) => sum + (u.baseRentAmount ?? 0), 0);

      return c.json({
        success: true,
        data: {
          totalUnits,
          occupiedUnits: occupiedUnits.length,
          availableUnits: units.filter((u) => u.status === 'vacant').length,
          maintenanceUnits: units.filter((u) => u.status === 'under_maintenance').length,
          reservedUnits: units.filter((u) => u.status === 'reserved').length,
          occupancyRate: Math.round(occupancyRate * 100) / 100,
          expectedMonthlyRevenue,
          totalPotentialRent,
          actualRevenue: 0, // Would need to query invoices
        },
      });
    } catch (error) {
      console.error('Database error, falling back to mock data:', error);
    }
  }

  // Fallback to mock data
  const property = getActiveById(DEMO_PROPERTIES, id);
  if (!property || property.tenantId !== auth.tenantId) {
    return errorResponse(c, 404, 'NOT_FOUND', 'Property not found');
  }
  if (!canAccessProperty(id, auth.propertyAccess)) {
    return errorResponse(c, 403, 'FORBIDDEN', 'Access denied');
  }

  const units = DEMO_UNITS.filter(
    (u) => u.propertyId === id && !u.deletedAt && u.tenantId === property.tenantId
  );
  const occupiedUnits = units.filter((u) => u.status === 'OCCUPIED');
  const totalUnits = units.length;
  const occupancyRate =
    totalUnits > 0 ? (occupiedUnits.length / totalUnits) * 100 : 0;

  const expectedMonthlyRevenue = occupiedUnits.reduce(
    (sum, u) => sum + u.rentAmount,
    0
  );
  const totalPotentialRent = units.reduce((sum, u) => sum + u.rentAmount, 0);

  // Actual revenue from Paid invoices for leases on this property's units
  const unitIds = new Set(units.map((u) => u.id));
  const propertyLeaseIds = new Set(
    DEMO_LEASES.filter((l) => unitIds.has(l.unitId)).map((l) => l.id)
  );
  const actualRevenue = DEMO_INVOICES
    .filter(
      (inv) =>
        inv.tenantId === property.tenantId &&
        inv.status === 'PAID' &&
        inv.leaseId &&
        propertyLeaseIds.has(inv.leaseId)
    )
    .reduce((sum, inv) => sum + inv.amountPaid, 0);

  return c.json({
    success: true,
    data: {
      totalUnits,
      occupiedUnits: occupiedUnits.length,
      availableUnits: units.filter((u) => u.status === 'AVAILABLE').length,
      maintenanceUnits: units.filter((u) => u.status === 'MAINTENANCE').length,
      reservedUnits: units.filter((u) => u.status === 'RESERVED').length,
      occupancyRate: Math.round(occupancyRate * 100) / 100,
      expectedMonthlyRevenue,
      totalPotentialRent,
      actualRevenue,
    },
  });
});

// GET /properties/:id - Get property by ID
app.get('/:id', zValidator('param', idParamSchema), async (c) => {
  const id = c.req.param('id');
  const auth = c.get('auth');
  const repos = c.get('repos');
  const useMockData = c.get('useMockData');

  // Use database if available
  if (!useMockData && repos) {
    try {
      const property = await repos.properties.findById(id, auth.tenantId);
      if (!property) {
        return errorResponse(c, 404, 'NOT_FOUND', 'Property not found');
      }
      if (!canAccessProperty(id, auth.propertyAccess)) {
        return errorResponse(c, 403, 'FORBIDDEN', 'Access denied');
      }

      const unitsResult = await repos.units.findByProperty(id, auth.tenantId, { limit: 1000, offset: 0 });
      const units = unitsResult.items;
      const occupiedUnits = units.filter((u) => u.status === 'occupied').length;
      const availableUnits = units.filter((u) => u.status === 'vacant').length;

      return c.json({
        success: true,
        data: {
          ...property,
          stats: {
            totalUnits: units.length,
            occupiedUnits,
            availableUnits,
            occupancyRate: units.length > 0 ? (occupiedUnits / units.length) * 100 : 0,
          },
        },
      });
    } catch (error) {
      console.error('Database error, falling back to mock data:', error);
    }
  }

  // Fallback to mock data
  const property = getActiveById(DEMO_PROPERTIES, id);
  if (!property || property.tenantId !== auth.tenantId) {
    return errorResponse(c, 404, 'NOT_FOUND', 'Property not found');
  }
  if (!canAccessProperty(id, auth.propertyAccess)) {
    return errorResponse(c, 403, 'FORBIDDEN', 'Access denied');
  }

  const units = DEMO_UNITS.filter(
    (u) => u.propertyId === id && !u.deletedAt && u.tenantId === property.tenantId
  );
  const occupiedUnits = units.filter((u) => u.status === 'OCCUPIED').length;
  const availableUnits = units.filter((u) => u.status === 'AVAILABLE').length;

  return c.json({
    success: true,
    data: {
      ...property,
      stats: {
        totalUnits: units.length,
        occupiedUnits,
        availableUnits,
        occupancyRate:
          units.length > 0 ? (occupiedUnits / units.length) * 100 : 0,
      },
    },
  });
});

// PUT /properties/:id - Update property
app.put('/:id', zValidator('param', idParamSchema), zValidator('json', updatePropertySchema, validationErrorHook), async (c) => {
  const id = c.req.param('id');
  const auth = c.get('auth');
  const repos = c.get('repos');
  const useMockData = c.get('useMockData');
  const body = c.req.valid('json');

  // Use database if available
  if (!useMockData && repos) {
    try {
      const property = await repos.properties.findById(id, auth.tenantId);
      if (!property) {
        return errorResponse(c, 404, 'NOT_FOUND', 'Property not found');
      }
      if (!canAccessProperty(id, auth.propertyAccess)) {
        return errorResponse(c, 403, 'FORBIDDEN', 'Access denied');
      }

      const updateData: Record<string, any> = {};
      if (body.name) updateData.name = body.name;
      if (body.type) updateData.type = body.type.toLowerCase();
      if (body.status) updateData.status = body.status.toLowerCase();
      if (body.description !== undefined) updateData.description = body.description;
      if (body.address) {
        if (body.address.line1) updateData.addressLine1 = body.address.line1;
        if (body.address.line2) updateData.addressLine2 = body.address.line2;
        if (body.address.city) updateData.city = body.address.city;
        if (body.address.region) updateData.state = body.address.region;
        if (body.address.country) updateData.country = body.address.country;
      }
      if (body.amenities) updateData.amenities = body.amenities;
      if (body.images) updateData.images = body.images;
      if (body.managerId !== undefined) updateData.managerId = body.managerId;

      const updated = await repos.properties.update(id, auth.tenantId, updateData, auth.userId);

      return c.json({ success: true, data: updated });
    } catch (error) {
      console.error('Database error, falling back to mock data:', error);
    }
  }

  // Fallback to mock data
  const property = getActiveById(DEMO_PROPERTIES, id);
  if (!property || property.tenantId !== auth.tenantId) {
    return errorResponse(c, 404, 'NOT_FOUND', 'Property not found');
  }
  if (!canAccessProperty(id, auth.propertyAccess)) {
    return errorResponse(c, 403, 'FORBIDDEN', 'Access denied');
  }

  const updated = updatePropertyMock(id, body as Record<string, unknown>, auth.userId);
  if (!updated) {
    return errorResponse(c, 404, 'NOT_FOUND', 'Property not found');
  }

  return c.json({
    success: true,
    data: updated,
  });
});

// DELETE /properties/:id - Soft delete
app.delete('/:id', zValidator('param', idParamSchema), async (c) => {
  const id = c.req.param('id');
  const auth = c.get('auth');
  const repos = c.get('repos');
  const useMockData = c.get('useMockData');

  // Use database if available
  if (!useMockData && repos) {
    try {
      const property = await repos.properties.findById(id, auth.tenantId);
      if (!property) {
        return errorResponse(c, 404, 'NOT_FOUND', 'Property not found');
      }
      if (!canAccessProperty(id, auth.propertyAccess)) {
        return errorResponse(c, 403, 'FORBIDDEN', 'Access denied');
      }

      await repos.properties.delete(id, auth.tenantId, auth.userId);

      return c.json({
        success: true,
        data: { message: 'Property soft deleted successfully' },
      });
    } catch (error) {
      console.error('Database error, falling back to mock data:', error);
    }
  }

  // Fallback to mock data
  const property = getActiveById(DEMO_PROPERTIES, id);
  if (!property || property.tenantId !== auth.tenantId) {
    return errorResponse(c, 404, 'NOT_FOUND', 'Property not found');
  }
  if (!canAccessProperty(id, auth.propertyAccess)) {
    return errorResponse(c, 403, 'FORBIDDEN', 'Access denied');
  }

  const deleted = softDeletePropertyMock(id);
  if (!deleted) {
    return errorResponse(c, 404, 'NOT_FOUND', 'Property not found');
  }

  return c.json({
    success: true,
    data: { message: 'Property soft deleted successfully' },
  });
});

export const propertiesRouter = app;
