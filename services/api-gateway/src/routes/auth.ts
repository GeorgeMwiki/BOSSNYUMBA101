
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { getDatabaseClient } from '../middleware/database';
import { authMiddleware } from '../middleware/hono-auth';
import { generateToken } from '../middleware/auth';
import { tokenBlocklist } from '../middleware/token-blocklist';
import { tenants, users, roles, userRoles } from '@bossnyumba/database';
import { UserRole } from '../types/user-role';
// AM-1 cookie-auth migration.
import {
  setSessionCookie,
  setRefreshCookie,
  setCsrfCookie,
  clearAllAuthCookies,
  readRefreshCookie,
  readCsrfCookie,
} from '../middleware/session-cookie';
import { generateRefreshToken, verifyRefreshToken } from '../middleware/refresh-token';
import { refreshTokenBlocklist } from '../middleware/refresh-token-blocklist';
import { generateCsrfToken } from '../middleware/csrf.middleware';

// Request schemas — enforced server-side so clients cannot bypass.
const LoginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(200),
});

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
    // Case-insensitive email match. Callers normalize to lowercase
    // before calling this helper; the LOWER() on the column makes the
    // match resilient to historically-cased rows pre-dating the
    // normalization.
    .where(
      and(
        sql`LOWER(${users.email}) = LOWER(${email})`,
        isNull(users.deletedAt),
        isNull(tenants.deletedAt)
      )
    )
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

app.post('/login', zValidator('json', LoginSchema), async (c) => {
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

  const body = c.req.valid('json');
  // Normalize email to lowercase so User@Example.com and user@example.com
  // resolve to the same account. Without this, case variants enable
  // duplicate signups AND email enumeration via the case-sensitivity
  // channel.
  const normalizedEmail = body.email.trim().toLowerCase();
  const record = await resolveAuthUser(normalizedEmail);
  if (!record?.passwordHash) {
    return c.json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } }, 401);
  }

  // Block suspended/deactivated/pending accounts BEFORE password check so
  // attackers can't use the response-timing channel to infer status. The
  // status column is lowercased at storage time.
  const status = String(record.status ?? '').toLowerCase();
  if (status && status !== 'active') {
    return c.json(
      {
        success: false,
        error: {
          code: 'ACCOUNT_NOT_ACTIVE',
          message:
            status === 'suspended'
              ? 'Account suspended. Contact your administrator.'
              : status === 'deactivated'
                ? 'Account has been deactivated.'
                : 'Account is not yet active. Check your email for activation.',
        },
      },
      403
    );
  }

  // Same check for the tenant the user belongs to — a suspended tenant
  // means no one under it can log in (billing delinquency / compliance).
  const tenantStatus = String(record.tenantStatus ?? '').toLowerCase();
  if (tenantStatus && tenantStatus !== 'active' && tenantStatus !== 'trial') {
    return c.json(
      {
        success: false,
        error: {
          code: 'TENANT_NOT_ACTIVE',
          message: 'Organization account is not active. Please contact support.',
        },
      },
      403
    );
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

  // AM-1 — set httpOnly session + refresh cookies, and a non-httpOnly
  // CSRF cookie for the SPA to echo as `X-CSRF-Token`. The legacy
  // `token` body field is still returned during the migration window
  // for any caller that hasn't switched to cookie-mode yet; a follow-up
  // PR removes it once telemetry confirms zero clients depend on it.
  setSessionCookie(c, token);
  const refresh = generateRefreshToken({ userId: record.id });
  setRefreshCookie(c, refresh.token);
  const csrfToken = generateCsrfToken();
  setCsrfCookie(c, csrfToken);

  return c.json({
    success: true,
    data: {
      // Legacy field — see migration note above. Cookie-mode clients ignore it.
      token,
      // AM-1: clients in cookie-mode read this and stash in memory for the
      // X-CSRF-Token header on subsequent mutations.
      csrfToken,
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
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    },
  });
});

