/**
 * Production-ready Leases API routes
 * Hono + Zod validation with proper error handling
 * Uses database queries with mock data fallback
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { authMiddleware } from '../middleware/hono-auth';
import { databaseMiddleware, generateId as generateUUID, buildPaginationResponse } from '../middleware/database';
import {
  leaseListQuerySchema,
  createLeaseSchema,
  updateLeaseSchema,
  expiringLeasesQuerySchema,
  renewLeaseSchema,
  terminateLeaseSchema,
  paginationSchema,
  idParamSchema,
  validationErrorResponse,
} from './schemas';
import {
  DEMO_LEASES,
  DEMO_UNITS,
  DEMO_CUSTOMERS,
  DEMO_PROPERTIES,
  DEMO_INVOICES,
  getByTenant,
  getById,
  paginate,
} from '../data/mock-data';
import { LeaseStatus } from '../types/mock-types';

// Mutable in-memory store for CRUD (production would use DB)
const leasesStore = [...DEMO_LEASES];

function generateMockId(prefix: string): string {
  const existing = leasesStore.map((l) => l.id);
  let n = 1;
  while (existing.includes(`${prefix}-${String(n).padStart(3, '0')}`)) n++;
  return `${prefix}-${String(n).padStart(3, '0')}`;
}

export const leasesRouter = new Hono()
  .use('*', authMiddleware)
  .use('*', databaseMiddleware);

// GET /leases/expiring - Get leases expiring soon (MUST be before /:id)
leasesRouter.get(
  '/expiring',
  zValidator('query', expiringLeasesQuerySchema, (result, c) => {
    if (!result.success) return validationErrorResponse(result, c, 'Invalid query parameters');
  }),
  async (c) => {
    const auth = c.get('auth');
    const repos = c.get('repos');
    const useMockData = c.get('useMockData');
    const query = c.req.valid('query');
    const { page, pageSize, days } = query;

    const now = new Date();
    const cutoffDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    // Use database if available
    if (!useMockData && repos) {
      try {
        const result = await repos.leases.findMany(auth.tenantId, { limit: 1000, offset: 0 }, { status: 'active' });
        
        // Filter by expiring date
        let expiring = result.items.filter((l) => {
          const endDate = new Date(l.endDate);
          return endDate >= now && endDate <= cutoffDate;
        });
        
        expiring.sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime());
        
        // Manual pagination
        const offset = (page - 1) * pageSize;
        const totalItems = expiring.length;
        const paginatedItems = expiring.slice(offset, offset + pageSize);

        // Enrich with unit, customer, property info
        const enrichedData = await Promise.all(
          paginatedItems.map(async (lease) => {
            const unit = lease.unitId ? await repos.units.findById(lease.unitId, auth.tenantId) : null;
            const customer = lease.customerId ? await repos.customers.findById(lease.customerId, auth.tenantId) : null;
            const property = unit?.propertyId ? await repos.properties.findById(unit.propertyId, auth.tenantId) : null;
            return {
              ...lease,
              unit: unit ? { id: unit.id, unitNumber: unit.unitCode } : null,
              property: property ? { id: property.id, name: property.name } : null,
              customer: customer
                ? { id: customer.id, name: `${customer.firstName} ${customer.lastName}` }
                : null,
            };
          })
        );

        return c.json({
          success: true,
          data: enrichedData,
          pagination: buildPaginationResponse(page, pageSize, totalItems),
        });
      } catch (error) {
        console.error('Database error, falling back to mock data:', error);
      }
    }

    // Fallback to mock data
    let leases = getByTenant(leasesStore, auth.tenantId).filter((l) => {
      const endDate = new Date(l.endDate);
      return l.status === 'ACTIVE' && endDate >= now && endDate <= cutoffDate;
    });

    leases.sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime());

    const result = paginate(leases, page, pageSize);
    const enrichedData = result.data.map((lease) => {
      const unit = getById(DEMO_UNITS, lease.unitId);
      const customer = getById(DEMO_CUSTOMERS, lease.customerId);
      const property = unit ? getById(DEMO_PROPERTIES, unit.propertyId) : null;
      return {
        ...lease,
        unit: unit ? { id: unit.id, unitNumber: unit.unitNumber } : null,
        property: property ? { id: property.id, name: property.name } : null,
        customer: customer
          ? { id: customer.id, name: `${customer.firstName} ${customer.lastName}` }
          : null,
      };
    });

    return c.json({
      success: true,
      data: enrichedData,
      pagination: result.pagination,
    });
  }
);

// GET /leases - List with pagination, filters (status, propertyId, customerId)
leasesRouter.get(
  '/',
  zValidator('query', leaseListQuerySchema, (result, c) => {
    if (!result.success) return validationErrorResponse(result, c, 'Invalid query parameters');
  }),
  async (c) => {
    const auth = c.get('auth');
    const repos = c.get('repos');
    const useMockData = c.get('useMockData');
    const query = c.req.valid('query');
    const { page, pageSize, status, propertyId, customerId } = query;

    // Use database if available
    if (!useMockData && repos) {
      try {
        const offset = (page - 1) * pageSize;
        const filters: { status?: string; propertyId?: string; customerId?: string } = {};
        if (status) filters.status = status.toLowerCase();
        if (propertyId) filters.propertyId = propertyId;
        if (customerId) filters.customerId = customerId;

        const result = await repos.leases.findMany(auth.tenantId, { limit: pageSize, offset }, filters);

        // Enrich with unit, customer, property info
        const enrichedData = await Promise.all(
          result.items.map(async (lease) => {
            const unit = lease.unitId ? await repos.units.findById(lease.unitId, auth.tenantId) : null;
            const customer = lease.customerId ? await repos.customers.findById(lease.customerId, auth.tenantId) : null;
            const property = unit?.propertyId ? await repos.properties.findById(unit.propertyId, auth.tenantId) : null;
            return {
              ...lease,
              unit: unit ? { id: unit.id, unitNumber: unit.unitCode } : null,
              property: property ? { id: property.id, name: property.name } : null,
              customer: customer
                ? { id: customer.id, name: `${customer.firstName} ${customer.lastName}` }
                : null,
            };
          })
        );

        return c.json({
          success: true,
          data: enrichedData,
          pagination: buildPaginationResponse(page, pageSize, result.total),
        });
      } catch (error) {
        console.error('Database error, falling back to mock data:', error);
      }
    }

    // Fallback to mock data
    let leases = getByTenant(leasesStore, auth.tenantId);

    if (status) {
      leases = leases.filter((l) => l.status === status);
    }

    if (propertyId) {
      const propertyUnits = DEMO_UNITS.filter((u) => u.propertyId === propertyId).map(
        (u) => u.id
      );
      leases = leases.filter((l) => propertyUnits.includes(l.unitId));
    }

    if (customerId) {
      leases = leases.filter((l) => l.customerId === customerId);
    }

    const result = paginate(leases, page, pageSize);
    const enrichedData = result.data.map((lease) => {
      const unit = getById(DEMO_UNITS, lease.unitId);
      const customer = getById(DEMO_CUSTOMERS, lease.customerId);
      const property = unit ? getById(DEMO_PROPERTIES, unit.propertyId) : null;
      return {
        ...lease,
        unit: unit ? { id: unit.id, unitNumber: unit.unitNumber } : null,
        property: property ? { id: property.id, name: property.name } : null,
        customer: customer
          ? { id: customer.id, name: `${customer.firstName} ${customer.lastName}` }
          : null,
      };
    });

    return c.json({
      success: true,
      data: enrichedData,
      pagination: result.pagination,
    });
  }
);

// GET /leases/:id - Get by ID
leasesRouter.get(
  '/:id',
  zValidator('param', idParamSchema, (result, c) => {
    if (!result.success) return validationErrorResponse(result, c, 'Invalid lease ID');
  }),
  async (c) => {
    const auth = c.get('auth');
    const repos = c.get('repos');
    const useMockData = c.get('useMockData');
    const id = c.req.param('id');

    // Use database if available
    if (!useMockData && repos) {
      try {
        const lease = await repos.leases.findById(id, auth.tenantId);

        if (!lease) {
          return c.json(
            {
              success: false,
              error: { code: 'NOT_FOUND', message: 'Lease not found' },
            },
            404
          );
        }

        const unit = lease.unitId ? await repos.units.findById(lease.unitId, auth.tenantId) : null;
        const customer = lease.customerId ? await repos.customers.findById(lease.customerId, auth.tenantId) : null;
        const property = unit?.propertyId ? await repos.properties.findById(unit.propertyId, auth.tenantId) : null;

        return c.json({
          success: true,
          data: {
            ...lease,
            unit,
            customer,
            property,
          },
        });
      } catch (error) {
        console.error('Database error, falling back to mock data:', error);
      }
    }

    // Fallback to mock data
    const lease = getById(leasesStore, id);

    if (!lease || lease.tenantId !== auth.tenantId) {
      return c.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Lease not found' },
        },
        404
      );
    }

    const unit = getById(DEMO_UNITS, lease.unitId);
    const customer = getById(DEMO_CUSTOMERS, lease.customerId);
    const property = unit ? getById(DEMO_PROPERTIES, unit.propertyId) : null;

    return c.json({
      success: true,
      data: {
        ...lease,
        unit,
        customer,
        property,
      },
    });
  }
);

// POST /leases - Create lease (draft)
leasesRouter.post(
  '/',
  zValidator('json', createLeaseSchema, (result, c) => {
    if (!result.success) return validationErrorResponse(result, c, 'Invalid request body');
  }),
  async (c) => {
    const auth = c.get('auth');
    const repos = c.get('repos');
    const useMockData = c.get('useMockData');
    const body = c.req.valid('json');

    // Use database if available
    if (!useMockData && repos) {
      try {
        // Verify unit exists
        const unit = await repos.units.findById(body.unitId, auth.tenantId);
        if (!unit) {
          return c.json(
            { success: false, error: { code: 'NOT_FOUND', message: 'Unit not found' } },
            404
          );
        }

        // Verify customer exists
        const customer = await repos.customers.findById(body.customerId, auth.tenantId);
        if (!customer) {
          return c.json(
            { success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } },
            404
          );
        }

        const id = generateUUID();
        const leaseNumber = `LEASE-${Date.now().toString(36).toUpperCase()}`;

        const lease = await repos.leases.create(
          {
            id,
            tenantId: auth.tenantId,
            leaseNumber,
            propertyId: unit.propertyId,
            unitId: body.unitId,
            customerId: body.customerId,
            status: 'draft',
            startDate: new Date(body.startDate),
            endDate: new Date(body.endDate),
            rentAmount: body.rentAmount,
            depositAmount: body.depositAmount ?? 0,
            depositPaid: 0,
            paymentDueDay: body.paymentDueDay ?? 5,
            leaseTerms: body.terms ?? {},
            createdBy: auth.userId,
            updatedBy: auth.userId,
          },
          auth.userId
        );

        return c.json({ success: true, data: lease }, 201);
      } catch (error) {
        console.error('Database error, falling back to mock data:', error);
      }
    }

    // Fallback to mock data
    const unit = getById(DEMO_UNITS, body.unitId);
    const customer = getById(DEMO_CUSTOMERS, body.customerId);

    if (!unit || unit.tenantId !== auth.tenantId) {
      return c.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Unit not found' },
        },
        404
      );
    }

    if (!customer || customer.tenantId !== auth.tenantId || customer.deletedAt) {
      return c.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Customer not found' },
        },
        404
      );
    }

    const now = new Date();
    const newLease = {
      id: generateMockId('lease'),
      tenantId: auth.tenantId,
      unitId: body.unitId,
      customerId: body.customerId,
      status: LeaseStatus.DRAFT,
      startDate: new Date(body.startDate),
      endDate: new Date(body.endDate),
      rentAmount: body.rentAmount,
      depositAmount: body.depositAmount,
      depositPaid: 0,
      paymentDueDay: body.paymentDueDay ?? 5,
      terms: body.terms ?? {
        gracePeriodDays: 5,
        noticePeriodDays: 30,
        allowPets: false,
        allowSubletting: false,
        utilitiesIncluded: [],
      },
      createdAt: now,
      createdBy: auth.userId,
      updatedAt: now,
      updatedBy: auth.userId,
    };

    leasesStore.push(newLease as (typeof leasesStore)[0]);

    return c.json({ success: true, data: newLease }, 201);
  }
);

// PUT /leases/:id - Update lease terms
leasesRouter.put(
  '/:id',
  zValidator('param', idParamSchema, (result, c) => {
    if (!result.success) return validationErrorResponse(result, c, 'Invalid lease ID');
  }),
  zValidator('json', updateLeaseSchema, (result, c) => {
    if (!result.success) return validationErrorResponse(result, c, 'Invalid request body');
  }),
  async (c) => {
    const auth = c.get('auth');
    const repos = c.get('repos');
    const useMockData = c.get('useMockData');
    const id = c.req.param('id');
    const body = c.req.valid('json');

    // Use database if available
    if (!useMockData && repos) {
      try {
        const lease = await repos.leases.findById(id, auth.tenantId);
        if (!lease) {
          return c.json(
            { success: false, error: { code: 'NOT_FOUND', message: 'Lease not found' } },
            404
          );
        }

        if (lease.status !== 'draft') {
          return c.json(
            {
              success: false,
              error: { code: 'CONFLICT', message: 'Only draft leases can be updated' },
            },
            409
          );
        }

        const updateData: Record<string, any> = {};
        if (body.startDate) updateData.startDate = new Date(body.startDate);
        if (body.endDate) updateData.endDate = new Date(body.endDate);
        if (body.rentAmount !== undefined) updateData.rentAmount = body.rentAmount;
        if (body.depositAmount !== undefined) updateData.depositAmount = body.depositAmount;
        if (body.paymentDueDay !== undefined) updateData.paymentDueDay = body.paymentDueDay;
        if (body.terms) updateData.leaseTerms = { ...(lease.leaseTerms as object), ...body.terms };

        const updated = await repos.leases.update(id, auth.tenantId, updateData, auth.userId);

        return c.json({ success: true, data: updated });
      } catch (error) {
        console.error('Database error, falling back to mock data:', error);
      }
    }

    // Fallback to mock data
    const lease = getById(leasesStore, id);
    if (!lease || lease.tenantId !== auth.tenantId) {
      return c.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Lease not found' },
        },
        404
      );
    }

    if (lease.status !== LeaseStatus.DRAFT) {
      return c.json(
        {
          success: false,
          error: {
            code: 'CONFLICT',
            message: 'Only draft leases can be updated',
          },
        },
        409
      );
    }

    const now = new Date();
    Object.assign(lease, {
      ...(body.startDate && { startDate: new Date(body.startDate) }),
      ...(body.endDate && { endDate: new Date(body.endDate) }),
      ...(body.rentAmount !== undefined && { rentAmount: body.rentAmount }),
      ...(body.depositAmount !== undefined && { depositAmount: body.depositAmount }),
      ...(body.paymentDueDay !== undefined && { paymentDueDay: body.paymentDueDay }),
      ...(body.terms && { terms: { ...lease.terms, ...body.terms } }),
      updatedAt: now,
      updatedBy: auth.userId,
    });

    return c.json({ success: true, data: lease });
  }
);

// DELETE /leases/:id - Cancel lease
leasesRouter.delete(
  '/:id',
  zValidator('param', idParamSchema, (result, c) => {
    if (!result.success) return validationErrorResponse(result, c, 'Invalid lease ID');
  }),
  async (c) => {
    const auth = c.get('auth');
    const repos = c.get('repos');
    const useMockData = c.get('useMockData');
    const id = c.req.param('id');

    // Use database if available
    if (!useMockData && repos) {
      try {
        const lease = await repos.leases.findById(id, auth.tenantId);
        if (!lease) {
          return c.json(
            { success: false, error: { code: 'NOT_FOUND', message: 'Lease not found' } },
            404
          );
        }

        await repos.leases.update(id, auth.tenantId, { status: 'terminated' }, auth.userId);

        return c.json({ success: true, data: { message: 'Lease cancelled' } });
      } catch (error) {
        console.error('Database error, falling back to mock data:', error);
      }
    }

    // Fallback to mock data
    const lease = getById(leasesStore, id);
    if (!lease || lease.tenantId !== auth.tenantId) {
      return c.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Lease not found' },
        },
        404
      );
    }

    const now = new Date();
    (lease as { status: LeaseStatus }).status = LeaseStatus.TERMINATED;
    (lease as { updatedAt: Date }).updatedAt = now;
    (lease as { updatedBy: string }).updatedBy = auth.userId;

    return c.json({ success: true, data: { message: 'Lease cancelled' } });
  }
);

// POST /leases/:id/activate - Activate lease
leasesRouter.post(
  '/:id/activate',
  zValidator('param', idParamSchema, (result, c) => {
    if (!result.success) return validationErrorResponse(result, c, 'Invalid lease ID');
  }),
  async (c) => {
    const auth = c.get('auth');
    const repos = c.get('repos');
    const useMockData = c.get('useMockData');
    const id = c.req.param('id');

    // Use database if available
    if (!useMockData && repos) {
      try {
        const lease = await repos.leases.findById(id, auth.tenantId);
        if (!lease) {
          return c.json(
            { success: false, error: { code: 'NOT_FOUND', message: 'Lease not found' } },
            404
          );
        }

        if (lease.status !== 'draft') {
          return c.json(
            {
              success: false,
              error: { code: 'CONFLICT', message: 'Only draft leases can be activated' },
            },
            409
          );
        }

        const now = new Date();
        const updated = await repos.leases.update(
          id,
          auth.tenantId,
          {
            status: 'active',
            signedAt: now,
            signedByTenant: true,
            signedByManager: true,
          },
          auth.userId
        );

        // Update unit status to occupied
        if (lease.unitId) {
          await repos.units.update(lease.unitId, auth.tenantId, { status: 'occupied', currentLeaseId: id }, auth.userId);
        }

        return c.json({ success: true, data: updated });
      } catch (error) {
        console.error('Database error, falling back to mock data:', error);
      }
    }

    // Fallback to mock data
    const lease = getById(leasesStore, id);
    if (!lease || lease.tenantId !== auth.tenantId) {
      return c.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Lease not found' },
        },
        404
      );
    }

    if (lease.status !== LeaseStatus.DRAFT) {
      return c.json(
        {
          success: false,
          error: {
            code: 'CONFLICT',
            message: 'Only draft leases can be activated',
          },
        },
        409
      );
    }

    const now = new Date();
    (lease as { status: LeaseStatus }).status = LeaseStatus.ACTIVE;
    (lease as { signedAt?: Date }).signedAt = now;
    (lease as { signedByCustomer?: boolean }).signedByCustomer = true;
    (lease as { signedByManager?: boolean }).signedByManager = true;
    (lease as { updatedAt: Date }).updatedAt = now;
    (lease as { updatedBy: string }).updatedBy = auth.userId;

    return c.json({ success: true, data: lease });
  }
);

// POST /leases/:id/terminate - Terminate lease
leasesRouter.post(
  '/:id/terminate',
  zValidator('param', idParamSchema, (result, c) => {
    if (!result.success) return validationErrorResponse(result, c, 'Invalid lease ID');
  }),
  zValidator('json', terminateLeaseSchema.optional(), (result, c) => {
    if (!result.success) return validationErrorResponse(result, c, 'Invalid request body');
  }),
  async (c) => {
    const auth = c.get('auth');
    const repos = c.get('repos');
    const useMockData = c.get('useMockData');
    const id = c.req.param('id');
    const body = c.req.valid('json') ?? {};

    // Use database if available
    if (!useMockData && repos) {
      try {
        const lease = await repos.leases.findById(id, auth.tenantId);
        if (!lease) {
          return c.json(
            { success: false, error: { code: 'NOT_FOUND', message: 'Lease not found' } },
            404
          );
        }

        if (lease.status !== 'active') {
          return c.json(
            {
              success: false,
              error: { code: 'CONFLICT', message: 'Only active leases can be terminated' },
            },
            409
          );
        }

        const now = new Date();
        const updated = await repos.leases.update(
          id,
          auth.tenantId,
          {
            status: 'terminated',
            terminationReason: body.reason,
            terminatedAt: now,
          },
          auth.userId
        );

        // Update unit status to vacant
        if (lease.unitId) {
          await repos.units.update(lease.unitId, auth.tenantId, { status: 'vacant', currentLeaseId: null }, auth.userId);
        }

        return c.json({ success: true, data: updated });
      } catch (error) {
        console.error('Database error, falling back to mock data:', error);
      }
    }

    // Fallback to mock data
    const lease = getById(leasesStore, id);
    if (!lease || lease.tenantId !== auth.tenantId) {
      return c.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Lease not found' },
        },
        404
      );
    }

    if (lease.status !== LeaseStatus.ACTIVE) {
      return c.json(
        {
          success: false,
          error: {
            code: 'CONFLICT',
            message: 'Only active leases can be terminated',
          },
        },
        409
      );
    }

    const now = new Date();
    (lease as { status: LeaseStatus }).status = LeaseStatus.TERMINATED;
    (lease as { terminationReason?: string }).terminationReason = body.reason;
    (lease as { terminatedAt?: Date }).terminatedAt = now;
    (lease as { updatedAt: Date }).updatedAt = now;
    (lease as { updatedBy: string }).updatedBy = auth.userId;

    return c.json({ success: true, data: lease });
  }
);

// POST /leases/:id/renew - Renew lease
leasesRouter.post(
  '/:id/renew',
  zValidator('param', idParamSchema, (result, c) => {
    if (!result.success) return validationErrorResponse(result, c, 'Invalid lease ID');
  }),
  zValidator('json', renewLeaseSchema.optional(), (result, c) => {
    if (!result.success) return validationErrorResponse(result, c, 'Invalid request body');
  }),
  async (c) => {
    const auth = c.get('auth');
    const repos = c.get('repos');
    const useMockData = c.get('useMockData');
    const id = c.req.param('id');
    const body = c.req.valid('json') ?? {};

    // Use database if available
    if (!useMockData && repos) {
      try {
        const lease = await repos.leases.findById(id, auth.tenantId);
        if (!lease) {
          return c.json(
            { success: false, error: { code: 'NOT_FOUND', message: 'Lease not found' } },
            404
          );
        }

        if (lease.status !== 'active' && lease.status !== 'expired') {
          return c.json(
            {
              success: false,
              error: { code: 'CONFLICT', message: 'Only active or expired leases can be renewed' },
            },
            409
          );
        }

        const oldEndDate = new Date(lease.endDate);
        const newStartDate = new Date(oldEndDate);
        newStartDate.setDate(newStartDate.getDate() + 1);

        let newEndDate: Date;
        let rentAmount = lease.rentAmount;

        if (body.newEndDate) {
          newEndDate = new Date(body.newEndDate);
        } else if (body.extendMonths) {
          newEndDate = new Date(newStartDate);
          newEndDate.setMonth(newEndDate.getMonth() + body.extendMonths);
          newEndDate.setDate(newEndDate.getDate() - 1);
        } else {
          newEndDate = new Date(newStartDate);
          newEndDate.setFullYear(newEndDate.getFullYear() + 1);
          newEndDate.setDate(newEndDate.getDate() - 1);
        }

        if (body.newRentAmount !== undefined) {
          rentAmount = body.newRentAmount;
        }

        // Expire old lease
        await repos.leases.update(id, auth.tenantId, { status: 'expired' }, auth.userId);

        // Create new lease
        const newId = generateUUID();
        const leaseNumber = `LEASE-${Date.now().toString(36).toUpperCase()}`;

        const renewedLease = await repos.leases.create(
          {
            id: newId,
            tenantId: auth.tenantId,
            leaseNumber,
            propertyId: lease.propertyId,
            unitId: lease.unitId,
            customerId: lease.customerId,
            status: 'draft',
            startDate: newStartDate,
            endDate: newEndDate,
            rentAmount,
            depositAmount: lease.depositAmount,
            depositPaid: lease.depositPaid,
            paymentDueDay: lease.paymentDueDay,
            leaseTerms: lease.leaseTerms,
            createdBy: auth.userId,
            updatedBy: auth.userId,
          },
          auth.userId
        );

        return c.json({ success: true, data: renewedLease }, 201);
      } catch (error) {
        console.error('Database error, falling back to mock data:', error);
      }
    }

    // Fallback to mock data
    const lease = getById(leasesStore, id);
    if (!lease || lease.tenantId !== auth.tenantId) {
      return c.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Lease not found' },
        },
        404
      );
    }

    if (lease.status !== LeaseStatus.ACTIVE && lease.status !== LeaseStatus.EXPIRED) {
      return c.json(
        {
          success: false,
          error: {
            code: 'CONFLICT',
            message: 'Only active or expired leases can be renewed',
          },
        },
        409
      );
    }

    const oldEndDate = new Date(lease.endDate);
    const newStartDate = new Date(oldEndDate);
    newStartDate.setDate(newStartDate.getDate() + 1);

    let newEndDate: Date;
    let rentAmount = lease.rentAmount;

    if (body.newEndDate) {
      newEndDate = new Date(body.newEndDate);
    } else if (body.extendMonths) {
      newEndDate = new Date(newStartDate);
      newEndDate.setMonth(newEndDate.getMonth() + body.extendMonths);
      newEndDate.setDate(newEndDate.getDate() - 1);
    } else {
      newEndDate = new Date(newStartDate);
      newEndDate.setFullYear(newEndDate.getFullYear() + 1);
      newEndDate.setDate(newEndDate.getDate() - 1);
    }

    if (body.newRentAmount !== undefined) {
      rentAmount = body.newRentAmount;
    }

    const now = new Date();
    const renewedLease = {
      id: generateMockId('lease'),
      tenantId: auth.tenantId,
      unitId: lease.unitId,
      customerId: lease.customerId,
      status: LeaseStatus.DRAFT,
      startDate: newStartDate,
      endDate: newEndDate,
      rentAmount,
      depositAmount: lease.depositAmount,
      depositPaid: lease.depositPaid,
      paymentDueDay: lease.paymentDueDay,
      terms: lease.terms,
      createdAt: now,
      createdBy: auth.userId,
      updatedAt: now,
      updatedBy: auth.userId,
    };

    (lease as { status: LeaseStatus }).status = LeaseStatus.EXPIRED;
    (lease as { updatedAt: Date }).updatedAt = now;
    (lease as { updatedBy: string }).updatedBy = auth.userId;

    leasesStore.push(renewedLease as (typeof leasesStore)[0]);

    return c.json({ success: true, data: renewedLease }, 201);
  }
);

// GET /leases/:id/invoices - Get lease invoices
leasesRouter.get(
  '/:id/invoices',
  zValidator('param', idParamSchema, (result, c) => {
    if (!result.success) return validationErrorResponse(result, c, 'Invalid lease ID');
  }),
  zValidator('query', paginationSchema, (result, c) => {
    if (!result.success) return validationErrorResponse(result, c, 'Invalid query parameters');
  }),
  async (c) => {
    const auth = c.get('auth');
    const repos = c.get('repos');
    const useMockData = c.get('useMockData');
    const id = c.req.param('id');
    const query = c.req.valid('query');

    // Use database if available
    if (!useMockData && repos) {
      try {
        const lease = await repos.leases.findById(id, auth.tenantId);
        if (!lease) {
          return c.json(
            { success: false, error: { code: 'NOT_FOUND', message: 'Lease not found' } },
            404
          );
        }

        const offset = (query.page - 1) * query.pageSize;
        const result = await repos.invoices.findByLease(id, auth.tenantId, query.pageSize, offset);

        return c.json({
          success: true,
          data: result.items,
          pagination: buildPaginationResponse(query.page, query.pageSize, result.total),
        });
      } catch (error) {
        console.error('Database error, falling back to mock data:', error);
      }
    }

    // Fallback to mock data
    const lease = getById(leasesStore, id);
    if (!lease || lease.tenantId !== auth.tenantId) {
      return c.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Lease not found' },
        },
        404
      );
    }

    let invoices = getByTenant(DEMO_INVOICES, auth.tenantId).filter(
      (i) => i.leaseId === id
    );
    invoices.sort(
      (a, b) =>
        new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime()
    );

    const result = paginate(invoices, query.page, query.pageSize);

    return c.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  }
);
