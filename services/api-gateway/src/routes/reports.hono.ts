/**
 * Reports API routes - Hono with Zod validation
 * Database-first with mock data fallback
 * GET /rent-roll, /collection, /occupancy, /maintenance, /financial
 * GET /tenant-statement/:customerId
 * POST /export
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { authMiddleware } from '../middleware/hono-auth';
import { databaseMiddleware } from '../middleware/database';
import {
  paginationQuerySchema,
  validationErrorHook,
} from './validators';
import {
  DEMO_INVOICES,
  DEMO_PAYMENTS,
  DEMO_WORK_ORDERS,
  DEMO_UNITS,
  DEMO_PROPERTIES,
  DEMO_LEASES,
  DEMO_CUSTOMERS,
  getByTenant,
} from '../data/mock-data';
import { z } from 'zod';

const app = new Hono();

const reportsQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  propertyId: z.string().optional(),
});

const exportReportSchema = z.object({
  reportType: z.enum(['rent-roll', 'collection', 'occupancy', 'maintenance', 'financial', 'tenant-statement']),
  format: z.enum(['csv', 'pdf']).default('csv'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  customerId: z.string().optional(),
});

const customerIdParamSchema = z.object({
  customerId: z.string().min(1, 'Customer ID is required'),
});

app.use('*', authMiddleware);
app.use('*', databaseMiddleware);

function errorResponse(
  c: { json: (body: unknown, status?: number) => Response },
  status: 404,
  code: string,
  message: string
) {
  return c.json({ success: false, error: { code, message } }, status);
}

// GET /reports/rent-roll
app.get('/rent-roll', zValidator('query', reportsQuerySchema), async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const useMockData = c.get('useMockData');

  if (!useMockData && repos) {
    try {
      const unitsResult = await repos.units.findMany(auth.tenantId, { limit: 1000, offset: 0 });
      const leasesResult = await repos.leases.findMany(auth.tenantId, { limit: 1000, offset: 0 }, { status: 'active' });

      const rentRoll = await Promise.all(
        unitsResult.items.map(async (unit) => {
          const lease = leasesResult.items.find((l) => l.unitId === unit.id);
          let customerName: string | null = null;
          if (lease?.customerId) {
            const customer = await repos.customers.findById(lease.customerId, auth.tenantId);
            if (customer) customerName = `${customer.firstName} ${customer.lastName}`;
          }
          let totalBilled = 0;
          let totalCollected = 0;
          if (lease) {
            const invoicesResult = await repos.invoices.findByLease(lease.id, auth.tenantId, 1000, 0);
            totalBilled = invoicesResult.items.reduce((s, i) => s + (i.totalAmount ?? 0), 0);
            totalCollected = invoicesResult.items.reduce((s, i) => s + (i.paidAmount ?? 0), 0);
          }
          return {
            unitId: unit.id,
            unitNumber: unit.unitCode,
            rentAmount: unit.baseRentAmount ?? 0,
            tenant: customerName,
            status: lease ? 'occupied' : 'vacant',
            totalBilled,
            totalCollected,
            balance: totalBilled - totalCollected,
          };
        })
      );

      return c.json({ success: true, data: rentRoll });
    } catch (error) {
      console.error('Database error, falling back to mock data:', error);
    }
  }

  // Fallback to mock data
  const units = getByTenant(DEMO_UNITS, auth.tenantId);
  const leases = getByTenant(DEMO_LEASES, auth.tenantId);
  const invoices = getByTenant(DEMO_INVOICES, auth.tenantId);
  const customers = getByTenant(DEMO_CUSTOMERS, auth.tenantId);

  const rentRoll = units.map((unit) => {
    const lease = leases.find((l) => l.unitId === unit.id && l.status === 'ACTIVE');
    const customer = lease ? customers.find((cust) => cust.id === lease.customerId) : null;
    const unitInvoices = invoices.filter((i) => i.leaseId === lease?.id);
    const totalBilled = unitInvoices.reduce((s, i) => s + i.total, 0);
    const totalCollected = unitInvoices.reduce((s, i) => s + (i.amountPaid ?? 0), 0);

    return {
      unitId: unit.id,
      unitNumber: unit.unitNumber,
      rentAmount: unit.rentAmount,
      tenant: customer ? `${customer.firstName} ${customer.lastName}` : null,
      status: lease ? 'occupied' : 'vacant',
      totalBilled,
      totalCollected,
      balance: totalBilled - totalCollected,
    };
  });

  return c.json({
    success: true,
    data: rentRoll,
  });
});

// GET /reports/collection
app.get('/collection', zValidator('query', reportsQuerySchema), async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const useMockData = c.get('useMockData');

  if (!useMockData && repos) {
    try {
      const paymentsResult = await repos.payments.findMany(auth.tenantId, 1000, 0);
      const invoicesResult = await repos.invoices.findMany(auth.tenantId, 1000, 0);

      const completedPayments = paymentsResult.items.filter((p) => p.status === 'completed');
      const totalCollected = completedPayments.reduce((s, p) => s + (p.amount ?? 0), 0);
      const totalInvoiced = invoicesResult.items.reduce((s, i) => s + (i.totalAmount ?? 0), 0);
      const totalOutstanding = invoicesResult.items.reduce((s, i) => s + (i.balanceDue ?? 0), 0);

      return c.json({
        success: true,
        data: {
          totalInvoiced,
          totalCollected,
          totalOutstanding,
          collectionRate: totalInvoiced > 0 ? (totalCollected / totalInvoiced) * 100 : 0,
          payments: completedPayments.slice(0, 20),
        },
      });
    } catch (error) {
      console.error('Database error, falling back to mock data:', error);
    }
  }

  // Fallback to mock data
  const payments = getByTenant(DEMO_PAYMENTS, auth.tenantId);
  const invoices = getByTenant(DEMO_INVOICES, auth.tenantId);

  const totalCollected = payments
    .filter((p) => p.status === 'COMPLETED')
    .reduce((s, p) => s + p.amount, 0);
  const totalInvoiced = invoices.reduce((s, i) => s + i.total, 0);
  const totalOutstanding = invoices.reduce((s, i) => s + i.amountDue, 0);

  return c.json({
    success: true,
    data: {
      totalInvoiced,
      totalCollected,
      totalOutstanding,
      collectionRate: totalInvoiced > 0 ? (totalCollected / totalInvoiced) * 100 : 0,
      payments: payments.filter((p) => p.status === 'COMPLETED').slice(0, 20),
    },
  });
});

// GET /reports/occupancy
app.get('/occupancy', zValidator('query', reportsQuerySchema), async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const useMockData = c.get('useMockData');

  if (!useMockData && repos) {
    try {
      const unitsResult = await repos.units.findMany(auth.tenantId, { limit: 1000, offset: 0 });
      const propertiesResult = await repos.properties.findMany(auth.tenantId, { limit: 1000, offset: 0 });
      const leasesResult = await repos.leases.findMany(auth.tenantId, { limit: 1000, offset: 0 }, { status: 'active' });

      const allUnits = unitsResult.items;
      const totalUnits = allUnits.length;
      const occupiedUnits = allUnits.filter((u) => u.status === 'occupied').length;

      const byProperty = propertiesResult.items.map((p) => {
        const propertyUnits = allUnits.filter((u) => u.propertyId === p.id);
        const occupied = propertyUnits.filter((u) => u.status === 'occupied').length;
        return {
          id: p.id,
          name: p.name,
          totalUnits: propertyUnits.length,
          occupiedUnits: occupied,
          occupancyRate: propertyUnits.length > 0 ? (occupied / propertyUnits.length) * 100 : 0,
        };
      });

      return c.json({
        success: true,
        data: {
          summary: {
            totalUnits,
            occupiedUnits,
            occupancyRate: totalUnits > 0 ? (occupiedUnits / totalUnits) * 100 : 0,
          },
          byProperty,
          expiringLeases: leasesResult.total,
        },
      });
    } catch (error) {
      console.error('Database error, falling back to mock data:', error);
    }
  }

  // Fallback to mock data
  const units = getByTenant(DEMO_UNITS, auth.tenantId);
  const properties = getByTenant(DEMO_PROPERTIES, auth.tenantId);
  const leases = getByTenant(DEMO_LEASES, auth.tenantId);

  const totalUnits = units.length;
  const occupiedUnits = units.filter((u) => u.status === 'OCCUPIED').length;
  const byProperty = properties.map((p) => {
    const propertyUnits = units.filter((u) => u.propertyId === p.id);
    const occupied = propertyUnits.filter((u) => u.status === 'OCCUPIED').length;
    return {
      id: p.id,
      name: p.name,
      totalUnits: propertyUnits.length,
      occupiedUnits: occupied,
      occupancyRate: propertyUnits.length > 0 ? (occupied / propertyUnits.length) * 100 : 0,
    };
  });

  return c.json({
    success: true,
    data: {
      summary: {
        totalUnits,
        occupiedUnits,
        occupancyRate: totalUnits > 0 ? (occupiedUnits / totalUnits) * 100 : 0,
      },
      byProperty,
      expiringLeases: leases.filter((l) => l.status === 'ACTIVE').length,
    },
  });
});

// GET /reports/maintenance
app.get('/maintenance', zValidator('query', reportsQuerySchema), async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const useMockData = c.get('useMockData');

  if (!useMockData && repos) {
    try {
      const result = await repos.workOrders.findMany(auth.tenantId, 1000, 0);
      const items = result.items as any[];
      const total = items.length;
      const completed = items.filter((wo) => wo.status === 'completed').length;
      const open = items.filter((wo) => !['completed', 'cancelled'].includes(wo.status)).length;
      const totalCost = items.reduce((s, wo) => s + (wo.actualCost ?? 0), 0);

      const statusCounts = await repos.workOrders.countByStatus(auth.tenantId);

      return c.json({
        success: true,
        data: {
          summary: {
            total,
            completed,
            open,
            completionRate: total > 0 ? (completed / total) * 100 : 0,
            totalCost,
          },
          byCategory: {},
          byPriority: {},
          byStatus: statusCounts,
        },
      });
    } catch (error) {
      console.error('Database error, falling back to mock data:', error);
    }
  }

  // Fallback to mock data
  const workOrders = getByTenant(DEMO_WORK_ORDERS, auth.tenantId);

  const total = workOrders.length;
  const completed = workOrders.filter((wo) => wo.status === 'COMPLETED').length;
  const open = workOrders.filter((wo) => !['COMPLETED', 'CANCELLED'].includes(wo.status)).length;
  const totalCost = workOrders.reduce((s, wo) => s + (wo.actualCost ?? 0), 0);

  return c.json({
    success: true,
    data: {
      summary: {
        total,
        completed,
        open,
        completionRate: total > 0 ? (completed / total) * 100 : 0,
        totalCost,
      },
      byCategory: {},
      byPriority: {},
    },
  });
});

// GET /reports/financial
app.get('/financial', zValidator('query', reportsQuerySchema), async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const useMockData = c.get('useMockData');

  if (!useMockData && repos) {
    try {
      const invoicesResult = await repos.invoices.findMany(auth.tenantId, 1000, 0);
      const paymentsResult = await repos.payments.findMany(auth.tenantId, 1000, 0);

      const totalInvoiced = invoicesResult.items.reduce((s, i) => s + (i.totalAmount ?? 0), 0);
      const totalCollected = paymentsResult.items
        .filter((p) => p.status === 'completed')
        .reduce((s, p) => s + (p.amount ?? 0), 0);
      const totalOutstanding = invoicesResult.items.reduce((s, i) => s + (i.balanceDue ?? 0), 0);

      return c.json({
        success: true,
        data: {
          summary: {
            totalInvoiced,
            totalCollected,
            totalOutstanding,
            collectionRate: totalInvoiced > 0 ? (totalCollected / totalInvoiced) * 100 : 0,
          },
          monthlyTrend: [],
          arrearsAging: { current: 0, overdue: totalOutstanding },
        },
      });
    } catch (error) {
      console.error('Database error, falling back to mock data:', error);
    }
  }

  // Fallback to mock data
  const invoices = getByTenant(DEMO_INVOICES, auth.tenantId);
  const payments = getByTenant(DEMO_PAYMENTS, auth.tenantId);

  const totalInvoiced = invoices.reduce((s, i) => s + i.total, 0);
  const totalCollected = payments
    .filter((p) => p.status === 'COMPLETED')
    .reduce((s, p) => s + p.amount, 0);
  const totalOutstanding = invoices.reduce((s, i) => s + i.amountDue, 0);

  return c.json({
    success: true,
    data: {
      summary: {
        totalInvoiced,
        totalCollected,
        totalOutstanding,
        collectionRate: totalInvoiced > 0 ? (totalCollected / totalInvoiced) * 100 : 0,
      },
      monthlyTrend: [],
      arrearsAging: { current: 0, overdue: totalOutstanding },
    },
  });
});

// GET /reports/tenant-statement/:customerId - Must be before /:id patterns
app.get(
  '/tenant-statement/:customerId',
  zValidator('param', customerIdParamSchema),
  zValidator('query', reportsQuerySchema),
  async (c) => {
    const auth = c.get('auth');
    const { customerId } = c.req.valid('param');
    const repos = c.get('repos');
    const useMockData = c.get('useMockData');

    if (!useMockData && repos) {
      try {
        const customer = await repos.customers.findById(customerId, auth.tenantId);
        if (!customer) {
          return errorResponse(c, 404, 'NOT_FOUND', 'Customer not found');
        }

        const invoicesResult = await repos.invoices.findByCustomer(customerId, auth.tenantId, 1000, 0);
        const paymentsResult = await repos.payments.findByCustomer(customerId, auth.tenantId, 1000, 0);

        const balance = invoicesResult.items.reduce((s, i) => s + (i.balanceDue ?? 0), 0);

        const statement = {
          customerId,
          customerName: `${customer.firstName} ${customer.lastName}`,
          invoices: invoicesResult.items,
          payments: paymentsResult.items,
          balance,
          asOf: new Date().toISOString(),
        };

        return c.json({ success: true, data: statement });
      } catch (error) {
        console.error('Database error, falling back to mock data:', error);
      }
    }

    // Fallback to mock data
    const customers = getByTenant(DEMO_CUSTOMERS, auth.tenantId);
    const customer = customers.find((cust) => cust.id === customerId);
    if (!customer) {
      return errorResponse(c, 404, 'NOT_FOUND', 'Customer not found');
    }

    const invoices = getByTenant(DEMO_INVOICES, auth.tenantId).filter((i) => i.customerId === customerId);
    const payments = getByTenant(DEMO_PAYMENTS, auth.tenantId).filter((p) => p.customerId === customerId);

    const statement = {
      customerId,
      customerName: `${customer.firstName} ${customer.lastName}`,
      invoices,
      payments,
      balance: invoices.reduce((s, i) => s + i.amountDue, 0),
      asOf: new Date().toISOString(),
    };

    return c.json({ success: true, data: statement });
  }
);

// POST /reports/export
app.post('/export', zValidator('json', exportReportSchema, validationErrorHook), (c) => {
  const body = c.req.valid('json');

  const downloadUrl = `/api/v1/reports/download/${body.reportType}-${Date.now()}.${body.format}`;
  return c.json({
    success: true,
    data: {
      reportType: body.reportType,
      format: body.format,
      downloadUrl,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    },
  }, 201);
});

export const reportsHonoRouter = app;
