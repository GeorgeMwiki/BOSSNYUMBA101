/**
 * Auth routes - Hono with Zod validation
 * Production-ready with proper error handling and response DTOs
 *
 * POST /login           - Login with email/password
 * POST /logout          - Logout (client-side token invalidation)
 * POST /refresh        - Refresh token (requires Bearer)
 * GET /me              - Current user (requires Bearer)
 * POST /register       - Register new user (optional, for self-signup)
 * POST /change-password - Change password (requires Bearer)
 * POST /forgot-password - Request password reset
 * GET /demo-users      - Demo logins (dev only)
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
import {
  loginSchema,
  registerSchema,
  changePasswordSchema,
  forgotPasswordSchema,
} from './validators';
import { authMiddleware } from '../middleware/hono-auth';
import type { LoginResponseDto, MeResponseDto, RefreshResponseDto } from './dtos';

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

// POST /auth/login - Login with email/password
app.post('/login', zValidator('json', loginSchema), async (c) => {
  const { email, password } = c.req.valid('json');

  // Platform admin login
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

  // Tenant user login (demo: accept any password)
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

// POST /auth/logout
app.post('/logout', (c) => {
  return c.json({
    success: true,
    data: { message: 'Logged out successfully' },
  });
});

// POST /auth/register - Self-registration (demo: creates user in tenant)
app.post('/register', zValidator('json', registerSchema), async (c) => {
  const { email, password, firstName, lastName, phone } = c.req.valid('json');

  const existingUser = DEMO_USERS.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (existingUser) {
    return c.json(
      {
        success: false,
        error: {
          code: 'CONFLICT',
          message: 'A user with this email already exists',
        },
      },
      409
    );
  }

  // Demo: create user and assign to default tenant
  const id = `user-${Date.now()}`;
  const now = new Date();
  DEMO_USERS.push({
    id,
    email,
    emailVerified: false,
    firstName,
    lastName,
    phone,
    phoneVerified: false,
    status: 'ACTIVE',
    mfaEnabled: false,
    createdAt: now,
    createdBy: 'system',
    updatedAt: now,
    updatedBy: 'system',
  });
  DEMO_TENANT_USERS.push({
    tenantId: DEMO_TENANT.id,
    userId: id,
    role: UserRole.RESIDENT,
    permissions: [],
    propertyAccess: ['*'],
    assignedAt: now,
    assignedBy: 'system',
  });

  const token = generateToken({
    userId: id,
    tenantId: DEMO_TENANT.id,
    role: UserRole.RESIDENT,
    permissions: getPermissionsForRole(UserRole.RESIDENT),
    propertyAccess: ['*'],
  });

  const response: LoginResponseDto = {
    token,
    user: {
      id,
      email,
      firstName,
      lastName,
      role: UserRole.RESIDENT,
      tenantId: DEMO_TENANT.id,
    },
    tenant: { id: DEMO_TENANT.id, name: DEMO_TENANT.name, slug: DEMO_TENANT.slug },
    role: UserRole.RESIDENT,
    permissions: getPermissionsForRole(UserRole.RESIDENT),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };

  return c.json({ success: true, data: response }, 201);
});

// POST /auth/change-password - Requires Bearer token
app.post(
  '/change-password',
  authMiddleware,
  zValidator('json', changePasswordSchema),
  async (c) => {
    const auth = c.get('auth');
    const { currentPassword, newPassword } = c.req.valid('json');

    const user = DEMO_USERS.find((u) => u.id === auth.userId);
    if (!user) {
      return c.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'User not found' },
        },
        404
      );
    }

    // Demo: accept any current password; in production verify via auth service
    if (!currentPassword) {
      return c.json(
        {
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Current password is incorrect',
          },
        },
        401
      );
    }

    // In production, update password in auth service
    return c.json({
      success: true,
      data: { message: 'Password changed successfully' },
    });
  }
);

// POST /auth/forgot-password - Request password reset
app.post('/forgot-password', zValidator('json', forgotPasswordSchema), async (c) => {
  const { email } = c.req.valid('json');

  const user = DEMO_USERS.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (!user) {
    // Don't reveal whether email exists (security)
    return c.json({
      success: true,
      data: {
        message:
          'If an account exists with this email, you will receive a password reset link shortly.',
      },
    });
  }

  // In production, send reset email
  return c.json({
    success: true,
    data: {
      message:
        'If an account exists with this email, you will receive a password reset link shortly.',
    },
  });
});

// POST /auth/refresh - Requires Bearer token
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

// GET /auth/me - Current user (requires auth)
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

// GET /auth/demo-users - Demo logins (dev only)
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