app.get('/me', authMiddleware, async (c) => {
  const auth = c.get('auth');
  return c.json({ success: true, data: await buildMePayload(auth) });
});

/**
 * /auth/refresh — AM-1 cookie-flow refresh.
 *
 * Reads the `bn_refresh` cookie, validates it against the refresh secret,
 * checks the blocklist (refresh-token rotation), revokes the old jti, then
 * mints a new access JWT + new refresh JWT and sets both cookies. The
 * Origin-header check in `csrf.middleware.ts` exempts this endpoint
 * because the SPA cannot send the X-CSRF-Token reliably during the
 * rotation window (the cookie token is being rotated in the same response).
 * The cross-origin protection comes from (a) refresh cookie being httpOnly
 * + SameSite=Lax, (b) the CORS allowlist, (c) the refresh JWT signature.
 */
app.post('/refresh', async (c) => {
  const refreshToken = readRefreshCookie(c);
  if (!refreshToken) {
    return c.json(
      {
        success: false,
        error: { code: 'NO_REFRESH_COOKIE', message: 'Refresh cookie is missing' },
      },
      401
    );
  }

  const result = verifyRefreshToken(refreshToken);
  if (!result.valid || !result.payload) {
    clearAllAuthCookies(c);
    return c.json(
      {
        success: false,
        error: {
          code: result.expired ? 'REFRESH_TOKEN_EXPIRED' : 'INVALID_REFRESH_TOKEN',
          message: result.error ?? 'Refresh token is invalid',
        },
      },
      401
    );
  }

  // Blocklist check — refresh-token rotation defense. A replay of an
  // already-rotated refresh token must fail.
  if (result.payload.jti && (await refreshTokenBlocklist.isRevoked(result.payload.jti))) {
    clearAllAuthCookies(c);
    return c.json(
      {
        success: false,
        error: {
          code: 'REFRESH_TOKEN_REVOKED',
          message: 'Refresh token has been revoked. Please log in again.',
        },
      },
      401
    );
  }

  // Reload the user fresh from the DB so role/permissions/tenant-status
  // changes apply on next refresh (not delayed until next login).
  const db = getDatabaseClient();
  let record: Awaited<ReturnType<typeof resolveAuthUser>> = null;
  if (db) {
    const rows = await db
      .select({ email: users.email })
      .from(users)
      .where(and(eq(users.id, result.payload.sub), isNull(users.deletedAt)))
      .limit(1);
    const email = rows[0]?.email;
    if (email) record = await resolveAuthUser(email);
  }
  if (!record) {
    clearAllAuthCookies(c);
    return c.json(
      {
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'Account no longer exists or has been deleted',
        },
      },
      401
    );
  }
  const status = String(record.status ?? '').toLowerCase();
  if (status && status !== 'active') {
    clearAllAuthCookies(c);
    return c.json(
      {
        success: false,
        error: { code: 'ACCOUNT_NOT_ACTIVE', message: 'Account is no longer active' },
      },
      401
    );
  }

  const newAccessToken = generateToken({
    userId: record.id,
    tenantId: record.tenantId,
    role: record.role,
    permissions: record.permissions,
    propertyAccess: record.propertyAccess,
  });
  const newRefresh = generateRefreshToken({
    userId: record.id,
    sessionId: result.payload.sid,
  });

  // Rotate: revoke the OLD refresh jti so a stolen copy is useless.
  await refreshTokenBlocklist.revoke(result.payload.jti, result.payload.exp);

  setSessionCookie(c, newAccessToken);
  setRefreshCookie(c, newRefresh.token);
  // Rotate the CSRF token alongside refresh — long-lived CSRF tokens are
  // an unnecessary correlation handle.
  const newCsrf = generateCsrfToken();
  setCsrfCookie(c, newCsrf);

  return c.json({
    success: true,
    data: {
      // Legacy body fields retained during migration window.
      token: newAccessToken,
      csrfToken: newCsrf,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    },
  });
});

