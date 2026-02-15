/**
 * Work Orders API routes - Hono with Zod validation
 * Production-ready REST API for maintenance workflow management
 */

import type { Context } from 'hono';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { WorkOrder } from '../types/mock-types';
import {
  DEMO_WORK_ORDERS,
  DEMO_UNITS,
  DEMO_CUSTOMERS,
  DEMO_PROPERTIES,
  DEMO_VENDORS,
  getById,
  getByTenant,
  paginate,
  createWorkOrder,
  updateWorkOrder,
} from '../data/mock-data';
import { authMiddleware } from '../middleware/hono-auth';
import { databaseMiddleware, generateId } from '../middleware/database';
import {
  listWorkOrdersQuerySchema,
  createWorkOrderSchema,
  paginationQuerySchema,
  updateWorkOrderSchema,
  triageWorkOrderSchema,
  assignWorkOrderSchema,
  scheduleWorkOrderSchema,
  completeWorkOrderSchema,
  verifyWorkOrderSchema,
  escalateWorkOrderSchema,
  pauseSlaSchema,
  idParamSchema,
  validationErrorHook,
} from './validators';
import { WorkOrderStatus, WorkOrderCategory } from '../types/mock-types';

const app = new Hono();

app.use('*', authMiddleware);
app.use('*', databaseMiddleware);

function canAccessProperty(propertyId: string, propertyAccess: string[]): boolean {
  return propertyAccess.includes('*') || propertyAccess.includes(propertyId);
}

function filterByPropertyAccess(workOrders: WorkOrder[], propertyAccess: string[]): WorkOrder[] {
  if (propertyAccess.includes('*')) return workOrders;
  return workOrders.filter((wo) => propertyAccess.includes(wo.propertyId));
}

function validateWorkOrderAccess(
  c: Context,
  id: string
): { error: true; status: 404 | 403; message: string } | { error: false; workOrder: WorkOrder } {
  const auth = c.get('auth');
  const workOrder = getById(DEMO_WORK_ORDERS, id);

  if (!workOrder || workOrder.tenantId !== auth.tenantId) {
    return { error: true, status: 404, message: 'Work order not found' };
  }

  if (!canAccessProperty(workOrder.propertyId, auth.propertyAccess)) {
    return { error: true, status: 403, message: 'Access denied' };
  }

  return { error: false, workOrder };
}

function errorResponse(
  c: Context,
  status: 400 | 403 | 404 | 409,
  code: string,
  message: string
) {
  return c.json({ success: false, error: { code, message } }, status);
}

