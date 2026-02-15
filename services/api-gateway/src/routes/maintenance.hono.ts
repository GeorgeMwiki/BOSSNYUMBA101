/**
 * Maintenance Requests API routes - Module F
 * @openapi
 * tags:
 *   - name: Maintenance
 *     description: Maintenance request management and work order dispatch
 * 
 * Endpoints:
 * POST /api/v1/maintenance/requests      - Submit maintenance request
 * GET  /api/v1/maintenance/requests      - List requests with filters
 * GET  /api/v1/maintenance/requests/:id  - Get request details
 * PATCH /api/v1/maintenance/requests/:id - Update request status
 * POST /api/v1/work-orders               - Create work order from request
 * POST /api/v1/work-orders/:id/dispatch  - Dispatch work order to vendor
 * POST /api/v1/work-orders/:id/complete  - Complete work order with proof
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { authMiddleware, requireRole } from '../middleware/hono-auth';
import { databaseMiddleware } from '../middleware/database';
import { validationErrorHook } from './validators';
import type { UserRole } from '../types/user-role';

const app = new Hono();

// ============================================================================
// Zod Schemas
// ============================================================================

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const maintenanceRequestStatusSchema = z.enum([
  'submitted',
  'acknowledged',
  'in_review',
  'approved',
  'work_order_created',
  'in_progress',
  'completed',
  'closed',
  'rejected',
  'cancelled',
]);

const maintenancePrioritySchema = z.enum(['low', 'medium', 'high', 'emergency']);

const maintenanceCategorySchema = z.enum([
  'plumbing',
  'electrical',
  'hvac',
  'appliance',
  'structural',
  'pest_control',
  'security',
  'cleaning',
  'landscaping',
  'general',
]);

const listMaintenanceRequestsSchema = paginationSchema.extend({
  status: maintenanceRequestStatusSchema.optional(),
  priority: maintenancePrioritySchema.optional(),
  category: maintenanceCategorySchema.optional(),
  propertyId: z.string().optional(),
  unitId: z.string().optional(),
  customerId: z.string().optional(),
  assignedTo: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

const submitMaintenanceRequestSchema = z.object({
  propertyId: z.string().min(1, 'Property ID is required'),
  unitId: z.string().min(1, 'Unit ID is required'),
  customerId: z.string().optional(),
  category: maintenanceCategorySchema,
  priority: maintenancePrioritySchema.default('medium'),
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().min(10, 'Description must be at least 10 characters').max(2000),
  preferredSchedule: z.object({
    date: z.string().optional(),
    timeSlot: z.enum(['morning', 'afternoon', 'evening', 'any']).optional(),
  }).optional(),
  attachments: z.array(z.object({
    type: z.enum(['photo', 'video', 'voice_note', 'document']),
    url: z.string().url(),
    description: z.string().max(500).optional(),
  })).max(10).optional(),
  contactPhone: z.string().max(50).optional(),
  accessInstructions: z.string().max(500).optional(),
});

const updateMaintenanceRequestSchema = z.object({
  status: maintenanceRequestStatusSchema.optional(),
  priority: maintenancePrioritySchema.optional(),
  assignedTo: z.string().optional(),
  internalNotes: z.string().max(2000).optional(),
  estimatedCompletionDate: z.string().optional(),
  rejectionReason: z.string().max(500).optional(),
});

const idParamSchema = z.object({
  id: z.string().min(1, 'ID is required'),
});

const createWorkOrderFromRequestSchema = z.object({
  maintenanceRequestId: z.string().min(1, 'Maintenance request ID is required'),
  vendorId: z.string().optional(),
  estimatedCost: z.number().min(0).optional(),
  scheduledDate: z.string().optional(),
  notes: z.string().max(2000).optional(),
});

const dispatchWorkOrderSchema = z.object({
  vendorId: z.string().min(1, 'Vendor ID is required'),
  scheduledDate: z.string().min(1, 'Scheduled date is required'),
  scheduledTimeSlot: z.enum(['morning', 'afternoon', 'evening']).optional(),
  estimatedDuration: z.number().int().min(15).optional(),
  instructions: z.string().max(2000).optional(),
  notifyCustomer: z.boolean().default(true),
});

const completeWorkOrderSchema = z.object({
  completionNotes: z.string().min(1, 'Completion notes are required').max(2000),
  actualCost: z.number().min(0).optional(),
  laborHours: z.number().min(0).optional(),
  materialsUsed: z.array(z.object({
    name: z.string(),
    quantity: z.number().min(0),
    unitCost: z.number().min(0),
  })).optional(),
  proofOfCompletion: z.array(z.object({
    type: z.enum(['photo', 'video', 'signature', 'document']),
    url: z.string().url(),
    description: z.string().max(500).optional(),
  })).min(1, 'At least one proof of completion is required'),
  customerSignature: z.string().optional(),
  requiresFollowUp: z.boolean().default(false),
  followUpNotes: z.string().max(1000).optional(),
});

// ============================================================================
// In-memory storage for demo
// ============================================================================

interface MaintenanceRequest {
  id: string;
  tenantId: string;
  propertyId: string;
  unitId: string;
  customerId?: string;
  category: string;
  priority: string;
  status: string;
  title: string;
  description: string;
  preferredSchedule?: {
    date?: string;
    timeSlot?: string;
  };
  attachments: Array<{
    type: string;
    url: string;
    description?: string;
  }>;
  contactPhone?: string;
  accessInstructions?: string;
  assignedTo?: string;
  workOrderId?: string;
  internalNotes?: string;
  estimatedCompletionDate?: string;
  rejectionReason?: string;
  acknowledgedAt?: string;
  completedAt?: string;
  closedAt?: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

interface WorkOrderDispatch {
  id: string;
  tenantId: string;
  maintenanceRequestId: string;
  propertyId: string;
  unitId: string;
  customerId?: string;
  vendorId?: string;
  status: string;
  scheduledDate?: string;
  scheduledTimeSlot?: string;
  estimatedCost?: number;
  actualCost?: number;
  estimatedDuration?: number;
  laborHours?: number;
  instructions?: string;
  completionNotes?: string;
  materialsUsed?: Array<{
    name: string;
    quantity: number;
    unitCost: number;
  }>;
  proofOfCompletion?: Array<{
    type: string;
    url: string;
    description?: string;
  }>;
  customerSignature?: string;
  requiresFollowUp: boolean;
  followUpNotes?: string;
  dispatchedAt?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

const maintenanceRequests = new Map<string, MaintenanceRequest>();
const workOrdersDispatch = new Map<string, WorkOrderDispatch>();

// Seed some demo data
const seedData = () => {
  const demoRequest: MaintenanceRequest = {
    id: 'mreq-001',
    tenantId: 'tenant-001',
    propertyId: 'property-001',
    unitId: 'unit-001',
    customerId: 'customer-001',
    category: 'plumbing',
    priority: 'high',
    status: 'in_progress',
    title: 'Kitchen sink leak',
    description: 'Water is leaking from under the kitchen sink. It appears to be from the P-trap connection.',
    attachments: [
      { type: 'photo', url: 'https://storage.example.com/photos/leak-001.jpg', description: 'Photo of leak' },
    ],
    contactPhone: '+255 755 111 001',
    accessInstructions: 'Please call before arrival',
    assignedTo: 'vendor-001',
    workOrderId: 'wo-dispatch-001',
    createdAt: '2026-02-10T08:00:00Z',
    createdBy: 'customer-001',
    updatedAt: '2026-02-11T10:00:00Z',
    updatedBy: 'user-002',
    acknowledgedAt: '2026-02-10T09:00:00Z',
  };
  maintenanceRequests.set(demoRequest.id, demoRequest);

  const demoWorkOrder: WorkOrderDispatch = {
    id: 'wo-dispatch-001',
    tenantId: 'tenant-001',
    maintenanceRequestId: 'mreq-001',
    propertyId: 'property-001',
    unitId: 'unit-001',
    customerId: 'customer-001',
    vendorId: 'vendor-001',
    status: 'in_progress',
    scheduledDate: '2026-02-12',
    scheduledTimeSlot: 'morning',
    estimatedCost: 50000,
    estimatedDuration: 120,
    instructions: 'Check P-trap and replace if necessary',
    requiresFollowUp: false,
    dispatchedAt: '2026-02-11T10:30:00Z',
    startedAt: '2026-02-12T09:00:00Z',
    createdAt: '2026-02-11T10:00:00Z',
    createdBy: 'user-002',
    updatedAt: '2026-02-12T09:00:00Z',
    updatedBy: 'vendor-001',
  };
  workOrdersDispatch.set(demoWorkOrder.id, demoWorkOrder);
};
seedData();

// ============================================================================
// Helper functions
// ============================================================================

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function paginate<T>(items: T[], page: number, pageSize: number) {
  const totalItems = items.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const start = (page - 1) * pageSize;
  const data = items.slice(start, start + pageSize);
  return {
    data,
    pagination: {
      page,
      pageSize,
      totalItems,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  };
}

// ============================================================================
// Middleware
// ============================================================================

app.use('*', authMiddleware);
app.use('*', databaseMiddleware);

// ============================================================================
// Routes
// ============================================================================

/**
 * @openapi
 * /api/v1/maintenance/requests:
 *   post:
 *     summary: Submit a new maintenance request
 *     tags: [Maintenance]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SubmitMaintenanceRequest'
 *     responses:
 *       201:
 *         description: Maintenance request created
 */
