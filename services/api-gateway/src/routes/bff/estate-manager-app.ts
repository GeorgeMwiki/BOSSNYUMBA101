/**
 * Estate Manager App BFF Routes - BOSSNYUMBA
 * 
 * Backend for Frontend routes for property managers and field staff:
 * - Work order management
 * - Inspection workflows
 * - Occupancy operations
 * - Lease lifecycle actions
 * - Collections workflows
 * - Vendor coordination
 * - SLA dashboards and escalations
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { authMiddleware } from '../../middleware/hono-auth';
import { requireRole, requirePermission, requirePropertyAccess } from '../../middleware/authorization';
import { UserRole } from '../../types/user-role';
import { getDataService } from '../../services/data-access.service';

// ============================================================================
// Schemas
// ============================================================================

const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const dateRangeSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

const workOrderFilterSchema = z.object({
  status: z.enum(['all', 'submitted', 'triaged', 'pending_approval', 'approved', 'assigned', 'scheduled', 'in_progress', 'pending_verification', 'completed', 'cancelled']).optional().default('all'),
  priority: z.enum(['all', 'emergency', 'high', 'medium', 'low']).optional().default('all'),
  category: z.string().optional(),
  propertyId: z.string().optional(),
  vendorId: z.string().optional(),
  assignedToMe: z.coerce.boolean().optional().default(false),
});

const triageWorkOrderSchema = z.object({
  category: z.enum(['plumbing', 'electrical', 'appliance', 'hvac', 'structural', 'pest_control', 'security', 'cleaning', 'landscaping', 'other']),
  priority: z.enum(['emergency', 'high', 'medium', 'low']),
  notes: z.string().max(1000).optional(),
  estimatedCost: z.number().positive().optional(),
  requiresApproval: z.boolean().default(false),
});

const approveWorkOrderSchema = z.object({
  approved: z.boolean(),
  comments: z.string().max(1000).optional(),
  budgetOverride: z.number().positive().optional(),
});

const assignVendorSchema = z.object({
  vendorId: z.string(),
  notes: z.string().max(1000).optional(),
  overrideRecommendation: z.boolean().default(false),
  overrideReason: z.string().max(500).optional(),
});

const scheduleWorkOrderSchema = z.object({
  scheduledDate: z.string(),
  scheduledTimeSlot: z.string(),
  notifyCustomer: z.boolean().default(true),
  notes: z.string().max(500).optional(),
});

const completeWorkOrderSchema = z.object({
  completionNotes: z.string().min(10).max(2000),
  laborHours: z.number().positive().optional(),
  materialsCost: z.number().min(0).optional(),
  beforePhotos: z.array(z.string()).optional(),
  afterPhotos: z.array(z.string()).min(1),
  defectsReturned: z.array(z.object({
    description: z.string(),
    quantity: z.number().int().positive(),
    photoUrl: z.string().optional(),
  })).optional(),
  materialsUsed: z.array(z.object({
    name: z.string(),
    quantity: z.number().positive(),
    unitCost: z.number().positive(),
  })).optional(),
});

const inspectionSchema = z.object({
  type: z.enum(['move_in', 'move_out', 'routine', 'maintenance']),
  unitId: z.string(),
  customerId: z.string().optional(),
  scheduledDate: z.string(),
  scheduledTime: z.string(),
  notes: z.string().max(1000).optional(),
});

const inspectionItemSchema = z.object({
  room: z.string(),
  item: z.string(),
  condition: z.enum(['excellent', 'good', 'fair', 'poor', 'damaged', 'missing']),
  notes: z.string().max(500).optional(),
  photoUrls: z.array(z.string()).optional(),
  reading: z.number().optional(), // For meter readings
});

const collectionActionSchema = z.object({
  customerId: z.string(),
  actionType: z.enum(['reminder', 'payment_plan', 'escalate', 'waive_fee', 'legal_notice']),
  notes: z.string().max(1000).optional(),
  paymentPlan: z.object({
    installments: z.number().int().min(2).max(12),
    startDate: z.string(),
    amount: z.number().positive(),
  }).optional(),
  waiverAmount: z.number().positive().optional(),
});

const vendorInvoiceApprovalSchema = z.object({
  approved: z.boolean(),
  adjustedAmount: z.number().positive().optional(),
  notes: z.string().max(1000).optional(),
  flagForReview: z.boolean().default(false),
  flagReason: z.string().max(500).optional(),
});

// ============================================================================
// Router
// ============================================================================

export const estateManagerAppRouter = new Hono()
  .use('*', authMiddleware)
  .use('*', requireRole(
    UserRole.PROPERTY_MANAGER,
    UserRole.MAINTENANCE_STAFF,
    UserRole.TENANT_ADMIN,
    UserRole.ADMIN
  ));

// ============================================================================
// Dashboard & Home
// ============================================================================

/**
 * GET /manager/home - Estate manager home screen
 */
