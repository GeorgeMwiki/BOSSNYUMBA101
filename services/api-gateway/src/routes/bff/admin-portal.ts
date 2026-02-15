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

  // Mock data - aggregate from all services
  const dashboard = {
    systemHealth: {
      status: 'healthy',
      uptime: 99.95,
      lastIncident: null,
      services: [
        { name: 'api-gateway', status: 'healthy', latencyMs: 45 },
        { name: 'domain-services', status: 'healthy', latencyMs: 32 },
        { name: 'payments', status: 'healthy', latencyMs: 78 },
        { name: 'notifications', status: 'healthy', latencyMs: 28 },
        { name: 'reports', status: 'healthy', latencyMs: 120 },
      ],
    },
    platformMetrics: {
      totalTenants: 42,
      activeTenants: 38,
      totalUsers: 1250,
      activeUsers24h: 340,
      totalProperties: 156,
      totalUnits: 4820,
      occupancyRate: 0.89,
    },
    financialOverview: {
      monthlyRecurringRevenue: 125000000,
      totalTransactionsToday: 847,
      transactionVolumeToday: 380000000,
      failedTransactions24h: 12,
      reconciliationQueue: 23,
    },
    operationalAlerts: [
      {
        id: 'alert-001',
        type: 'payment_failure_spike',
        severity: 'medium',
        message: 'Payment failure rate increased 15% in last hour',
        timestamp: new Date(Date.now() - 1800000).toISOString(),
        acknowledged: false,
      },
      {
        id: 'alert-002',
        type: 'sla_breach_risk',
        severity: 'high',
        message: '5 work orders at risk of SLA breach',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        acknowledged: true,
      },
    ],
    exceptionQueues: {
      failedReconciliations: 23,
      pendingApprovals: 45,
      escalatedCases: 8,
      stuckWorkflows: 3,
    },
    recentActivity: [
      { type: 'tenant_created', description: 'New tenant: ABC Properties Ltd', timestamp: new Date().toISOString() },
      { type: 'payment_exception', description: 'Manual reconciliation required - TXN-12345', timestamp: new Date().toISOString() },
    ],
  };

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

    // Mock data
    const tenants = [
      {
        id: 'tnt-001',
        code: 'MASAKI-PROP',
        name: 'Masaki Properties Ltd',
        type: 'company',
        status: 'active',
        contactName: 'John Mwangi',
        contactEmail: 'john@masakiproperties.co.tz',
        contactPhone: '+255700000001',
        subscriptionPlan: 'professional',
        properties: 12,
        units: 286,
        users: 15,
        monthlyBilling: 2500000,
        createdAt: '2023-01-15T00:00:00Z',
        lastLoginAt: '2024-03-01T10:00:00Z',
      },
      {
        id: 'tnt-002',
        code: 'NHC-TZ',
        name: 'National Housing Corporation',
        type: 'institution',
        status: 'active',
        contactName: 'Grace Kimaro',
        contactEmail: 'grace.kimaro@nhc.go.tz',
        contactPhone: '+255700000002',
        subscriptionPlan: 'enterprise',
        properties: 45,
        units: 1250,
        users: 120,
        monthlyBilling: 15000000,
        createdAt: '2022-06-01T00:00:00Z',
        lastLoginAt: '2024-03-01T14:30:00Z',
      },
    ];

    return c.json({
      success: true,
      data: tenants,
      pagination: { page, pageSize, total: tenants.length, totalPages: 1 },
    });
  }
);

/**
 * GET /admin/tenants/:id - Get tenant details
 */