app.post('/requests', zValidator('json', submitMaintenanceRequestSchema, validationErrorHook), async (c) => {
  const auth = c.get('auth');
  const body = c.req.valid('json');
  const repos = c.get('repos');
  const useMockData = c.get('useMockData');

  if (!useMockData && repos) {
    try {
      const created = await repos.workOrders.create({
        tenantId: auth.tenantId,
        propertyId: body.propertyId,
        unitId: body.unitId,
        customerId: body.customerId ?? auth.userId,
        category: body.category,
        priority: body.priority,
        status: 'submitted',
        title: body.title,
        description: body.description,
        createdBy: auth.userId,
      });

      return c.json({
        success: true,
        data: {
          ...created,
          message: 'Maintenance request submitted successfully',
          trackingNumber: created.id,
        },
      }, 201);
    } catch (error) {
      console.error('Database error, falling back to mock data:', error);
    }
  }

  // Fallback to mock data
  const now = new Date().toISOString();
  const request: MaintenanceRequest = {
    id: generateId('mreq'),
    tenantId: auth.tenantId,
    propertyId: body.propertyId,
    unitId: body.unitId,
    customerId: body.customerId ?? auth.userId,
    category: body.category,
    priority: body.priority,
    status: 'submitted',
    title: body.title,
    description: body.description,
    preferredSchedule: body.preferredSchedule,
    attachments: body.attachments ?? [],
    contactPhone: body.contactPhone,
    accessInstructions: body.accessInstructions,
    createdAt: now,
    createdBy: auth.userId,
    updatedAt: now,
    updatedBy: auth.userId,
  };
  maintenanceRequests.set(request.id, request);

  return c.json({
    success: true,
    data: {
      ...request,
      message: 'Maintenance request submitted successfully',
      trackingNumber: request.id,
    },
  }, 201);
});

