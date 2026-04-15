// @ts-nocheck

import crypto from 'crypto';
import { Hono } from 'hono';
import bcrypt from 'bcrypt';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { getDatabaseClient } from '../middleware/database';
import { authMiddleware } from '../middleware/hono-auth';
import { generateToken } from '../middleware/auth';
import {
  tenants,
  users,
  roles,
  userRoles,
  RefreshTokenRepository,
} from '@bossnyumba/database';
import { auth as authConfig } from '@bossnyumba/config';
import { UserRole } from '../types/user-role';
import { activatePendingMemberships } from './memberships.hono';

const app = new Hono();

// ---------------------------------------------------------------------------
// Token helpers
// ---------------------------------------------------------------------------

/**
 * Read TTL knobs lazily so tests can override env after import. Falls back to
 * the documented defaults (15 min access / 30 day refresh) if @bossnyumba/config
 * isn't loaded (e.g. mock-mode tests that never read env).
 */
function getAuthTtls(): { accessSeconds: number; refreshDays: number } {
  try {
    const cfg = authConfig();
    return {
      accessSeconds: cfg.accessTokenTtlSeconds ?? 900,
      refreshDays: cfg.refreshTokenTtlDays ?? 30,
    };
  } catch {
    return { accessSeconds: 900, refreshDays: 30 };
  }
}

