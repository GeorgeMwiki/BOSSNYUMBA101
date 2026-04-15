import { Hono } from 'hono';
import bcrypt from 'bcrypt';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { getDatabaseClient } from '../middleware/database';
import { authMiddleware } from '../middleware/hono-auth';
import { generateToken } from '../middleware/auth';
import { tenants, users, roles, userRoles } from '@bossnyumba/database';
import { UserRole } from '../types/user-role';

const app = new Hono();

function mapRoleName(roleName?: string): UserRole {
  switch ((roleName || '').toLowerCase()) {
    case 'super_admin':
    case 'super-admin':
      return UserRole.SUPER_ADMIN;
    case 'support':
      return UserRole.SUPPORT;
    case 'owner':
      return UserRole.OWNER;
    case 'accountant':
      return UserRole.ACCOUNTANT;
    case 'property_manager':
    case 'property-manager':
    case 'manager':
      return UserRole.PROPERTY_MANAGER;
    case 'maintenance':
    case 'maintenance_staff':
      return UserRole.MAINTENANCE_STAFF;
    case 'resident':
      return UserRole.RESIDENT;
    case 'admin':
    case 'administrator':
    default:
      return UserRole.TENANT_ADMIN;
  }
}

async function resolveAuthUser(email: string) {
  const db = getDatabaseClient();
  if (!db) return null;

  const rows = await db
    .select({
      id: users.id,
      tenantId: users.tenantId,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      passwordHash: users.passwordHash,
      status: users.status,
      tenantName: tenants.name,
      tenantSlug: tenants.slug,
      tenantStatus: tenants.status,
    })
    .from(users)
    .innerJoin(tenants, eq(tenants.id, users.tenantId))
    .where(and(eq(users.email, email), isNull(users.deletedAt), isNull(tenants.deletedAt)))
    .limit(1);

  const user = rows[0];
  if (!user) return null;

  const assignments = await db
    .select({ roleId: userRoles.roleId })
    .from(userRoles)
    .where(and(eq(userRoles.userId, user.id), eq(userRoles.tenantId, user.tenantId)));

  const roleIds = assignments.map((row) => row.roleId);
  const roleRows = roleIds.length
    ? await db
        .select({
          id: roles.id,
          name: roles.name,
          permissions: roles.permissions,
          priority: roles.priority,
        })
        .from(roles)
        .where(and(eq(roles.tenantId, user.tenantId), inArray(roles.id, roleIds), isNull(roles.deletedAt)))
    : [];

  roleRows.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  const primaryRole = roleRows[0]?.name;
  const permissions = Array.from(
    new Set(roleRows.flatMap((role) => (Array.isArray(role.permissions) ? role.permissions : [])))
  );

  return {
    ...user,
    role: mapRoleName(primaryRole),
    permissions: permissions.length ? permissions : ['*'],
    propertyAccess: ['*'],
  };
}

async function buildMePayload(auth: any) {
  const db = getDatabaseClient();
  if (!db) {
    return {
      user: {
        id: auth.userId,
        tenantId: auth.tenantId,
        role: auth.role,
        permissions: auth.permissions,
        propertyAccess: auth.propertyAccess,
      },
    };
  }

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      avatarUrl: users.avatarUrl,
      tenantId: tenants.id,
      tenantName: tenants.name,
      tenantSlug: tenants.slug,
    })
    .from(users)
    .innerJoin(tenants, eq(tenants.id, users.tenantId))
    .where(and(eq(users.id, auth.userId), eq(users.tenantId, auth.tenantId), isNull(users.deletedAt)))
    .limit(1);

  const row = rows[0];
  return {
    user: row
      ? {
          id: row.id,
          email: row.email,
          firstName: row.firstName,
          lastName: row.lastName,
          avatarUrl: row.avatarUrl,
        }
      : {
          id: auth.userId,
          tenantId: auth.tenantId,
        },
    tenant: row
      ? {
          id: row.tenantId,
          name: row.tenantName,
          slug: row.tenantSlug,
        }
      : undefined,
    role: auth.role,
    permissions: auth.permissions,
    properties: auth.propertyAccess,
  };
}

app.post('/login', async (c) => {
  const db = getDatabaseClient();
  if (!db) {
    return c.json(
      {
        success: false,
        error: {
          code: 'AUTH_NOT_CONFIGURED',
          message: 'Authentication requires a live database connection.',
        },
      },
      503
    );
  }

  const body = await c.req.json();
  const record = await resolveAuthUser(body.email);
  if (!record?.passwordHash) {
    return c.json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } }, 401);
  }

  const valid = await bcrypt.compare(body.password, record.passwordHash);
  if (!valid) {
    return c.json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } }, 401);
  }

  const token = generateToken({
    userId: record.id,
    tenantId: record.tenantId,
    role: record.role,
    permissions: record.permissions,
    propertyAccess: record.propertyAccess,
  });

  return c.json({
    success: true,
    data: {
      token,
      user: {
        id: record.id,
        email: record.email,
        firstName: record.firstName,
        lastName: record.lastName,
        avatarUrl: record.avatarUrl,
      },
      tenant: {
        id: record.tenantId,
        name: record.tenantName,
        slug: record.tenantSlug,
      },
      role: record.role,
      permissions: record.permissions,
      properties: record.propertyAccess,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    },
  });
});

app.get('/me', authMiddleware, async (c) => {
  const auth = c.get('auth');
  return c.json({ success: true, data: await buildMePayload(auth) });
});

app.post('/refresh', authMiddleware, async (c) => {
  const auth = c.get('auth');
  const token = generateToken({
    userId: auth.userId,
    tenantId: auth.tenantId,
    role: auth.role,
    permissions: auth.permissions,
    propertyAccess: auth.propertyAccess,
  });
  return c.json({
    success: true,
    data: {
      token,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    },
  });
});

app.post('/logout', (_c) => {
  return _c.json({ success: true, data: { loggedOut: true } });
});

app.post('/register', (c) =>
  c.json({ success: false, error: { code: 'LIVE_DATA_NOT_IMPLEMENTED', message: 'Self-registration is not enabled.' } }, 503)
);
app.post('/change-password', (c) =>
  c.json({ success: false, error: { code: 'LIVE_DATA_NOT_IMPLEMENTED', message: 'Password change is not enabled.' } }, 503)
);
app.post('/forgot-password', (c) =>
  c.json({ success: false, error: { code: 'LIVE_DATA_NOT_IMPLEMENTED', message: 'Password reset is not enabled.' } }, 503)
);

export const authRouter = app;
