/**
 * Auth routes - Hono with Zod validation
 * POST /login, POST /logout, POST /refresh, GET /me, GET /demo-users
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { UserRole } from '../types/user-role';
import { generateToken } from '../middleware/auth';
import {
  DEMO_USERS,
  DEMO_TENANT_USERS,
  DEMO_TENANT,
  PLATFORM_ADMIN_USERS,
} from '../data/mock-data';
import { loginSchema } from './validators';
import { authMiddleware } from '../middleware/hono-auth';

const getPermissionsForRole = (role: UserRole): string[] => {
  const basePermissions: Record<UserRole, string[]> = {
    SUPER_ADMIN: ['*'],
    ADMIN: ['users:*', 'tenants:*', 'reports:*', 'settings:*'],
    SUPPORT: ['users:read', 'tenants:read', 'reports:read'],
    TENANT_ADMIN: [
      'users:*',
      'properties:*',
      'units:*',
      'leases:*',
      'invoices:*',
      'payments:*',
      'reports:*',
    ],
    PROPERTY_MANAGER: ['properties:read', 'units:*', 'leases:*', 'work_orders:*', 'customers:*'],
    ACCOUNTANT: ['invoices:*', 'payments:*', 'reports:read'],
    MAINTENANCE_STAFF: ['work_orders:*', 'units:read'],
    OWNER: [
      'properties:read',
      'units:read',
      'leases:read',
      'invoices:read',
      'payments:read',
      'reports:read',
      'approvals:*',
    ],
    RESIDENT: ['leases:read:own', 'invoices:read:own', 'payments:create:own', 'work_orders:create:own'],
  };
  return basePermissions[role] || [];
};

const PLATFORM_ADMIN_ROLES: Record<string, UserRole> = {
  'admin@bossnyumba.com': UserRole.ADMIN,
  'support@bossnyumba.com': UserRole.SUPPORT,
};

const app = new Hono();

app.post('/login', zValidator('json', loginSchema), async (c) => {
  const { email, password } = c.req.valid('json');

  const platformAdmin = PLATFORM_ADMIN_USERS.find((u) => u.email === email);
  if (platformAdmin) {
    const role = PLATFORM_ADMIN_ROLES[email] ?? UserRole.SUPPORT;
    const token = generateToken({
      userId: platformAdmin.id,
      tenantId: 'platform',
      role,
      permissions: getPermissionsForRole(role),
      propertyAccess: ['*'],
    });

    return c.json(
      {
        success: true,
        data: {
          token,
          user: {
            id: platformAdmin.id,
            email: platformAdmin.email,
            firstName: platformAdmin.firstName,
            lastName: platformAdmin.lastName,
            role,
            tenantId: 'platform',
          },
          role,
          permissions: getPermissionsForRole(role),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        },
      },
      200
    );
  }

  const user = DEMO_USERS.find((u) => u.email === email);
  if (!user) {
    return c.json(
      {
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
      },
      401
    );
  }

  const tenantUser = DEMO_TENANT_USERS.find((tu) => tu.userId === user.id);
  if (!tenantUser) {
    return c.json(
      {
        success: false,
        error: {
          code: 'NO_TENANT_ACCESS',
          message: 'User does not have access to any tenant',
        },
      },
      401
    );
  }

  const token = generateToken({
    userId: user.id,
    tenantId: tenantUser.tenantId,
    role: tenantUser.role,
    permissions: [...tenantUser.permissions, ...getPermissionsForRole(tenantUser.role)],
    propertyAccess: tenantUser.propertyAccess,
  });

  return c.json({
    success: true,
    data: {
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: user.avatarUrl,
        role: tenantUser.role,
        tenantId: tenantUser.tenantId,
      },
      tenant: {
        id: tenantUser.tenantId,
        name: DEMO_TENANT.name,
        slug: DEMO_TENANT.slug,
      },
      role: tenantUser.role,
      permissions: [...tenantUser.permissions, ...getPermissionsForRole(tenantUser.role)],
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    },
  });
});

app.post('/logout', (c) => {
  return c.json({
    success: true,
    data: { message: 'Logged out successfully' },
  });
});

app.post('/refresh', authMiddleware, async (c) => {
  const auth = c.get('auth');
  const user = DEMO_USERS.find((u) => u.id === auth.userId);
  const tenantUser = DEMO_TENANT_USERS.find(
    (tu) => tu.tenantId === auth.tenantId && tu.userId === auth.userId
  );

  if (!user || !tenantUser) {
    return c.json(
      {
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User or tenant access not found' },
      },
      404
    );
  }

  const token = generateToken({
    userId: user.id,
    tenantId: tenantUser.tenantId,
    role: tenantUser.role,
    permissions: [...tenantUser.permissions, ...getPermissionsForRole(tenantUser.role)],
    propertyAccess: tenantUser.propertyAccess,
  });

  return c.json({
    success: true,
    data: {
      token,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    },
  });
});

app.get('/me', authMiddleware, async (c) => {
  const auth = c.get('auth');
  const user = DEMO_USERS.find((u) => u.id === auth.userId);
  const tenantUser = DEMO_TENANT_USERS.find(
    (tu) => tu.tenantId === auth.tenantId && tu.userId === auth.userId
  );

  if (!user || !tenantUser) {
    return c.json(
      {
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' },
      },
      404
    );
  }

  return c.json({
    success: true,
    data: {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: user.avatarUrl,
      },
      tenant: {
        id: tenantUser.tenantId,
        name: DEMO_TENANT.name,
        slug: DEMO_TENANT.slug,
      },
      role: tenantUser.role,
      permissions: [...tenantUser.permissions, ...getPermissionsForRole(tenantUser.role)],
    },
  });
});

app.get('/demo-users', (c) => {
  const demoLogins = DEMO_USERS.map((user) => {
    const tenantUser = DEMO_TENANT_USERS.find((tu) => tu.userId === user.id);
    return {
      email: user.email,
      password: 'demo123',
      name: `${user.firstName} ${user.lastName}`,
      role: tenantUser?.role ?? 'Unknown',
    };
  });

  return c.json({
    success: true,
    data: demoLogins,
  });
});

export const authRouter = app;