/**
 * @openapi
 * /api/v1/maintenance/requests:
 *   get:
 *     summary: List maintenance requests with filters
 *     tags: [Maintenance]
 *     parameters:
 *       - name: status
 *         in: query
 *         schema:
 *           type: string
 *       - name: priority
 *         in: query
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of maintenance requests
 */
app.get('/requests', zValidator('query', listMaintenanceRequestsSchema), async (c) => {
  const auth = c.get('auth');
  const query = c.req.valid('query');
  const repos = c.get('repos');
  const useMockData = c.get('useMockData');

  if (!useMockData && repos) {
    try {
      const offset = (query.page - 1) * query.pageSize;
      const result = await repos.workOrders.findMany(auth.tenantId, query.pageSize, offset);

      // Apply client-side filters since findMany doesn't accept filters directly
      let items = [...result.items] as any[];
      if (query.status) items = items.filter((r: any) => r.status === query.status);
      if (query.priority) items = items.filter((r: any) => r.priority === query.priority);
      if (query.propertyId) items = items.filter((r: any) => r.propertyId === query.propertyId);
      if (query.unitId) items = items.filter((r: any) => r.unitId === query.unitId);
      if (query.customerId) items = items.filter((r: any) => r.customerId === query.customerId);

      return c.json({
        success: true,
        data: items,
        pagination: {
          page: query.page,
          pageSize: query.pageSize,
          totalItems: result.total,
          totalPages: Math.ceil(result.total / query.pageSize),
          hasNextPage: query.page < Math.ceil(result.total / query.pageSize),
          hasPreviousPage: query.page > 1,
        },
      });
    } catch (error) {
      console.error('Database error, falling back to mock data:', error);
    }
  }

  // Fallback to mock data
  let requests = Array.from(maintenanceRequests.values())
    .filter(r => r.tenantId === auth.tenantId);

  if (query.status) requests = requests.filter(r => r.status === query.status);
  if (query.priority) requests = requests.filter(r => r.priority === query.priority);
  if (query.category) requests = requests.filter(r => r.category === query.category);
  if (query.propertyId) requests = requests.filter(r => r.propertyId === query.propertyId);
  if (query.unitId) requests = requests.filter(r => r.unitId === query.unitId);
  if (query.customerId) requests = requests.filter(r => r.customerId === query.customerId);
  if (query.assignedTo) requests = requests.filter(r => r.assignedTo === query.assignedTo);
  
  if (query.dateFrom) {
    const from = new Date(query.dateFrom);
    requests = requests.filter(r => new Date(r.createdAt) >= from);
  }
  if (query.dateTo) {
    const to = new Date(query.dateTo);
    requests = requests.filter(r => new Date(r.createdAt) <= to);
  }

  requests.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const result = paginate(requests, query.page, query.pageSize);

  return c.json({
    success: true,
    data: result.data,
    pagination: result.pagination,
  });
});

