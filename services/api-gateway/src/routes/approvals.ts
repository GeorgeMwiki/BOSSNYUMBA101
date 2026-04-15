// @ts-nocheck
/**
 * Approvals API - owner approval queue (VENDOR_INVOICE and related)
 *
 * Endpoints:
 *   GET    /approvals            list approvals (grouped by type on client)
 *   GET    /approvals/:id        fetch single approval + metadata + docs
 *   POST   /approvals            create approval row (used by vendor/invoice flows)
 *   POST   /approvals/:id/approve
 *   POST   /approvals/:id/reject
 *
 * Each mutation:
 *   - writes an audit log entry (who/when/context)
 *   - fires a notification (to owner on create, to vendor on decide)
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { authMiddleware } from '../middleware/hono-auth';
import { auditRequest } from '../middleware/audit.middleware';
import { idParamSchema, validationErrorHook } from './validators';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info', name: 'approvals' });

// ---------------------------------------------------------------------------
// Types & in-process store
// ---------------------------------------------------------------------------

export type ApprovalType =
  | 'VENDOR_INVOICE'
  | 'WORK_ORDER'
  | 'LEASE_CHANGE'
  | 'EXPENSE'
  | 'OTHER';

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface ApprovalAuditEntry {
  at: string;
  actorId: string;
  action: 'CREATED' | 'APPROVED' | 'REJECTED';
  reason?: string;
  context?: Record<string, unknown>;
}

export interface Approval {
  id: string;
  orgId: string;
  tenantId: string;
  type: ApprovalType;
  status: ApprovalStatus;
  title: string;
  summary?: string;
  amount?: { amount: number; currency: string };
  threshold?: { amount: number; currency: string };
  requestedById: string;
  requestedByName?: string;
  vendorId?: string;
  vendorName?: string;
  invoiceId?: string;
  metadata: Record<string, unknown>;
  documents: Array<{ id: string; name: string; url: string; mimeType?: string }>;
  audit: ApprovalAuditEntry[];
  createdAt: string;
  updatedAt: string;
  decidedAt?: string;
  decidedById?: string;
  rejectionReason?: string;
}

// Module-level store. In production this lives in Postgres; wiring in-process
// keeps parity with the existing complaints/inspections stubs and unblocks the
// mobile flow end-to-end.
const approvalsByTenant = new Map<string, Map<string, Approval>>();

function getTenantStore(tenantId: string): Map<string, Approval> {
  let store = approvalsByTenant.get(tenantId);
  if (!store) {
    store = new Map();
    approvalsByTenant.set(tenantId, store);
  }
  return store;
}

function genId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? `apr-${crypto.randomUUID()}`
    : `apr-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// ---------------------------------------------------------------------------
// Notifications (thin wrapper)
// ---------------------------------------------------------------------------

interface NotificationPayload {
  tenantId: string;
  userId?: string;
  audience?: 'OWNER' | 'VENDOR' | 'TENANT';
  kind: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

async function fireNotification(payload: NotificationPayload): Promise<void> {
  // The notifications service is the eventual transport. For now we log
  // through pino so it flows through the observability pipeline, matching
  // how other routes emit side-effect events.
  logger.info({ notification: payload }, 'approvals.notification');
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const approvalTypeSchema = z.enum([
  'VENDOR_INVOICE',
  'WORK_ORDER',
  'LEASE_CHANGE',
  'EXPENSE',
  'OTHER',
]);

const moneySchema = z.object({
  amount: z.number().nonnegative(),
  currency: z.string().min(1).max(8).default('KES'),
});

const createApprovalSchema = z.object({
  orgId: z.string().min(1).optional(),
  type: approvalTypeSchema,
  title: z.string().min(1).max(200),
  summary: z.string().max(2000).optional(),
  amount: moneySchema.optional(),
  threshold: moneySchema.optional(),
  requestedById: z.string().min(1).optional(),
  requestedByName: z.string().max(200).optional(),
  vendorId: z.string().optional(),
  vendorName: z.string().max(200).optional(),
  invoiceId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  documents: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1),
        url: z.string().url(),
        mimeType: z.string().optional(),
      })
    )
    .optional(),
});

const listApprovalsQuerySchema = z.object({
  orgId: z.string().optional(),
  type: approvalTypeSchema.optional(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

const rejectSchema = z.object({
  reason: z.string().min(1, 'Reason is required').max(1000),
});

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

const app = new Hono();

app.use('*', authMiddleware);

// POST /approvals  - create (called by vendor invoice handler when over threshold)
app.post(
  '/',
  zValidator('json', createApprovalSchema, validationErrorHook),
  async (c) => {
    const auth = c.get('auth');
    const body = c.req.valid('json');

    const now = new Date().toISOString();
    const id = genId();
    const orgId = body.orgId || auth.tenantId;

    const approval: Approval = {
      id,
      orgId,
      tenantId: auth.tenantId,
      type: body.type,
      status: 'PENDING',
      title: body.title,
      summary: body.summary,
      amount: body.amount,
      threshold: body.threshold,
      requestedById: body.requestedById || auth.userId,
      requestedByName: body.requestedByName,
      vendorId: body.vendorId,
      vendorName: body.vendorName,
      invoiceId: body.invoiceId,
      metadata: body.metadata || {},
      documents: body.documents || [],
      audit: [
        {
          at: now,
          actorId: auth.userId,
          action: 'CREATED',
          context: {
            type: body.type,
            amount: body.amount,
            threshold: body.threshold,
            vendorId: body.vendorId,
            invoiceId: body.invoiceId,
          },
        },
      ],
      createdAt: now,
      updatedAt: now,
    };

    getTenantStore(auth.tenantId).set(id, approval);

    await auditRequest(
      c,
      'APPROVAL_CREATED',
      { type: 'Approval', id },
      {
        category: 'PAYMENT',
        metadata: {
          approvalType: approval.type,
          amount: approval.amount,
          vendorId: approval.vendorId,
          invoiceId: approval.invoiceId,
        },
      }
    );

    await fireNotification({
      tenantId: auth.tenantId,
      audience: 'OWNER',
      kind: 'APPROVAL_PENDING',
      title: 'New approval waiting',
      body: approval.title,
      data: { approvalId: id, type: approval.type },
    });

    return c.json({ success: true, data: approval }, 201);
  }
);

// GET /approvals  - list for org/tenant
app.get(
  '/',
  zValidator('query', listApprovalsQuerySchema, validationErrorHook),
  async (c) => {
    const auth = c.get('auth');
    const { orgId, type, status, page, pageSize } = c.req.valid('query');

    const targetOrg = orgId || auth.tenantId;
    const store = getTenantStore(auth.tenantId);

    let items = Array.from(store.values()).filter((a) => a.orgId === targetOrg);
    if (type) items = items.filter((a) => a.type === type);
    if (status) items = items.filter((a) => a.status === status);

    // Pending first, then by createdAt desc
    items.sort((a, b) => {
      if (a.status === b.status) {
        return b.createdAt.localeCompare(a.createdAt);
      }
      if (a.status === 'PENDING') return -1;
      if (b.status === 'PENDING') return 1;
      return b.createdAt.localeCompare(a.createdAt);
    });

    const totalItems = items.length;
    const start = (page - 1) * pageSize;
    const pageItems = items.slice(start, start + pageSize);

    return c.json({
      success: true,
      data: pageItems,
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
      },
    });
  }
);

// GET /approvals/:id - detail
app.get('/:id', zValidator('param', idParamSchema), async (c) => {
  const auth = c.get('auth');
  const { id } = c.req.valid('param');
  const approval = getTenantStore(auth.tenantId).get(id);
  if (!approval) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Approval not found' } },
      404
    );
  }
  return c.json({ success: true, data: approval });
});

// POST /approvals/:id/approve
app.post('/:id/approve', zValidator('param', idParamSchema), async (c) => {
  const auth = c.get('auth');
  const { id } = c.req.valid('param');
  const store = getTenantStore(auth.tenantId);
  const approval = store.get(id);
  if (!approval) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Approval not found' } },
      404
    );
  }
  if (approval.status !== 'PENDING') {
    return c.json(
      {
        success: false,
        error: {
          code: 'INVALID_STATE',
          message: `Approval is already ${approval.status.toLowerCase()}`,
        },
      },
      409
    );
  }

  const now = new Date().toISOString();
  approval.status = 'APPROVED';
  approval.decidedAt = now;
  approval.decidedById = auth.userId;
  approval.updatedAt = now;
  approval.audit.push({
    at: now,
    actorId: auth.userId,
    action: 'APPROVED',
    context: { role: auth.role },
  });
  store.set(id, approval);

  await auditRequest(
    c,
    'APPROVAL_APPROVED',
    { type: 'Approval', id },
    {
      category: 'PAYMENT',
      metadata: {
        approvalType: approval.type,
        amount: approval.amount,
        vendorId: approval.vendorId,
        invoiceId: approval.invoiceId,
      },
    }
  );

  if (approval.vendorId) {
    await fireNotification({
      tenantId: auth.tenantId,
      userId: approval.vendorId,
      audience: 'VENDOR',
      kind: 'APPROVAL_DECIDED',
      title: 'Invoice approved',
      body: approval.title,
      data: { approvalId: id, status: 'APPROVED' },
    });
  }

  return c.json({ success: true, data: approval });
});

// POST /approvals/:id/reject
app.post(
  '/:id/reject',
  zValidator('param', idParamSchema),
  zValidator('json', rejectSchema, validationErrorHook),
  async (c) => {
    const auth = c.get('auth');
    const { id } = c.req.valid('param');
    const { reason } = c.req.valid('json');
    const store = getTenantStore(auth.tenantId);
    const approval = store.get(id);
    if (!approval) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Approval not found' } },
        404
      );
    }
    if (approval.status !== 'PENDING') {
      return c.json(
        {
          success: false,
          error: {
            code: 'INVALID_STATE',
            message: `Approval is already ${approval.status.toLowerCase()}`,
          },
        },
        409
      );
    }

    const now = new Date().toISOString();
    approval.status = 'REJECTED';
    approval.decidedAt = now;
    approval.decidedById = auth.userId;
    approval.rejectionReason = reason;
    approval.updatedAt = now;
    approval.audit.push({
      at: now,
      actorId: auth.userId,
      action: 'REJECTED',
      reason,
      context: { role: auth.role },
    });
    store.set(id, approval);

    await auditRequest(
      c,
      'APPROVAL_REJECTED',
      { type: 'Approval', id },
      {
        category: 'PAYMENT',
        metadata: {
          approvalType: approval.type,
          amount: approval.amount,
          vendorId: approval.vendorId,
          invoiceId: approval.invoiceId,
          rejectionReason: reason,
        },
      }
    );

    if (approval.vendorId) {
      await fireNotification({
        tenantId: auth.tenantId,
        userId: approval.vendorId,
        audience: 'VENDOR',
        kind: 'APPROVAL_DECIDED',
        title: 'Invoice rejected',
        body: reason,
        data: { approvalId: id, status: 'REJECTED', reason },
      });
    }

    return c.json({ success: true, data: approval });
  }
);

export const approvalsRouter = app;

// Exposed for tests and for cross-route creation (e.g. invoice over threshold).
export function _createApprovalInProcess(input: Omit<Approval, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'audit'> & { id?: string }): Approval {
  const now = new Date().toISOString();
  const id = input.id || genId();
  const approval: Approval = {
    ...input,
    id,
    status: 'PENDING',
    audit: [
      {
        at: now,
        actorId: input.requestedById,
        action: 'CREATED',
        context: { amount: input.amount, threshold: input.threshold },
      },
    ],
    createdAt: now,
    updatedAt: now,
  };
  getTenantStore(input.tenantId).set(id, approval);
  return approval;
}