estateManagerAppRouter.get('/home', async (c) => {
  const auth = c.get('auth');
  const dataService = getDataService();

  const [workOrders, inspections, occupancy, notifications] = await Promise.all([
    dataService.getWorkOrders({}, { page: 1, pageSize: 100 }),
    dataService.getInspections({ status: 'scheduled' }, { page: 1, pageSize: 10 }),
    dataService.getOccupancySummary(),
    dataService.getNotifications(auth.userId, { page: 1, pageSize: 5 }, true),
  ]);

  const woData = workOrders.data as Array<{ status: string; priority: string }>;
  const openWo = woData.filter((wo) => !['completed', 'cancelled'].includes(wo.status));
  const urgentWo = woData.filter((wo) => wo.priority === 'emergency' || wo.priority === 'high');
  const occData = occupancy as { summary?: { occupancyRate?: number } };

  const home = {
    greeting: getTimeBasedGreeting(),
    manager: { id: auth.userId },
    todaySummary: {
      scheduledInspections: inspections.data.length,
      openWorkOrders: openWo.length,
      urgentWorkOrders: urgentWo.length,
      slaAtRisk: 0,
      collectionsFollowUp: 0,
      vendorVisitsExpected: 0,
      occupancyRate: occData.summary?.occupancyRate || 0,
    },
    quickActions: [
      { id: 'new_work_order', label: 'New Work Order', icon: 'wrench' },
      { id: 'start_inspection', label: 'Start Inspection', icon: 'clipboard' },
      { id: 'view_arrears', label: 'View Arrears', icon: 'alert' },
      { id: 'contact_vendor', label: 'Contact Vendor', icon: 'phone' },
    ],
    alerts: notifications.data,
    recentActivity: [],
    dailyBriefing: { available: true, lastGenerated: new Date().toISOString(), url: '/manager/briefing' },
  };

  return c.json({ success: true, data: home });
});

/**
 * GET /manager/briefing - Morning briefing
 */
estateManagerAppRouter.get('/briefing', async (c) => {
  const dataService = getDataService();

  const [workOrders, inspections, occupancy, collections, leases] = await Promise.all([
    dataService.getWorkOrders({}, { page: 1, pageSize: 200 }),
    dataService.getInspections({ status: 'scheduled' }, { page: 1, pageSize: 50 }),
    dataService.getOccupancySummary(),
    dataService.getCollections({ page: 1, pageSize: 50 }),
    dataService.getLeases({ page: 1, pageSize: 50 }, { status: 'active' }),
  ]);

  const woData = workOrders.data as Array<{ id: string; title: string; priority: string; status: string; created_at?: string; createdAt?: string }>;
  const openWos = woData.filter((wo) => !['completed', 'cancelled'].includes(wo.status));
  const urgentWos = openWos.filter((wo) => wo.priority === 'emergency' || wo.priority === 'high');
  const occData = occupancy as { summary?: { occupancyRate?: number } };
  const collectionsData = collections as { summary?: { totalOutstanding?: number; tenantsInArrears?: number } };
  const todayStr = new Date().toISOString().split('T')[0];
  const todayInspections = (inspections.data as Array<{ scheduledDate?: string; scheduled_date?: string; type?: string; description?: string }>)
    .filter((i) => (i.scheduledDate || i.scheduled_date || '').startsWith(todayStr));

  const briefing = {
    date: todayStr,
    generatedAt: new Date().toISOString(),
    summary: {
      headline: `${getTimeBasedGreeting()}! Here is your daily briefing.`,
      keyMetrics: {
        occupancyRate: { value: occData.summary?.occupancyRate || 0, change: 0, trend: 'stable' },
        collectionRate: { value: 0, change: 0, trend: 'stable' },
        openWorkOrders: { value: openWos.length, change: 0, trend: 'stable' },
        avgResolutionDays: { value: 0, change: 0, trend: 'stable' },
      },
    },
    urgentItems: urgentWos.slice(0, 5).map((wo) => ({
      type: 'work_order',
      id: wo.id,
      title: wo.title,
      priority: wo.priority,
      detail: `Status: ${wo.status}`,
      suggestedAction: wo.status === 'submitted' ? 'Triage and assign' : 'Follow up',
    })),
    scheduledToday: todayInspections.slice(0, 10).map((i) => ({
      time: '', type: 'inspection', description: i.description || i.type || 'Inspection', customer: '',
    })),
    expiringSoon: { leases: [], documents: [] },
    vendorPerformance: { topPerformer: null, needsAttention: null },
    aiInsights: [],
  };

  return c.json({ success: true, data: briefing });
});

