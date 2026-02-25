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
import { getDataService } from '../../services/data-access.service';

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

    const dataService = getDataService();
    const dashboardData = await dataService.getOwnerDashboard(auth.userId, { startDate, endDate, period });

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
    const dataService = getDataService();
    const result = await dataService.getPropertiesByOwner(auth.userId, { page, pageSize });

    return c.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  }
);

/**
 * GET /owner/properties/:id - Single property details
 */
ownerPortalRouter.get('/properties/:id', async (c) => {
  const auth = c.get('auth');
  const propertyId = c.req.param('id');
  const dataService = getDataService();

  // Check property access
  if (!auth.propertyAccess.includes('*') && !auth.propertyAccess.includes(propertyId)) {
    return c.json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'You do not have access to this property' },
    }, 403);
  }

  const property = await dataService.getPropertyById(propertyId, auth.userId);

  if (!property) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Property not found' } }, 404);
  }

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
    const auth = c.get('auth');
    const { period, propertyIds, page, pageSize, startDate, endDate } = c.req.valid('query');
    const dataService = getDataService();

    const result = await dataService.getFinancialStatements(auth.userId, { page, pageSize }, { startDate, endDate, period });

    return c.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
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
    const auth = c.get('auth');
    const { page, pageSize } = c.req.valid('query');
    const dataService = getDataService();

    const result = await dataService.getDisbursements(auth.userId, { page, pageSize });

    return c.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
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
    const auth = c.get('auth');
    const { propertyIds } = c.req.valid('query');
    const dataService = getDataService();

    const arrears = await dataService.getArrears(auth.userId, propertyIds);

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
    const dataService = getDataService();

    const result = await dataService.getWorkOrders({ status, priority }, { page, pageSize });

    return c.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  }
);

/**
 * GET /owner/maintenance/work-orders/:id - Work order details
 */
ownerPortalRouter.get('/maintenance/work-orders/:id', async (c) => {
  const workOrderId = c.req.param('id');
  const dataService = getDataService();

  const workOrder = await dataService.getWorkOrderById(workOrderId);
  if (!workOrder) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Work order not found' } }, 404);
  }

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
    const auth = c.get('auth');
    const { startDate, endDate, period, propertyIds } = c.req.valid('query');
    const dataService = getDataService();

    const costAnalysis = await dataService.getMaintenanceCosts(auth.userId, { startDate, endDate, period }, propertyIds);

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
    const auth = c.get('auth');
    const { page, pageSize, type } = c.req.valid('query');
    const dataService = getDataService();

    const result = await dataService.getDocuments(auth.userId, { page, pageSize }, type);

    return c.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  }
);

/**
 * GET /owner/documents/:id/download - Download document
 */
ownerPortalRouter.get('/documents/:id/download', async (c) => {
  const documentId = c.req.param('id');
  const storageBaseUrl = process.env.STORAGE_BASE_URL || '/storage';

  // In production, generate signed URL or stream file
  return c.json({
    success: true,
    data: {
      downloadUrl: `${storageBaseUrl}/documents/${documentId}?token=xxx`,
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
  const dataService = getDataService();
  const reports = await dataService.getAvailableReports();

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
    const auth = c.get('auth');
    const { page, pageSize } = c.req.valid('query');
    const dataService = getDataService();
    const result = await dataService.getMessages(auth.userId, { page, pageSize });

    return c.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
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
