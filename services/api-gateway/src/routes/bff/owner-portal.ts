/**
 * Owner Portal BFF Routes - BOSSNYUMBA
 * 
 * Backend for Frontend routes optimized for property owners/investors:
 * - Portfolio dashboards and performance metrics
 * - Financial statements and disbursements
 * - Maintenance oversight and approvals
 * - Document access and e-signatures
 * - Owner-manager messaging
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

const dateRangeSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  period: z.enum(['week', 'month', 'quarter', 'year', 'custom']).optional().default('month'),
});

const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const propertyFilterSchema = z.object({
  propertyIds: z.string().optional(), // Comma-separated
});

const approvalSchema = z.object({
  approved: z.boolean(),
  comments: z.string().max(1000).optional(),
});

// ============================================================================
// Router
// ============================================================================

export const ownerPortalRouter = new Hono()
  .use('*', authMiddleware)
  .use('*', requireRole(UserRole.OWNER, UserRole.TENANT_ADMIN, UserRole.ADMIN));

// ============================================================================
// Dashboard Endpoints
// ============================================================================

/**
 * GET /owner/dashboard - Portfolio overview dashboard
 */
ownerPortalRouter.get(
  '/dashboard',
  zValidator('query', dateRangeSchema.merge(propertyFilterSchema)),
  async (c) => {
    const auth = c.get('auth');
    const { startDate, endDate, period, propertyIds } = c.req.valid('query');

    // Filter by owner's property access
    const accessibleProperties = auth.propertyAccess.includes('*') 
      ? undefined 
      : auth.propertyAccess;

    const requestedProperties = propertyIds?.split(',').filter(Boolean);
    const filteredProperties = requestedProperties 
      ? requestedProperties.filter(p => !accessibleProperties || accessibleProperties.includes(p))
      : accessibleProperties;

    // Mock data - in production, aggregate from domain services
    const dashboardData = {
      portfolioSummary: {
        totalProperties: 5,
        totalUnits: 48,
        occupancyRate: 0.92,
        totalValue: 2500000000, // TZS
        monthOverMonthChange: 0.03,
      },
      financials: {
        rentBilled: 45000000,
        rentCollected: 41400000,
        collectionRate: 0.92,
        arrearsTotal: 3600000,
        netOperatingIncome: 38200000,
        expenses: 3200000,
      },
      arrearsBuckets: {
        '0-7': { count: 2, amount: 800000 },
        '8-14': { count: 1, amount: 400000 },
        '15-30': { count: 2, amount: 1200000 },
        '31-60': { count: 1, amount: 600000 },
        '60+': { count: 1, amount: 600000 },
      },
      maintenance: {
        openWorkOrders: 8,
        urgentWorkOrders: 2,
        pendingApprovals: 3,
        avgResolutionDays: 2.5,
        totalMaintenanceCost: 1200000,
      },
      leases: {
        expiringIn30Days: 2,
        expiringIn60Days: 4,
        renewalRate: 0.78,
        vacantUnits: 4,
      },
      recentActivity: [
        { type: 'payment', description: 'Rent payment received - Unit A1', amount: 800000, date: new Date().toISOString() },
        { type: 'workOrder', description: 'Work order completed - Plumbing repair', amount: 150000, date: new Date().toISOString() },
        { type: 'lease', description: 'Lease renewed - Unit B3', amount: null, date: new Date().toISOString() },
      ],
    };

    return c.json({
      success: true,
      data: dashboardData,
      meta: {
        period,
        startDate,
        endDate,
        generatedAt: new Date().toISOString(),
      },
    });
  }
);

/**
 * GET /owner/properties - List owner's properties with metrics
 */
