import { Router, Response } from 'express';
import { AuthenticatedRequest, requireRole } from '../middleware/auth';
import { UserRole } from '../types/user-role';
import { DEMO_USERS, DEMO_TENANT_USERS, getById, paginate } from '../data/mock-data';

export const usersRouter = Router();

// GET /users - List users
usersRouter.get('/', requireRole(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN, UserRole.PROPERTY_MANAGER), (req, res: Response) => {
  const auth = (req as AuthenticatedRequest).auth;
  const { page = '1', pageSize = '10', status, role, search } = req.query;

  // Get users for this tenant
  const tenantUserIds = DEMO_TENANT_USERS
    .filter((tu) => tu.tenantId === auth.tenantId)
    .map((tu) => tu.userId);

  let users = DEMO_USERS.filter((u) => tenantUserIds.includes(u.id));

  // Filter by status
  if (status) {
    users = users.filter((u) => u.status === status);
  }

  // Filter by role
  if (role) {
    const usersWithRole = DEMO_TENANT_USERS
      .filter((tu) => tu.tenantId === auth.tenantId && tu.role === role)
      .map((tu) => tu.userId);
    users = users.filter((u) => usersWithRole.includes(u.id));
  }

  // Filter by search
  if (search) {
    const searchLower = String(search).toLowerCase();
    users = users.filter(
      (u) =>
        u.firstName.toLowerCase().includes(searchLower) ||
        u.lastName.toLowerCase().includes(searchLower) ||
        u.email.toLowerCase().includes(searchLower)
    );
  }

  const result = paginate(users, Number(page), Number(pageSize));

  // Enrich with role info
  const enrichedData = result.data.map((user) => {
    const tenantUser = DEMO_TENANT_USERS.find(
      (tu) => tu.tenantId === auth.tenantId && tu.userId === user.id
    );
    return {
      ...user,
      role: tenantUser?.role,
      propertyAccess: tenantUser?.propertyAccess,
    };
  });

  res.json({
    success: true,
    data: enrichedData,
    pagination: result.pagination,
  });
});

// GET /users/:id - Get user by ID
usersRouter.get('/:id', (req, res: Response) => {
  const auth = (req as AuthenticatedRequest).auth;
  const { id } = req.params;

  // Users can view their own profile, admins can view any user
  if (id !== auth.userId && ![UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN].includes(auth.role)) {
    return res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Access denied' },
    });
  }

  const user = getById(DEMO_USERS, id);
  const tenantUser = DEMO_TENANT_USERS.find(
    (tu) => tu.tenantId === auth.tenantId && tu.userId === id
  );

  if (!user || !tenantUser) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'User not found' },
    });
  }

  res.json({
    success: true,
    data: {
      ...user,
      role: tenantUser.role,
      permissions: tenantUser.permissions,
      propertyAccess: tenantUser.propertyAccess,
    },
  });
});

// GET /users/me - Get current user
usersRouter.get('/me', (req, res: Response) => {
  const auth = (req as AuthenticatedRequest).auth;

  const user = getById(DEMO_USERS, auth.userId);
  if (!user) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'User not found' },
    });
  }

  res.json({
    success: true,
    data: {
      ...user,
      role: auth.role,
      permissions: auth.permissions,
      propertyAccess: auth.propertyAccess,
    },
  });
});

// PATCH /users/:id - Update user
usersRouter.patch('/:id', (req, res: Response) => {
  const auth = (req as AuthenticatedRequest).auth;
  const { id } = req.params;
  const updates = req.body;

  // Users can update their own profile, admins can update any user
  if (id !== auth.userId && ![UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN].includes(auth.role)) {
    return res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Access denied' },
    });
  }

  const user = getById(DEMO_USERS, id);
  if (!user) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'User not found' },
    });
  }

  // In a real implementation, this would update the database
  res.json({
    success: true,
    data: {
      ...user,
      ...updates,
      updatedAt: new Date(),
      updatedBy: auth.userId,
    },
  });
});
