// @ts-nocheck
/**
 * Approvals API routes
 *
 * Wired to @bossnyumba/domain-services ApprovalService when available.
 * Falls back to in-memory ApprovalRequestStore (provided by the same
 * package) so the endpoints return real, mutable data. If the domain
 * package cannot be loaded, returns 501 Not Implemented.
 *
 * Scope: approvals are filtered by the caller's active org id
 * (c.get('activeOrgId')) and fall back to auth.tenantId when no
 * org context is set.
 */

import { Hono } from 'hono';
import { authMiddleware } from '../middleware/hono-auth';

// ---------------------------------------------------------------------------
// Approval model (types)
// ---------------------------------------------------------------------------

export type ApprovalType =
  | 'lease'
  | 'expense'
  | 'refund'
  | 'maintenance_cost'
  | 'tenant_application'
  | 'rent_adjustment';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'escalated';

export interface Approval {
  id: string;
  tenantId: string;
  orgId: string;
  type: ApprovalType;
  entityId: string;
  requestedBy: string;
  amount: number;
  reason: string;
  status: ApprovalStatus;
  approvers: string[];
  comments: string[];
  createdAt: string;
  updatedAt?: string;
  approvedBy?: string;
  rejectedBy?: string;
  escalatedBy?: string;
}

// ---------------------------------------------------------------------------
// Lazy-loaded domain service
// ---------------------------------------------------------------------------

interface DomainHandle {
  available: boolean;
  service?: any;
  requestStore?: any;
  reason?: string;
}

let domainHandle: DomainHandle | null = null;

async function getDomainHandle(): Promise<DomainHandle> {
  if (domainHandle) return domainHandle;
  try {
    const mod: any = await import('@bossnyumba/domain-services');
    const requestStore = new mod.MemoryApprovalRequestStore();
    const ruleStore = new mod.MemoryApprovalRuleStore();
    const eventBus = {
      async publish() {
        /* noop event bus for gateway-local state */
      },
    };
    const service = new mod.ApprovalService(requestStore, ruleStore, eventBus);
    domainHandle = { available: true, service, requestStore };
  } catch (err) {
    domainHandle = {
      available: false,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
  return domainHandle;
}

function getOrgId(c: any): string {
  return c.get('activeOrgId') || c.get('auth')?.tenantId;
}

function notImplemented(c: any, reason?: string) {
  return c.json(
    {
      success: false,
      error: {
        code: 'APPROVALS_NOT_CONFIGURED',
        message:
          'Approvals service is not available. @bossnyumba/domain-services could not be loaded.',
        detail: reason,
      },
    },
    501
  );
}

function toApproval(row: any, orgId: string): Approval {
  return {
    id: row.id,
    tenantId: row.tenantId,
    orgId,
    type: row.type,
    entityId: row.entityId,
    requestedBy: row.requestedBy,
    amount: row.amount,
    reason: row.reason,
    status: row.status,
    approvers: [...(row.approvers ?? [])],
    comments: [...(row.comments ?? [])],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    approvedBy: row.approvedBy,
    rejectedBy: row.rejectedBy,
    escalatedBy: row.escalatedBy,
  };
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

const app = new Hono();
app.use('*', authMiddleware);

// GET / - list approvals for active org (optionally filter by status/type)
app.get('/', async (c) => {
  const handle = await getDomainHandle();
  if (!handle.available) return notImplemented(c, handle.reason);

  const auth = c.get('auth');
  const orgId = getOrgId(c);
  const statusFilter = c.req.query('status') as ApprovalStatus | undefined;
  const typeFilter = c.req.query('type') as ApprovalType | undefined;

  const rows = await handle.requestStore.findPendingByApprover(orgId, auth.userId);
  let items = rows.map((r: any) => toApproval(r, orgId));

  if (statusFilter) items = items.filter((a) => a.status === statusFilter);
  if (typeFilter) items = items.filter((a) => a.type === typeFilter);

  return c.json({ success: true, data: items });
});

// GET /:id - fetch one
app.get('/:id', async (c) => {
  const handle = await getDomainHandle();
  if (!handle.available) return notImplemented(c, handle.reason);

  const orgId = getOrgId(c);
  const id = c.req.param('id');
  const row = await handle.requestStore.findById(id, orgId);

  if (!row) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Approval not found' } },
      404
    );
  }
  return c.json({ success: true, data: toApproval(row, orgId) });
});

// POST / - create an approval request
app.post('/', async (c) => {
  const handle = await getDomainHandle();
  if (!handle.available) return notImplemented(c, handle.reason);

  const auth = c.get('auth');
  const orgId = getOrgId(c);
  const body = await c.req.json().catch(() => ({}));

  if (!body.type || !body.entityId || typeof body.amount !== 'number') {
    return c.json(
      {
        success: false,
        error: { code: 'VALIDATION_FAILED', message: 'type, entityId, amount are required' },
      },
      400
    );
  }

  const result = await handle.service.createApprovalRequest(
    orgId,
    body.type,
    body.entityId,
    auth.userId,
    body.amount,
    body.reason ?? ''
  );

  if (!result.success) {
    return c.json({ success: false, error: result.error }, 400);
  }
  return c.json({ success: true, data: toApproval(result.data, orgId) }, 201);
});

// POST /:id/approve
app.post('/:id/approve', async (c) => {
  const handle = await getDomainHandle();
  if (!handle.available) return notImplemented(c, handle.reason);

  const auth = c.get('auth');
  const orgId = getOrgId(c);
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));

  const result = await handle.service.approveRequest(id, orgId, auth.userId, body.comment);
  if (!result.success) {
    const status = result.error.code === 'REQUEST_NOT_FOUND' ? 404 : 409;
    return c.json({ success: false, error: result.error }, status);
  }
  return c.json({ success: true, data: toApproval(result.data, orgId) });
});

// POST /:id/reject
app.post('/:id/reject', async (c) => {
  const handle = await getDomainHandle();
  if (!handle.available) return notImplemented(c, handle.reason);

  const auth = c.get('auth');
  const orgId = getOrgId(c);
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const reason = body.reason ?? 'Rejected by approver';

  const result = await handle.service.rejectRequest(id, orgId, auth.userId, reason);
  if (!result.success) {
    const status = result.error.code === 'REQUEST_NOT_FOUND' ? 404 : 409;
    return c.json({ success: false, error: result.error }, status);
  }
  return c.json({ success: true, data: toApproval(result.data, orgId) });
});

export const approvalsRouter = app;
