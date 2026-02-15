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

  const home = {
    greeting: getTimeBasedGreeting(),
    manager: {
      id: auth.userId,
      name: 'Alice Manager',
      properties: ['Masaki Heights', 'Oyster Bay Apartments'],
    },
    todaySummary: {
      scheduledInspections: 2,
      openWorkOrders: 15,
      urgentWorkOrders: 3,
      slaAtRisk: 2,
      collectionsFollowUp: 5,
      vendorVisitsExpected: 4,
    },
    quickActions: [
      { id: 'new_work_order', label: 'New Work Order', icon: 'wrench' },
      { id: 'start_inspection', label: 'Start Inspection', icon: 'clipboard' },
      { id: 'view_arrears', label: 'View Arrears', icon: 'alert' },
      { id: 'contact_vendor', label: 'Contact Vendor', icon: 'phone' },
    ],
    alerts: [
      { id: 'alert-1', type: 'sla_breach', priority: 'high', message: 'WO-2024-0150: SLA breach in 2 hours', actionUrl: '/manager/work-orders/wo-001' },
      { id: 'alert-2', type: 'payment_overdue', priority: 'medium', message: '3 tenants 15+ days overdue', actionUrl: '/manager/collections' },
    ],
    recentActivity: [
      { type: 'work_order', description: 'WO-2024-0155 completed - Electrical repair', timestamp: new Date(Date.now() - 3600000).toISOString() },
      { type: 'inspection', description: 'Move-in inspection Unit B5 completed', timestamp: new Date(Date.now() - 7200000).toISOString() },
      { type: 'collection', description: 'Payment plan approved for John Doe', timestamp: new Date(Date.now() - 14400000).toISOString() },
    ],
    dailyBriefing: {
      available: true,
      lastGenerated: new Date().toISOString(),
      url: '/manager/briefing',
    },
  };

  return c.json({ success: true, data: home });
});

/**
 * GET /manager/briefing - Morning briefing
 */