adminPortalRouter.get('/tenants/:id', async (c) => {
  const tenantId = c.req.param('id');

  const tenant = {
    id: tenantId,
    code: 'MASAKI-PROP',
    name: 'Masaki Properties Ltd',
    type: 'company',
    status: 'active',
    contact: {
      name: 'John Mwangi',
      email: 'john@masakiproperties.co.tz',
      phone: '+255700000001',
    },
    address: {
      street: 'Plot 45, Masaki Peninsula',
      city: 'Dar es Salaam',
      region: 'Kinondoni',
      country: 'Tanzania',
    },
    subscription: {
      plan: 'professional',
      status: 'active',
      startDate: '2023-01-15',
      renewalDate: '2024-01-15',
      monthlyBilling: 2500000,
      features: ['unlimited_users', 'api_access', 'priority_support'],
    },
    usage: {
      properties: 12,
      units: 286,
      users: 15,
      messagesThisMonth: 4500,
      reportsGenerated: 45,
      storageUsedMB: 2500,
    },
    billing: {
      totalBilled: 30000000,
      totalPaid: 27500000,
      balance: 2500000,
      lastPaymentDate: '2024-02-05',
      paymentMethod: 'bank_transfer',
    },
    policyConstitution: {
      approvalThresholds: {
        feeWaiver: 50000,
        rentIncrease: 10,
        workOrderCost: 500000,
      },
      gracePeriodDays: 5,
      lateFeePercentage: 5,
      renewalNoticeDays: 60,
    },
    createdAt: '2023-01-15T00:00:00Z',
    updatedAt: '2024-02-28T10:00:00Z',
  };

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

    const users = [
      {
        id: 'usr-001',
        email: 'john@masakiproperties.co.tz',
        firstName: 'John',
        lastName: 'Mwangi',
        phone: '+255700000001',
        tenant: { id: 'tnt-001', name: 'Masaki Properties Ltd' },
        role: { id: 'role-001', name: 'Tenant Admin', code: 'TENANT_ADMIN' },
        status: 'active',
        mfaEnabled: true,
        lastLoginAt: '2024-03-01T10:00:00Z',
        createdAt: '2023-01-15T00:00:00Z',
      },
      {
        id: 'usr-002',
        email: 'alice@masakiproperties.co.tz',
        firstName: 'Alice',
        lastName: 'Kimaro',
        phone: '+255700000002',
        tenant: { id: 'tnt-001', name: 'Masaki Properties Ltd' },
        role: { id: 'role-002', name: 'Property Manager', code: 'PROPERTY_MANAGER' },
        status: 'active',
        mfaEnabled: false,
        lastLoginAt: '2024-03-01T08:30:00Z',
        createdAt: '2023-02-20T00:00:00Z',
      },
    ];

    return c.json({
      success: true,
      data: users,
      pagination: { page, pageSize, total: users.length, totalPages: 1 },
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

    const roles = [
      {
        id: 'role-001',
        code: 'TENANT_ADMIN',
        name: 'Tenant Admin',
        description: 'Full access within tenant',
        isSystem: true,
        userCount: 12,
        permissions: ['users:*', 'properties:*', 'units:*', 'leases:*', 'invoices:*', 'payments:*', 'reports:*'],
        tenantId: null,
      },
      {
        id: 'role-002',
        code: 'PROPERTY_MANAGER',
        name: 'Property Manager',
        description: 'Manage properties and day-to-day operations',
        isSystem: true,
        userCount: 45,
        permissions: ['properties:read', 'units:*', 'leases:*', 'work_orders:*', 'customers:*'],
        tenantId: null,
      },
    ];

    return c.json({
      success: true,
      data: roles,
      pagination: { page, pageSize, total: roles.length, totalPages: 1 },
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

    const auditLogs = [
      {
        id: 'audit-001',
        timestamp: new Date(Date.now() - 1800000).toISOString(),
        userId: 'usr-001',
        userName: 'John Mwangi',
        tenantId: 'tnt-001',
        tenantName: 'Masaki Properties Ltd',
        action: 'user.login',
        resource: 'auth',
        resourceId: null,
        details: { ip: '196.41.55.100', userAgent: 'Mozilla/5.0...' },
        outcome: 'success',
      },
      {
        id: 'audit-002',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        userId: 'usr-002',
        userName: 'Alice Kimaro',
        tenantId: 'tnt-001',
        tenantName: 'Masaki Properties Ltd',
        action: 'workorder.approve',
        resource: 'work_orders',
        resourceId: 'wo-001',
        details: { amount: 250000, vendor: 'ABC Plumbing' },
        outcome: 'success',
      },
    ];

    return c.json({
      success: true,
      data: auditLogs,
      pagination: { page, pageSize, total: auditLogs.length, totalPages: 1 },
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

    const results = {
      customers: [
        {
          id: 'cust-001',
          name: 'Jane Smith',
          email: 'jane@example.com',
          phone: '+255700000010',
          unit: 'A1, Masaki Heights',
          tenant: { id: 'tnt-001', name: 'Masaki Properties Ltd' },
          match: 'name',
        },
      ],
      properties: [],
      invoices: [
        {
          id: 'inv-001',
          number: 'INV-2024-0001',
          amount: 800000,
          status: 'pending',
          customer: 'Jane Smith',
          tenant: { id: 'tnt-001', name: 'Masaki Properties Ltd' },
          match: 'customer_name',
        },
      ],
      payments: [],
      workOrders: [],
    };

    return c.json({ success: true, data: results });
  }
);

/**
 * GET /admin/support/customers/:id/timeline - Customer activity timeline
 */
adminPortalRouter.get('/support/customers/:id/timeline', async (c) => {
  const customerId = c.req.param('id');

  const timeline = {
    customer: {
      id: customerId,
      name: 'Jane Smith',
      email: 'jane@example.com',
      phone: '+255700000010',
      unit: { id: 'unit-001', number: 'A1', property: 'Masaki Heights' },
      tenant: { id: 'tnt-001', name: 'Masaki Properties Ltd' },
      status: 'active',
      moveInDate: '2023-06-01',
      leaseEndDate: '2024-05-31',
    },
    events: [
      { type: 'payment', timestamp: '2024-03-01T10:00:00Z', description: 'Rent payment - TSh 800,000', status: 'completed' },
      { type: 'maintenance', timestamp: '2024-02-25T10:00:00Z', description: 'Maintenance request - Plumbing', status: 'completed' },
      { type: 'communication', timestamp: '2024-02-20T14:00:00Z', description: 'Message sent re: parking', status: 'read' },
      { type: 'payment', timestamp: '2024-02-01T09:30:00Z', description: 'Rent payment - TSh 800,000', status: 'completed' },
      { type: 'onboarding', timestamp: '2023-06-05T14:00:00Z', description: 'Onboarding completed', status: 'completed' },
      { type: 'lease', timestamp: '2023-06-01T00:00:00Z', description: 'Lease started', status: 'active' },
    ],
    financials: {
      totalPaid: 7200000,
      totalBilled: 7200000,
      balance: 0,
      paymentHistory: [
        { month: '2024-03', amount: 800000, status: 'paid', paidOn: '2024-03-01' },
        { month: '2024-02', amount: 800000, status: 'paid', paidOn: '2024-02-01' },
      ],
    },
    maintenance: {
      totalRequests: 3,
      openRequests: 0,
      avgResolutionDays: 2.5,
    },
    sentiment: {
      score: 4.2,
      trend: 'stable',
      lastCheckIn: '2024-02-15T10:00:00Z',
    },
  };

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

    const invoices = [
      {
        id: 'bill-001',
        invoiceNumber: 'PLAT-2024-03-001',
        tenant: { id: 'tnt-001', name: 'Masaki Properties Ltd' },
        period: '2024-03',
        amount: 2500000,
        status: 'pending',
        dueDate: '2024-03-15',
        lineItems: [
          { description: 'Professional Plan - Monthly', amount: 2000000 },
          { description: 'Additional Users (5)', amount: 250000 },
          { description: 'SMS Messages (500)', amount: 250000 },
        ],
      },
    ];

    return c.json({
      success: true,
      data: invoices,
      pagination: { page, pageSize, total: invoices.length, totalPages: 1 },
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

    const usage = [
      {
        tenantId: 'tnt-001',
        tenantName: 'Masaki Properties Ltd',
        period: period || '2024-03',
        metrics: {
          activeUsers: 15,
          properties: 12,
          units: 286,
          messagesWhatsApp: 2500,
          messagesSms: 500,
          messagesEmail: 1000,
          reportsGenerated: 45,
          storageUsedMB: 2500,
          apiCalls: 15000,
        },
        billing: {
          basePlan: 2000000,
          additionalUsers: 250000,
          messaging: 250000,
          storage: 0,
          total: 2500000,
        },
      },
    ];

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
    const { page, pageSize } = c.req.valid('query');

    const decisions = [
      {
        id: 'ai-001',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        tenantId: 'tnt-001',
        tenantName: 'Masaki Properties Ltd',
        decisionType: 'maintenance_triage',
        input: { description: 'Water leak in bathroom', photos: 2 },
        output: { category: 'plumbing', priority: 'high', confidence: 0.92 },
        humanOverride: false,
        outcome: 'work_order_created',
      },
      {
        id: 'ai-002',
        timestamp: new Date(Date.now() - 7200000).toISOString(),
        tenantId: 'tnt-001',
        tenantName: 'Masaki Properties Ltd',
        decisionType: 'vendor_recommendation',
        input: { category: 'plumbing', location: 'Masaki', urgency: 'high' },
        output: {
          recommendedVendor: 'ABC Plumbing',
          score: 0.89,
          alternatives: ['XYZ Plumbing', 'Quick Fix'],
        },
        humanOverride: true,
        overrideReason: 'Customer requested specific vendor',
        outcome: 'vendor_assigned',
      },
    ];

    return c.json({
      success: true,
      data: decisions,
      pagination: { page, pageSize, total: decisions.length, totalPages: 1 },
    });
  }
);

/**
 * GET /admin/ai/metrics - AI performance metrics
 */
adminPortalRouter.get('/ai/metrics', requirePermission('audit:read'), async (c) => {
  const metrics = {
    period: '2024-03',
    triageAccuracy: {
      correct: 892,
      incorrect: 45,
      humanOverrides: 63,
      accuracy: 0.95,
    },
    vendorMatching: {
      recommendations: 234,
      accepted: 198,
      overridden: 36,
      acceptanceRate: 0.85,
    },
    churnPrediction: {
      predictions: 45,
      confirmed: 8,
      falsePositives: 12,
      accuracy: 0.73,
    },
    paymentRisk: {
      flagged: 156,
      defaulted: 23,
      falsePositives: 45,
      precision: 0.34,
    },
    sentimentAnalysis: {
      analyzed: 4500,
      accuracy: 0.82,
      averageConfidence: 0.78,
    },
    latency: {
      avgTriageMs: 245,
      avgVendorMatchMs: 180,
      avgSentimentMs: 120,
    },
  };

  return c.json({ success: true, data: metrics });
});

// ============================================================================
// Workflows & Exceptions
// ============================================================================

/**
 * GET /admin/workflows/stuck - Get stuck workflows
 */
adminPortalRouter.get('/workflows/stuck', async (c) => {
  const stuckWorkflows = [
    {
      id: 'wf-001',
      type: 'payment_reconciliation',
      tenantId: 'tnt-001',
      tenantName: 'Masaki Properties Ltd',
      stuckAt: 'matching',
      stuckSince: new Date(Date.now() - 86400000).toISOString(),
      reason: 'Ambiguous payment reference',
      data: { transactionId: 'txn-123', amount: 800000, reference: 'RENT' },
      suggestedActions: ['Manual match to invoice', 'Request clarification from tenant', 'Mark as unallocated'],
    },
  ];

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
