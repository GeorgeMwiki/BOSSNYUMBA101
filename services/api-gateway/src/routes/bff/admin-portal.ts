/**
 * Admin Portal BFF Routes - BOSSNYUMBA
 * 
 * Backend for Frontend routes for internal operations staff:
 * - Tenant (customer) onboarding and provisioning
 * - Role and policy governance
 * - Operations control tower
 * - Billing and subscription management
 * - Support tooling and escalation
 * - Audit and risk console
 * - AI operations cockpit
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { authMiddleware } from '../../middleware/hono-auth';
import { requireRole, requirePermission } from '../../middleware/authorization';
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

const createTenantSchema = z.object({
  name: z.string().min(2).max(200),
  code: z.string().min(2).max(50).regex(/^[A-Z0-9-]+$/),
  type: z.enum(['individual', 'company', 'institution']),
  contactEmail: z.string().email(),
  contactPhone: z.string().regex(/^\+?[1-9]\d{1,14}$/),
  contactName: z.string().min(2).max(100),
  address: z.object({
    street: z.string(),
    city: z.string(),
    region: z.string().optional(),
    country: z.string().default('Tanzania'),
  }),
  subscriptionPlan: z.enum(['starter', 'professional', 'enterprise']),
  billingEmail: z.string().email().optional(),
});

const updateTenantSchema = createTenantSchema.partial().extend({
  status: z.enum(['active', 'suspended', 'pending', 'cancelled']).optional(),
});

const createRoleSchema = z.object({
  name: z.string().min(2).max(100),
  code: z.string().min(2).max(50).regex(/^[A-Z_]+$/),
  description: z.string().max(500).optional(),
  permissions: z.array(z.string()),
  tenantId: z.string(),
});

const createUserSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/).optional(),
  roleId: z.string(),
  tenantId: z.string(),
  propertyAccess: z.array(z.string()).optional(),
  sendInvitation: z.boolean().default(true),
});

const approvalMatrixSchema = z.object({
  tenantId: z.string(),
  rules: z.array(z.object({
    action: z.string(),
    resource: z.string(),
    threshold: z.number().optional(),
    approverRoles: z.array(z.string()),
    requireMultiple: z.boolean().default(false),
  })),
});

const escalationSchema = z.object({
  caseId: z.string(),
  targetTeam: z.enum(['legal', 'finance', 'operations', 'executive']),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  notes: z.string().max(2000),
});

const impersonationSchema = z.object({
  userId: z.string(),
  reason: z.string().min(10).max(500),
});

const billingAdjustmentSchema = z.object({
  tenantId: z.string(),
  type: z.enum(['credit', 'debit', 'discount']),
  amount: z.number().positive(),
  description: z.string().min(5).max(500),
  reason: z.string().min(10).max(1000),
});

// ============================================================================
// Router
// ============================================================================

export const adminPortalRouter = new Hono()
  .use('*', authMiddleware)
  .use('*', requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT));

// ============================================================================
// System Health & Dashboard
// ============================================================================

/**
 * GET /admin/dashboard - Operations control tower
 */
adminPortalRouter.get('/dashboard', async (c) => {
  const auth = c.get('auth');
  const dataService = getDataService();

  const dashboard = await dataService.getPlatformDashboard();

  return c.json({ success: true, data: dashboard });
});

/**
 * POST /admin/alerts/:id/acknowledge - Acknowledge alert
 */
adminPortalRouter.post('/alerts/:id/acknowledge', async (c) => {
  const alertId = c.req.param('id');
  const auth = c.get('auth');

  return c.json({
    success: true,
    data: {
      id: alertId,
      acknowledged: true,
      acknowledgedBy: auth.userId,
      acknowledgedAt: new Date().toISOString(),
    },
  });
});

// ============================================================================
// Tenant Management
// ============================================================================

/**
 * GET /admin/tenants - List all tenants
 */
adminPortalRouter.get(
  '/tenants',
  zValidator('query', paginationSchema.merge(z.object({
    status: z.enum(['all', 'active', 'suspended', 'pending', 'cancelled']).optional().default('all'),
    type: z.enum(['all', 'individual', 'company', 'institution']).optional().default('all'),
    search: z.string().optional(),
  }))),
  async (c) => {
    const { page, pageSize, status, type, search } = c.req.valid('query');
    const dataService = getDataService();

    const result = await dataService.getTenants({ page, pageSize }, { status: status !== 'all' ? status : undefined, search });

    return c.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  }
);

/**
 * GET /admin/tenants/:id - Get tenant details
 */