// ============================================================================
// Work Order Management
// ============================================================================

/**
 * GET /manager/work-orders - List work orders
 */
estateManagerAppRouter.get(
  '/work-orders',
  zValidator('query', paginationSchema.merge(workOrderFilterSchema)),
  async (c) => {
    const auth = c.get('auth');
    const { page, pageSize, status, priority, category, propertyId, assignedToMe } = c.req.valid('query');
    const dataService = getDataService();

    const result = await dataService.getWorkOrders(
      { propertyId, status, priority, assignedTo: assignedToMe ? auth.userId : undefined },
      { page, pageSize }
    );

    return c.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  }
);

/**
 * GET /manager/work-orders/:id - Work order details
 */
estateManagerAppRouter.get('/work-orders/:id', async (c) => {
  const workOrderId = c.req.param('id');
  const dataService = getDataService();

  const workOrder = await dataService.getWorkOrderById(workOrderId);
  if (!workOrder) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Work order not found' } }, 404);
  }

  return c.json({ success: true, data: workOrder });
});

/**
 * POST /manager/work-orders/:id/triage - Triage work order
 */
estateManagerAppRouter.post(
  '/work-orders/:id/triage',
  zValidator('json', triageWorkOrderSchema),
  async (c) => {
    const workOrderId = c.req.param('id');
    const auth = c.get('auth');
    const body = c.req.valid('json');

    return c.json({
      success: true,
      data: {
        id: workOrderId,
        status: body.requiresApproval ? 'pending_approval' : 'triaged',
        category: body.category,
        priority: body.priority,
        estimatedCost: body.estimatedCost,
        triagedBy: auth.userId,
        triagedAt: new Date().toISOString(),
      },
      message: body.requiresApproval
        ? 'Work order triaged and sent for approval.'
        : 'Work order triaged successfully.',
    });
  }
);

/**
 * POST /manager/work-orders/:id/approve - Approve work order
 */
estateManagerAppRouter.post(
  '/work-orders/:id/approve',
  requirePermission('work_orders:approve'),
  zValidator('json', approveWorkOrderSchema),
  async (c) => {
    const workOrderId = c.req.param('id');
    const auth = c.get('auth');
    const { approved, comments, budgetOverride } = c.req.valid('json');

    return c.json({
      success: true,
      data: {
        id: workOrderId,
        status: approved ? 'approved' : 'rejected',
        approvedBy: auth.userId,
        approvedAt: new Date().toISOString(),
        comments,
        budgetOverride,
      },
      message: approved ? 'Work order approved.' : 'Work order rejected.',
    });
  }
);

/**
 * POST /manager/work-orders/:id/assign - Assign vendor
 */
estateManagerAppRouter.post(
  '/work-orders/:id/assign',
  requirePermission('work_orders:assign'),
  zValidator('json', assignVendorSchema),
  async (c) => {
    const workOrderId = c.req.param('id');
    const auth = c.get('auth');
    const body = c.req.valid('json');

    return c.json({
      success: true,
      data: {
        id: workOrderId,
        status: 'assigned',
        vendorId: body.vendorId,
        assignedBy: auth.userId,
        assignedAt: new Date().toISOString(),
        overrideRecommendation: body.overrideRecommendation,
        overrideReason: body.overrideReason,
      },
      message: 'Vendor assigned. Notification sent.',
    });
  }
);

/**
 * POST /manager/work-orders/:id/schedule - Schedule work order
 */
