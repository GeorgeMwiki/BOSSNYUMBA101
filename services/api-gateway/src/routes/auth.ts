// @ts-nocheck
/**
 * Authentication routes (Hono)
 *
 * Real implementation backed by `@bossnyumba/database`:
 *   - POST /login              : bcrypt verify + audit + (optional) MFA gate
 *   - POST /refresh            : re-issue token from current auth context
 *   - POST /logout             : audit logout event
 *   - POST /mfa/challenge      : issue (and audit) an MFA challenge for a user
 *   - POST /mfa/verify         : verify MFA code, return final session token
 *   - GET  /me                 : profile + tenant + permissions
 *
 * All mutations emit audit events via the `writeAuditEvent` adapter.
 */

import { Hono } from 'hono';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { getDatabaseClient } from '../middleware/database';
import { authMiddleware } from '../middleware/hono-auth';
import { generateToken } from '../middleware/auth';
import { tenants, users, roles, userRoles } from '@bossnyumba/database';
import { UserRole } from '../types/user-role';
import { writeAuditEvent } from '../adapters/audit-log';
import {
  loginSchema,
  refreshSchema,
  mfaChallengeSchema,
  mfaVerifySchema,
} from '../schemas/index';

const app = new Hono();

// ============================================================================
// MFA challenge cache (in-memory; replace with Redis in production)
// ============================================================================

interface PendingMfa {
  userId: string;
  tenantId: string;
  code: string;
  expiresAt: number;
}

const PENDING_MFA = new Map<string, PendingMfa>();
const MFA_TTL_MS = 5 * 60 * 1000;