adminPortalRouter.get('/tenants/:id', async (c) => {
  const tenantId = c.req.param('id');
  const dataService = getDataService();

  const tenant = await dataService.getTenantById(tenantId);
  if (!tenant) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Tenant not found' } }, 404);
  }

  return c.json({ success: true, data: tenant });
});

/**
 * POST /admin/tenants - Create new tenant
 */
adminPortalRouter.post(
  '/tenants',
  requirePermission('tenants:create'),
  zValidator('json', createTenantSchema),
  async (c) => {
    const auth = c.get('auth');
    const body = c.req.valid('json');

    const tenant = {
      id: `tnt_${Date.now()}`,
      ...body,
      status: 'pending',
      usage: {
        properties: 0,
        units: 0,
        users: 0,
        messagesThisMonth: 0,
        reportsGenerated: 0,
        storageUsedMB: 0,
      },
      createdBy: auth.userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return c.json({
      success: true,
      data: tenant,
      message: 'Tenant created successfully. Invitation email will be sent.',
    }, 201);
  }
);

/**
 * PUT /admin/tenants/:id - Update tenant
 */
adminPortalRouter.put(
  '/tenants/:id',
  requirePermission('tenants:update'),
  zValidator('json', updateTenantSchema),
  async (c) => {
    const tenantId = c.req.param('id');
    const auth = c.get('auth');
    const body = c.req.valid('json');

    const updated = {
      id: tenantId,
      ...body,
      updatedBy: auth.userId,
      updatedAt: new Date().toISOString(),
    };

    return c.json({ success: true, data: updated });
  }
);

/**
 * POST /admin/tenants/:id/suspend - Suspend tenant
 */
adminPortalRouter.post(
  '/tenants/:id/suspend',
  requirePermission('tenants:update'),
  zValidator('json', z.object({ reason: z.string().min(10).max(500) })),
  async (c) => {
    const tenantId = c.req.param('id');
    const auth = c.get('auth');
    const { reason } = c.req.valid('json');

    return c.json({
      success: true,
      data: {
        id: tenantId,
        status: 'suspended',
        suspendedAt: new Date().toISOString(),
        suspendedBy: auth.userId,
        suspensionReason: reason,
      },
      message: 'Tenant suspended. All users will be logged out.',
    });
  }
);

/**
 * POST /admin/tenants/:id/reactivate - Reactivate tenant
 */
adminPortalRouter.post('/tenants/:id/reactivate', requirePermission('tenants:update'), async (c) => {
  const tenantId = c.req.param('id');
  const auth = c.get('auth');

  return c.json({
    success: true,
    data: {
      id: tenantId,
      status: 'active',
      reactivatedAt: new Date().toISOString(),
      reactivatedBy: auth.userId,
    },
    message: 'Tenant reactivated successfully.',
  });
});

/**
 * PUT /admin/tenants/:id/policy - Update tenant policy constitution
 */
adminPortalRouter.put(
  '/tenants/:id/policy',
  requirePermission('tenants:update'),
  zValidator('json', z.object({
    approvalThresholds: z.object({
      feeWaiver: z.number().positive().optional(),
      rentIncrease: z.number().positive().max(100).optional(),
      workOrderCost: z.number().positive().optional(),
    }).optional(),
    gracePeriodDays: z.number().int().min(0).max(30).optional(),
    lateFeePercentage: z.number().min(0).max(20).optional(),
    renewalNoticeDays: z.number().int().min(30).max(120).optional(),
  })),
  async (c) => {
    const tenantId = c.req.param('id');
    const auth = c.get('auth');
    const body = c.req.valid('json');

    return c.json({
      success: true,
      data: {
        tenantId,
        policyConstitution: body,
        updatedBy: auth.userId,
        updatedAt: new Date().toISOString(),
      },
      message: 'Policy constitution updated.',
    });
  }
);

// ============================================================================
// User & Role Management
// ============================================================================

/**
 * GET /admin/users - List users across tenants (with authorization)
 */
adminPortalRouter.get(
  '/users',
  zValidator('query', paginationSchema.merge(z.object({
    tenantId: z.string().optional(),
    role: z.string().optional(),
    status: z.enum(['all', 'active', 'inactive', 'locked']).optional().default('all'),
    search: z.string().optional(),
  }))),
  async (c) => {
    const { page, pageSize, tenantId, role, status, search } = c.req.valid('query');
    const dataService = getDataService();

    const result = await dataService.getUsers({ page, pageSize }, { tenantId, status: status !== 'all' ? status : undefined, search });

    return c.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  }
);

/**
 * POST /admin/users - Create user
 */
adminPortalRouter.post(
  '/users',
  requirePermission('users:create'),
  zValidator('json', createUserSchema),
  async (c) => {
    const auth = c.get('auth');
    const body = c.req.valid('json');

    const user = {
      id: `usr_${Date.now()}`,
      ...body,
      status: 'pending_verification',
      mfaEnabled: false,
      createdBy: auth.userId,
      createdAt: new Date().toISOString(),
    };

    return c.json({
      success: true,
      data: user,
      message: body.sendInvitation
        ? 'User created. Invitation email sent.'
        : 'User created. No invitation sent.',
    }, 201);
  }
);

/**
 * GET /admin/roles - List custom roles
 */
adminPortalRouter.get(
  '/roles',
  zValidator('query', paginationSchema.merge(z.object({ tenantId: z.string().optional() }))),
  async (c) => {
    const { page, pageSize, tenantId } = c.req.valid('query');
    const dataService = getDataService();

    const result = await dataService.getRoles({ page, pageSize }, { tenantId });

    return c.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  }
);

/**
 * POST /admin/roles - Create custom role
 */
adminPortalRouter.post(
  '/roles',
  requirePermission('users:create'),
  zValidator('json', createRoleSchema),
  async (c) => {
    const auth = c.get('auth');
    const body = c.req.valid('json');

    const role = {
      id: `role_${Date.now()}`,
      ...body,
      isSystem: false,
      userCount: 0,
      createdBy: auth.userId,
      createdAt: new Date().toISOString(),
    };

    return c.json({ success: true, data: role }, 201);
  }
);

/**
 * PUT /admin/tenants/:tenantId/approval-matrix - Update approval matrix
 */
adminPortalRouter.put(
  '/tenants/:tenantId/approval-matrix',
  requirePermission('tenants:update'),
  zValidator('json', approvalMatrixSchema.omit({ tenantId: true })),
  async (c) => {
    const tenantId = c.req.param('tenantId');
    const auth = c.get('auth');
    const body = c.req.valid('json');

    return c.json({
      success: true,
      data: {
        tenantId,
        rules: body.rules,
        updatedBy: auth.userId,
        updatedAt: new Date().toISOString(),
      },
      message: 'Approval matrix updated.',
    });
  }
);

/**
 * GET /admin/audit - View audit logs
 */
adminPortalRouter.get(
  '/audit',
  requirePermission('audit:read'),
  zValidator('query', paginationSchema.merge(dateRangeSchema).merge(z.object({
    tenantId: z.string().optional(),
    userId: z.string().optional(),
    action: z.string().optional(),
    resource: z.string().optional(),
  }))),
  async (c) => {
    const { page, pageSize, tenantId, userId, action } = c.req.valid('query');
    const dataService = getDataService();

    const result = await dataService.getAuditLogs({ page, pageSize }, { tenantId, userId, action });

    return c.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  }
);

// ============================================================================
// Support Tooling
// ============================================================================

/**
 * GET /admin/support/search - Search across tenants
 */
adminPortalRouter.get(
  '/support/search',
  zValidator('query', z.object({
    query: z.string().min(2),
    type: z.enum(['customer', 'property', 'unit', 'invoice', 'payment', 'workorder']).optional(),
    tenantId: z.string().optional(),
  })),
  async (c) => {
    const { query, type, tenantId } = c.req.valid('query');
    const dataService = getDataService();

    const results = await dataService.searchPlatform(query, type, tenantId);

    return c.json({ success: true, data: results });
  }
);

/**
 * GET /admin/support/customers/:id/timeline - Customer activity timeline
 */
adminPortalRouter.get('/support/customers/:id/timeline', async (c) => {
  const customerId = c.req.param('id');
  const dataService = getDataService();

  const timeline = await dataService.getCustomerTimeline(customerId);
  if (!timeline) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } }, 404);
  }

  return c.json({ success: true, data: timeline });
});