estateManagerAppRouter.post(
  '/work-orders/:id/schedule',
  zValidator('json', scheduleWorkOrderSchema),
  async (c) => {
    const workOrderId = c.req.param('id');
    const auth = c.get('auth');
    const body = c.req.valid('json');

    return c.json({
      success: true,
      data: {
        id: workOrderId,
        status: 'scheduled',
        scheduledDate: body.scheduledDate,
        scheduledTimeSlot: body.scheduledTimeSlot,
        scheduledBy: auth.userId,
        scheduledAt: new Date().toISOString(),
      },
      message: body.notifyCustomer
        ? 'Work order scheduled. Customer notified.'
        : 'Work order scheduled.',
    });
  }
);

/**
 * POST /manager/work-orders/:id/complete - Complete work order
 */
estateManagerAppRouter.post(
  '/work-orders/:id/complete',
  zValidator('json', completeWorkOrderSchema),
  async (c) => {
    const workOrderId = c.req.param('id');
    const auth = c.get('auth');
    const body = c.req.valid('json');

    const totalMaterialsCost = body.materialsUsed?.reduce(
      (sum, m) => sum + m.quantity * m.unitCost,
      0
    ) || 0;

    return c.json({
      success: true,
      data: {
        id: workOrderId,
        status: 'pending_verification',
        completionNotes: body.completionNotes,
        laborHours: body.laborHours,
        materialsCost: totalMaterialsCost,
        totalCost: (body.laborHours || 0) * 50000 + totalMaterialsCost, // Example rate
        completedBy: auth.userId,
        completedAt: new Date().toISOString(),
        afterPhotos: body.afterPhotos,
        defectsReturned: body.defectsReturned,
        materialsUsed: body.materialsUsed,
      },
      message: 'Work order marked complete. Awaiting customer verification.',
    });
  }
);

/**
 * POST /manager/work-orders/:id/verify - Verify completion (dual sign-off)
 */
estateManagerAppRouter.post(
  '/work-orders/:id/verify',
  zValidator('json', z.object({
    verified: z.boolean(),
    customerSatisfied: z.boolean(),
    customerSignature: z.string().optional(),
    technicianSignature: z.string(),
    notes: z.string().max(1000).optional(),
    reopenReason: z.string().max(500).optional(),
  })),
  async (c) => {
    const workOrderId = c.req.param('id');
    const auth = c.get('auth');
    const body = c.req.valid('json');

    if (!body.verified || !body.customerSatisfied) {
      return c.json({
        success: true,
        data: {
          id: workOrderId,
          status: 'reopened',
          reopenedAt: new Date().toISOString(),
          reopenReason: body.reopenReason || 'Customer not satisfied',
        },
        message: 'Work order reopened for follow-up.',
      });
    }

    return c.json({
      success: true,
      data: {
        id: workOrderId,
        status: 'completed',
        verifiedBy: auth.userId,
        verifiedAt: new Date().toISOString(),
        customerSignature: body.customerSignature,
        technicianSignature: body.technicianSignature,
      },
      message: 'Work order completed with dual sign-off.',
    });
  }
);

// ============================================================================
// Inspection Workflows
// ============================================================================

/**
 * GET /manager/inspections - List inspections
 */
estateManagerAppRouter.get(
  '/inspections',
  zValidator('query', paginationSchema.merge(z.object({
    type: z.enum(['all', 'move_in', 'move_out', 'routine', 'maintenance']).optional().default('all'),
    status: z.enum(['all', 'scheduled', 'in_progress', 'completed', 'cancelled']).optional().default('all'),
    propertyId: z.string().optional(),
  }))),
  async (c) => {
    const { page, pageSize, type, status, propertyId } = c.req.valid('query');
    const dataService = getDataService();

    const result = await dataService.getInspections({ propertyId, type, status }, { page, pageSize });

    return c.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  }
);

/**
 * POST /manager/inspections - Schedule inspection
 */
estateManagerAppRouter.post(
  '/inspections',
  zValidator('json', inspectionSchema),
  async (c) => {
    const auth = c.get('auth');
    const body = c.req.valid('json');

    const inspection = {
      id: `insp_${Date.now()}`,
      ...body,
      status: 'scheduled',
      inspector: { id: auth.userId },
      createdAt: new Date().toISOString(),
    };

    return c.json({
      success: true,
      data: inspection,
      message: 'Inspection scheduled. Customer notified.',
    }, 201);
  }
);