estateManagerAppRouter.get('/briefing', async (c) => {
  const briefing = {
    date: new Date().toISOString().split('T')[0],
    generatedAt: new Date().toISOString(),
    summary: {
      headline: 'Good morning! Here is your daily briefing.',
      keyMetrics: {
        occupancyRate: { value: 0.92, change: 0.01, trend: 'up' },
        collectionRate: { value: 0.89, change: -0.02, trend: 'down' },
        openWorkOrders: { value: 15, change: 3, trend: 'up' },
        avgResolutionDays: { value: 2.3, change: -0.2, trend: 'down' },
      },
    },
    urgentItems: [
      {
        type: 'work_order',
        id: 'wo-001',
        title: 'Water leak - Unit A3',
        priority: 'emergency',
        detail: 'Submitted 2 hours ago. Customer reports water damage.',
        suggestedAction: 'Assign to ABC Plumbing immediately',
      },
      {
        type: 'payment',
        id: 'arr-001',
        title: 'Arrears: Jane Smith - Unit B2',
        priority: 'high',
        detail: '25 days overdue. TSh 1,600,000 outstanding.',
        suggestedAction: 'Contact for payment plan or escalate',
      },
    ],
    scheduledToday: [
      { time: '09:00', type: 'inspection', description: 'Move-in inspection - Unit C1', customer: 'New Tenant' },
      { time: '11:00', type: 'vendor_visit', description: 'AC servicing - Block A', vendor: 'Cool Air Services' },
      { time: '14:00', type: 'inspection', description: 'Routine inspection - Unit A5', customer: 'John Doe' },
    ],
    expiringSoon: {
      leases: [
        { customerId: 'cust-001', name: 'Mary Johnson', unit: 'A2', expiresIn: 30, renewalStatus: 'pending' },
        { customerId: 'cust-002', name: 'Peter Mwangi', unit: 'B4', expiresIn: 45, renewalStatus: 'not_started' },
      ],
      documents: [
        { type: 'insurance', vendorName: 'ABC Plumbing', expiresIn: 14 },
      ],
    },
    vendorPerformance: {
      topPerformer: { name: 'ABC Plumbing', score: 4.8, completedThisWeek: 5 },
      needsAttention: { name: 'XYZ Electrical', score: 3.2, reopenRate: 0.25 },
    },
    aiInsights: [
      {
        type: 'churn_risk',
        message: 'Unit A5 tenant showing elevated churn risk (72%). Consider proactive engagement.',
        confidence: 0.72,
      },
      {
        type: 'maintenance_prediction',
        message: 'Block B water pump likely to need service within 30 days based on usage patterns.',
        confidence: 0.68,
      },
    ],
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

    const workOrders = [
      {
        id: 'wo-001',
        number: 'WO-2024-0150',
        property: { id: 'prop-001', name: 'Masaki Heights' },
        unit: { id: 'unit-003', number: 'A3' },
        customer: { id: 'cust-001', name: 'Jane Smith', phone: '+255700000010' },
        category: 'plumbing',
        priority: 'high',
        title: 'Water leak in bathroom',
        description: 'Water leak under bathroom sink causing damage',
        status: 'assigned',
        sla: {
          responseDue: new Date(Date.now() + 7200000).toISOString(),
          resolutionDue: new Date(Date.now() + 86400000).toISOString(),
          responseBreached: false,
          resolutionBreached: false,
        },
        vendor: { id: 'vendor-001', name: 'ABC Plumbing', phone: '+255700000020' },
        estimatedCost: 250000,
        createdAt: '2024-02-28T10:00:00Z',
        updatedAt: '2024-02-28T14:00:00Z',
      },
      {
        id: 'wo-002',
        number: 'WO-2024-0151',
        property: { id: 'prop-001', name: 'Masaki Heights' },
        unit: { id: 'unit-005', number: 'B2' },
        customer: { id: 'cust-002', name: 'John Doe', phone: '+255700000011' },
        category: 'electrical',
        priority: 'medium',
        title: 'AC not cooling properly',
        description: 'Air conditioning unit not cooling',
        status: 'scheduled',
        sla: {
          responseDue: new Date(Date.now() + 86400000).toISOString(),
          resolutionDue: new Date(Date.now() + 172800000).toISOString(),
          responseBreached: false,
          resolutionBreached: false,
        },
        vendor: { id: 'vendor-002', name: 'Cool Air Services', phone: '+255700000021' },
        estimatedCost: 150000,
        scheduledDate: '2024-03-01',
        scheduledTime: '14:00-16:00',
        createdAt: '2024-02-27T14:30:00Z',
        updatedAt: '2024-02-28T09:00:00Z',
      },
    ];

    return c.json({
      success: true,
      data: workOrders,
      pagination: { page, pageSize, total: workOrders.length, totalPages: 1 },
      summary: {
        total: 15,
        byStatus: {
          submitted: 2,
          triaged: 1,
          pending_approval: 2,
          approved: 1,
          assigned: 3,
          scheduled: 2,
          in_progress: 2,
          pending_verification: 1,
          completed: 1,
        },
        byPriority: { emergency: 1, high: 4, medium: 8, low: 2 },
        slaAtRisk: 2,
      },
    });
  }
);

/**
 * GET /manager/work-orders/:id - Work order details
 */
estateManagerAppRouter.get('/work-orders/:id', async (c) => {
  const workOrderId = c.req.param('id');

  const workOrder = {
    id: workOrderId,
    number: 'WO-2024-0150',
    property: {
      id: 'prop-001',
      name: 'Masaki Heights',
      address: 'Plot 123, Masaki, Dar es Salaam',
    },
    unit: {
      id: 'unit-003',
      number: 'A3',
      type: '2 Bedroom',
      floor: 1,
    },
    customer: {
      id: 'cust-001',
      name: 'Jane Smith',
      phone: '+255700000010',
      email: 'jane@example.com',
      permissionToEnter: true,
      entryInstructions: 'Key with security guard',
    },
    category: 'plumbing',
    priority: 'high',
    source: 'customer_app',
    title: 'Water leak in bathroom',
    description: 'Water leak under bathroom sink causing damage. Water is pooling on the floor.',
    location: 'Bathroom - under sink',
    status: 'assigned',
    sla: {
      submittedAt: '2024-02-28T10:00:00Z',
      responseDue: new Date(Date.now() + 7200000).toISOString(),
      resolutionDue: new Date(Date.now() + 86400000).toISOString(),
      responseBreached: false,
      resolutionBreached: false,
      pausedAt: null,
    },
    triage: {
      triagerdBy: 'system',
      triageMethod: 'ai',
      originalCategory: 'plumbing',
      originalPriority: 'high',
      confidence: 0.92,
      triageNotes: 'AI triage: Water leak detected. High priority due to potential water damage.',
    },
    vendor: {
      id: 'vendor-001',
      name: 'ABC Plumbing',
      phone: '+255700000020',
      email: 'contact@abcplumbing.co.tz',
      rating: 4.5,
      completedJobs: 45,
      avgResponseTime: '2 hours',
    },
    vendorRecommendations: [
      { vendorId: 'vendor-001', name: 'ABC Plumbing', score: 0.92, reason: 'Highest rated, fastest response' },
      { vendorId: 'vendor-003', name: 'Quick Fix Plumbing', score: 0.78, reason: 'Good rating, available now' },
    ],
    costs: {
      estimated: 250000,
      quoted: null,
      actual: null,
      laborHours: null,
      materialsCost: null,
    },
    timeline: [
      { status: 'submitted', timestamp: '2024-02-28T10:00:00Z', actor: 'Jane Smith (Customer)', notes: null },
      { status: 'triaged', timestamp: '2024-02-28T10:05:00Z', actor: 'System (AI)', notes: 'Category: plumbing, Priority: high' },
      { status: 'pending_approval', timestamp: '2024-02-28T10:10:00Z', actor: 'System', notes: 'Requires approval - estimated cost > threshold' },
      { status: 'approved', timestamp: '2024-02-28T11:00:00Z', actor: 'Alice Manager', notes: 'Approved for immediate dispatch' },
      { status: 'assigned', timestamp: '2024-02-28T11:30:00Z', actor: 'Alice Manager', notes: 'Assigned to ABC Plumbing' },
    ],
    attachments: [
      { id: 'att-001', type: 'image', url: '/attachments/wo-001-1.jpg', description: 'Photo of leak', uploadedBy: 'customer', uploadedAt: '2024-02-28T10:00:00Z' },
      { id: 'att-002', type: 'image', url: '/attachments/wo-001-2.jpg', description: 'Water damage', uploadedBy: 'customer', uploadedAt: '2024-02-28T10:00:00Z' },
    ],
    communications: [
      { type: 'notification', to: 'customer', message: 'Work order received', timestamp: '2024-02-28T10:00:00Z', status: 'delivered' },
      { type: 'notification', to: 'vendor', message: 'New assignment', timestamp: '2024-02-28T11:30:00Z', status: 'delivered' },
    ],
    availableActions: ['schedule', 'reassign', 'contact_customer', 'contact_vendor', 'add_note', 'cancel'],
  };

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

    const inspections = [
      {
        id: 'insp-001',
        type: 'move_in',
        property: { id: 'prop-001', name: 'Masaki Heights' },
        unit: { id: 'unit-010', number: 'C1' },
        customer: { id: 'cust-new', name: 'New Tenant', phone: '+255700000030' },
        status: 'scheduled',
        scheduledDate: new Date().toISOString().split('T')[0],
        scheduledTime: '09:00',
        inspector: { id: 'usr-001', name: 'Alice Manager' },
        createdAt: '2024-02-27T10:00:00Z',
      },
      {
        id: 'insp-002',
        type: 'routine',
        property: { id: 'prop-001', name: 'Masaki Heights' },
        unit: { id: 'unit-005', number: 'A5' },
        customer: { id: 'cust-001', name: 'John Doe', phone: '+255700000010' },
        status: 'scheduled',
        scheduledDate: new Date().toISOString().split('T')[0],
        scheduledTime: '14:00',
        inspector: { id: 'usr-001', name: 'Alice Manager' },
        createdAt: '2024-02-26T14:00:00Z',
      },
    ];

    return c.json({
      success: true,
      data: inspections,
      pagination: { page, pageSize, total: inspections.length, totalPages: 1 },
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

  const inspection = {
    id: inspectionId,
    type: 'move_in',
    property: { id: 'prop-001', name: 'Masaki Heights', address: 'Plot 123, Masaki' },
    unit: { id: 'unit-010', number: 'C1', type: '2 Bedroom', floor: 3 },
    customer: { id: 'cust-new', name: 'New Tenant', phone: '+255700000030', email: 'new@example.com' },
    status: 'in_progress',
    scheduledDate: new Date().toISOString().split('T')[0],
    scheduledTime: '09:00',
    inspector: { id: 'usr-001', name: 'Alice Manager' },
    checklist: {
      rooms: ['Living Room', 'Bedroom 1', 'Bedroom 2', 'Kitchen', 'Bathroom 1', 'Bathroom 2', 'Balcony'],
      itemsPerRoom: ['Walls', 'Floor', 'Ceiling', 'Windows', 'Doors', 'Electrical Outlets', 'Light Fixtures'],
      additionalItems: ['Water Heater', 'AC Unit', 'Kitchen Appliances', 'Smoke Detectors'],
    },
    meterReadings: {
      electricity: { meterId: 'LUKU-12345', required: true, reading: null },
      water: { meterId: 'WTR-C1-2024', required: true, reading: null },
    },
    keysHandover: {
      mainDoor: { quantity: 2, handed: false },
      backDoor: { quantity: 1, handed: false },
      mailbox: { quantity: 1, handed: false },
      remote: { quantity: 1, handed: false },
    },
    completedItems: [],
    baselineComparison: null, // For move_out, this would have move_in data
    createdAt: '2024-02-27T10:00:00Z',
    startedAt: new Date().toISOString(),
  };

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

    const occupancy = {
      summary: {
        totalUnits: 48,
        occupied: 44,
        vacant: 3,
        turnover: 1,
        occupancyRate: 0.917,
      },
      byProperty: [
        {
          propertyId: 'prop-001',
          propertyName: 'Masaki Heights',
          totalUnits: 24,
          occupied: 22,
          vacant: 1,
          turnover: 1,
          occupancyRate: 0.917,
        },
        {
          propertyId: 'prop-002',
          propertyName: 'Oyster Bay Apartments',
          totalUnits: 24,
          occupied: 22,
          vacant: 2,
          turnover: 0,
          occupancyRate: 0.917,
        },
      ],
      units: [
        {
          id: 'unit-003',
          number: 'A3',
          property: 'Masaki Heights',
          type: '2 Bedroom',
          status: 'occupied',
          customer: { id: 'cust-001', name: 'Jane Smith' },
          leaseEnd: '2024-06-30',
          rentAmount: 800000,
          paymentStatus: 'current',
        },
        {
          id: 'unit-008',
          number: 'B5',
          property: 'Masaki Heights',
          type: 'Studio',
          status: 'vacant',
          customer: null,
          availableFrom: '2024-03-01',
          rentAmount: 450000,
          daysVacant: 5,
        },
        {
          id: 'unit-012',
          number: 'C2',
          property: 'Masaki Heights',
          type: '1 Bedroom',
          status: 'turnover',
          customer: null,
          previousCustomer: 'John Former',
          expectedReady: '2024-03-05',
          turnoverProgress: 60,
          pendingItems: ['Deep cleaning', 'Paint touch-up'],
        },
      ],
    };

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

    const collections = {
      summary: {
        totalOutstanding: 8500000,
        tenantsInArrears: 12,
        percentageOfRentRoll: 0.11,
      },
      byAgingBucket: {
        '0-7': { count: 3, amount: 1200000 },
        '8-14': { count: 2, amount: 1600000 },
        '15-30': { count: 4, amount: 2800000 },
        '31-60': { count: 2, amount: 1900000 },
        '60+': { count: 1, amount: 1000000 },
      },
      accounts: [
        {
          customerId: 'cust-005',
          name: 'Peter Mwangi',
          unit: 'B4',
          property: 'Masaki Heights',
          phone: '+255700000015',
          amountOwed: 1600000,
          daysOverdue: 25,
          lastPayment: { date: '2024-01-15', amount: 800000 },
          paymentHistory: { onTimePercentage: 0.65, avgDaysLate: 8 },
          riskScore: 0.72,
          status: 'active_collection',
          lastContact: '2024-02-20',
          notes: 'Promised payment by month end',
          suggestedAction: 'Follow up on promise',
        },
        {
          customerId: 'cust-008',
          name: 'Mary Johnson',
          unit: 'A6',
          property: 'Masaki Heights',
          phone: '+255700000018',
          amountOwed: 2400000,
          daysOverdue: 45,
          lastPayment: { date: '2023-12-15', amount: 800000 },
          paymentHistory: { onTimePercentage: 0.45, avgDaysLate: 15 },
          riskScore: 0.85,
          status: 'payment_plan',
          paymentPlan: {
            totalAmount: 2400000,
            installments: 3,
            paidInstallments: 1,
            nextDue: '2024-03-15',
            nextAmount: 800000,
          },
          lastContact: '2024-02-25',
          notes: 'On payment plan, 1 of 3 paid',
          suggestedAction: 'Monitor payment plan compliance',
        },
      ],
    };

    return c.json({
      success: true,
      data: collections,
      pagination: { page, pageSize, total: 12, totalPages: 1 },
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

    const vendors = [
      {
        id: 'vendor-001',
        name: 'ABC Plumbing',
        specializations: ['plumbing'],
        status: 'active',
        contact: { phone: '+255700000020', email: 'contact@abcplumbing.co.tz' },
        performance: {
          rating: 4.5,
          completedJobs: 45,
          avgResponseTime: '2 hours',
          reopenRate: 0.05,
          onTimeCompletion: 0.92,
        },
        rates: {
          calloutFee: 50000,
          hourlyRate: 35000,
        },
        isPreferred: true,
        emergencyAvailable: true,
        activeWorkOrders: 3,
      },
      {
        id: 'vendor-002',
        name: 'Cool Air Services',
        specializations: ['hvac', 'electrical'],
        status: 'active',
        contact: { phone: '+255700000021', email: 'info@coolair.co.tz' },
        performance: {
          rating: 4.2,
          completedJobs: 32,
          avgResponseTime: '4 hours',
          reopenRate: 0.08,
          onTimeCompletion: 0.88,
        },
        rates: {
          calloutFee: 60000,
          hourlyRate: 40000,
        },
        isPreferred: false,
        emergencyAvailable: true,
        activeWorkOrders: 2,
      },
    ];

    return c.json({
      success: true,
      data: vendors,
      pagination: { page, pageSize, total: vendors.length, totalPages: 1 },
    });
  }
);

/**
 * GET /manager/vendors/:id/scorecard - Vendor performance scorecard
 */
estateManagerAppRouter.get('/vendors/:id/scorecard', async (c) => {
  const vendorId = c.req.param('id');

  const scorecard = {
    vendorId,
    vendorName: 'ABC Plumbing',
    period: '2024-Q1',
    overallScore: 4.5,
    metrics: {
      responseTime: { score: 4.8, benchmark: 4.0, percentile: 92 },
      completionRate: { score: 4.6, benchmark: 4.2, percentile: 85 },
      customerSatisfaction: { score: 4.3, benchmark: 4.0, percentile: 78 },
      reopenRate: { score: 4.7, benchmark: 4.0, percentile: 88 },
      costEfficiency: { score: 4.2, benchmark: 4.0, percentile: 72 },
    },
    trends: [
      { month: '2024-01', score: 4.3 },
      { month: '2024-02', score: 4.5 },
      { month: '2024-03', score: 4.5 },
    ],
    recentJobs: [
      { id: 'wo-001', title: 'Water leak repair', rating: 5, completedAt: '2024-02-28' },
      { id: 'wo-002', title: 'Pipe replacement', rating: 4, completedAt: '2024-02-25' },
    ],
    issues: [],
    recommendations: ['Maintain current performance levels', 'Consider for emergency priority list'],
  };

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
  const sla = {
    summary: {
      responseCompliance: 0.94,
      resolutionCompliance: 0.89,
      atRiskCount: 2,
      breachedCount: 1,
    },
    byCategory: [
      { category: 'emergency', responseTarget: '1h', resolutionTarget: '4h', compliance: 0.95 },
      { category: 'high', responseTarget: '4h', resolutionTarget: '24h', compliance: 0.92 },
      { category: 'medium', responseTarget: '24h', resolutionTarget: '72h', compliance: 0.90 },
      { category: 'low', responseTarget: '48h', resolutionTarget: '7d', compliance: 0.88 },
    ],
    atRisk: [
      {
        workOrderId: 'wo-001',
        number: 'WO-2024-0150',
        title: 'Water leak',
        slaType: 'resolution',
        timeRemaining: '2 hours',
        priority: 'high',
        vendor: 'ABC Plumbing',
      },
      {
        workOrderId: 'wo-003',
        number: 'WO-2024-0152',
        title: 'AC repair',
        slaType: 'response',
        timeRemaining: '30 minutes',
        priority: 'medium',
        vendor: 'Unassigned',
      },
    ],
    breached: [
      {
        workOrderId: 'wo-005',
        number: 'WO-2024-0148',
        title: 'Lock replacement',
        slaType: 'resolution',
        breachedBy: '4 hours',
        priority: 'medium',
        vendor: 'Quick Fix Security',
        reason: 'Parts unavailable',
      },
    ],
    trends: [
      { week: 'W1', compliance: 0.92 },
      { week: 'W2', compliance: 0.89 },
      { week: 'W3', compliance: 0.91 },
      { week: 'W4', compliance: 0.94 },
    ],
  };

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