function newChallengeId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `mfa_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function newOtpCode(): string {
  return Math.floor(100_000 + Math.random() * 900_000).toString();
}

// ============================================================================
// Helpers
// ============================================================================

function clientIp(c: any): string | null {
  return (
    c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() ||
    c.req.header('X-Real-IP') ||
    null
  );
}

function userAgent(c: any): string | null {
  return c.req.header('User-Agent') || null;
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
      return UserRole.ADMIN;
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
      mfaEnabled: users.mfaEnabled,
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

  const roleIds = assignments.map((row: any) => row.roleId);
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

  roleRows.sort((a: any, b: any) => (b.priority ?? 0) - (a.priority ?? 0));
  const primaryRole = roleRows[0]?.name;
  const permissions = Array.from(
    new Set(roleRows.flatMap((role: any) => (Array.isArray(role.permissions) ? role.permissions : [])))
  );

  return {
    ...user,
    role: mapRoleName(primaryRole),
    permissions: permissions.length ? (permissions as string[]) : ['*'],
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

function tokenForUser(record: any) {
  const token = generateToken({
    userId: record.id,
    tenantId: record.tenantId,
    role: record.role,
    permissions: record.permissions,
    propertyAccess: record.propertyAccess,
  });
  return {
    token,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
}

// ============================================================================
// Routes
// ============================================================================

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

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json(
      { success: false, error: { code: 'INVALID_REQUEST', message: 'Request body must be JSON.' } },
      400
    );
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Invalid login payload.',
          details: parsed.error.flatten(),
        },
      },
      400
    );
  }

  const record = await resolveAuthUser(parsed.data.email);
  if (!record?.passwordHash) {
    await writeAuditEvent(db, {
      tenantId: record?.tenantId ?? 'unknown',
      eventType: 'user.login',
      action: 'login.failure',
      description: 'Login attempt with unknown email or unset password',
      actorEmail: parsed.data.email,
      actorType: 'user',
      ipAddress: clientIp(c),
      userAgent: userAgent(c),
      metadata: { reason: 'unknown_user' },
    });
    return c.json(
      { success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } },
      401
    );
  }

  const valid = await bcrypt.compare(parsed.data.password, record.passwordHash);
  if (!valid) {
    await writeAuditEvent(db, {
      tenantId: record.tenantId,
      eventType: 'user.login',
      action: 'login.failure',
      description: 'Invalid password',
      actorId: record.id,
      actorEmail: record.email,
      actorName: `${record.firstName} ${record.lastName}`,
      ipAddress: clientIp(c),
      userAgent: userAgent(c),
      metadata: { reason: 'bad_password' },
    });
    return c.json(
      { success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } },
      401
    );
  }

  if (record.status && record.status !== 'active') {
    await writeAuditEvent(db, {
      tenantId: record.tenantId,
      eventType: 'user.login',
      action: 'login.denied',
      description: `User account status is ${record.status}`,
      actorId: record.id,
      actorEmail: record.email,
      ipAddress: clientIp(c),
      userAgent: userAgent(c),
      metadata: { reason: 'inactive_account', status: record.status },
    });
    return c.json(
      { success: false, error: { code: 'ACCOUNT_INACTIVE', message: `Account is ${record.status}.` } },
      403
    );
  }

  // MFA gate
  if (record.mfaEnabled) {
    const challengeId = newChallengeId();
    const code = newOtpCode();
    PENDING_MFA.set(challengeId, {
      userId: record.id,
      tenantId: record.tenantId,
      code,
      expiresAt: Date.now() + MFA_TTL_MS,
    });

    await writeAuditEvent(db, {
      tenantId: record.tenantId,
      eventType: 'user.login',
      action: 'login.mfa_required',
      description: 'MFA challenge issued during login',
      actorId: record.id,
      actorEmail: record.email,
      ipAddress: clientIp(c),
      userAgent: userAgent(c),
      metadata: { challengeId },
    });

    return c.json({
      success: true,
      data: {
        mfaRequired: true,
        challengeId,
        // In non-production we surface the OTP for development convenience.
        ...(process.env.NODE_ENV !== 'production' ? { devCode: code } : {}),
      },
    });
  }

  const session = tokenForUser(record);

  await writeAuditEvent(db, {
    tenantId: record.tenantId,
    eventType: 'user.login',
    action: 'login.success',
    description: 'User logged in successfully',
    actorId: record.id,
    actorEmail: record.email,
    actorName: `${record.firstName} ${record.lastName}`,
    ipAddress: clientIp(c),
    userAgent: userAgent(c),
  });

  return c.json({
    success: true,
    data: {
      ...session,
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
    },
  });
});

app.post('/mfa/challenge', async (c) => {
  const db = getDatabaseClient();
  if (!db) {
    return c.json(
      { success: false, error: { code: 'AUTH_NOT_CONFIGURED', message: 'Database required.' } },
      503
    );
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json(
      { success: false, error: { code: 'INVALID_REQUEST', message: 'JSON body required.' } },
      400
    );
  }

  const parsed = mfaChallengeSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Invalid challenge payload.',
          details: parsed.error.flatten(),
        },
      },
      400
    );
  }

  const record = await resolveAuthUser(parsed.data.email);
  // Always respond success-shaped to avoid user enumeration.
  if (!record) {
    return c.json({ success: true, data: { challengeId: newChallengeId(), issued: true } });
  }

  const challengeId = newChallengeId();
  const code = newOtpCode();
  PENDING_MFA.set(challengeId, {
    userId: record.id,
    tenantId: record.tenantId,
    code,
    expiresAt: Date.now() + MFA_TTL_MS,
  });

  await writeAuditEvent(db, {
    tenantId: record.tenantId,
    eventType: 'user.login',
    action: 'mfa.challenge_issued',
    description: 'Standalone MFA challenge issued',
    actorId: record.id,
    actorEmail: record.email,
    ipAddress: clientIp(c),
    userAgent: userAgent(c),
    metadata: { challengeId },
  });

  return c.json({
    success: true,
    data: {
      challengeId,
      issued: true,
      ...(process.env.NODE_ENV !== 'production' ? { devCode: code } : {}),
    },
  });
});

app.post('/mfa/verify', async (c) => {
  const db = getDatabaseClient();
  if (!db) {
    return c.json(
      { success: false, error: { code: 'AUTH_NOT_CONFIGURED', message: 'Database required.' } },
      503
    );
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json(
      { success: false, error: { code: 'INVALID_REQUEST', message: 'JSON body required.' } },
      400
    );
  }

  const parsed = mfaVerifySchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Invalid verify payload.',
          details: parsed.error.flatten(),
        },
      },
      400
    );
  }

  const pending = PENDING_MFA.get(parsed.data.challengeId);
  if (!pending || pending.expiresAt < Date.now()) {
    PENDING_MFA.delete(parsed.data.challengeId);
    return c.json(
      { success: false, error: { code: 'MFA_CHALLENGE_INVALID', message: 'Challenge expired or unknown.' } },
      400
    );
  }
  if (pending.code !== parsed.data.code) {
    return c.json(
      { success: false, error: { code: 'MFA_CODE_INVALID', message: 'Incorrect MFA code.' } },
      400
    );
  }
  PENDING_MFA.delete(parsed.data.challengeId);

  // Re-resolve user (status may have changed since challenge issue).
  const userRows = await db
    .select({
      id: users.id,
      tenantId: users.tenantId,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      avatarUrl: users.avatarUrl,
      tenantName: tenants.name,
      tenantSlug: tenants.slug,
    })
    .from(users)
    .innerJoin(tenants, eq(tenants.id, users.tenantId))
    .where(and(eq(users.id, pending.userId), isNull(users.deletedAt), isNull(tenants.deletedAt)))
    .limit(1);

  const userRow = userRows[0];
  if (!userRow) {
    return c.json(
      { success: false, error: { code: 'USER_NOT_FOUND', message: 'User no longer exists.' } },
      404
    );
  }

  const record = await resolveAuthUser(userRow.email);
  const session = tokenForUser(record!);

  await writeAuditEvent(db, {
    tenantId: pending.tenantId,
    eventType: 'user.login',
    action: 'login.mfa_verified',
    description: 'MFA verified, session issued',
    actorId: pending.userId,
    actorEmail: userRow.email,
    ipAddress: clientIp(c),
    userAgent: userAgent(c),
  });

  return c.json({
    success: true,
    data: {
      ...session,
      user: {
        id: userRow.id,
        email: userRow.email,
        firstName: userRow.firstName,
        lastName: userRow.lastName,
        avatarUrl: userRow.avatarUrl,
      },
      tenant: {
        id: userRow.tenantId,
        name: userRow.tenantName,
        slug: userRow.tenantSlug,
      },
      role: record!.role,
      permissions: record!.permissions,
      properties: record!.propertyAccess,
    },
  });
});

app.get('/me', authMiddleware, async (c) => {
  const auth = c.get('auth');
  return c.json({ success: true, data: await buildMePayload(auth) });
});

app.post('/refresh', authMiddleware, async (c) => {
  const auth = c.get('auth');
  const db = getDatabaseClient();

  let body: unknown = {};
  try {
    body = await c.req.json();
  } catch {
    /* refresh body is optional */
  }
  // Schema validates optionally-provided refresh token (future expansion).
  const parsed = refreshSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return c.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Invalid refresh payload.',
          details: parsed.error.flatten(),
        },
      },
      400
    );
  }

  const session = tokenForUser({
    id: auth.userId,
    tenantId: auth.tenantId,
    role: auth.role,
    permissions: auth.permissions,
    propertyAccess: auth.propertyAccess,
  });

  await writeAuditEvent(db, {
    tenantId: auth.tenantId,
    eventType: 'user.login',
    action: 'token.refreshed',
    description: 'Session token refreshed',
    actorId: auth.userId,
    ipAddress: clientIp(c),
    userAgent: userAgent(c),
  });

  return c.json({ success: true, data: session });
});

app.post('/logout', authMiddleware, async (c) => {
  const auth = c.get('auth');
  const db = getDatabaseClient();
  await writeAuditEvent(db, {
    tenantId: auth.tenantId,
    eventType: 'user.logout',
    action: 'logout',
    description: 'User logged out',
    actorId: auth.userId,
    ipAddress: clientIp(c),
    userAgent: userAgent(c),
  });
  return c.json({ success: true, data: { loggedOut: true } });
});

app.post('/register', (c) =>
  c.json(
    {
      success: false,
      error: {
        code: 'NOT_AVAILABLE',
        message: 'Self-registration is disabled. Contact your tenant admin to be invited.',
      },
    },
    503
  )
);

app.post('/change-password', (c) =>
  c.json(
    {
      success: false,
      error: {
        code: 'NOT_AVAILABLE',
        message: 'Password change endpoint is not exposed yet.',
      },
    },
    503
  )
);

app.post('/forgot-password', (c) =>
  c.json(
    {
      success: false,
      error: {
        code: 'NOT_AVAILABLE',
        message: 'Password reset endpoint is not exposed yet.',
      },
    },
    503
  )
);

export const authRouter = app;
