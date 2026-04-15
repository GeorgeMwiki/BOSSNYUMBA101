// @ts-nocheck

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

/**
 * Resolve a single user row for a given tenant. Used post-login once we know
 * which tenant the caller is acting as (via X-Active-Org header or the token's
 * tenantId claim).
 */
async function resolveUserForTenant(userId: string, tenantId: string) {
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
    .where(
      and(
        eq(users.id, userId),
        eq(users.tenantId, tenantId),
        isNull(users.deletedAt),
        isNull(tenants.deletedAt)
      )
    )
    .limit(1);

  const user = rows[0];
  if (!user) return null;

  const { role, permissions } = await resolveRolesForUser(user.id, user.tenantId);

  return {
    ...user,
    role,
    permissions,
    propertyAccess: ['*'],
  };
}

async function resolveRolesForUser(userId: string, tenantId: string) {
  const db = getDatabaseClient();
  if (!db) return { role: UserRole.TENANT_ADMIN, permissions: ['*'] };

  const assignments = await db
    .select({ roleId: userRoles.roleId })
    .from(userRoles)
    .where(and(eq(userRoles.userId, userId), eq(userRoles.tenantId, tenantId)));

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
        .where(
          and(eq(roles.tenantId, tenantId), inArray(roles.id, roleIds), isNull(roles.deletedAt))
        )
    : [];

  roleRows.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  const primaryRole = roleRows[0]?.name;
  const permissions = Array.from(
    new Set(roleRows.flatMap((role) => (Array.isArray(role.permissions) ? role.permissions : [])))
  );

  return {
    role: mapRoleName(primaryRole),
    permissions: permissions.length ? permissions : ['*'],
  };
}

/**
 * Build the list of org memberships for a given email. A "membership" is a
 * (user_row, tenant) pair. Since `users` rows are tenant-scoped, a human who
 * belongs to multiple orgs has one row per tenant sharing the same email.
 */
async function resolveMembershipsForEmail(email: string) {
  const db = getDatabaseClient();
  if (!db) return [];

  const rows = await db
    .select({
      userId: users.id,
      tenantId: tenants.id,
      tenantName: tenants.name,
      tenantSlug: tenants.slug,
      tenantStatus: tenants.status,
    })
    .from(users)
    .innerJoin(tenants, eq(tenants.id, users.tenantId))
    .where(and(eq(users.email, email), isNull(users.deletedAt), isNull(tenants.deletedAt)));

  const memberships = [];
  for (const row of rows) {
    const { role, permissions } = await resolveRolesForUser(row.userId, row.tenantId);
    memberships.push({
      userId: row.userId,
      tenantId: row.tenantId,
      tenantName: row.tenantName,
      tenantSlug: row.tenantSlug,
      tenantStatus: row.tenantStatus,
      role,
      permissions,
    });
  }
  return memberships;
}

/**
 * Find the primary (login) user row by email. We pick the first active tenant
 * as the default active org. Callers can switch via X-Active-Org.
 */
async function resolveLoginCandidate(email: string) {
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

  const { role, permissions } = await resolveRolesForUser(user.id, user.tenantId);

  return {
    ...user,
    role,
    permissions,
    propertyAccess: ['*'],
  };
}

function buildUserPayload(record: any) {
  return {
    id: record.id,
    email: record.email,
    firstName: record.firstName,
    lastName: record.lastName,
    displayName: record.displayName,
    avatarUrl: record.avatarUrl,
  };
}

function buildTenantPayload(record: any) {
  return {
    id: record.tenantId ?? record.id,
    name: record.tenantName ?? record.name,
    slug: record.tenantSlug ?? record.slug,
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

  let body: { email?: string; password?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json(
      {
        success: false,
        error: { code: 'INVALID_REQUEST', message: 'Request body must be valid JSON.' },
      },
      400
    );
  }

  const email = (body?.email ?? '').trim().toLowerCase();
  const password = body?.password ?? '';
  if (!email || !password) {
    return c.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Email and password are required.',
        },
      },
      400
    );
  }

  const record = await resolveLoginCandidate(email);
  if (!record?.passwordHash) {
    return c.json(
      { success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } },
      401
    );
  }

  const valid = await bcrypt.compare(password, record.passwordHash);
  if (!valid) {
    return c.json(
      { success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } },
      401
    );
  }

  if (record.status && record.status !== 'active' && record.status !== 'pending_activation') {
    return c.json(
      {
        success: false,
        error: {
          code: 'ACCOUNT_DISABLED',
          message: 'This account is not currently active. Contact your administrator.',
        },
      },
      403
    );
  }

  const memberships = await resolveMembershipsForEmail(email);

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
      user: buildUserPayload(record),
      tenant: buildTenantPayload(record),
      role: record.role,
      permissions: record.permissions,
      properties: record.propertyAccess,
      memberships,
      activeOrgId: record.tenantId,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    },
  });
});