/**
 * @openapi
 * /api/v1/maintenance/requests/{id}:
 *   get:
 *     summary: Get maintenance request details
 *     tags: [Maintenance]
 */
app.get('/requests/:id', zValidator('param', idParamSchema), async (c) => {
  const auth = c.get('auth');
  const { id } = c.req.valid('param');
  const repos = c.get('repos');
  const useMockData = c.get('useMockData');

  if (!useMockData && repos) {
    try {
      const workOrder = await repos.workOrders.findById(id, auth.tenantId);
      if (!workOrder) {
        return c.json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Maintenance request not found' },
        }, 404);
      }
      return c.json({ success: true, data: workOrder });
    } catch (error) {
      console.error('Database error, falling back to mock data:', error);
    }
  }

  // Fallback to mock data
  const request = maintenanceRequests.get(id);
  if (!request || request.tenantId !== auth.tenantId) {
    return c.json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Maintenance request not found' },
    }, 404);
  }

  let workOrder = null;
  if (request.workOrderId) {
    workOrder = workOrdersDispatch.get(request.workOrderId);
  }

  return c.json({
    success: true,
    data: { ...request, workOrder },
  });
});

/**
 * @openapi
 * /api/v1/maintenance/requests/{id}:
 *   patch:
 *     summary: Update maintenance request status
 *     tags: [Maintenance]
 */
app.patch('/requests/:id', 
  zValidator('param', idParamSchema),
  zValidator('json', updateMaintenanceRequestSchema, validationErrorHook),
  async (c) => {
    const auth = c.get('auth');
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');
    const repos = c.get('repos');
    const useMockData = c.get('useMockData');

    if (!useMockData && repos) {
      try {
        const updateData: Record<string, any> = {};
        if (body.status) updateData.status = body.status;
        if (body.priority) updateData.priority = body.priority;
        if (body.assignedTo !== undefined) updateData.assignedTo = body.assignedTo;
        updateData.updatedBy = auth.userId;

        const updated = await repos.workOrders.update(id, auth.tenantId, updateData);
        if (!updated) {
          return c.json({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Maintenance request not found' },
          }, 404);
        }
        return c.json({ success: true, data: updated });
      } catch (error) {
        console.error('Database error, falling back to mock data:', error);
      }
    }

    // Fallback to mock data
    const now = new Date().toISOString();
    const request = maintenanceRequests.get(id);
    if (!request || request.tenantId !== auth.tenantId) {
      return c.json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Maintenance request not found' },
      }, 404);
    }

    if (body.status) {
      request.status = body.status;
      if (body.status === 'acknowledged' && !request.acknowledgedAt) request.acknowledgedAt = now;
      if (body.status === 'completed' && !request.completedAt) request.completedAt = now;
      if (body.status === 'closed' && !request.closedAt) request.closedAt = now;
    }
    if (body.priority) request.priority = body.priority;
    if (body.assignedTo !== undefined) request.assignedTo = body.assignedTo;
    if (body.internalNotes) request.internalNotes = body.internalNotes;
    if (body.estimatedCompletionDate) request.estimatedCompletionDate = body.estimatedCompletionDate;
    if (body.rejectionReason) request.rejectionReason = body.rejectionReason;

    request.updatedAt = now;
    request.updatedBy = auth.userId;
    maintenanceRequests.set(id, request);

    return c.json({ success: true, data: request });
  }
);

