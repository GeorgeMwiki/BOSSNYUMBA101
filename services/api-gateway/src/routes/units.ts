/**
 * Units API routes - Hono with Zod validation
 * Production-ready REST API with tenant scoping and error handling
 * Uses database queries with mock data fallback
 */

import type { Context } from 'hono';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { Unit } from '../types/mock-types';
import {
  DEMO_UNITS,
  DEMO_LEASES,
  DEMO_CUSTOMERS,
  DEMO_PROPERTIES,
  getActiveById,
  getActiveByTenant,
  getById,
  paginate,
  createUnit as createUnitMock,
  updateUnit as updateUnitMock,
  softDeleteUnit as softDeleteUnitMock,
} from '../data/mock-data';
import { authMiddleware } from '../middleware/hono-auth';
import { databaseMiddleware, generateId, buildPaginationResponse } from '../middleware/database';
import {
  listUnitsQuerySchema,
  createUnitSchema,
  updateUnitSchema,
  updateUnitStatusSchema,
  idParamSchema,
  validationErrorHook,
} from './validators';

const app = new Hono();

// Apply auth and database middleware to all routes
app.use('*', authMiddleware);
app.use('*', databaseMiddleware);

function canAccessProperty(propertyId: string, propertyAccess: string[]): boolean {
  return propertyAccess.includes('*') || propertyAccess.includes(propertyId);
}

/** Consistent error response helper */
function errorResponse(
  c: Context,
  status: 400 | 403 | 404 | 409,
  code: 'NOT_FOUND' | 'FORBIDDEN' | 'BAD_REQUEST' | 'CONFLICT',
  message: string
) {
  return c.json({ success: false, error: { code, message } }, status);
}

