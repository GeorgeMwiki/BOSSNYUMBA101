// @ts-nocheck
/**
 * Hono-compatible auth middleware
 *
 * Responsibilities:
 *   1. Verify the Bearer JWT and stamp `auth` on the Hono context.
 *   2. Resolve the caller's *active* organisation, in priority order:
 *        a. `X-Active-Org` request header (per-request override sent by
 *           the org switcher in Flutter / owner-portal / estate-manager-app
 *           / customer-app)
 *        b. `activeOrgId` claim on the JWT (set by /login and /switch-org)
 *        c. Fallback to the JWT's `tenantId` (the user's home tenant)
 *   3. When (a) is used, verify the caller has an `active` membership in
 *      that tenant (via the `memberships` table) before honouring it.
 *      Invalid header → 403 INVALID_ACTIVE_ORG.
 *   4. Override `auth.tenantId` with the resolved active org so existing
 *      `auth.tenantId`-based scoping in handlers automatically routes to
 *      the selected org. Also expose `c.get('activeOrgId')` for handlers
 *      that read it explicitly.
 *
 * Order: this middleware must run BEFORE any route handler. It is mounted
 * per-router via `app.use('*', authMiddleware)` (see routes/*.ts) so it
 * always precedes the handlers it gates.
 */

import { createMiddleware } from 'hono/factory';
import jwt from 'jsonwebtoken';
import { and, eq } from 'drizzle-orm';
import type { UserRole } from '../types/user-role';
import { getJwtSecret } from '../config/jwt';
import { getDatabaseClient } from './database';
import { memberships } from '@bossnyumba/database';

const JWT_SECRET = getJwtSecret();

export interface AuthContext {
  userId: string;
  // The *effective* tenant the request is scoped to. After this middleware
  // runs this is always equal to the resolved active org so any handler
  // that does `where(tenantId = auth.tenantId)` is automatically org-aware.
  tenantId: string;
  // The home tenant from the JWT (immutable across requests). Useful for
  // self-service flows that should always hit the user's primary tenant
  // (password change, account deletion, etc.).
  homeTenantId: string;
  role: UserRole;
  permissions: string[];
  propertyAccess: string[];
  // The resolved active org id (mirrors c.get('activeOrgId')).
  activeOrgId: string;
}

export interface JWTPayload {
  userId: string;
  tenantId: string;
  role: UserRole;
  permissions: string[];
  propertyAccess: string[];
  /** Optional active-org claim. Defaults to `tenantId` when absent. */
  activeOrgId?: string;
  exp: number;
  iat: number;
}

declare module 'hono' {
  interface ContextVariableMap {
    auth: AuthContext;
    activeOrgId: string;
  }
}

/**
 * Verify that `userId` has an `active` membership in `tenantId`.
 *
 * Returns true when the membership exists and is active; false otherwise.
 * The user's home tenant (decoded.tenantId) is always considered a valid
 * membership without a DB lookup — that membership is implicit in the JWT
 * and removing the row would invalidate every other tenant scoping check
 * the user has already passed.
 *
 * When no DB is configured (mock mode) we accept any tenant id so the
 * middleware doesn't break local dev / tests. Production deployments
 * always have DATABASE_URL set so this branch is never taken in prod.
 */
async function hasActiveMembership(
  userId: string,
  tenantId: string,
  homeTenantId: string,
): Promise<boolean> {
  if (tenantId === homeTenantId) return true;

  const db = getDatabaseClient();
  if (!db) return true;

  const rows = await db
    .select({ id: memberships.id })
    .from(memberships)
    .where(
      and(
        eq(memberships.userId, userId),
        eq(memberships.tenantId, tenantId),
        eq(memberships.status, 'active'),
      ),
    )
    .limit(1);

  return rows.length > 0;
}

export const authMiddleware = createMiddleware(async (c, next) => {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json(
      {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing or invalid authorization header',
        },
      },
      401
    );
  }

  const token = authHeader.split(' ')[1];

  let decoded: JWTPayload;
  try {
    decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return c.json(
        {
          success: false,
          error: {
            code: 'TOKEN_EXPIRED',
            message: 'Authentication token has expired',
          },
        },
        401
      );
    }

    return c.json(
      {
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid authentication token',
        },
      },
      401
    );
  }

  // ---------------------------------------------------------------------
  // Resolve active org
  // ---------------------------------------------------------------------
  const homeTenantId = decoded.tenantId;
  const headerOrg = (c.req.header('X-Active-Org') || '').trim();
  const claimOrg = decoded.activeOrgId && decoded.activeOrgId.trim();

  let activeOrgId: string;

  if (headerOrg) {
    // Per-request override — must validate membership.
    const allowed = await hasActiveMembership(decoded.userId, headerOrg, homeTenantId);
    if (!allowed) {
      return c.json(
        {
          success: false,
          error: {
            code: 'INVALID_ACTIVE_ORG',
            message: `You do not have an active membership in organization "${headerOrg}".`,
          },
        },
        403
      );
    }
    activeOrgId = headerOrg;
  } else if (claimOrg) {
    // Fall back to the activeOrgId baked into the JWT (set by /switch-org).
    activeOrgId = claimOrg;
  } else {
    // Default: the user's home tenant.
    activeOrgId = homeTenantId;
  }

  c.set('activeOrgId', activeOrgId);
  c.set('auth', {
    userId: decoded.userId,
    // Override tenantId with the active org so existing handlers that
    // scope via `auth.tenantId` route to the selected org transparently.
    tenantId: activeOrgId,
    homeTenantId,
    role: decoded.role,
    permissions: decoded.permissions,
    propertyAccess: decoded.propertyAccess,
    activeOrgId,
  });

  await next();
});

/** Require at least one of the given roles (use after authMiddleware) */
export const requireRole = (...roles: UserRole[]) => {
  return createMiddleware(async (c, next) => {
    const auth = c.get('auth');
    if (!auth) {
      return c.json(
        {
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        },
        401
      );
    }
    if (!roles.includes(auth.role)) {
      return c.json(
        {
          success: false,
          error: { code: 'FORBIDDEN', message: 'Insufficient permissions' },
        },
        403
      );
    }
    await next();
  });
};