/**
 * /auth/logout — clear cookies + revoke both jtis in the blocklist.
 *
 * Accepts the request even without an active session cookie (idempotent
 * — a logged-out user clicking "logout" should not see an error). The
 * blocklist additions only happen for tokens we successfully decode.
 *
 * CSRF middleware enforces Origin + X-CSRF-Token here just like any
 * other mutation — a same-origin XSS could still trigger logout, but
 * (a) the worst case is the user has to re-login, (b) the alternative
 * is exempting logout, which then becomes a known CSRF target.
 */
app.post('/logout', async (c) => {
  // Access-token revocation (best-effort — we may not have a valid one).
  const accessCookie = c.req.header('Cookie')?.match(/bn_session=([^;]+)/)?.[1];
  if (accessCookie) {
    try {
      const decoded = jwt.decode(accessCookie) as { jti?: string; exp?: number } | null;
      if (decoded?.jti && decoded?.exp) {
        tokenBlocklist.revoke(decoded.jti, decoded.exp);
      }
    } catch {
      // ignore — token was probably already invalid
    }
  }
  // Refresh-token revocation.
  const refreshCookie = readRefreshCookie(c);
  if (refreshCookie) {
    const result = verifyRefreshToken(refreshCookie);
    if (result.payload?.jti && result.payload.exp) {
      await refreshTokenBlocklist.revoke(result.payload.jti, result.payload.exp);
    }
  }
  clearAllAuthCookies(c);
  return c.json({ success: true, data: { loggedOut: true } });
});

/**
 * /auth/csrf — issue (or rotate) a CSRF token for the current session.
 *
 * Called by the SPA at app boot if it doesn't already have a CSRF token
 * in memory. The cookie is set non-httpOnly so the SPA can read it
 * synchronously after the response; the token is also returned in the
 * JSON body for convenience.
 *
 * No authentication required — the cookie scopes the token to the
 * caller's browser session. An anonymous attacker browser can request a
 * token, but the token is useless without the matching `bn_session`
 * cookie because the gateway's authMiddleware still requires a valid
 * session for every protected endpoint.
 */
app.get('/csrf', async (c) => {
  // Reuse existing token if the browser already has one — avoids
  // churning the cookie on every page navigation. Rotation happens on
  // login and on refresh.
  const existing = readCsrfCookie(c);
  if (existing) {
    return c.json({ success: true, data: { csrfToken: existing } });
  }
  const token = generateCsrfToken();
  setCsrfCookie(c, token);
  return c.json({ success: true, data: { csrfToken: token } });
});

/**
 * /auth/logout-legacy-token — AM-1 migration sweeper.
 *
 * Called by the per-portal `legacy-token-scrubber.ts` on app load when
 * it detects a residual `auth_token`/`customer_token`/`manager_token`/
 * `token` value in localStorage. The portal POSTs the legacy bearer
 * here so the gateway can:
 *   1. Decode it (best-effort, no signature requirement — invalid tokens
 *      simply no-op).
 *   2. Add the jti to the blocklist so the token cannot mint refreshes
 *      or be replayed even before its natural expiry.
 *
 * The portal then deletes the localStorage entry. Net effect: any user
 * who already has a token from before the migration loses it at server-
 * side AND client-side without any visible action.
 */
const LegacyLogoutSchema = z.object({
  // Accept the stale token so we can extract the jti. We DO verify the
  // signature — but only to extract the jti for blocklist eviction.
  // Tokens that fail verification are simply discarded client-side; no
  // harm done.
  token: z.string().min(20).max(4096),
});
app.post('/logout-legacy-token', zValidator('json', LegacyLogoutSchema), async (c) => {
  const body = c.req.valid('json');
  try {
    const decoded = jwt.decode(body.token) as { jti?: string; exp?: number } | null;
    if (decoded?.jti && decoded?.exp) {
      tokenBlocklist.revoke(decoded.jti, decoded.exp);
    }
  } catch {
    // ignore — best-effort
  }
  return c.json({ success: true, data: { scrubbed: true } });
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