ownerPortalRouter.get(
  '/properties',
  zValidator('query', paginationSchema),
  async (c) => {
    const auth = c.get('auth');
    const { page, pageSize } = c.req.valid('query');

    // Mock data
    const properties = [
      {
        id: 'prop-001',
        name: 'Masaki Heights',
        address: 'Plot 123, Masaki, Dar es Salaam',
        type: 'residential',
        totalUnits: 24,
        occupiedUnits: 22,
        occupancyRate: 0.917,
        monthlyRentRoll: 19200000,
        collectionRate: 0.95,
        openWorkOrders: 3,
        status: 'active',
      },
      {
        id: 'prop-002',
        name: 'Oyster Bay Apartments',
        address: 'Plot 456, Oyster Bay, Dar es Salaam',
        type: 'residential',
        totalUnits: 16,
        occupiedUnits: 14,
        occupancyRate: 0.875,
        monthlyRentRoll: 16800000,
        collectionRate: 0.89,
        openWorkOrders: 4,
        status: 'active',
      },
    ];

    return c.json({
      success: true,
      data: properties,
      pagination: {
        page,
        pageSize,
        total: properties.length,
        totalPages: Math.ceil(properties.length / pageSize),
      },
    });
  }
);

/**
 * GET /owner/properties/:id - Single property details
 */
ownerPortalRouter.get('/properties/:id', async (c) => {
  const auth = c.get('auth');
  const propertyId = c.req.param('id');

  // Check property access
  if (!auth.propertyAccess.includes('*') && !auth.propertyAccess.includes(propertyId)) {
    return c.json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'You do not have access to this property' },
    }, 403);
  }

  // Mock data
  const property = {
    id: propertyId,
    name: 'Masaki Heights',
    address: 'Plot 123, Masaki, Dar es Salaam',
    type: 'residential',
    description: 'Modern apartment complex with 24 units',
    amenities: ['Swimming Pool', 'Gym', 'Parking', 'Security'],
    totalUnits: 24,
    occupiedUnits: 22,
    vacantUnits: 2,
    units: [
      { id: 'unit-001', number: 'A1', type: '2BR', status: 'occupied', rentAmount: 800000, tenant: 'John Doe' },
      { id: 'unit-002', number: 'A2', type: '2BR', status: 'occupied', rentAmount: 800000, tenant: 'Jane Smith' },
      { id: 'unit-003', number: 'A3', type: '2BR', status: 'vacant', rentAmount: 850000, tenant: null },
    ],
    financials: {
      totalRentRoll: 19200000,
      collectedThisMonth: 18240000,
      arrearsTotal: 960000,
      expenses: 1800000,
      netIncome: 16440000,
    },
    estateManager: {
      id: 'user-001',
      name: 'Alice Manager',
      phone: '+255700000001',
      email: 'alice@example.com',
    },
  };

  return c.json({ success: true, data: property });
});

// ============================================================================
// Financial Endpoints
// ============================================================================

/**
 * GET /owner/financials/statements - Financial statements
 */
ownerPortalRouter.get(
  '/financials/statements',
  zValidator('query', dateRangeSchema.merge(propertyFilterSchema).merge(paginationSchema)),
  async (c) => {
    const { period, propertyIds, page, pageSize } = c.req.valid('query');

    // Mock data
    const statements = [
      {
        id: 'stmt-2024-02',
        period: '2024-02',
        property: { id: 'prop-001', name: 'Masaki Heights' },
        income: {
          rentCollected: 18240000,
          lateFees: 120000,
          otherIncome: 50000,
          totalIncome: 18410000,
        },
        expenses: {
          maintenance: 800000,
          utilities: 200000,
          management: 920500,
          insurance: 150000,
          other: 100000,
          totalExpenses: 2170500,
        },
        netOperatingIncome: 16239500,
        disbursement: {
          amount: 15000000,
          date: '2024-03-05',
          status: 'completed',
        },
      },
    ];

    return c.json({
      success: true,
      data: statements,
      pagination: { page, pageSize, total: 1, totalPages: 1 },
    });
  }
);

/**
 * GET /owner/financials/disbursements - Disbursement history
 */
ownerPortalRouter.get(
  '/financials/disbursements',
  zValidator('query', paginationSchema),
  async (c) => {
    const { page, pageSize } = c.req.valid('query');

    const disbursements = [
      {
        id: 'disb-001',
        date: '2024-03-05',
        amount: 15000000,
        property: { id: 'prop-001', name: 'Masaki Heights' },
        period: '2024-02',
        bankAccount: '****4567',
        status: 'completed',
        reference: 'DISB-2024-02-001',
      },
      {
        id: 'disb-002',
        date: '2024-02-05',
        amount: 14500000,
        property: { id: 'prop-001', name: 'Masaki Heights' },
        period: '2024-01',
        bankAccount: '****4567',
        status: 'completed',
        reference: 'DISB-2024-01-001',
      },
    ];

    return c.json({
      success: true,
      data: disbursements,
      pagination: { page, pageSize, total: disbursements.length, totalPages: 1 },
    });
  }
);