/**
 * GET /manager/inspections/:id - Inspection details
 */
estateManagerAppRouter.get('/inspections/:id', async (c) => {
  const inspectionId = c.req.param('id');
  const dataService = getDataService();

  const inspection = await dataService.getInspectionById(inspectionId);
  if (!inspection) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Inspection not found' } }, 404);
  }

  return c.json({ success: true, data: inspection });
});

/**
 * POST /manager/inspections/:id/items - Record inspection item
 */
estateManagerAppRouter.post(
  '/inspections/:id/items',
  zValidator('json', inspectionItemSchema),
  async (c) => {
    const inspectionId = c.req.param('id');
    const auth = c.get('auth');
    const body = c.req.valid('json');

    const item = {
      id: `item_${Date.now()}`,
      inspectionId,
      ...body,
      recordedBy: auth.userId,
      recordedAt: new Date().toISOString(),
    };

    return c.json({ success: true, data: item });
  }
);

/**
 * POST /manager/inspections/:id/complete - Complete inspection
 */
estateManagerAppRouter.post(
  '/inspections/:id/complete',
  zValidator('json', z.object({
    meterReadings: z.object({
      electricity: z.number().optional(),
      water: z.number().optional(),
    }),
    keysHanded: z.record(z.boolean()),
    customerSignature: z.string(),
    inspectorSignature: z.string(),
    overallCondition: z.enum(['excellent', 'good', 'fair', 'poor']),
    notes: z.string().max(2000).optional(),
    followUpRequired: z.boolean().default(false),
    followUpItems: z.array(z.string()).optional(),
  })),
  async (c) => {
    const inspectionId = c.req.param('id');
    const auth = c.get('auth');
    const body = c.req.valid('json');

    return c.json({
      success: true,
      data: {
        id: inspectionId,
        status: 'completed',
        completedAt: new Date().toISOString(),
        completedBy: auth.userId,
        ...body,
        reportUrl: `/api/manager/inspections/${inspectionId}/report`,
      },
      message: 'Inspection completed. Report generated.',
    });
  }
);

// ============================================================================
// Occupancy Operations
// ============================================================================

/**
 * GET /manager/occupancy - Occupancy dashboard
 */
estateManagerAppRouter.get(
  '/occupancy',
  zValidator('query', z.object({ propertyId: z.string().optional() })),
  async (c) => {
    const { propertyId } = c.req.valid('query');
    const dataService = getDataService();

    const occupancy = await dataService.getOccupancySummary(propertyId);

    return c.json({ success: true, data: occupancy });
  }
);

/**
 * PUT /manager/units/:id/status - Update unit status
 */
estateManagerAppRouter.put(
  '/units/:id/status',
  zValidator('json', z.object({
    status: z.enum(['occupied', 'vacant', 'turnover', 'maintenance', 'reserved']),
    notes: z.string().max(500).optional(),
  })),
  async (c) => {
    const unitId = c.req.param('id');
    const auth = c.get('auth');
    const body = c.req.valid('json');

    return c.json({
      success: true,
      data: {
        id: unitId,
        status: body.status,
        updatedBy: auth.userId,
        updatedAt: new Date().toISOString(),
      },
    });
  }
);

// ============================================================================
// Collections Workflows
// ============================================================================

/**
 * GET /manager/collections - Arrears and collections dashboard
 */
estateManagerAppRouter.get(
  '/collections',
  zValidator('query', paginationSchema.merge(z.object({
    propertyId: z.string().optional(),
    minDaysOverdue: z.coerce.number().int().min(0).optional(),
  }))),
  async (c) => {
    const { page, pageSize, propertyId, minDaysOverdue } = c.req.valid('query');
    const dataService = getDataService();

    const collections = await dataService.getCollections({ page, pageSize }, propertyId);

    return c.json({
      success: true,
      data: collections,
      pagination: { page, pageSize, total: 0, totalPages: 0 },
    });
  }
);

/**
 * POST /manager/collections/action - Take collection action
 */