app.get('/me', authMiddleware, async (c) => {
  const auth = c.get('auth');

  // Honor X-Active-Org header: if the caller provides it and it resolves to a
  // tenant the user is a member of, hydrate against that tenant.
  const requestedOrg = c.req.header('x-active-org') || c.req.header('X-Active-Org');

  const db = getDatabaseClient();
  if (!db) {
    return c.json({
      success: true,
      data: {
        user: {
          id: auth.userId,
          tenantId: auth.tenantId,
        },
        role: auth.role,
        permissions: auth.permissions,
        properties: auth.propertyAccess,
        memberships: [],
        activeOrgId: auth.tenantId,
      },
    });
  }

  // Resolve the primary record to get the email, then list memberships.
  const primary = await resolveUserForTenant(auth.userId, auth.tenantId);
  if (!primary) {
    return c.json(
      {
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'Authenticated user no longer exists.' },
      },
      404
    );
  }

  const memberships = await resolveMembershipsForEmail(primary.email);

  let active = primary;
  let activeOrgId = auth.tenantId;
  if (requestedOrg && memberships.some((m) => m.tenantId === requestedOrg)) {
    const match = memberships.find((m) => m.tenantId === requestedOrg)!;
    const switched = await resolveUserForTenant(match.userId, match.tenantId);
    if (switched) {
      active = switched;
      activeOrgId = match.tenantId;
    }
  }

  return c.json({
    success: true,
    data: {
      user: buildUserPayload(active),
      tenant: buildTenantPayload(active),
      role: active.role,
      permissions: active.permissions,
      properties: active.propertyAccess,
      memberships,
      activeOrgId,
    },
  });
});

app.post('/refresh', authMiddleware, async (c) => {
  const auth = c.get('auth');

  // TODO: wire a real refresh-token store. Today we re-issue on the current
  // access token which means a compromised token can be extended indefinitely.
  // A production implementation should:
  //   1. Store refresh tokens in a `refresh_tokens` table keyed to userId+deviceId
  //   2. Require the refresh token (not the access token) in the request body
  //   3. Rotate the refresh token on each use and revoke on logout
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

app.post('/switch-org', authMiddleware, async (c) => {
  const auth = c.get('auth');
  let body: { tenantId?: string; orgId?: string };
  try {
    body = await c.req.json();
  } catch {
    body = {};
  }
  const targetId = (body.tenantId || body.orgId || '').trim();
  if (!targetId) {
    return c.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'tenantId is required.' } },
      400
    );
  }

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

  const primary = await resolveUserForTenant(auth.userId, auth.tenantId);
  if (!primary) {
    return c.json(
      { success: false, error: { code: 'USER_NOT_FOUND', message: 'User not found.' } },
      404
    );
  }
  const memberships = await resolveMembershipsForEmail(primary.email);
  const match = memberships.find((m) => m.tenantId === targetId);
  if (!match) {
    return c.json(
      {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You are not a member of the requested organization.',
        },
      },
      403
    );
  }

  const switched = await resolveUserForTenant(match.userId, match.tenantId);
  if (!switched) {
    return c.json(
      { success: false, error: { code: 'USER_NOT_FOUND', message: 'User not found for org.' } },
      404
    );
  }

  const token = generateToken({
    userId: switched.id,
    tenantId: switched.tenantId,
    role: switched.role,
    permissions: switched.permissions,
    propertyAccess: switched.propertyAccess,
  });

  return c.json({
    success: true,
    data: {
      token,
      user: buildUserPayload(switched),
      tenant: buildTenantPayload(switched),
      role: switched.role,
      permissions: switched.permissions,
      properties: switched.propertyAccess,
      memberships,
      activeOrgId: switched.tenantId,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    },
  });
});

app.post('/logout', (_c) => {
  // TODO: when refresh-token store lands, revoke the caller's refresh token here.
  return _c.json({ success: true, data: { loggedOut: true } });
});

app.post('/register', (c) =>
  c.json(
    {
      success: false,
      error: { code: 'LIVE_DATA_NOT_IMPLEMENTED', message: 'Self-registration is not enabled.' },
    },
    503
  )
);
app.post('/change-password', (c) =>
  c.json(
    {
      success: false,
      error: { code: 'LIVE_DATA_NOT_IMPLEMENTED', message: 'Password change is not enabled.' },
    },
    503
  )
);
app.post('/forgot-password', (c) =>
  c.json(
    {
      success: false,
      error: { code: 'LIVE_DATA_NOT_IMPLEMENTED', message: 'Password reset is not enabled.' },
    },
    503
  )
);

export const authRouter = app;