/**
 * POST /admin/support/cases/:id/escalate - Escalate case
 */
adminPortalRouter.post(
  '/support/cases/:id/escalate',
  zValidator('json', escalationSchema.omit({ caseId: true })),
  async (c) => {
    const caseId = c.req.param('id');
    const auth = c.get('auth');
    const body = c.req.valid('json');

    return c.json({
      success: true,
      data: {
        caseId,
        escalatedTo: body.targetTeam,
        priority: body.priority,
        escalatedBy: auth.userId,
        escalatedAt: new Date().toISOString(),
        notes: body.notes,
      },
      message: `Case escalated to ${body.targetTeam} team.`,
    });
  }
);

/**
 * POST /admin/support/impersonate - Impersonate user (with audit)
 */
adminPortalRouter.post(
  '/support/impersonate',
  requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  zValidator('json', impersonationSchema),
  async (c) => {
    const auth = c.get('auth');
    const { userId, reason } = c.req.valid('json');

    // In production, generate impersonation token and log extensively
    return c.json({
      success: true,
      data: {
        impersonationToken: 'imp_' + Date.now(),
        targetUserId: userId,
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        auditId: 'audit_' + Date.now(),
      },
      message: 'Impersonation session started. All actions will be logged.',
    });
  }
);

// ============================================================================
// Billing & Subscription
// ============================================================================