estateManagerAppRouter.post(
  '/collections/action',
  zValidator('json', collectionActionSchema),
  async (c) => {
    const auth = c.get('auth');
    const body = c.req.valid('json');

    let result: Record<string, unknown> = {
      actionId: `col_${Date.now()}`,
      customerId: body.customerId,
      actionType: body.actionType,
      executedBy: auth.userId,
      executedAt: new Date().toISOString(),
    };

    switch (body.actionType) {
      case 'reminder':
        result.message = 'Reminder sent via WhatsApp.';
        break;
      case 'payment_plan':
        result = {
          ...result,
          paymentPlan: body.paymentPlan,
          status: 'pending_approval',
          message: 'Payment plan submitted for approval.',
        };
        break;
      case 'escalate':
        result.message = 'Escalated to legal team.';
        break;
      case 'waive_fee':
        result = {
          ...result,
          waiverAmount: body.waiverAmount,
          status: auth.role === 'TENANT_ADMIN' ? 'approved' : 'pending_approval',
          message: auth.role === 'TENANT_ADMIN' ? 'Fee waived.' : 'Waiver submitted for approval.',
        };
        break;
      case 'legal_notice':
        result = {
          ...result,
          status: 'pending_approval',
          message: 'Legal notice drafted. Requires approval before sending.',
        };
        break;
    }

    return c.json({ success: true, data: result });
  }
);

// ============================================================================
// Vendor Coordination
// ============================================================================

/**
 * GET /manager/vendors - Vendor list with performance
 */
estateManagerAppRouter.get(
  '/vendors',
  zValidator('query', paginationSchema.merge(z.object({
    specialization: z.string().optional(),
    status: z.enum(['all', 'active', 'probation', 'suspended']).optional().default('active'),
  }))),
  async (c) => {
    const { page, pageSize, specialization, status } = c.req.valid('query');
    const dataService = getDataService();

    const result = await dataService.getVendors({ page, pageSize }, { specialization, status });

    return c.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  }
);

/**
 * GET /manager/vendors/:id/scorecard - Vendor performance scorecard
 */
estateManagerAppRouter.get('/vendors/:id/scorecard', async (c) => {
  const vendorId = c.req.param('id');
  const dataService = getDataService();

  const scorecard = await dataService.getVendorScorecard(vendorId);
  if (!scorecard) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Vendor not found' } }, 404);
  }

  return c.json({ success: true, data: scorecard });
});

/**
 * POST /manager/vendors/:id/invoices/:invoiceId/approve - Approve vendor invoice
 */
estateManagerAppRouter.post(
  '/vendors/:id/invoices/:invoiceId/approve',
  zValidator('json', vendorInvoiceApprovalSchema),
  async (c) => {
    const vendorId = c.req.param('id');
    const invoiceId = c.req.param('invoiceId');
    const auth = c.get('auth');
    const body = c.req.valid('json');

    return c.json({
      success: true,
      data: {
        vendorId,
        invoiceId,
        status: body.approved ? 'approved' : 'rejected',
        adjustedAmount: body.adjustedAmount,
        approvedBy: auth.userId,
        approvedAt: new Date().toISOString(),
        flaggedForReview: body.flagForReview,
        flagReason: body.flagReason,
      },
      message: body.approved
        ? 'Invoice approved for payment.'
        : 'Invoice rejected.',
    });
  }
);

/**
 * POST /manager/vendors/:id/flag - Flag vendor for review
 */
estateManagerAppRouter.post(
  '/vendors/:id/flag',
  zValidator('json', z.object({
    reason: z.enum(['quality', 'pricing', 'conduct', 'availability', 'other']),
    description: z.string().min(10).max(1000),
    workOrderId: z.string().optional(),
    severity: z.enum(['minor', 'moderate', 'severe']),
  })),
  async (c) => {
    const vendorId = c.req.param('id');
    const auth = c.get('auth');
    const body = c.req.valid('json');

    return c.json({
      success: true,
      data: {
        flagId: `flag_${Date.now()}`,
        vendorId,
        ...body,
        flaggedBy: auth.userId,
        flaggedAt: new Date().toISOString(),
        status: 'under_review',
      },
      message: 'Vendor flagged for review.',
    });
  }
);

// ============================================================================
// SLA Dashboard
// ============================================================================

/**
 * GET /manager/sla - SLA compliance dashboard
 */
estateManagerAppRouter.get('/sla', async (c) => {
  const dataService = getDataService();
  const sla = await dataService.getSlaMetrics();

  return c.json({ success: true, data: sla });
});

// ============================================================================
// Helpers
// ============================================================================

function getTimeBasedGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default estateManagerAppRouter;