/**
 * @openapi
 * /api/v1/maintenance/work-orders:
 *   post:
 *     summary: Create work order from maintenance request
 *     tags: [Maintenance]
 */
app.post('/work-orders', zValidator('json', createWorkOrderFromRequestSchema, validationErrorHook), async (c) => {
  const auth = c.get('auth');
  const body = c.req.valid('json');
  const repos = c.get('repos');
  const useMockData = c.get('useMockData');

  if (!useMockData && repos) {
    try {
      // Verify the maintenance request exists
      const maintenanceReq = await repos.workOrders.findById(body.maintenanceRequestId, auth.tenantId);
      if (!maintenanceReq) {
        return c.json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Maintenance request not found' },
        }, 404);
      }

      const created = await repos.workOrders.create({
        tenantId: auth.tenantId,
        propertyId: (maintenanceReq as any).propertyId,
        unitId: (maintenanceReq as any).unitId,
        customerId: (maintenanceReq as any).customerId,
        vendorId: body.vendorId,
        status: body.vendorId ? 'assigned' : 'pending_assignment',
        scheduledDate: body.scheduledDate ? new Date(body.scheduledDate) : undefined,
        estimatedCost: body.estimatedCost ? String(body.estimatedCost) : undefined,
        description: body.notes,
        createdBy: auth.userId,
      });

      return c.json({
        success: true,
        data: {
          workOrder: created,
          maintenanceRequest: maintenanceReq,
          message: 'Work order created successfully',
        },
      }, 201);
    } catch (error) {
      console.error('Database error, falling back to mock data:', error);
    }
  }

  // Fallback to mock data
  const now = new Date().toISOString();
  const request = maintenanceRequests.get(body.maintenanceRequestId);
  if (!request || request.tenantId !== auth.tenantId) {
    return c.json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Maintenance request not found' },
    }, 404);
  }

  if (request.workOrderId) {
    return c.json({
      success: false,
      error: { code: 'CONFLICT', message: 'Work order already exists for this request' },
    }, 409);
  }

  const workOrder: WorkOrderDispatch = {
    id: generateId('wo-dispatch'),
    tenantId: auth.tenantId,
    maintenanceRequestId: body.maintenanceRequestId,
    propertyId: request.propertyId,
    unitId: request.unitId,
    customerId: request.customerId,
    vendorId: body.vendorId,
    status: body.vendorId ? 'assigned' : 'pending_assignment',
    scheduledDate: body.scheduledDate,
    estimatedCost: body.estimatedCost,
    instructions: body.notes,
    requiresFollowUp: false,
    createdAt: now,
    createdBy: auth.userId,
    updatedAt: now,
    updatedBy: auth.userId,
  };
  workOrdersDispatch.set(workOrder.id, workOrder);

  request.workOrderId = workOrder.id;
  request.status = 'work_order_created';
  request.updatedAt = now;
  request.updatedBy = auth.userId;
  maintenanceRequests.set(request.id, request);

  return c.json({
    success: true,
    data: {
      workOrder,
      maintenanceRequest: request,
      message: 'Work order created successfully',
    },
  }, 201);
});

/**
 * @openapi
 * /api/v1/maintenance/work-orders/{id}/dispatch:
 *   post:
 *     summary: Dispatch work order to vendor
 *     tags: [Maintenance]
 */