/**
 * GET /owner/financials/arrears - Arrears summary
 */
ownerPortalRouter.get(
  '/financials/arrears',
  zValidator('query', propertyFilterSchema),
  async (c) => {
    const arrears = {
      summary: {
        totalOutstanding: 3600000,
        tenantsInArrears: 7,
        percentageOfRentRoll: 0.08,
      },
      byProperty: [
        { propertyId: 'prop-001', propertyName: 'Masaki Heights', amount: 2400000, tenants: 5 },
        { propertyId: 'prop-002', propertyName: 'Oyster Bay Apartments', amount: 1200000, tenants: 2 },
      ],
      tenants: [
        {
          customerId: 'cust-001',
          name: 'John Doe',
          unit: 'A5',
          property: 'Masaki Heights',
          amountOwed: 800000,
          daysOverdue: 15,
          lastPayment: '2024-01-15',
          status: 'payment_plan',
        },
      ],
    };

    return c.json({ success: true, data: arrears });
  }
);

// ============================================================================
// Maintenance Endpoints
// ============================================================================

/**
 * GET /owner/maintenance/work-orders - Work orders overview
 */
ownerPortalRouter.get(
  '/maintenance/work-orders',
  zValidator('query', paginationSchema.merge(z.object({
    status: z.enum(['all', 'open', 'pending_approval', 'in_progress', 'completed']).optional().default('all'),
    priority: z.enum(['all', 'emergency', 'high', 'medium', 'low']).optional().default('all'),
  }))),
  async (c) => {
    const { page, pageSize, status, priority } = c.req.valid('query');

    const workOrders = [
      {
        id: 'wo-001',
        number: 'WO-2024-0001',
        property: { id: 'prop-001', name: 'Masaki Heights' },
        unit: { id: 'unit-003', number: 'A3' },
        category: 'plumbing',
        priority: 'high',
        title: 'Water leak in bathroom',
        description: 'Tenant reports water leak under bathroom sink',
        status: 'pending_approval',
        estimatedCost: 250000,
        actualCost: null,
        createdAt: '2024-02-28T10:00:00Z',
        vendor: { id: 'vendor-001', name: 'ABC Plumbing' },
      },
      {
        id: 'wo-002',
        number: 'WO-2024-0002',
        property: { id: 'prop-001', name: 'Masaki Heights' },
        unit: { id: 'unit-005', number: 'B2' },
        category: 'electrical',
        priority: 'medium',
        title: 'AC not cooling properly',
        description: 'Air conditioning unit not cooling, needs inspection',
        status: 'in_progress',
        estimatedCost: 150000,
        actualCost: null,
        createdAt: '2024-02-27T14:30:00Z',
        vendor: { id: 'vendor-002', name: 'Cool Air Services' },
      },
    ];

    return c.json({
      success: true,
      data: workOrders,
      pagination: { page, pageSize, total: workOrders.length, totalPages: 1 },
    });
  }
);

/**
 * GET /owner/maintenance/work-orders/:id - Work order details
 */
ownerPortalRouter.get('/maintenance/work-orders/:id', async (c) => {
  const workOrderId = c.req.param('id');

  const workOrder = {
    id: workOrderId,
    number: 'WO-2024-0001',
    property: { id: 'prop-001', name: 'Masaki Heights', address: 'Plot 123, Masaki' },
    unit: { id: 'unit-003', number: 'A3', tenant: 'Jane Smith' },
    category: 'plumbing',
    priority: 'high',
    title: 'Water leak in bathroom',
    description: 'Tenant reports water leak under bathroom sink causing water damage',
    status: 'pending_approval',
    estimatedCost: 250000,
    actualCost: null,
    createdAt: '2024-02-28T10:00:00Z',
    updatedAt: '2024-02-28T12:00:00Z',
    vendor: {
      id: 'vendor-001',
      name: 'ABC Plumbing',
      phone: '+255700000002',
      rating: 4.5,
    },
    timeline: [
      { status: 'submitted', timestamp: '2024-02-28T10:00:00Z', actor: 'Jane Smith (Tenant)' },
      { status: 'triaged', timestamp: '2024-02-28T10:30:00Z', actor: 'System (AI)' },
      { status: 'pending_approval', timestamp: '2024-02-28T11:00:00Z', actor: 'Alice Manager' },
    ],
    attachments: [
      { id: 'att-001', type: 'image', url: '/attachments/wo-001-1.jpg', description: 'Photo of leak' },
    ],
    quotes: [
      { vendorId: 'vendor-001', vendorName: 'ABC Plumbing', amount: 250000, notes: 'Includes parts and labor' },
    ],
  };

  return c.json({ success: true, data: workOrder });
});