/** Generate an opaque 256-bit refresh token, base64url-encoded. NOT a JWT. */
function generateRefreshToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/** SHA-256 hex digest. We never persist the plaintext refresh token. */
function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function refreshTokenExpiry(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function issueAccessToken(record: {
  userId: string;
  tenantId: string;
  role: UserRole;
  permissions: string[];
  propertyAccess: string[];
}): { token: string; expiresAt: string; ttlSeconds: number } {
  const { accessSeconds } = getAuthTtls();
  const token = generateToken(
    {
      userId: record.userId,
      tenantId: record.tenantId,
      role: record.role,
      permissions: record.permissions,
      propertyAccess: record.propertyAccess,
    },
    { expiresInSeconds: accessSeconds }
  );
  return {
    token,
    expiresAt: new Date(Date.now() + accessSeconds * 1000).toISOString(),
    ttlSeconds: accessSeconds,
  };
}

/**
 * Persist a fresh refresh token for (userId, tenantId, deviceId?). Returns
 * the plaintext refresh token (only ever returned ONCE, to the client) and
 * its expiry timestamp.
 */
async function issueAndStoreRefreshToken(
  userId: string,
  tenantId: string,
  deviceId: string | null
): Promise<{ refreshToken: string; refreshTokenExpiresAt: string } | null> {
  const db = getDatabaseClient();
  if (!db) return null;

  const { refreshDays } = getAuthTtls();
  const refreshToken = generateRefreshToken();
  const tokenHash = hashRefreshToken(refreshToken);
  const expiresAt = refreshTokenExpiry(refreshDays);

  const repo = new RefreshTokenRepository(db);
  await repo.create({
    userId,
    tenantId,
    deviceId,
    tokenHash,
    expiresAt,
  });

  return {
    refreshToken,
    refreshTokenExpiresAt: expiresAt.toISOString(),
  };
}

function readDeviceId(c: any): string | null {
  const value = c.req.header('x-device-id') || c.req.header('X-Device-Id');
  return value ? String(value).slice(0, 255) : null;
}

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

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

app.post('/login', async (c) => {
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
  if (!email) {
    return c.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'Email is required' } },
      400
    );
  }
  if (typeof email !== 'string' || !email.includes('@')) {
    return c.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid email format' } },
      400
    );
  }
  if (!password) {
    return c.json(
      {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Email and password are required.' },
      },
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

  // Auto-activate any pending cross-tenant invitations addressed to this email.
  // Safe to call on every login: no-op when there are no pending rows.
  try {
    await activatePendingMemberships(db, record.id, record.email);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('activatePendingMemberships failed', err);
  }

  const memberships = await resolveMembershipsForEmail(record.email);

  const access = issueAccessToken({
    userId: record.id,
    tenantId: record.tenantId,
    role: record.role,
    permissions: record.permissions,
    propertyAccess: record.propertyAccess,
  });

  const deviceId = readDeviceId(c);
  const refresh = await issueAndStoreRefreshToken(record.id, record.tenantId, deviceId);

  return c.json({
    success: true,
    data: {
      // Legacy field kept for back-compat with existing clients.
      token: access.token,
      accessToken: access.token,
      refreshToken: refresh?.refreshToken ?? null,
      refreshTokenExpiresAt: refresh?.refreshTokenExpiresAt ?? null,
      tokenType: 'Bearer',
      expiresIn: access.ttlSeconds,
      user: buildUserPayload(record),
      tenant: buildTenantPayload(record),
      role: record.role,
      permissions: record.permissions,
      properties: record.propertyAccess,
      memberships,
      activeOrgId: record.tenantId,
      expiresAt: access.expiresAt,
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

/**
 * POST /refresh
 *
 * Real refresh-token rotation with compromise detection.
 *
 * Happy path:
 *   1. Caller posts { refreshToken } (opaque random string).
 *   2. We hash it and look the row up.
 *   3. If the row is active (not revoked, not expired), we:
 *      a) issue a NEW access token (short-lived JWT)
 *      b) issue a NEW refresh token (opaque), persist its hash
 *      c) mark the OLD row as used and link replaced_by_token_hash -> new hash
 *      d) return both new tokens
 *
 * Compromise detection:
 *   - If the row is unknown -> 401, nothing to revoke.
 *   - If the row exists but is expired -> 401, no chain action (natural EOL).
 *   - If the row exists but was already used (revoked_at set AND
 *     replaced_by_token_hash set), an attacker is replaying a rotated token.
 *     We REVOKE the entire user's active refresh chain and return 401.
 *   - If the row was revoked for any other reason (logout/admin) -> 401.
 */
app.post('/refresh', async (c) => {
  let body: { refreshToken?: string } = {};
  try {
    body = await c.req.json();
  } catch {
    body = {};
  }

  const presented = (body?.refreshToken ?? '').trim();
  if (!presented) {
    return c.json(
      {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'refreshToken is required.' },
      },
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

  const repo = new RefreshTokenRepository(db);
  const presentedHash = hashRefreshToken(presented);
  const row = await repo.findByTokenHash(presentedHash);

  // Unknown token: opaque 401, no chain to revoke.
  if (!row) {
    return c.json(
      { success: false, error: { code: 'INVALID_REFRESH_TOKEN', message: 'Refresh token is invalid.' } },
      401
    );
  }

  const now = Date.now();

  // Already-used token being replayed -> compromise. Revoke the chain.
  if (row.revokedAt && row.replacedByTokenHash) {
    await repo.revokeByUserId(row.userId);
    return c.json(
      {
        success: false,
        error: {
          code: 'REFRESH_TOKEN_REUSED',
          message: 'Refresh token has already been used. All sessions for this user have been revoked.',
        },
      },
      401
    );
  }

  // Revoked (logout / admin / earlier compromise) but never rotated.
  if (row.revokedAt) {
    return c.json(
      { success: false, error: { code: 'REFRESH_TOKEN_REVOKED', message: 'Refresh token has been revoked.' } },
      401
    );
  }

  // Expired.
  if (new Date(row.expiresAt).getTime() <= now) {
    return c.json(
      { success: false, error: { code: 'REFRESH_TOKEN_EXPIRED', message: 'Refresh token has expired.' } },
      401
    );
  }

  // Re-resolve the user so role/permissions reflect the current state of the
  // world (not whatever was stamped at login time).
  const userRecord = await resolveUserForTenant(row.userId, row.tenantId);
  if (!userRecord) {
    // The user was deleted while holding a refresh token. Revoke the chain.
    await repo.revokeByUserId(row.userId);
    return c.json(
      { success: false, error: { code: 'USER_NOT_FOUND', message: 'User no longer exists.' } },
      401
    );
  }

  // Rotate.
  const access = issueAccessToken({
    userId: userRecord.id,
    tenantId: userRecord.tenantId,
    role: userRecord.role,
    permissions: userRecord.permissions,
    propertyAccess: userRecord.propertyAccess,
  });

  const { refreshDays } = getAuthTtls();
  const newRefreshToken = generateRefreshToken();
  const newHash = hashRefreshToken(newRefreshToken);
  const newExpiresAt = refreshTokenExpiry(refreshDays);

  await repo.create({
    userId: row.userId,
    tenantId: row.tenantId,
    deviceId: row.deviceId,
    tokenHash: newHash,
    expiresAt: newExpiresAt,
  });

  await repo.markUsed(row.id, newHash);

  return c.json({
    success: true,
    data: {
      token: access.token,
      accessToken: access.token,
      refreshToken: newRefreshToken,
      refreshTokenExpiresAt: newExpiresAt.toISOString(),
      tokenType: 'Bearer',
      expiresIn: access.ttlSeconds,
      expiresAt: access.expiresAt,
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

  const access = issueAccessToken({
    userId: switched.id,
    tenantId: switched.tenantId,
    role: switched.role,
    permissions: switched.permissions,
    propertyAccess: switched.propertyAccess,
  });

  return c.json({
    success: true,
    data: {
      token: access.token,
      accessToken: access.token,
      tokenType: 'Bearer',
      expiresIn: access.ttlSeconds,
      user: buildUserPayload(switched),
      tenant: buildTenantPayload(switched),
      role: switched.role,
      permissions: switched.permissions,
      properties: switched.propertyAccess,
      memberships,
      activeOrgId: switched.tenantId,
      expiresAt: access.expiresAt,
    },
  });
});

/**
 * POST /logout
 *
 * Revokes the refresh token presented in the body. If `allDevices=true` (or
 * if the token's row has a deviceId and `device=true`), revokes every active
 * refresh token belonging to the same user / device chain.
 */
app.post('/logout', async (c) => {
  let body: { refreshToken?: string; allDevices?: boolean } = {};
  try {
    body = await c.req.json();
  } catch {
    body = {};
  }

  const presented = (body?.refreshToken ?? '').trim();
  const db = getDatabaseClient();

  // Without a token (or without DB), logout is best-effort idempotent.
  if (!presented || !db) {
    return c.json({ success: true, data: { loggedOut: true } });
  }

  const repo = new RefreshTokenRepository(db);
  const presentedHash = hashRefreshToken(presented);
  const row = await repo.findByTokenHash(presentedHash);

  if (!row) {
    // Don't leak existence; return 200.
    return c.json({ success: true, data: { loggedOut: true } });
  }

  if (body.allDevices === true) {
    const revoked = await repo.revokeByUserId(row.userId);
    return c.json({ success: true, data: { loggedOut: true, revokedCount: revoked } });
  }

  await repo.revokeByHash(presentedHash);
  return c.json({ success: true, data: { loggedOut: true, revokedCount: 1 } });
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

// Exposed for unit tests.
export const __testables = {
  generateRefreshToken,
  hashRefreshToken,
  refreshTokenExpiry,
};