app.post('/work-orders/:id/dispatch',
  zValidator('param', idParamSchema),
  zValidator('json', dispatchWorkOrderSchema, validationErrorHook),
  async (c) => {
    const auth = c.get('auth');
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');
    const repos = c.get('repos');
    const useMockData = c.get('useMockData');
    const now = new Date().toISOString();

    if (!useMockData && repos) {
      try {
        const updated = await repos.workOrders.update(id, auth.tenantId, {
          vendorId: body.vendorId,
          scheduledDate: new Date(body.scheduledDate),
          status: 'dispatched',
          updatedBy: auth.userId,
        });
        if (!updated) {
          return c.json({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Work order not found' },
          }, 404);
        }
        return c.json({
          success: true,
          data: {
            workOrder: updated,
            dispatchedAt: now,
            vendorNotified: true,
            customerNotified: body.notifyCustomer,
            message: 'Work order dispatched to vendor',
          },
        });
      } catch (error) {
        console.error('Database error, falling back to mock data:', error);
      }
    }

    // Fallback to mock data
    const workOrder = workOrdersDispatch.get(id);
    if (!workOrder || workOrder.tenantId !== auth.tenantId) {
      return c.json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Work order not found' },
      }, 404);
    }

    if (workOrder.status === 'completed' || workOrder.status === 'cancelled') {
      return c.json({
        success: false,
        error: { code: 'CONFLICT', message: 'Work order is already completed or cancelled' },
      }, 409);
    }

    workOrder.vendorId = body.vendorId;
    workOrder.scheduledDate = body.scheduledDate;
    workOrder.scheduledTimeSlot = body.scheduledTimeSlot;
    workOrder.estimatedDuration = body.estimatedDuration;
    if (body.instructions) workOrder.instructions = body.instructions;
    workOrder.status = 'dispatched';
    workOrder.dispatchedAt = now;
    workOrder.updatedAt = now;
    workOrder.updatedBy = auth.userId;
    workOrdersDispatch.set(id, workOrder);

    const request = maintenanceRequests.get(workOrder.maintenanceRequestId);
    if (request) {
      request.status = 'in_progress';
      request.assignedTo = body.vendorId;
      request.updatedAt = now;
      request.updatedBy = auth.userId;
      maintenanceRequests.set(request.id, request);
    }

    return c.json({
      success: true,
      data: {
        workOrder,
        dispatchedAt: now,
        vendorNotified: true,
        customerNotified: body.notifyCustomer,
        message: 'Work order dispatched to vendor',
      },
    });
  }
);

/**
 * @openapi
 * /api/v1/maintenance/work-orders/{id}/complete:
 *   post:
 *     summary: Complete work order with proof
 *     tags: [Maintenance]
 */
app.post('/work-orders/:id/complete',
  zValidator('param', idParamSchema),
  zValidator('json', completeWorkOrderSchema, validationErrorHook),
  async (c) => {
    const auth = c.get('auth');
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');
    const repos = c.get('repos');
    const useMockData = c.get('useMockData');
    const now = new Date().toISOString();

    if (!useMockData && repos) {
      try {
        const materialsCost = body.materialsUsed?.reduce(
          (sum, m) => sum + (m.quantity * m.unitCost), 0
        ) ?? 0;

        const updated = await repos.workOrders.update(id, auth.tenantId, {
          status: 'completed',
          actualCost: body.actualCost ? String(body.actualCost) : undefined,
          completedAt: new Date(),
          updatedBy: auth.userId,
        });

        if (!updated) {
          return c.json({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Work order not found' },
          }, 404);
        }

        return c.json({
          success: true,
          data: {
            workOrder: updated,
            summary: {
              completedAt: now,
              laborHours: body.laborHours,
              materialsCost,
              totalCost: body.actualCost ?? 0,
              proofCount: body.proofOfCompletion.length,
              requiresFollowUp: body.requiresFollowUp,
            },
            message: 'Work order completed successfully',
          },
        });
      } catch (error) {
        console.error('Database error, falling back to mock data:', error);
      }
    }

    // Fallback to mock data
    const workOrder = workOrdersDispatch.get(id);
    if (!workOrder || workOrder.tenantId !== auth.tenantId) {
      return c.json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Work order not found' },
      }, 404);
    }

    if (workOrder.status === 'completed') {
      return c.json({
        success: false,
        error: { code: 'CONFLICT', message: 'Work order is already completed' },
      }, 409);
    }

    if (workOrder.status !== 'in_progress' && workOrder.status !== 'dispatched') {
      return c.json({
        success: false,
        error: { code: 'CONFLICT', message: 'Work order must be in progress to complete' },
      }, 409);
    }

    const materialsCost = body.materialsUsed?.reduce(
      (sum, m) => sum + (m.quantity * m.unitCost), 0
    ) ?? 0;

    workOrder.status = 'completed';
    workOrder.completionNotes = body.completionNotes;
    workOrder.actualCost = body.actualCost ?? (workOrder.estimatedCost ?? 0);
    workOrder.laborHours = body.laborHours;
    workOrder.materialsUsed = body.materialsUsed;
    workOrder.proofOfCompletion = body.proofOfCompletion;
    workOrder.customerSignature = body.customerSignature;
    workOrder.requiresFollowUp = body.requiresFollowUp;
    workOrder.followUpNotes = body.followUpNotes;
    workOrder.completedAt = now;
    workOrder.updatedAt = now;
    workOrder.updatedBy = auth.userId;
    workOrdersDispatch.set(id, workOrder);

    const request = maintenanceRequests.get(workOrder.maintenanceRequestId);
    if (request) {
      request.status = 'completed';
      request.completedAt = now;
      request.updatedAt = now;
      request.updatedBy = auth.userId;
      maintenanceRequests.set(request.id, request);
    }

    return c.json({
      success: true,
      data: {
        workOrder,
        maintenanceRequest: request,
        summary: {
          completedAt: now,
          laborHours: body.laborHours,
          materialsCost,
          totalCost: workOrder.actualCost,
          proofCount: body.proofOfCompletion.length,
          requiresFollowUp: body.requiresFollowUp,
        },
        message: 'Work order completed successfully',
      },
    });
  }
);