/**
 * POST /owner/maintenance/work-orders/:id/approve - Approve work order
 */
ownerPortalRouter.post(
  '/maintenance/work-orders/:id/approve',
  zValidator('json', approvalSchema),
  async (c) => {
    const workOrderId = c.req.param('id');
    const auth = c.get('auth');
    const { approved, comments } = c.req.valid('json');

    // In production, call domain service
    const result = {
      id: workOrderId,
      status: approved ? 'approved' : 'rejected',
      approvedBy: auth.userId,
      approvedAt: new Date().toISOString(),
      comments,
    };

    return c.json({
      success: true,
      data: result,
      message: approved ? 'Work order approved successfully' : 'Work order rejected',
    });
  }
);

/**
 * GET /owner/maintenance/costs - Maintenance cost analysis
 */
ownerPortalRouter.get(
  '/maintenance/costs',
  zValidator('query', dateRangeSchema.merge(propertyFilterSchema)),
  async (c) => {
    const costAnalysis = {
      summary: {
        totalCost: 4500000,
        avgCostPerUnit: 93750,
        avgCostPerWorkOrder: 225000,
        workOrderCount: 20,
      },
      byCategory: [
        { category: 'plumbing', cost: 1500000, count: 8, percentage: 33.3 },
        { category: 'electrical', cost: 1200000, count: 6, percentage: 26.7 },
        { category: 'appliance', cost: 800000, count: 3, percentage: 17.8 },
        { category: 'structural', cost: 600000, count: 2, percentage: 13.3 },
        { category: 'other', cost: 400000, count: 1, percentage: 8.9 },
      ],
      byProperty: [
        { propertyId: 'prop-001', propertyName: 'Masaki Heights', cost: 2800000, count: 12 },
        { propertyId: 'prop-002', propertyName: 'Oyster Bay Apartments', cost: 1700000, count: 8 },
      ],
      trend: [
        { month: '2024-01', cost: 1200000 },
        { month: '2024-02', cost: 1500000 },
        { month: '2024-03', cost: 1800000 },
      ],
    };

    return c.json({ success: true, data: costAnalysis });
  }
);

// ============================================================================
// Document Endpoints
// ============================================================================

/**
 * GET /owner/documents - List documents
 */
ownerPortalRouter.get(
  '/documents',
  zValidator('query', paginationSchema.merge(z.object({
    type: z.enum(['all', 'lease', 'report', 'notice', 'invoice', 'statement']).optional().default('all'),
  }))),
  async (c) => {
    const { page, pageSize, type } = c.req.valid('query');

    const documents = [
      {
        id: 'doc-001',
        type: 'statement',
        name: 'Monthly Statement - February 2024',
        property: { id: 'prop-001', name: 'Masaki Heights' },
        createdAt: '2024-03-01T00:00:00Z',
        size: 245000,
        format: 'pdf',
        downloadUrl: '/api/owner/documents/doc-001/download',
      },
      {
        id: 'doc-002',
        type: 'lease',
        name: 'Lease Agreement - Unit A1',
        property: { id: 'prop-001', name: 'Masaki Heights' },
        createdAt: '2024-01-15T10:00:00Z',
        size: 512000,
        format: 'pdf',
        downloadUrl: '/api/owner/documents/doc-002/download',
        requiresSignature: false,
        signedAt: '2024-01-16T14:30:00Z',
      },
    ];

    return c.json({
      success: true,
      data: documents,
      pagination: { page, pageSize, total: documents.length, totalPages: 1 },
    });
  }
);

/**
 * GET /owner/documents/:id/download - Download document
 */
