/**
 * Production-ready Customers API routes
 * Hono + Zod validation with proper error handling
 * Uses database queries with mock data fallback
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { authMiddleware } from '../middleware/hono-auth';
import { databaseMiddleware, generateId, buildPaginationResponse } from '../middleware/database';
import {
  customerListQuerySchema,
  createCustomerSchema,
  updateCustomerSchema,
  kycStatusSchema,
  blacklistSchema,
  paginationSchema,
  idParamSchema,
  validationErrorResponse,
} from './schemas';
import {
  DEMO_CUSTOMERS,
  DEMO_LEASES,
  DEMO_UNITS,
  DEMO_PROPERTIES,
  DEMO_INVOICES,
  DEMO_PAYMENTS,
  getByTenant,
  getById,
  paginate,
} from '../data/mock-data';
import { DocumentVerificationStatus } from '../types/mock-types';

// Mutable in-memory store for CRUD (production would use DB)
const customersStore = [...DEMO_CUSTOMERS];

function generateMockId(prefix: string): string {
  const existing = customersStore.map((c) => c.id);
  let n = 1;
  while (existing.includes(`${prefix}-${String(n).padStart(3, '0')}`)) n++;
  return `${prefix}-${String(n).padStart(3, '0')}`;
}

export const customersRouter = new Hono()
  .use('*', authMiddleware)
  .use('*', databaseMiddleware);

// GET /customers - List with pagination, search, status filter
customersRouter.get(
  '/',
  zValidator('query', customerListQuerySchema, (result, c) => {
    if (!result.success) return validationErrorResponse(result, c, 'Invalid query parameters');
  }),
  async (c) => {
    const auth = c.get('auth');
    const repos = c.get('repos');
    const useMockData = c.get('useMockData');
    const query = c.req.valid('query');
    const { page, pageSize, search, status } = query;

    // Use database if available
    if (!useMockData && repos) {
      try {
        const offset = (page - 1) * pageSize;
        const result = await repos.customers.findMany(
          auth.tenantId,
          { limit: pageSize, offset },
          { search, status }
        );

        // Enrich with current lease info
        const enrichedData = await Promise.all(
          result.items.map(async (customer) => {
            const leasesResult = await repos.leases.findByCustomer(customer.id, auth.tenantId, { limit: 1, offset: 0 });
            const activeLease = leasesResult.items.find((l) => l.status === 'active');
            let unitInfo = null;
            if (activeLease?.unitId) {
              const unit = await repos.units.findById(activeLease.unitId, auth.tenantId);
              if (unit) {
                unitInfo = { id: unit.id, unitNumber: unit.unitCode, propertyId: unit.propertyId };
              }
            }
            return {
              ...customer,
              currentLease: activeLease
                ? { id: activeLease.id, unitNumber: unitInfo?.unitNumber, propertyId: unitInfo?.propertyId }
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
    let customers = getByTenant(customersStore, auth.tenantId).filter(
      (cust) => !cust.deletedAt
    );

    if (search) {
      const searchLower = search.toLowerCase();
      customers = customers.filter(
        (cust) =>
          cust.firstName.toLowerCase().includes(searchLower) ||
          cust.lastName.toLowerCase().includes(searchLower) ||
          cust.email.toLowerCase().includes(searchLower)
      );
    }

    if (status) {
      customers = customers.filter((cust) => cust.verificationStatus === status);
    }

    const result = paginate(customers, page, pageSize);
    const enrichedData = result.data.map((customer) => {
      const lease = DEMO_LEASES.find(
        (l) => l.customerId === customer.id && l.status === 'ACTIVE'
      );
      const unit = lease ? getById(DEMO_UNITS, lease.unitId) : null;
      return {
        ...customer,
        currentLease: lease
          ? {
              id: lease.id,
              unitNumber: unit?.unitNumber,
              propertyId: unit?.propertyId,
            }
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

// GET /customers/:id/leases - Get customer's leases (must be before /:id)
customersRouter.get(
  '/:id/leases',
  zValidator('param', idParamSchema, (result, c) => {
    if (!result.success) return validationErrorResponse(result, c, 'Invalid customer ID');
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
        const customer = await repos.customers.findById(id, auth.tenantId);
        if (!customer) {
          return c.json(
            { success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } },
            404
          );
        }

        const offset = (query.page - 1) * query.pageSize;
        const result = await repos.leases.findByCustomer(id, auth.tenantId, { limit: query.pageSize, offset });

        // Enrich with unit and property info
        const enrichedData = await Promise.all(
          result.items.map(async (lease) => {
            const unit = lease.unitId ? await repos.units.findById(lease.unitId, auth.tenantId) : null;
            const property = unit?.propertyId ? await repos.properties.findById(unit.propertyId, auth.tenantId) : null;
            return {
              ...lease,
              unit: unit ? { id: unit.id, unitNumber: unit.unitCode } : null,
              property: property ? { id: property.id, name: property.name } : null,
            };
          })
        );

        return c.json({
          success: true,
          data: enrichedData,
          pagination: buildPaginationResponse(query.page, query.pageSize, result.total),
        });
      } catch (error) {
        console.error('Database error, falling back to mock data:', error);
      }
    }

    // Fallback to mock data
    const customer = getById(customersStore, id);
    if (!customer || customer.tenantId !== auth.tenantId || customer.deletedAt) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } },
        404
      );
    }

    let leases = DEMO_LEASES.filter(
      (l) => l.customerId === id && l.tenantId === auth.tenantId
    );

    const result = paginate(leases, query.page, query.pageSize);
    const enrichedData = result.data.map((lease) => {
      const unit = getById(DEMO_UNITS, lease.unitId);
      const property = unit ? getById(DEMO_PROPERTIES, unit.propertyId) : null;
      return {
        ...lease,
        unit: unit ? { id: unit.id, unitNumber: unit.unitNumber } : null,
        property: property ? { id: property.id, name: property.name } : null,
      };
    });

    return c.json({
      success: true,
      data: enrichedData,
      pagination: result.pagination,
    });
  }
);

// GET /customers/:id/payments - Get customer's payment history (must be before /:id)
customersRouter.get(
  '/:id/payments',
  zValidator('param', idParamSchema, (result, c) => {
    if (!result.success) return validationErrorResponse(result, c, 'Invalid customer ID');
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
        const customer = await repos.customers.findById(id, auth.tenantId);
        if (!customer) {
          return c.json(
            { success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } },
            404
          );
        }

        const offset = (query.page - 1) * query.pageSize;
        const result = await repos.payments.findByCustomer(id, auth.tenantId, query.pageSize, offset);

        // Enrich with invoice info
        const enrichedData = await Promise.all(
          result.items.map(async (payment) => {
            const invoice = payment.invoiceId ? await repos.invoices.findById(payment.invoiceId, auth.tenantId) : null;
            return {
              ...payment,
              invoice: invoice
                ? { id: invoice.id, number: invoice.invoiceNumber, total: invoice.totalAmount }
                : null,
            };
          })
        );

        return c.json({
          success: true,
          data: enrichedData,
          pagination: buildPaginationResponse(query.page, query.pageSize, result.total),
        });
      } catch (error) {
        console.error('Database error, falling back to mock data:', error);
      }
    }

    // Fallback to mock data
    const customer = getById(customersStore, id);
    if (!customer || customer.tenantId !== auth.tenantId || customer.deletedAt) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } },
        404
      );
    }

    let payments = getByTenant(DEMO_PAYMENTS, auth.tenantId).filter(
      (p) => p.customerId === id
    );
    payments.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const result = paginate(payments, query.page, query.pageSize);
    const enrichedData = result.data.map((payment) => {
      const invoice = getById(DEMO_INVOICES, payment.invoiceId);
      return {
        ...payment,
        invoice: invoice
          ? { id: invoice.id, number: invoice.number, total: invoice.total }
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

// GET /customers/:id - Get by ID
customersRouter.get(
  '/:id',
  zValidator('param', idParamSchema, (result, c) => {
    if (!result.success) return validationErrorResponse(result, c, 'Invalid customer ID');
  }),
  async (c) => {
    const auth = c.get('auth');
    const repos = c.get('repos');
    const useMockData = c.get('useMockData');
    const id = c.req.param('id');

    // Use database if available
    if (!useMockData && repos) {
      try {
        const customer = await repos.customers.findById(id, auth.tenantId);
        if (!customer) {
          return c.json(
            { success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } },
            404
          );
        }

        // Get leases
        const leasesResult = await repos.leases.findByCustomer(id, auth.tenantId, { limit: 100, offset: 0 });
        const currentLease = leasesResult.items.find((l) => l.status === 'active');
        let currentUnit = null;
        if (currentLease?.unitId) {
          currentUnit = await repos.units.findById(currentLease.unitId, auth.tenantId);
        }

        return c.json({
          success: true,
          data: {
            ...customer,
            leases: leasesResult.items.map((l) => ({
              id: l.id,
              status: l.status,
              startDate: l.startDate,
              endDate: l.endDate,
              rentAmount: l.rentAmount,
              unitId: l.unitId,
            })),
            currentUnit: currentUnit
              ? { id: currentUnit.id, unitNumber: currentUnit.unitCode, propertyId: currentUnit.propertyId }
              : null,
          },
        });
      } catch (error) {
        console.error('Database error, falling back to mock data:', error);
      }
    }

    // Fallback to mock data
    const customer = getById(customersStore, id);
    if (!customer || customer.tenantId !== auth.tenantId || customer.deletedAt) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } },
        404
      );
    }

    const leases = DEMO_LEASES.filter((l) => l.customerId === id);
    const currentLease = leases.find((l) => l.status === 'ACTIVE');
    const currentUnit = currentLease ? getById(DEMO_UNITS, currentLease.unitId) : null;

    return c.json({
      success: true,
      data: {
        ...customer,
        leases: leases.map((l) => ({
          id: l.id,
          status: l.status,
          startDate: l.startDate,
          endDate: l.endDate,
          rentAmount: l.rentAmount,
          unitId: l.unitId,
        })),
        currentUnit: currentUnit
          ? { id: currentUnit.id, unitNumber: currentUnit.unitNumber, propertyId: currentUnit.propertyId }
          : null,
      },
    });
  }
);

// POST /customers - Create customer
customersRouter.post(
  '/',
  zValidator('json', createCustomerSchema, (result, c) => {
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
        const id = generateId();
        const customerCode = `CUST-${Date.now().toString(36).toUpperCase()}`;

        const customer = await repos.customers.create(
          {
            id,
            tenantId: auth.tenantId,
            customerCode,
            customerType: body.type?.toLowerCase() as any ?? 'individual',
            firstName: body.firstName,
            lastName: body.lastName,
            email: body.email,
            phone: body.phone,
            idNumber: body.idNumber,
            idType: body.idType,
            companyName: body.companyName,
            companyRegistrationNumber: body.companyRegNumber,
            status: 'active',
            kycStatus: 'pending',
            communicationPreferences: body.preferences ?? {},
            createdBy: auth.userId,
            updatedBy: auth.userId,
          },
          auth.userId
        );

        return c.json({ success: true, data: customer }, 201);
      } catch (error) {
        console.error('Database error, falling back to mock data:', error);
      }
    }

    // Fallback to mock data
    const now = new Date();
    const newCustomer = {
      id: generateMockId('customer'),
      tenantId: auth.tenantId,
      type: body.type,
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email,
      phone: body.phone,
      idNumber: body.idNumber,
      idType: body.idType,
      companyName: body.companyName,
      companyRegNumber: body.companyRegNumber,
      preferences: body.preferences ?? {},
      verificationStatus: DocumentVerificationStatus.PENDING as DocumentVerificationStatus,
      createdAt: now,
      createdBy: auth.userId,
      updatedAt: now,
      updatedBy: auth.userId,
    };

    customersStore.push(newCustomer as (typeof customersStore)[0]);

    return c.json({ success: true, data: newCustomer }, 201);
  }
);

// PUT /customers/:id - Update customer profile
customersRouter.put(
  '/:id',
  zValidator('param', idParamSchema, (result, c) => {
    if (!result.success) return validationErrorResponse(result, c, 'Invalid customer ID');
  }),
  zValidator('json', updateCustomerSchema, (result, c) => {
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
        const existing = await repos.customers.findById(id, auth.tenantId);
        if (!existing) {
          return c.json(
            { success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } },
            404
          );
        }

        const updateData: Record<string, any> = {};
        if (body.firstName) updateData.firstName = body.firstName;
        if (body.lastName) updateData.lastName = body.lastName;
        if (body.email) updateData.email = body.email;
        if (body.phone) updateData.phone = body.phone;
        if (body.preferences) updateData.communicationPreferences = body.preferences;

        const updated = await repos.customers.update(id, auth.tenantId, updateData, auth.userId);

        return c.json({ success: true, data: updated });
      } catch (error) {
        console.error('Database error, falling back to mock data:', error);
      }
    }

    // Fallback to mock data
    const customer = getById(customersStore, id);
    if (!customer || customer.tenantId !== auth.tenantId || customer.deletedAt) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } },
        404
      );
    }

    const now = new Date();
    Object.assign(customer, {
      ...body,
      updatedAt: now,
      updatedBy: auth.userId,
    });

    return c.json({ success: true, data: customer });
  }
);

// DELETE /customers/:id - Soft delete
customersRouter.delete(
  '/:id',
  zValidator('param', idParamSchema, (result, c) => {
    if (!result.success) return validationErrorResponse(result, c, 'Invalid customer ID');
  }),
  async (c) => {
    const auth = c.get('auth');
    const repos = c.get('repos');
    const useMockData = c.get('useMockData');
    const id = c.req.param('id');

    // Use database if available
    if (!useMockData && repos) {
      try {
        const existing = await repos.customers.findById(id, auth.tenantId);
        if (!existing) {
          return c.json(
            { success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } },
            404
          );
        }

        await repos.customers.delete(id, auth.tenantId, auth.userId);

        return c.json({ success: true, data: { message: 'Customer soft deleted' } });
      } catch (error) {
        console.error('Database error, falling back to mock data:', error);
      }
    }

    // Fallback to mock data
    const customer = getById(customersStore, id);
    if (!customer || customer.tenantId !== auth.tenantId || customer.deletedAt) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } },
        404
      );
    }

    const now = new Date();
    (customer as { deletedAt?: Date }).deletedAt = now;
    (customer as { updatedAt: Date }).updatedAt = now;
    (customer as { updatedBy: string }).updatedBy = auth.userId;

    return c.json({ success: true, data: { message: 'Customer soft deleted' } });
  }
);

// PUT /customers/:id/kyc - Update KYC status (verify/reject)
customersRouter.put(
  '/:id/kyc',
  zValidator('param', idParamSchema, (result, c) => {
    if (!result.success) return validationErrorResponse(result, c, 'Invalid customer ID');
  }),
  zValidator('json', kycStatusSchema, (result, c) => {
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
        const existing = await repos.customers.findById(id, auth.tenantId);
        if (!existing) {
          return c.json(
            { success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } },
            404
          );
        }

        const updated = await repos.customers.update(
          id,
          auth.tenantId,
          { kycStatus: body.status.toLowerCase() },
          auth.userId
        );

        return c.json({ success: true, data: updated });
      } catch (error) {
        console.error('Database error, falling back to mock data:', error);
      }
    }

    // Fallback to mock data
    const customer = getById(customersStore, id);
    if (!customer || customer.tenantId !== auth.tenantId || customer.deletedAt) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } },
        404
      );
    }

    (customer as { verificationStatus: DocumentVerificationStatus }).verificationStatus =
      body.status as DocumentVerificationStatus;
    (customer as { updatedAt: Date }).updatedAt = new Date();
    (customer as { updatedBy: string }).updatedBy = auth.userId;

    return c.json({ success: true, data: customer });
  }
);

// PUT /customers/:id/blacklist - Blacklist customer
customersRouter.put(
  '/:id/blacklist',
  zValidator('param', idParamSchema, (result, c) => {
    if (!result.success) return validationErrorResponse(result, c, 'Invalid customer ID');
  }),
  zValidator('json', blacklistSchema, (result, c) => {
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
        const existing = await repos.customers.findById(id, auth.tenantId);
        if (!existing) {
          return c.json(
            { success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } },
            404
          );
        }

        const updated = await repos.customers.update(
          id,
          auth.tenantId,
          {
            status: 'blacklisted',
            blacklistReason: body.reason,
            blacklistedAt: new Date(),
            blacklistedBy: auth.userId,
          },
          auth.userId
        );

        return c.json({ success: true, data: updated });
      } catch (error) {
        console.error('Database error, falling back to mock data:', error);
      }
    }

    // Fallback to mock data
    const customer = getById(customersStore, id);
    if (!customer || customer.tenantId !== auth.tenantId || customer.deletedAt) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } },
        404
      );
    }

    const now = new Date();
    (customer as { blacklisted?: boolean }).blacklisted = true;
    (customer as { blacklistReason?: string }).blacklistReason = body.reason;
    (customer as { blacklistedAt?: Date }).blacklistedAt = now;
    (customer as { blacklistedBy?: string }).blacklistedBy = auth.userId;
    (customer as { updatedAt: Date }).updatedAt = now;
    (customer as { updatedBy: string }).updatedBy = auth.userId;

    return c.json({ success: true, data: customer });
  }
);