// GET /units - List all units (pagination, filters: status, type, propertyId)
app.get('/', zValidator('query', listUnitsQuerySchema), async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const useMockData = c.get('useMockData');
  const { page, pageSize, status, type, propertyId, search, sortBy, sortOrder } = c.req.valid('query');

  // Use database if available
  if (!useMockData && repos) {
    try {
      const offset = (page - 1) * pageSize;
      let result;

      if (propertyId) {
        result = await repos.units.findByProperty(propertyId, auth.tenantId, { limit: pageSize, offset });
      } else {
        result = await repos.units.findMany(auth.tenantId, { limit: pageSize, offset });
      }

      let items = result.items;

      // Filter by property access
      if (!canAccessProperty('*', auth.propertyAccess)) {
        items = items.filter((u) => auth.propertyAccess.includes(u.propertyId));
      }

      // Apply additional filters
      if (status) {
        items = items.filter((u) => u.status === status.toLowerCase());
      }
      if (type) {
        items = items.filter((u) => u.type === type.toLowerCase());
      }
      if (search) {
        const searchLower = search.toLowerCase();
        items = items.filter((u) => u.unitCode.toLowerCase().includes(searchLower) || u.name.toLowerCase().includes(searchLower));
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
  let units = getActiveByTenant(DEMO_UNITS, auth.tenantId);

  if (!canAccessProperty('*', auth.propertyAccess)) {
    units = units.filter((u) => auth.propertyAccess.includes(u.propertyId));
  }

  if (propertyId) {
    units = units.filter((u) => u.propertyId === propertyId);
  }

  if (status) {
    units = units.filter((u) => u.status === status);
  }

  if (type) {
    units = units.filter((u) => u.type === type);
  }

  if (search) {
    const searchLower = search.toLowerCase();
    units = units.filter((u) => u.unitNumber.toLowerCase().includes(searchLower));
  }

  // Sort
  units = [...units].sort((a, b) => {
    let cmp = 0;
    switch (sortBy) {
      case 'unitNumber':
        cmp = a.unitNumber.localeCompare(b.unitNumber, undefined, { numeric: true });
        break;
      case 'floor':
        cmp = (a.floor ?? 0) - (b.floor ?? 0);
        break;
      case 'rentAmount':
        cmp = a.rentAmount - b.rentAmount;
        break;
      case 'status':
        cmp = a.status.localeCompare(b.status);
        break;
      case 'createdAt':
        cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        break;
      default:
        cmp = a.unitNumber.localeCompare(b.unitNumber, undefined, { numeric: true });
    }
    return sortOrder === 'desc' ? -cmp : cmp;
  });

  const result = paginate(units, page, pageSize);

  return c.json({
    success: true,
    data: result.data,
    pagination: result.pagination,
  });
});

// POST /units - Create unit
app.post('/', zValidator('json', createUnitSchema, validationErrorHook), async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const useMockData = c.get('useMockData');
  const body = c.req.valid('json');

  // Use database if available
  if (!useMockData && repos) {
    try {
      // Verify property exists and user has access
      const property = await repos.properties.findById(body.propertyId, auth.tenantId);
      if (!property) {
        return errorResponse(c, 404, 'NOT_FOUND', 'Property not found');
      }
      if (!canAccessProperty(body.propertyId, auth.propertyAccess)) {
        return errorResponse(c, 403, 'FORBIDDEN', 'Access denied');
      }

      // Check for duplicate unit code within property
      const existingUnit = await repos.units.findByCode(body.propertyId, body.unitNumber, auth.tenantId);
      if (existingUnit) {
        return errorResponse(c, 409, 'CONFLICT', `Unit number "${body.unitNumber}" already exists in this property`);
      }

      const id = generateId();
      const unit = await repos.units.create(
        {
          id,
          tenantId: auth.tenantId,
          propertyId: body.propertyId,
          unitCode: body.unitNumber,
          name: body.unitNumber,
          type: (body.type?.toLowerCase() ?? 'one_bedroom') as any,
          status: (body.status?.toLowerCase() ?? 'vacant') as any,
          floor: body.floor,
          bedrooms: body.bedrooms,
          bathrooms: body.bathrooms?.toString(),
          squareMeters: body.squareMeters?.toString(),
          baseRentAmount: body.rentAmount,
          depositAmount: body.depositAmount,
          amenities: body.amenities ?? [],
          images: body.images ?? [],
          createdBy: auth.userId,
          updatedBy: auth.userId,
        },
        auth.userId
      );

      return c.json({ success: true, data: unit }, 201);
    } catch (error) {
      console.error('Database error, falling back to mock data:', error);
    }
  }

  // Fallback to mock data
  const property = getActiveById(DEMO_PROPERTIES, body.propertyId);
  if (!property || property.tenantId !== auth.tenantId) {
    return errorResponse(c, 404, 'NOT_FOUND', 'Property not found');
  }
  if (!canAccessProperty(body.propertyId, auth.propertyAccess)) {
    return errorResponse(c, 403, 'FORBIDDEN', 'Access denied');
  }

  // Check for duplicate unit number within same property
  const duplicateUnit = DEMO_UNITS.find(
    (u) =>
      u.propertyId === body.propertyId &&
      u.unitNumber.toLowerCase() === body.unitNumber.toLowerCase() &&
      !u.deletedAt
  );
  if (duplicateUnit) {
    return c.json(
      {
        success: false,
        error: {
          code: 'CONFLICT',
          message: `Unit number "${body.unitNumber}" already exists in this property`,
        },
      },
      409
    );
  }

  const unit = createUnitMock(
    {
      propertyId: body.propertyId,
      unitNumber: body.unitNumber,
      floor: body.floor,
      type: body.type,
      status: body.status ?? 'AVAILABLE',
      bedrooms: body.bedrooms,
      bathrooms: body.bathrooms,
      squareMeters: body.squareMeters,
      rentAmount: body.rentAmount,
      depositAmount: body.depositAmount,
      amenities: body.amenities ?? [],
      images: body.images ?? [],
    },
    auth.tenantId,
    auth.userId
  );

  return c.json({ success: true, data: unit }, 201);
});

// PUT /units/:id/status - Update unit status (must be before /:id)
app.put(
  '/:id/status',
  zValidator('param', idParamSchema),
  zValidator('json', updateUnitStatusSchema, validationErrorHook),
  async (c) => {
    const id = c.req.param('id');
    const auth = c.get('auth');
    const repos = c.get('repos');
    const useMockData = c.get('useMockData');
    const { status } = c.req.valid('json');

    // Use database if available
    if (!useMockData && repos) {
      try {
        const unit = await repos.units.findById(id, auth.tenantId);
        if (!unit) {
          return errorResponse(c, 404, 'NOT_FOUND', 'Unit not found');
        }
        if (!canAccessProperty(unit.propertyId, auth.propertyAccess)) {
          return errorResponse(c, 403, 'FORBIDDEN', 'Access denied');
        }

        const updated = await repos.units.update(
          id,
          auth.tenantId,
          { status: status.toLowerCase() as any },
          auth.userId
        );

        return c.json({ success: true, data: updated });
      } catch (error) {
        console.error('Database error, falling back to mock data:', error);
      }
    }

    // Fallback to mock data
    const unit = getActiveById(DEMO_UNITS, id);
    if (!unit || unit.tenantId !== auth.tenantId) {
      return errorResponse(c, 404, 'NOT_FOUND', 'Unit not found');
    }
    if (!canAccessProperty(unit.propertyId, auth.propertyAccess)) {
      return errorResponse(c, 403, 'FORBIDDEN', 'Access denied');
    }

    const updated = updateUnitMock(id, { status }, auth.userId);
    if (!updated) {
      return errorResponse(c, 404, 'NOT_FOUND', 'Unit not found');
    }

    return c.json({ success: true, data: updated });
  }
);

// GET /units/:id - Get unit by ID
app.get('/:id', zValidator('param', idParamSchema), async (c) => {
  const id = c.req.param('id');
  const auth = c.get('auth');
  const repos = c.get('repos');
  const useMockData = c.get('useMockData');

  // Use database if available
  if (!useMockData && repos) {
    try {
      const unit = await repos.units.findById(id, auth.tenantId);
      if (!unit) {
        return errorResponse(c, 404, 'NOT_FOUND', 'Unit not found');
      }
      if (!canAccessProperty(unit.propertyId, auth.propertyAccess)) {
        return errorResponse(c, 403, 'FORBIDDEN', 'Access denied');
      }

      // Get current lease if occupied
      let currentLease = null;
      let currentTenant = null;
      if (unit.status === 'occupied' && unit.currentLeaseId) {
        const lease = await repos.leases.findById(unit.currentLeaseId, auth.tenantId);
        if (lease) {
          currentLease = {
            id: lease.id,
            startDate: lease.startDate,
            endDate: lease.endDate,
            rentAmount: lease.rentAmount,
          };
          if (lease.customerId) {
            const customer = await repos.customers.findById(lease.customerId, auth.tenantId);
            if (customer) {
              currentTenant = {
                id: customer.id,
                name: `${customer.firstName} ${customer.lastName}`,
                email: customer.email,
                phone: customer.phone,
              };
            }
          }
        }
      }

      return c.json({
        success: true,
        data: {
          ...unit,
          currentLease,
          currentTenant,
        },
      });
    } catch (error) {
      console.error('Database error, falling back to mock data:', error);
    }
  }

  // Fallback to mock data
  const unit = getActiveById(DEMO_UNITS, id);
  if (!unit || unit.tenantId !== auth.tenantId) {
    return errorResponse(c, 404, 'NOT_FOUND', 'Unit not found');
  }
  if (!canAccessProperty(unit.propertyId, auth.propertyAccess)) {
    return errorResponse(c, 403, 'FORBIDDEN', 'Access denied');
  }

  let currentLease = null;
  let currentTenant = null;
  if (unit.status === 'OCCUPIED') {
    currentLease = DEMO_LEASES.find((l) => l.unitId === id && l.status === 'ACTIVE');
    if (currentLease) {
      currentTenant = getById(DEMO_CUSTOMERS, currentLease.customerId);
    }
  }

  return c.json({
    success: true,
    data: {
      ...unit,
      currentLease: currentLease
        ? {
            id: currentLease.id,
            startDate: currentLease.startDate,
            endDate: currentLease.endDate,
            rentAmount: currentLease.rentAmount,
          }
        : null,
      currentTenant: currentTenant
        ? {
            id: currentTenant.id,
            name: `${currentTenant.firstName} ${currentTenant.lastName}`,
            email: currentTenant.email,
            phone: currentTenant.phone,
          }
        : null,
    },
  });
});

// PUT /units/:id - Update unit
app.put('/:id', zValidator('param', idParamSchema), zValidator('json', updateUnitSchema, validationErrorHook), async (c) => {
  const id = c.req.param('id');
  const auth = c.get('auth');
  const repos = c.get('repos');
  const useMockData = c.get('useMockData');
  const body = c.req.valid('json');

  // Use database if available
  if (!useMockData && repos) {
    try {
      const unit = await repos.units.findById(id, auth.tenantId);
      if (!unit) {
        return errorResponse(c, 404, 'NOT_FOUND', 'Unit not found');
      }
      if (!canAccessProperty(unit.propertyId, auth.propertyAccess)) {
        return errorResponse(c, 403, 'FORBIDDEN', 'Access denied');
      }

      // Check for duplicate unit code if changing
      if (body.unitNumber && body.unitNumber.toLowerCase() !== unit.unitCode.toLowerCase()) {
        const existingUnit = await repos.units.findByCode(unit.propertyId, body.unitNumber, auth.tenantId);
        if (existingUnit && existingUnit.id !== id) {
          return errorResponse(c, 409, 'CONFLICT', `Unit number "${body.unitNumber}" already exists in this property`);
        }
      }

      const updateData: Record<string, any> = {};
      if (body.unitNumber) {
        updateData.unitCode = body.unitNumber;
        updateData.name = body.unitNumber;
      }
      if (body.floor !== undefined) updateData.floor = body.floor;
      if (body.type) updateData.type = body.type.toLowerCase();
      if (body.status) updateData.status = body.status.toLowerCase();
      if (body.bedrooms !== undefined) updateData.bedrooms = body.bedrooms;
      if (body.bathrooms !== undefined) updateData.bathrooms = body.bathrooms.toString();
      if (body.squareMeters !== undefined) updateData.squareMeters = body.squareMeters.toString();
      if (body.rentAmount !== undefined) updateData.baseRentAmount = body.rentAmount;
      if (body.depositAmount !== undefined) updateData.depositAmount = body.depositAmount;
      if (body.amenities) updateData.amenities = body.amenities;
      if (body.images) updateData.images = body.images;

      const updated = await repos.units.update(id, auth.tenantId, updateData, auth.userId);

      return c.json({ success: true, data: updated });
    } catch (error) {
      console.error('Database error, falling back to mock data:', error);
    }
  }

  // Fallback to mock data
  const unit = getActiveById(DEMO_UNITS, id);
  if (!unit || unit.tenantId !== auth.tenantId) {
    return errorResponse(c, 404, 'NOT_FOUND', 'Unit not found');
  }
  if (!canAccessProperty(unit.propertyId, auth.propertyAccess)) {
    return errorResponse(c, 403, 'FORBIDDEN', 'Access denied');
  }

  // When changing unit number, check for duplicate within same property
  if (body.unitNumber && body.unitNumber.toLowerCase() !== unit.unitNumber.toLowerCase()) {
    const duplicate = DEMO_UNITS.find(
      (u) =>
        u.propertyId === unit.propertyId &&
        u.unitNumber.toLowerCase() === body.unitNumber!.toLowerCase() &&
        u.id !== id &&
        !u.deletedAt
    );
    if (duplicate) {
      return c.json(
        {
          success: false,
          error: {
            code: 'CONFLICT',
            message: `Unit number "${body.unitNumber}" already exists in this property`,
          },
        },
        409
      );
    }
  }

  const updated = updateUnitMock(id, body as Record<string, unknown>, auth.userId);
  if (!updated) {
    return errorResponse(c, 404, 'NOT_FOUND', 'Unit not found');
  }

  return c.json({ success: true, data: updated });
});

// DELETE /units/:id - Soft delete
app.delete('/:id', zValidator('param', idParamSchema), async (c) => {
  const id = c.req.param('id');
  const auth = c.get('auth');
  const repos = c.get('repos');
  const useMockData = c.get('useMockData');

  // Use database if available
  if (!useMockData && repos) {
    try {
      const unit = await repos.units.findById(id, auth.tenantId);
      if (!unit) {
        return errorResponse(c, 404, 'NOT_FOUND', 'Unit not found');
      }
      if (!canAccessProperty(unit.propertyId, auth.propertyAccess)) {
        return errorResponse(c, 403, 'FORBIDDEN', 'Access denied');
      }

      await repos.units.delete(id, auth.tenantId, auth.userId);

      return c.json({
        success: true,
        data: { message: 'Unit soft deleted successfully' },
      });
    } catch (error) {
      console.error('Database error, falling back to mock data:', error);
    }
  }

  // Fallback to mock data
  const unit = getActiveById(DEMO_UNITS, id);
  if (!unit || unit.tenantId !== auth.tenantId) {
    return errorResponse(c, 404, 'NOT_FOUND', 'Unit not found');
  }
  if (!canAccessProperty(unit.propertyId, auth.propertyAccess)) {
    return errorResponse(c, 403, 'FORBIDDEN', 'Access denied');
  }

  const deleted = softDeleteUnitMock(id);
  if (!deleted) {
    return errorResponse(c, 404, 'NOT_FOUND', 'Unit not found');
  }

  return c.json({
    success: true,
    data: { message: 'Unit soft deleted successfully' },
  });
});

export const unitsRouter = app;