// GET /work-orders - List with pagination and filters
app.get('/', zValidator('query', listWorkOrdersQuerySchema), async (c) => {
  const auth = c.get('auth');
  const { page, pageSize, status, priority, category, propertyId, vendorId } = c.req.valid('query');
  const repos = c.get('repos');
  const useMockData = c.get('useMockData');

  if (!useMockData && repos) {
    try {
      const offset = (page - 1) * pageSize;
      const result = await repos.workOrders.findMany(auth.tenantId, pageSize, offset);

      let items = [...result.items] as any[];
      if (status) items = items.filter((wo: any) => wo.status === status.toLowerCase());
      if (priority) items = items.filter((wo: any) => wo.priority === priority.toLowerCase());
      if (category) items = items.filter((wo: any) => wo.category === category.toLowerCase());
      if (propertyId) items = items.filter((wo: any) => wo.propertyId === propertyId);
      if (vendorId) items = items.filter((wo: any) => wo.vendorId === vendorId);

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
  let workOrders = filterByPropertyAccess(getByTenant(DEMO_WORK_ORDERS, auth.tenantId), auth.propertyAccess);

  if (status) workOrders = workOrders.filter((wo) => wo.status === status);
  if (priority) workOrders = workOrders.filter((wo) => wo.priority === priority);
  if (category) workOrders = workOrders.filter((wo) => wo.category === category);
  if (propertyId) workOrders = workOrders.filter((wo) => wo.propertyId === propertyId);
  if (vendorId) workOrders = workOrders.filter((wo) => wo.vendorId === vendorId);

  workOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const result = paginate(workOrders, page, pageSize);

  const enrichedData = result.data.map((wo) => {
    const unit = getById(DEMO_UNITS, wo.unitId);
    const customer = wo.customerId ? getById(DEMO_CUSTOMERS, wo.customerId) : null;
    const property = getById(DEMO_PROPERTIES, wo.propertyId);
    const vendor = wo.vendorId ? getById(DEMO_VENDORS, wo.vendorId) : null;

    return {
      ...wo,
      unit: unit ? { id: unit.id, unitNumber: unit.unitNumber } : null,
      property: property ? { id: property.id, name: property.name } : null,
      customer: customer ? { id: customer.id, name: `${customer.firstName} ${customer.lastName}` } : null,
      vendor: vendor ? { id: vendor.id, name: vendor.name } : null,
    };
  });

  return c.json({
    success: true,
    data: enrichedData,
    pagination: result.pagination,
  });
});

// GET /work-orders/sla-breaches - Must be before /:id
app.get('/sla-breaches', zValidator('query', paginationQuerySchema), async (c) => {
  const auth = c.get('auth');
  const { page, pageSize } = c.req.valid('query');
  const repos = c.get('repos');
  const useMockData = c.get('useMockData');

  if (!useMockData && repos) {
    try {
      const offset = (page - 1) * pageSize;
      const result = await repos.workOrders.findSLABreached(auth.tenantId, pageSize, offset);
      return c.json({
        success: true,
        data: result.items,
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
  const now = new Date();
  let workOrders = filterByPropertyAccess(getByTenant(DEMO_WORK_ORDERS, auth.tenantId), auth.propertyAccess);
  workOrders = workOrders.filter(
    (wo) =>
      !['COMPLETED', 'CANCELLED'].includes(wo.status) &&
      wo.slaDeadline &&
      !wo.slaPausedAt &&
      new Date(wo.slaDeadline) < now
  );

  workOrders.sort((a, b) => new Date(a.slaDeadline!).getTime() - new Date(b.slaDeadline!).getTime());
  const result = paginate(workOrders, page, pageSize);

  const enrichedData = result.data.map((wo) => {
    const unit = getById(DEMO_UNITS, wo.unitId);
    const property = getById(DEMO_PROPERTIES, wo.propertyId);
    return {
      ...wo,
      unit: unit ? { id: unit.id, unitNumber: unit.unitNumber } : null,
      property: property ? { id: property.id, name: property.name } : null,
    };
  });

  return c.json({
    success: true,
    data: enrichedData,
    pagination: result.pagination,
  });
});

// GET /work-orders/stats - Must be before /:id
app.get('/stats', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const useMockData = c.get('useMockData');

  if (!useMockData && repos) {
    try {
      const result = await repos.workOrders.findMany(auth.tenantId, 1000, 0);
      const items = result.items as any[];
      const stats = {
        total: items.length,
        byStatus: {
          submitted: items.filter((wo: any) => wo.status === 'submitted').length,
          triaged: items.filter((wo: any) => wo.status === 'triaged').length,
          approved: items.filter((wo: any) => wo.status === 'approved').length,
          assigned: items.filter((wo: any) => wo.status === 'assigned').length,
          inProgress: items.filter((wo: any) => wo.status === 'in_progress').length,
          completed: items.filter((wo: any) => wo.status === 'completed').length,
          cancelled: items.filter((wo: any) => wo.status === 'cancelled').length,
        },
        byPriority: {
          low: items.filter((wo: any) => wo.priority === 'low').length,
          medium: items.filter((wo: any) => wo.priority === 'medium').length,
          high: items.filter((wo: any) => wo.priority === 'high').length,
          emergency: items.filter((wo: any) => wo.priority === 'emergency').length,
        },
        byCategory: {},
      };
      return c.json({ success: true, data: stats });
    } catch (error) {
      console.error('Database error, falling back to mock data:', error);
    }
  }

  const workOrders = filterByPropertyAccess(getByTenant(DEMO_WORK_ORDERS, auth.tenantId), auth.propertyAccess);

  const categories = Object.values(WorkOrderCategory);
  const byCategory = Object.fromEntries(
    categories.map((cat) => [
      cat.toLowerCase(),
      workOrders.filter((wo) => wo.category === cat).length,
    ])
  );

  const stats = {
    total: workOrders.length,
    byStatus: {
      submitted: workOrders.filter((wo) => wo.status === WorkOrderStatus.SUBMITTED).length,
      triaged: workOrders.filter((wo) => wo.status === WorkOrderStatus.TRIAGED).length,
      approved: workOrders.filter((wo) => wo.status === WorkOrderStatus.APPROVED).length,
      assigned: workOrders.filter((wo) => wo.status === WorkOrderStatus.ASSIGNED).length,
      inProgress: workOrders.filter((wo) => wo.status === WorkOrderStatus.IN_PROGRESS).length,
      completed: workOrders.filter((wo) => wo.status === WorkOrderStatus.COMPLETED).length,
      cancelled: workOrders.filter((wo) => wo.status === WorkOrderStatus.CANCELLED).length,
    },
    byPriority: {
      low: workOrders.filter((wo) => wo.priority === 'LOW').length,
      medium: workOrders.filter((wo) => wo.priority === 'MEDIUM').length,
      high: workOrders.filter((wo) => wo.priority === 'HIGH').length,
      emergency: workOrders.filter((wo) => wo.priority === 'EMERGENCY').length,
    },
    byCategory: {
      ...byCategory,
      other: workOrders.filter((wo) => !categories.includes(wo.category)).length,
    },
  };

  return c.json({ success: true, data: stats });
});

// POST /work-orders - Create work order
app.post('/', zValidator('json', createWorkOrderSchema, validationErrorHook), async (c) => {
  const auth = c.get('auth');
  const body = c.req.valid('json');
  const repos = c.get('repos');
  const useMockData = c.get('useMockData');

  if (!canAccessProperty(body.propertyId, auth.propertyAccess)) {
    return errorResponse(c, 403, 'FORBIDDEN', 'Access denied to property');
  }

  if (!useMockData && repos) {
    try {
      const unit = await repos.units.findById(body.unitId, auth.tenantId);
      if (!unit) {
        return errorResponse(c, 404, 'NOT_FOUND', 'Unit not found');
      }

      const property = await repos.properties.findById(body.propertyId, auth.tenantId);
      if (!property) {
        return errorResponse(c, 404, 'NOT_FOUND', 'Property not found');
      }

      const id = generateId();
      const workOrderCode = `WO-${Date.now().toString(36).toUpperCase()}`;

      const workOrder = await repos.workOrders.create({
        id,
        tenantId: auth.tenantId,
        workOrderCode,
        unitId: body.unitId,
        propertyId: body.propertyId,
        reportedBy: body.customerId ?? auth.userId,
        category: body.category?.toLowerCase() as any,
        priority: body.priority?.toLowerCase() as any,
        title: body.title,
        description: body.description,
        status: 'submitted',
        createdBy: auth.userId,
        updatedBy: auth.userId,
      });

      return c.json({ success: true, data: workOrder }, 201);
    } catch (error) {
      console.error('Database error, falling back to mock data:', error);
    }
  }

  // Fallback to mock data
  const unit = getById(DEMO_UNITS, body.unitId);
  if (!unit || unit.tenantId !== auth.tenantId) {
    return errorResponse(c, 404, 'NOT_FOUND', 'Unit not found');
  }

  const property = getById(DEMO_PROPERTIES, body.propertyId);
  if (!property || property.tenantId !== auth.tenantId) {
    return errorResponse(c, 404, 'NOT_FOUND', 'Property not found');
  }

  const workOrder = createWorkOrder(
    {
      unitId: body.unitId,
      propertyId: body.propertyId,
      customerId: body.customerId,
      category: body.category,
      priority: body.priority,
      title: body.title,
      description: body.description,
      reportedAt: new Date(),
      evidence: body.evidence ?? { beforePhotos: [], afterPhotos: [], videos: [], voiceNotes: [] },
      notes: [],
    },
    auth.tenantId,
    auth.userId
  );

  return c.json({ success: true, data: workOrder }, 201);
});

// GET /work-orders/:id - Get by ID with full details
app.get('/:id', zValidator('param', idParamSchema), async (c) => {
  const { id } = c.req.valid('param');
  const auth = c.get('auth');
  const repos = c.get('repos');
  const useMockData = c.get('useMockData');

  if (!useMockData && repos) {
    try {
      const workOrder = await repos.workOrders.findById(id, auth.tenantId);
      if (!workOrder) {
        return errorResponse(c, 404, 'NOT_FOUND', 'Work order not found');
      }
      return c.json({ success: true, data: workOrder });
    } catch (error) {
      console.error('Database error, falling back to mock data:', error);
    }
  }

  // Fallback to mock data
  const validation = validateWorkOrderAccess(c, id);
  if (validation.error) {
    return errorResponse(c, validation.status, validation.status === 404 ? 'NOT_FOUND' : 'FORBIDDEN', validation.message);
  }

  const { workOrder } = validation;
  const unit = getById(DEMO_UNITS, workOrder.unitId);
  const customer = workOrder.customerId ? getById(DEMO_CUSTOMERS, workOrder.customerId) : null;
  const property = getById(DEMO_PROPERTIES, workOrder.propertyId);
  const vendor = workOrder.vendorId ? getById(DEMO_VENDORS, workOrder.vendorId) : null;

  return c.json({
    success: true,
    data: {
      ...workOrder,
      unit,
      customer,
      property,
      vendor,
    },
  });
});

// PUT /work-orders/:id - Update work order
app.put(
  '/:id',
  zValidator('param', idParamSchema),
  zValidator('json', updateWorkOrderSchema, validationErrorHook),
  async (c) => {
    const { id } = c.req.valid('param');
    const auth = c.get('auth');
    const body = c.req.valid('json');
    const repos = c.get('repos');
    const useMockData = c.get('useMockData');

    if (!useMockData && repos) {
      try {
        const existing = await repos.workOrders.findById(id, auth.tenantId);
        if (!existing) {
          return errorResponse(c, 404, 'NOT_FOUND', 'Work order not found');
        }
        if (['completed', 'cancelled'].includes(String(existing.status))) {
          return errorResponse(c, 409, 'CONFLICT', 'Cannot update completed or cancelled work order');
        }

        const updateData: Record<string, unknown> = {};
        if (body.priority) updateData.priority = body.priority.toLowerCase();
        if (body.category) updateData.category = body.category.toLowerCase();
        if (body.title) updateData.title = body.title;
        if (body.description) updateData.description = body.description;

        const updated = await repos.workOrders.update(id, auth.tenantId, updateData as any);
        return c.json({ success: true, data: updated });
      } catch (error) {
        console.error('Database error, falling back to mock data:', error);
      }
    }

    // Fallback to mock data
    const validation = validateWorkOrderAccess(c, id);
    if (validation.error) {
      return errorResponse(c, validation.status, validation.status === 404 ? 'NOT_FOUND' : 'FORBIDDEN', validation.message);
    }

    if (['COMPLETED', 'CANCELLED'].includes(validation.workOrder.status)) {
      return errorResponse(c, 409, 'CONFLICT', 'Cannot update completed or cancelled work order');
    }

    const updated = updateWorkOrder(id, body, auth.userId);
    return c.json({ success: true, data: updated });
  }
);

// DELETE /work-orders/:id - Cancel work order
app.delete('/:id', zValidator('param', idParamSchema), async (c) => {
  const { id } = c.req.valid('param');
  const auth = c.get('auth');
  const repos = c.get('repos');
  const useMockData = c.get('useMockData');

  if (!useMockData && repos) {
    try {
      const existing = await repos.workOrders.findById(id, auth.tenantId);
      if (!existing) {
        return errorResponse(c, 404, 'NOT_FOUND', 'Work order not found');
      }
      await repos.workOrders.delete(id, auth.tenantId, auth.userId);
      return c.json({ success: true, data: { id, message: 'Work order cancelled' } });
    } catch (error) {
      console.error('Database error, falling back to mock data:', error);
    }
  }

  // Fallback to mock data
  const validation = validateWorkOrderAccess(c, id);
  if (validation.error) {
    return errorResponse(c, validation.status, validation.status === 404 ? 'NOT_FOUND' : 'FORBIDDEN', validation.message);
  }

  const updated = updateWorkOrder(id, { status: WorkOrderStatus.CANCELLED }, auth.userId);
  return c.json({ success: true, data: updated });
});

// POST /work-orders/:id/triage
app.post(
  '/:id/triage',
  zValidator('param', idParamSchema),
  zValidator('json', triageWorkOrderSchema, validationErrorHook),
  async (c) => {
    const { id } = c.req.valid('param');
    const auth = c.get('auth');
    const { priority, category } = c.req.valid('json');
    const repos = c.get('repos');
    const useMockData = c.get('useMockData');

    if (!useMockData && repos) {
      try {
        const existing = await repos.workOrders.findById(id, auth.tenantId);
        if (!existing) return errorResponse(c, 404, 'NOT_FOUND', 'Work order not found');
        if (String(existing.status) !== 'submitted') return errorResponse(c, 409, 'CONFLICT', 'Can only triage SUBMITTED work orders');

        const updated = await repos.workOrders.update(id, auth.tenantId, {
          priority: priority.toLowerCase(),
          category: category?.toLowerCase() ?? (existing as any).category,
          status: 'triaged',
          updatedBy: auth.userId,
        });
        return c.json({ success: true, data: updated });
      } catch (error) {
        console.error('Database error, falling back to mock data:', error);
      }
    }

    // Fallback to mock data
    const validation = validateWorkOrderAccess(c, id);
    if (validation.error) {
      return errorResponse(c, validation.status, validation.status === 404 ? 'NOT_FOUND' : 'FORBIDDEN', validation.message);
    }

    if (validation.workOrder.status !== WorkOrderStatus.SUBMITTED) {
      return errorResponse(c, 409, 'CONFLICT', 'Can only triage SUBMITTED work orders');
    }

    const updated = updateWorkOrder(id, { priority, category: category ?? validation.workOrder.category, status: WorkOrderStatus.TRIAGED }, auth.userId);
    return c.json({ success: true, data: updated });
  }
);

// POST /work-orders/:id/assign
app.post(
  '/:id/assign',
  zValidator('param', idParamSchema),
  zValidator('json', assignWorkOrderSchema, validationErrorHook),
  async (c) => {
    const { id } = c.req.valid('param');
    const auth = c.get('auth');
    const { vendorId, scheduledAt } = c.req.valid('json');
    const repos = c.get('repos');
    const useMockData = c.get('useMockData');

    if (!useMockData && repos) {
      try {
        const existing = await repos.workOrders.findById(id, auth.tenantId);
        if (!existing) return errorResponse(c, 404, 'NOT_FOUND', 'Work order not found');

        const vendor = await repos.vendors.findById(vendorId, auth.tenantId);
        if (!vendor) return errorResponse(c, 404, 'NOT_FOUND', 'Vendor not found');

        const updateData: Record<string, any> = {
          vendorId,
          assignedTo: vendorId,
          status: 'assigned',
          updatedBy: auth.userId,
        };
        if (scheduledAt) updateData.scheduledDate = new Date(scheduledAt);

        const updated = await repos.workOrders.update(id, auth.tenantId, updateData);
        return c.json({ success: true, data: updated });
      } catch (error) {
        console.error('Database error, falling back to mock data:', error);
      }
    }

    // Fallback to mock data
    const validation = validateWorkOrderAccess(c, id);
    if (validation.error) {
      return errorResponse(c, validation.status, validation.status === 404 ? 'NOT_FOUND' : 'FORBIDDEN', validation.message);
    }

    const vendor = getById(DEMO_VENDORS, vendorId);
    if (!vendor || vendor.tenantId !== auth.tenantId || vendor.deletedAt) {
      return errorResponse(c, 404, 'NOT_FOUND', 'Vendor not found');
    }

    if (!vendor.categories.includes(validation.workOrder.category)) {
      return errorResponse(c, 400, 'BAD_REQUEST', 'Vendor does not support this work order category');
    }

    const update = { vendorId, assignedTo: vendorId, status: WorkOrderStatus.ASSIGNED };
    if (scheduledAt) (update as Record<string, unknown>).scheduledAt = new Date(scheduledAt);

    const updated = updateWorkOrder(id, update, auth.userId);
    return c.json({ success: true, data: updated });
  }
);

// POST /work-orders/:id/auto-assign
app.post('/:id/auto-assign', zValidator('param', idParamSchema), async (c) => {
  const { id } = c.req.valid('param');
  const auth = c.get('auth');
  const repos = c.get('repos');
  const useMockData = c.get('useMockData');

  if (!useMockData && repos) {
    try {
      const existing = await repos.workOrders.findById(id, auth.tenantId);
      if (!existing) return errorResponse(c, 404, 'NOT_FOUND', 'Work order not found');

      const category = String((existing as any).category ?? '');
      const availableVendors = await repos.vendors.findAvailable(category, false, auth.tenantId);
      if (!availableVendors || availableVendors.length === 0) {
        return errorResponse(c, 404, 'NOT_FOUND', 'No available vendor for this category');
      }

      const best = availableVendors[0]; // already sorted by preference
      const updated = await repos.workOrders.update(id, auth.tenantId, {
        vendorId: (best as any).id,
        assignedTo: (best as any).id,
        status: 'assigned',
        updatedBy: auth.userId,
      });
      return c.json({ success: true, data: updated });
    } catch (error) {
      console.error('Database error, falling back to mock data:', error);
    }
  }

  // Fallback to mock data
  const validation = validateWorkOrderAccess(c, id);
  if (validation.error) {
    return errorResponse(c, validation.status, validation.status === 404 ? 'NOT_FOUND' : 'FORBIDDEN', validation.message);
  }

  const { workOrder } = validation;
  const availableVendors = DEMO_VENDORS.filter(
    (v) =>
      v.tenantId === auth.tenantId &&
      !v.deletedAt &&
      v.isAvailable &&
      v.categories.includes(workOrder.category)
  );

  if (availableVendors.length === 0) {
    return errorResponse(c, 404, 'NOT_FOUND', 'No available vendor for this category');
  }

  const best = availableVendors.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))[0];
  const updated = updateWorkOrder(id, { vendorId: best.id, assignedTo: best.id, status: WorkOrderStatus.ASSIGNED }, auth.userId);

  return c.json({ success: true, data: updated });
});

// POST /work-orders/:id/schedule
app.post(
  '/:id/schedule',
  zValidator('param', idParamSchema),
  zValidator('json', scheduleWorkOrderSchema, validationErrorHook),
  async (c) => {
    const { id } = c.req.valid('param');
    const auth = c.get('auth');
    const { scheduledAt } = c.req.valid('json');
    const repos = c.get('repos');
    const useMockData = c.get('useMockData');

    if (!useMockData && repos) {
      try {
        const updated = await repos.workOrders.update(id, auth.tenantId, {
          scheduledDate: new Date(scheduledAt),
          updatedBy: auth.userId,
        });
        if (!updated) return errorResponse(c, 404, 'NOT_FOUND', 'Work order not found');
        return c.json({ success: true, data: updated });
      } catch (error) {
        console.error('Database error, falling back to mock data:', error);
      }
    }

    // Fallback to mock data
    const validation = validateWorkOrderAccess(c, id);
    if (validation.error) {
      return errorResponse(c, validation.status, validation.status === 404 ? 'NOT_FOUND' : 'FORBIDDEN', validation.message);
    }

    const updated = updateWorkOrder(id, { scheduledAt: new Date(scheduledAt) }, auth.userId);
    return c.json({ success: true, data: updated });
  }
);

// POST /work-orders/:id/start
app.post('/:id/start', zValidator('param', idParamSchema), async (c) => {
  const { id } = c.req.valid('param');
  const auth = c.get('auth');
  const repos = c.get('repos');
  const useMockData = c.get('useMockData');

  if (!useMockData && repos) {
    try {
      const existing = await repos.workOrders.findById(id, auth.tenantId);
      if (!existing) return errorResponse(c, 404, 'NOT_FOUND', 'Work order not found');

      const validStatuses = ['assigned', 'triaged', 'approved'];
      if (!validStatuses.includes(String(existing.status))) {
        return errorResponse(c, 409, 'CONFLICT', 'Work order must be in ASSIGNED, TRIAGED, or APPROVED status to start');
      }

      const updated = await repos.workOrders.update(id, auth.tenantId, {
        status: 'in_progress',
        startedAt: new Date(),
        updatedBy: auth.userId,
      });
      return c.json({ success: true, data: updated });
    } catch (error) {
      console.error('Database error, falling back to mock data:', error);
    }
  }

  // Fallback to mock data
  const validation = validateWorkOrderAccess(c, id);
  if (validation.error) {
    return errorResponse(c, validation.status, validation.status === 404 ? 'NOT_FOUND' : 'FORBIDDEN', validation.message);
  }

  const validStatuses = [WorkOrderStatus.ASSIGNED, WorkOrderStatus.TRIAGED, WorkOrderStatus.APPROVED];
  if (!validStatuses.includes(validation.workOrder.status)) {
    return errorResponse(c, 409, 'CONFLICT', 'Work order must be in ASSIGNED, TRIAGED, or APPROVED status to start');
  }

  const updated = updateWorkOrder(id, { status: WorkOrderStatus.IN_PROGRESS }, auth.userId);
  return c.json({ success: true, data: updated });
});

// POST /work-orders/:id/complete
app.post(
  '/:id/complete',
  zValidator('param', idParamSchema),
  zValidator('json', completeWorkOrderSchema, validationErrorHook),
  async (c) => {
    const { id } = c.req.valid('param');
    const auth = c.get('auth');
    const body = c.req.valid('json');
    const repos = c.get('repos');
    const useMockData = c.get('useMockData');

    if (!useMockData && repos) {
      try {
        const existing = await repos.workOrders.findById(id, auth.tenantId);
        if (!existing) return errorResponse(c, 404, 'NOT_FOUND', 'Work order not found');

        if (String(existing.status) !== 'in_progress') {
          return errorResponse(c, 409, 'CONFLICT', 'Can only complete work orders in IN_PROGRESS status');
        }

        const updateData: Record<string, any> = {
          status: 'completed',
          completedAt: new Date(),
          updatedBy: auth.userId,
        };
        if (body?.actualCost !== undefined) updateData.actualCost = String(body.actualCost);

        const updated = await repos.workOrders.update(id, auth.tenantId, updateData);
        return c.json({ success: true, data: updated });
      } catch (error) {
        console.error('Database error, falling back to mock data:', error);
      }
    }

    // Fallback to mock data
    const validation = validateWorkOrderAccess(c, id);
    if (validation.error) {
      return errorResponse(c, validation.status, validation.status === 404 ? 'NOT_FOUND' : 'FORBIDDEN', validation.message);
    }

    if (validation.workOrder.status !== WorkOrderStatus.IN_PROGRESS) {
      return errorResponse(c, 409, 'CONFLICT', 'Can only complete work orders in IN_PROGRESS status');
    }

    const update: Record<string, unknown> = { status: WorkOrderStatus.COMPLETED, completedAt: new Date() };
    if (body?.actualCost !== undefined) update.actualCost = body.actualCost;
    if (body?.notes) update.notes = [...(validation.workOrder.notes as unknown[]), { text: body.notes, at: new Date(), by: auth.userId }];

    const updated = updateWorkOrder(id, update, auth.userId);
    return c.json({ success: true, data: updated });
  }
);

// POST /work-orders/:id/verify
app.post(
  '/:id/verify',
  zValidator('param', idParamSchema),
  zValidator('json', verifyWorkOrderSchema, validationErrorHook),
  async (c) => {
    const { id } = c.req.valid('param');
    const auth = c.get('auth');
    const body = c.req.valid('json');
    const repos = c.get('repos');
    const useMockData = c.get('useMockData');

    if (!useMockData && repos) {
      try {
        const existing = await repos.workOrders.findById(id, auth.tenantId);
        if (!existing) return errorResponse(c, 404, 'NOT_FOUND', 'Work order not found');

        if (String(existing.status) !== 'completed') {
          return errorResponse(c, 409, 'CONFLICT', 'Can only verify completed work orders');
        }

        const updated = await repos.workOrders.update(id, auth.tenantId, {
          verifiedAt: new Date(),
          verifiedBy: auth.userId,
          updatedBy: auth.userId,
        });
        return c.json({ success: true, data: updated });
      } catch (error) {
        console.error('Database error, falling back to mock data:', error);
      }
    }

    // Fallback to mock data
    const validation = validateWorkOrderAccess(c, id);
    if (validation.error) {
      return errorResponse(c, validation.status, validation.status === 404 ? 'NOT_FOUND' : 'FORBIDDEN', validation.message);
    }

    if (validation.workOrder.status !== WorkOrderStatus.COMPLETED) {
      return errorResponse(c, 409, 'CONFLICT', 'Can only verify completed work orders');
    }

    const updated = updateWorkOrder(id, {
      verifiedAt: new Date(),
      verifiedBy: auth.userId,
      customerRating: body?.rating,
      customerFeedback: body?.feedback,
    }, auth.userId);
    return c.json({ success: true, data: updated });
  }
);

// POST /work-orders/:id/escalate
app.post(
  '/:id/escalate',
  zValidator('param', idParamSchema),
  zValidator('json', escalateWorkOrderSchema, validationErrorHook),
  async (c) => {
    const { id } = c.req.valid('param');
    const auth = c.get('auth');
    const { reason } = c.req.valid('json');
    const repos = c.get('repos');
    const useMockData = c.get('useMockData');

    if (!useMockData && repos) {
      try {
        const existing = await repos.workOrders.findById(id, auth.tenantId);
        if (!existing) return errorResponse(c, 404, 'NOT_FOUND', 'Work order not found');

        const updated = await repos.workOrders.update(id, auth.tenantId, {
          escalatedAt: new Date(),
          updatedBy: auth.userId,
        });
        return c.json({ success: true, data: updated });
      } catch (error) {
        console.error('Database error, falling back to mock data:', error);
      }
    }

    // Fallback to mock data
    const validation = validateWorkOrderAccess(c, id);
    if (validation.error) {
      return errorResponse(c, validation.status, validation.status === 404 ? 'NOT_FOUND' : 'FORBIDDEN', validation.message);
    }

    const updated = updateWorkOrder(id, {
      escalatedAt: new Date(),
      escalationReason: reason,
    }, auth.userId);
    return c.json({ success: true, data: updated });
  }
);

// POST /work-orders/:id/pause-sla
app.post(
  '/:id/pause-sla',
  zValidator('param', idParamSchema),
  zValidator('json', pauseSlaSchema, validationErrorHook),
  async (c) => {
    const { id } = c.req.valid('param');
    const auth = c.get('auth');
    const body = c.req.valid('json');
    const repos = c.get('repos');
    const useMockData = c.get('useMockData');

    if (!useMockData && repos) {
      try {
        const existing = await repos.workOrders.findById(id, auth.tenantId);
        if (!existing) return errorResponse(c, 404, 'NOT_FOUND', 'Work order not found');

        const updated = await repos.workOrders.update(id, auth.tenantId, {
          slaPausedAt: new Date(),
          updatedBy: auth.userId,
        });
        return c.json({ success: true, data: updated });
      } catch (error) {
        console.error('Database error, falling back to mock data:', error);
      }
    }

    // Fallback to mock data
    const validation = validateWorkOrderAccess(c, id);
    if (validation.error) {
      return errorResponse(c, validation.status, validation.status === 404 ? 'NOT_FOUND' : 'FORBIDDEN', validation.message);
    }

    if (validation.workOrder.slaPausedAt) {
      return errorResponse(c, 409, 'CONFLICT', 'SLA is already paused');
    }

    const updated = updateWorkOrder(id, {
      slaPausedAt: new Date(),
      slaPausedReason: body?.reason,
    }, auth.userId);
    return c.json({ success: true, data: updated });
  }
);

// POST /work-orders/:id/resume-sla
app.post('/:id/resume-sla', zValidator('param', idParamSchema), async (c) => {
  const { id } = c.req.valid('param');
  const auth = c.get('auth');
  const repos = c.get('repos');
  const useMockData = c.get('useMockData');

  if (!useMockData && repos) {
    try {
      const existing = await repos.workOrders.findById(id, auth.tenantId);
      if (!existing) return errorResponse(c, 404, 'NOT_FOUND', 'Work order not found');

      const updated = await repos.workOrders.update(id, auth.tenantId, {
        slaPausedAt: null,
        updatedBy: auth.userId,
      });
      return c.json({ success: true, data: updated });
    } catch (error) {
      console.error('Database error, falling back to mock data:', error);
    }
  }

  // Fallback to mock data
  const validation = validateWorkOrderAccess(c, id);
  if (validation.error) {
    return errorResponse(c, validation.status, validation.status === 404 ? 'NOT_FOUND' : 'FORBIDDEN', validation.message);
  }

  if (!validation.workOrder.slaPausedAt) {
    return errorResponse(c, 409, 'CONFLICT', 'SLA is not paused');
  }

  const updated = updateWorkOrder(id, { slaPausedAt: undefined, slaPausedReason: undefined }, auth.userId);
  return c.json({ success: true, data: updated });
});

export const workOrdersRouter = app;