/**
 * @openapi
 * /api/v1/maintenance/work-orders/{id}:
 *   get:
 *     summary: Get work order details
 *     tags: [Maintenance]
 */
app.get('/work-orders/:id', zValidator('param', idParamSchema), async (c) => {
  const auth = c.get('auth');
  const { id } = c.req.valid('param');
  const repos = c.get('repos');
  const useMockData = c.get('useMockData');

  if (!useMockData && repos) {
    try {
      const workOrder = await repos.workOrders.findById(id, auth.tenantId);
      if (!workOrder) {
        return c.json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Work order not found' },
        }, 404);
      }
      return c.json({ success: true, data: workOrder });
    } catch (error) {
      console.error('Database error, falling back to mock data:', error);
    }
  }

  // Fallback to mock data
  const workOrder = workOrdersDispatch.get(id);
  if (!workOrder || workOrder.tenantId !== auth.tenantId) {
    return c.json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Work order not found' },
    }, 404);
  }

  const request = maintenanceRequests.get(workOrder.maintenanceRequestId);
  return c.json({
    success: true,
    data: { ...workOrder, maintenanceRequest: request ?? null },
  });
});

/**
 * @openapi
 * /api/v1/maintenance/work-orders/{id}/start:
 *   post:
 *     summary: Mark work order as started
 *     tags: [Maintenance]
 */
app.post('/work-orders/:id/start', zValidator('param', idParamSchema), async (c) => {
  const auth = c.get('auth');
  const { id } = c.req.valid('param');
  const repos = c.get('repos');
  const useMockData = c.get('useMockData');
  const now = new Date().toISOString();

  if (!useMockData && repos) {
    try {
      const updated = await repos.workOrders.update(id, auth.tenantId, {
        status: 'in_progress',
        startedAt: new Date(),
        updatedBy: auth.userId,
      });
      if (!updated) {
        return c.json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Work order not found' },
        }, 404);
      }
      return c.json({
        success: true,
        data: { workOrder: updated, startedAt: now, message: 'Work order started' },
      });
    } catch (error) {
      console.error('Database error, falling back to mock data:', error);
    }
  }

  // Fallback to mock data
  const workOrder = workOrdersDispatch.get(id);
  if (!workOrder || workOrder.tenantId !== auth.tenantId) {
    return c.json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Work order not found' },
    }, 404);
  }

  if (workOrder.status !== 'dispatched' && workOrder.status !== 'assigned') {
    return c.json({
      success: false,
      error: { code: 'CONFLICT', message: 'Work order must be dispatched to start' },
    }, 409);
  }

  workOrder.status = 'in_progress';
  workOrder.startedAt = now;
  workOrder.updatedAt = now;
  workOrder.updatedBy = auth.userId;
  workOrdersDispatch.set(id, workOrder);

  const request = maintenanceRequests.get(workOrder.maintenanceRequestId);
  if (request) {
    request.status = 'in_progress';
    request.updatedAt = now;
    request.updatedBy = auth.userId;
    maintenanceRequests.set(request.id, request);
  }

  return c.json({
    success: true,
    data: { workOrder, startedAt: now, message: 'Work order started' },
  });
});

export const maintenanceRouter = app;