ownerPortalRouter.get('/documents/:id/download', async (c) => {
  const documentId = c.req.param('id');

  // In production, generate signed URL or stream file
  return c.json({
    success: true,
    data: {
      downloadUrl: `https://storage.example.com/documents/${documentId}?token=xxx`,
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    },
  });
});

// ============================================================================
// Reports Endpoints
// ============================================================================

/**
 * GET /owner/reports/available - List available reports
 */
ownerPortalRouter.get('/reports/available', async (c) => {
  const reports = [
    {
      id: 'financial-summary',
      name: 'Financial Summary',
      description: 'Monthly income, expenses, and net operating income',
      formats: ['pdf', 'excel'],
      frequency: ['monthly', 'quarterly', 'annually'],
    },
    {
      id: 'occupancy-report',
      name: 'Occupancy Report',
      description: 'Unit occupancy rates and vacancy analysis',
      formats: ['pdf', 'excel'],
      frequency: ['monthly', 'quarterly'],
    },
    {
      id: 'maintenance-report',
      name: 'Maintenance Report',
      description: 'Work orders, costs, and vendor performance',
      formats: ['pdf', 'excel'],
      frequency: ['monthly'],
    },
    {
      id: 'arrears-report',
      name: 'Arrears Report',
      description: 'Outstanding rent and collection efforts',
      formats: ['pdf', 'excel'],
      frequency: ['weekly', 'monthly'],
    },
  ];

  return c.json({ success: true, data: reports });
});

/**
 * POST /owner/reports/generate - Generate a report
 */
ownerPortalRouter.post(
  '/reports/generate',
  zValidator('json', z.object({
    reportType: z.string(),
    format: z.enum(['pdf', 'excel', 'csv']),
    dateRange: dateRangeSchema,
    propertyIds: z.array(z.string()).optional(),
  })),
  async (c) => {
    const auth = c.get('auth');
    const body = c.req.valid('json');

    // In production, queue report generation
    const report = {
      id: `report-${Date.now()}`,
      type: body.reportType,
      format: body.format,
      status: 'generating',
      requestedBy: auth.userId,
      requestedAt: new Date().toISOString(),
      estimatedCompletion: new Date(Date.now() + 60000).toISOString(),
    };

    return c.json({
      success: true,
      data: report,
      message: 'Report generation started. You will be notified when ready.',
    }, 202);
  }
);

// ============================================================================
// Messaging Endpoints
// ============================================================================

/**
 * GET /owner/messages - List messages with estate manager
 */
ownerPortalRouter.get(
  '/messages',
  zValidator('query', paginationSchema),
  async (c) => {
    const { page, pageSize } = c.req.valid('query');

    const messages = [
      {
        id: 'msg-001',
        from: { id: 'user-001', name: 'Alice Manager', role: 'estate_manager' },
        subject: 'Monthly Update - February 2024',
        preview: 'Here is your monthly property update...',
        createdAt: '2024-03-01T09:00:00Z',
        read: true,
        hasAttachments: true,
      },
      {
        id: 'msg-002',
        from: { id: 'user-001', name: 'Alice Manager', role: 'estate_manager' },
        subject: 'Work Order Approval Required',
        preview: 'A work order requires your approval...',
        createdAt: '2024-02-28T14:00:00Z',
        read: false,
        hasAttachments: false,
      },
    ];

    return c.json({
      success: true,
      data: messages,
      pagination: { page, pageSize, total: messages.length, totalPages: 1 },
    });
  }
);

/**
 * POST /owner/messages - Send message to estate manager
 */
ownerPortalRouter.post(
  '/messages',
  zValidator('json', z.object({
    subject: z.string().min(1).max(200),
    body: z.string().min(1).max(10000),
    propertyId: z.string().optional(),
    attachments: z.array(z.string()).optional(),
  })),
  async (c) => {
    const auth = c.get('auth');
    const body = c.req.valid('json');

    const message = {
      id: `msg-${Date.now()}`,
      from: { id: auth.userId, role: 'owner' },
      subject: body.subject,
      body: body.body,
      propertyId: body.propertyId,
      attachments: body.attachments || [],
      createdAt: new Date().toISOString(),
      status: 'sent',
    };

    return c.json({ success: true, data: message }, 201);
  }
);

export default ownerPortalRouter;