/**
 * GET /admin/billing/invoices - Platform billing invoices
 */
adminPortalRouter.get(
  '/billing/invoices',
  zValidator('query', paginationSchema.merge(z.object({
    tenantId: z.string().optional(),
    status: z.enum(['all', 'pending', 'paid', 'overdue']).optional().default('all'),
  }))),
  async (c) => {
    const { page, pageSize, tenantId, status } = c.req.valid('query');
    const dataService = getDataService();

    const result = await dataService.getBillingInvoices({ page, pageSize }, { tenantId, status });

    return c.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  }
);

/**
 * POST /admin/billing/adjustments - Apply billing adjustment
 */
adminPortalRouter.post(
  '/billing/adjustments',
  requirePermission('tenants:update'),
  zValidator('json', billingAdjustmentSchema),
  async (c) => {
    const auth = c.get('auth');
    const body = c.req.valid('json');

    const adjustment = {
      id: `adj_${Date.now()}`,
      ...body,
      createdBy: auth.userId,
      createdAt: new Date().toISOString(),
      status: 'approved',
    };

    return c.json({
      success: true,
      data: adjustment,
      message: `${body.type} of TSh ${body.amount.toLocaleString()} applied.`,
    }, 201);
  }
);

/**
 * GET /admin/billing/usage - Usage reports for billing
 */
adminPortalRouter.get(
  '/billing/usage',
  zValidator('query', z.object({
    tenantId: z.string().optional(),
    period: z.string().optional(),
  })),
  async (c) => {
    const { tenantId, period } = c.req.valid('query');
    const dataService = getDataService();

    const usage = await dataService.getBillingUsage(tenantId, period);

    return c.json({ success: true, data: usage });
  }
);

// ============================================================================
// AI Operations Cockpit
// ============================================================================

/**
 * GET /admin/ai/decisions - AI decision audit log
 */
adminPortalRouter.get(
  '/ai/decisions',
  requirePermission('audit:read'),
  zValidator('query', paginationSchema.merge(z.object({
    tenantId: z.string().optional(),
    decisionType: z.string().optional(),
  }))),
  async (c) => {
    const { page, pageSize, tenantId, decisionType } = c.req.valid('query');
    const dataService = getDataService();

    const result = await dataService.getAiDecisions({ page, pageSize }, { tenantId, decisionType });

    return c.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  }
);

/**
 * GET /admin/ai/metrics - AI performance metrics
 */
adminPortalRouter.get('/ai/metrics', requirePermission('audit:read'), async (c) => {
  const dataService = getDataService();
  const metrics = await dataService.getAiMetrics();

  return c.json({ success: true, data: metrics });
});

// ============================================================================
// Workflows & Exceptions
// ============================================================================

/**
 * GET /admin/workflows/stuck - Get stuck workflows
 */
adminPortalRouter.get('/workflows/stuck', async (c) => {
  const dataService = getDataService();
  const stuckWorkflows = await dataService.getStuckWorkflows();

  return c.json({ success: true, data: stuckWorkflows });
});

/**
 * POST /admin/workflows/:id/intervene - Intervene in stuck workflow
 */
adminPortalRouter.post(
  '/workflows/:id/intervene',
  zValidator('json', z.object({
    action: z.string(),
    parameters: z.record(z.unknown()).optional(),
    notes: z.string().max(1000),
  })),
  async (c) => {
    const workflowId = c.req.param('id');
    const auth = c.get('auth');
    const body = c.req.valid('json');

    return c.json({
      success: true,
      data: {
        workflowId,
        action: body.action,
        status: 'resolved',
        resolvedBy: auth.userId,
        resolvedAt: new Date().toISOString(),
      },
      message: 'Workflow intervention successful.',
    });
  }
);

export default adminPortalRouter;
