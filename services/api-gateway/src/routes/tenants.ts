import { Router, Response } from 'express';
import { AuthenticatedRequest, requireRole } from '../middleware/auth';
import { UserRole } from '../types/user-role';
import { DEMO_TENANT } from '../data/mock-data';

export const tenantsRouter = Router();

// GET /tenants/current - Get current tenant
tenantsRouter.get('/current', (req, res: Response) => {
  const auth = (req as AuthenticatedRequest).auth;

  // In a real implementation, fetch from database
  if (auth.tenantId !== DEMO_TENANT.id) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Tenant not found' },
    });
  }

  res.json({
    success: true,
    data: DEMO_TENANT,
  });
});

// PATCH /tenants/current - Update current tenant
tenantsRouter.patch('/current', requireRole(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN), (req, res: Response) => {
  const auth = (req as AuthenticatedRequest).auth;
  const updates = req.body;

  // In a real implementation, validate and update in database
  res.json({
    success: true,
    data: {
      ...DEMO_TENANT,
      ...updates,
      updatedAt: new Date(),
      updatedBy: auth.userId,
    },
  });
});

// GET /tenants/current/settings - Get tenant settings
tenantsRouter.get('/current/settings', (req, res: Response) => {
  const auth = (req as AuthenticatedRequest).auth;

  res.json({
    success: true,
    data: DEMO_TENANT.settings,
  });
});

// PATCH /tenants/current/settings - Update tenant settings
tenantsRouter.patch('/current/settings', requireRole(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN), (req, res: Response) => {
  const auth = (req as AuthenticatedRequest).auth;
  const updates = req.body;

  res.json({
    success: true,
    data: {
      ...DEMO_TENANT.settings,
      ...updates,
    },
  });
});

// GET /tenants/current/subscription - Get subscription info
tenantsRouter.get('/current/subscription', (req, res: Response) => {
  res.json({
    success: true,
    data: DEMO_TENANT.subscription,
  });
});
