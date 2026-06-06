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
import {
  peekJwtClaims,
  looksLikeSupabaseToken,
  verifyAndProjectSupabaseToken,
} from './auth.middleware';

const JWT_SECRET = getJwtSecret();

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
    // A gateway-issued HS256 token that has merely EXPIRED must keep its
    // existing TOKEN_EXPIRED response — falling through to the Supabase
    // verifier would only collapse it into a generic INVALID_TOKEN and
    // lose the refresh signal that clients depend on.
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

    // Supabase fallback (HQ "Ask" parity): the HS256 gateway path failed.
    // If the token is shaped like a Supabase-issued access token (iss /
    // app_metadata), verify it with the SAME verifier the ai-chat / brain
    // routes use — `verifyAndProjectSupabaseToken` wraps the ai-copilot
    // `verifySupabaseJwt` (JWKS/ES256 with HS256 fallback), pins algorithms,
    // checks signature + exp, and enforces the F6 rule that tenant_id comes
    // from `app_metadata` only. This lets a Supabase login token reach
    // `/api/v1/ask` without weakening the gateway-token path above.
    if (looksLikeSupabaseToken(peekJwtClaims(token))) {
      const supabase = await verifyAndProjectSupabaseToken(token);
      if (supabase.valid && supabase.context) {
        // Project onto this middleware's AuthContext shape. The downstream
        // /ask handlers read userId / tenantId / role from `c.get('auth')`;
        // populate the same flat accessors the HS256 path sets above. `jti`
        // / `exp` are gateway-token blocklist concerns (the Supabase token
        // carries no gateway jti), so they are intentionally omitted here.
        c.set('auth', {
          userId: supabase.context.userId,
          tenantId: supabase.context.tenantId,
          role: supabase.context.role,
          permissions: supabase.context.permissions,
          propertyAccess: supabase.context.propertyAccess,
        });
        c.set('tenantId', supabase.context.tenantId);
        c.set('userId', supabase.context.userId);
        await next();
        return;
      }
      // Fail-closed: a Supabase-shaped token that does not verify is
      // rejected — never fall through to a success path.
      return c.json(
        {
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: supabase.error || 'Invalid authentication token',
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
