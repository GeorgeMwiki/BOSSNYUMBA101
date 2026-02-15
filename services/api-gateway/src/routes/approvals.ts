import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { DEMO_APPROVALS, DEMO_USERS, getByTenant, getById, paginate } from '../data/mock-data';

export const approvalsRouter = Router();

// GET /approvals - List approvals
approvalsRouter.get('/', (req, res: Response) => {
  const auth = (req as AuthenticatedRequest).auth;
  const { page = '1', pageSize = '10', status, type } = req.query;

  let approvals = getByTenant(DEMO_APPROVALS, auth.tenantId);

  // Filter by status
  if (status) {
    approvals = approvals.filter((a) => a.status === status);
  }

  // Filter by type
  if (type) {
    approvals = approvals.filter((a) => a.type === type);
  }

  // Sort by creation date
  approvals.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const result = paginate(approvals, Number(page), Number(pageSize));

  // Enrich with requester info
  const enrichedData = result.data.map((approval) => {
    const requester = getById(DEMO_USERS, approval.requesterId);
    const approver = approval.approverId ? getById(DEMO_USERS, approval.approverId) : null;

    return {
      ...approval,
      requester: requester ? {
        id: requester.id,
        name: `${requester.firstName} ${requester.lastName}`,
      } : null,
      approver: approver ? {
        id: approver.id,
        name: `${approver.firstName} ${approver.lastName}`,
      } : null,
    };
  });

  res.json({
    success: true,
    data: enrichedData,
    pagination: result.pagination,
  });
});

// GET /approvals/:id - Get approval by ID
approvalsRouter.get('/:id', (req, res: Response) => {
  const auth = (req as AuthenticatedRequest).auth;
  const { id } = req.params;

  const approval = getById(DEMO_APPROVALS, id);

  if (!approval || approval.tenantId !== auth.tenantId) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Approval not found' },
    });
  }

  const requester = getById(DEMO_USERS, approval.requesterId);
  const approver = approval.approverId ? getById(DEMO_USERS, approval.approverId) : null;

  res.json({
    success: true,
    data: {
      ...approval,
      requester,
      approver,
    },
  });
});

// POST /approvals/:id/approve - Approve an approval request
approvalsRouter.post('/:id/approve', (req, res: Response) => {
  const auth = (req as AuthenticatedRequest).auth;
  const { id } = req.params;
  const { decision } = req.body;

  const approval = getById(DEMO_APPROVALS, id);

  if (!approval || approval.tenantId !== auth.tenantId) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Approval not found' },
    });
  }

  if (approval.status !== 'PENDING') {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_STATE', message: 'Approval is not pending' },
    });
  }

  // In a real implementation, this would update the database
  res.json({
    success: true,
    data: {
      ...approval,
      status: 'APPROVED',
      approverId: auth.userId,
      decision: decision || 'Approved',
      decidedAt: new Date(),
    },
  });
});

// POST /approvals/:id/reject - Reject an approval request
approvalsRouter.post('/:id/reject', (req, res: Response) => {
  const auth = (req as AuthenticatedRequest).auth;
  const { id } = req.params;
  const { decision } = req.body;

  const approval = getById(DEMO_APPROVALS, id);

  if (!approval || approval.tenantId !== auth.tenantId) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Approval not found' },
    });
  }

  if (approval.status !== 'PENDING') {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_STATE', message: 'Approval is not pending' },
    });
  }

  res.json({
    success: true,
    data: {
      ...approval,
      status: 'REJECTED',
      approverId: auth.userId,
      decision: decision || 'Rejected',
      decidedAt: new Date(),
    },
  });
});
