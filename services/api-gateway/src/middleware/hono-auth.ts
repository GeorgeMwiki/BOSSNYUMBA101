// @ts-nocheck — Hono v4 MiddlewareHandler status-code literal union: multiple c.json({...}, status) branches widen return type and TypedResponse overload rejects the union. Tracked at hono-dev/hono#3891.
/**
 * Hono-compatible auth middleware
 * Extracts JWT from Authorization header and provides tenant-scoped auth context
 */

import { createMiddleware } from 'hono/factory';
import jwt from 'jsonwebtoken';
import type { UserRole } from '../types/user-role';
import { getJwtSecret } from '../config/jwt';
import { tokenBlocklist } from './token-blocklist';
import { readSessionCookie } from './session-cookie';

const JWT_SECRET = getJwtSecret();

/**
 * Extract the access token from the request.
 *
 * AM-1 migration: prefer the `bn_session` httpOnly cookie (set by /auth/login).
 * Fall back to the `Authorization: Bearer` header so:
 *   - service-to-service callers using API keys + minted tokens still work,
 *   - WebSocket/EventSource clients that cannot use cookies still work,
 *   - in-flight bearer-based portal pages during the migration window
 *     still authenticate (the portals stop SENDING the bearer once their
 *     PR lands; the gateway stops ACCEPTING it once telemetry confirms
 *     zero header traffic — staged removal in a later PR).
 */
function resolveAccessToken(c: import('hono').Context): string | null {
  const cookieToken = readSessionCookie(c);
  if (cookieToken) return cookieToken;
  const authHeader = c.req.header('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1] ?? null;
  }
  return null;
}

export interface AuthContext {
  userId: string;
  tenantId: string;
  role: UserRole;
  permissions: string[];
  propertyAccess: string[];
  /** JWT ID of the current token — needed for /auth/logout revocation. */
  jti?: string;
  /** Token expiry epoch seconds — paired with jti for blocklist TTL. */
  exp?: number;
}

export interface JWTPayload {
  userId: string;
  tenantId: string;
  role: UserRole;
  permissions: string[];
  propertyAccess: string[];
  jti?: string;
  exp: number;
  iat: number;
}

declare module 'hono' {
  interface ContextVariableMap {
    auth: AuthContext;
  }
}

export const authMiddleware = createMiddleware(async (c, next) => {
  const token = resolveAccessToken(c);

  if (!token) {
    return c.json(
      {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          // AM-1: message no longer assumes header — cookie also accepted.
          message: 'Missing authentication credential (session cookie or bearer header)',
        },
      },
      401
    );
  }

  try {
    // Pin algorithm to prevent alg=none / RS256-vs-HS256 confusion.
    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256'],
    }) as JWTPayload;

    if (decoded.jti && tokenBlocklist.isRevoked(decoded.jti)) {
      return c.json(
        {
          success: false,
          error: {
            code: 'TOKEN_REVOKED',
            message: 'Authentication token has been revoked',
          },
        },
        401
      );
    }

    c.set('auth', {
      userId: decoded.userId,
      tenantId: decoded.tenantId,
      role: decoded.role,
      permissions: decoded.permissions,
      propertyAccess: decoded.propertyAccess,
      jti: decoded.jti,
      exp: decoded.exp,
    });

    // Flat accessors — legacy routers look up `tenantId`/`userId`
    // directly via `c.get('tenantId')`. Populate these here (the
    // service-context middleware cannot because it runs BEFORE this
    // per-router middleware).
    c.set('tenantId', decoded.tenantId);
    c.set('userId', decoded.userId);

    await next();
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
