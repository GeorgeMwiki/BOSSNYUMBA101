/**
 * JWT Authentication Middleware - BOSSNYUMBA
 *
 * Enhanced JWT validation with:
 * - Tenant extraction from token and headers
 * - Token refresh detection
 * - Session validation
 * - Multi-tenant context setup
 */

import { createMiddleware } from 'hono/factory';
import type { Context } from 'hono';
import jwt from 'jsonwebtoken';
import type { UserRole } from '../types/user-role';

// ============================================================================
// Configuration
// ============================================================================

const JWT_ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || 'development-secret-change-in-production';
const JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || 'refresh-secret-change-in-production';
const JWT_ISSUER = process.env.JWT_ISSUER || 'bossnyumba';
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'bossnyumba-api';

// ============================================================================
// Types
// ============================================================================

export interface AuthContext {
  userId: string;
  tenantId: string;
  role: UserRole;
  permissions: string[];
  propertyAccess: string[];
  email?: string;
  sessionId?: string;
  tokenExp?: number;
  tokenIat?: number;
}

export interface JWTPayload {
  sub?: string;
  userId?: string;
  tenantId: string;
  role: UserRole;
  email?: string;
  permissions: string[];
  propertyAccess: string[];
  sessionId?: string;
  exp: number;
  iat: number;
  iss?: string;
  aud?: string | string[];
}

export interface TokenValidationResult {
  valid: boolean;
  expired: boolean;
  payload?: JWTPayload;
  error?: string;
}

export interface RefreshTokenPayload {
  sub: string;
  sessionId?: string;
  exp: number;
  iat: number;
}

// ============================================================================
// Token Validation Utilities
// ============================================================================

/**
 * Extract token from Authorization header
 */
export function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7).trim();
}

/**
 * Validate JWT access token
 */
export function validateAccessToken(token: string): TokenValidationResult {
  try {
    const payload = jwt.verify(token, JWT_ACCESS_SECRET, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    }) as JWTPayload;

    return {
      valid: true,
      expired: false,
      payload,
    };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      // Decode without verification to get payload for refresh
      const decoded = jwt.decode(token) as JWTPayload | null;
      return {
        valid: false,
        expired: true,
        payload: decoded || undefined,
        error: 'Token has expired',
      };
    }

    if (error instanceof jwt.JsonWebTokenError) {
      return {
        valid: false,
        expired: false,
        error: error.message,
      };
    }

    return {
      valid: false,
      expired: false,
      error: 'Token validation failed',
    };
  }
}

/**
 * Validate JWT refresh token
 */
export function validateRefreshToken(token: string): TokenValidationResult {
  try {
    const payload = jwt.verify(token, JWT_REFRESH_SECRET, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    }) as RefreshTokenPayload;

    return {
      valid: true,
      expired: false,
      payload: payload as unknown as JWTPayload,
    };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return {
        valid: false,
        expired: true,
        error: 'Refresh token has expired',
      };
    }

    return {
      valid: false,
      expired: false,
      error: error instanceof Error ? error.message : 'Token validation failed',
    };
  }
}

/**
 * Generate new access token
 */
export function generateAccessToken(payload: Omit<JWTPayload, 'exp' | 'iat' | 'iss' | 'aud'>): string {
  return jwt.sign(
    {
      userId: payload.userId || payload.sub,
      tenantId: payload.tenantId,
      role: payload.role,
      email: payload.email,
      permissions: payload.permissions,
      propertyAccess: payload.propertyAccess,
      sessionId: payload.sessionId,
    },
    JWT_ACCESS_SECRET,
    {
      expiresIn: '15m',
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      subject: payload.sub || payload.userId,
    }
  );
}

/**
 * Generate refresh token
 */
export function generateRefreshToken(userId: string, sessionId?: string): string {
  return jwt.sign(
    { sessionId },
    JWT_REFRESH_SECRET,
    {
      expiresIn: '7d',
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      subject: userId,
    }
  );
}

/**
 * Generate token pair
 */
export function generateTokenPair(
  payload: Omit<JWTPayload, 'exp' | 'iat' | 'iss' | 'aud'>
): { accessToken: string; refreshToken: string; expiresIn: number } {
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload.sub || payload.userId || '', payload.sessionId);

  return {
    accessToken,
    refreshToken,
    expiresIn: 900, // 15 minutes in seconds
  };
}

/**
 * Extract tenant ID from request
 */
function extractTenantId(c: Context, payload?: JWTPayload): string | null {
  // Priority: 1. Token payload 2. X-Tenant-ID header 3. Query param
  if (payload?.tenantId) {
    return payload.tenantId;
  }

  const headerTenantId = c.req.header('X-Tenant-ID');
  if (headerTenantId) {
    return headerTenantId;
  }

  const queryTenantId = c.req.query('tenantId');
  if (queryTenantId) {
    return queryTenantId;
  }

  return null;
}

// ============================================================================
// Middleware Functions
// ============================================================================

/**
 * Main authentication middleware
 * Validates JWT and extracts auth context
 */
export const authMiddleware = createMiddleware(async (c, next) => {
  const authHeader = c.req.header('Authorization');
  const token = extractBearerToken(authHeader);

  if (!token) {
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

  const validation = validateAccessToken(token);

  if (!validation.valid) {
    if (validation.expired) {
      return c.json(
        {
          success: false,
          error: {
            code: 'TOKEN_EXPIRED',
            message: 'Authentication token has expired',
            refreshRequired: true,
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
          message: validation.error || 'Invalid authentication token',
        },
      },
      401
    );
  }

  const payload = validation.payload!;
  const tenantId = extractTenantId(c, payload);

  if (!tenantId) {
    return c.json(
      {
        success: false,
        error: {
          code: 'MISSING_TENANT',
          message: 'Tenant context is required',
        },
      },
      400
    );
  }

  // Set auth context
  const authContext: AuthContext = {
    userId: payload.sub || payload.userId || '',
    tenantId,
    role: payload.role,
    permissions: payload.permissions || [],
    propertyAccess: payload.propertyAccess || [],
    email: payload.email,
    sessionId: payload.sessionId,
    tokenExp: payload.exp,
    tokenIat: payload.iat,
  };

  c.set('auth', authContext);

  await next();
});

/**
 * Optional authentication middleware
 * Sets auth context if token is present, but doesn't require it
 */
export const optionalAuthMiddleware = createMiddleware(async (c, next) => {
  const authHeader = c.req.header('Authorization');
  const token = extractBearerToken(authHeader);

  if (token) {
    const validation = validateAccessToken(token);

    if (validation.valid && validation.payload) {
      const payload = validation.payload;
      const tenantId = extractTenantId(c, payload);

      if (tenantId) {
        const authContext: AuthContext = {
          userId: payload.sub || payload.userId || '',
          tenantId,
          role: payload.role,
          permissions: payload.permissions || [],
          propertyAccess: payload.propertyAccess || [],
          email: payload.email,
          sessionId: payload.sessionId,
          tokenExp: payload.exp,
          tokenIat: payload.iat,
        };

        c.set('auth', authContext);
      }
    }
  }

  await next();
});

/**
 * Require fresh token (recently issued)
 * Use for sensitive operations
 */
export const requireFreshToken = (maxAgeSeconds: number = 300) => {
  return createMiddleware(async (c, next) => {
    const auth = c.get('auth') as AuthContext | undefined;

    if (!auth) {
      return c.json(
        {
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        },
        401
      );
    }

    if (!auth.tokenIat) {
      return c.json(
        {
          success: false,
          error: {
            code: 'FRESH_TOKEN_REQUIRED',
            message: 'A fresh authentication token is required for this operation',
          },
        },
        401
      );
    }

    const tokenAge = Math.floor(Date.now() / 1000) - auth.tokenIat;
    if (tokenAge > maxAgeSeconds) {
      return c.json(
        {
          success: false,
          error: {
            code: 'FRESH_TOKEN_REQUIRED',
            message: `Token must be less than ${maxAgeSeconds} seconds old for this operation`,
            reauthRequired: true,
          },
        },
        401
      );
    }

    await next();
  });
};

/**
 * API Key authentication middleware
 * For service-to-service communication
 */
export const apiKeyAuthMiddleware = createMiddleware(async (c, next) => {
  const apiKey = c.req.header('X-API-Key');

  if (!apiKey) {
    return c.json(
      {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'API key is required',
        },
      },
      401
    );
  }

  // TODO: Validate API key against database
  // For now, check against environment variable
  const validApiKeys = (process.env.API_KEYS || '').split(',').filter(Boolean);

  if (!validApiKeys.includes(apiKey)) {
    return c.json(
      {
        success: false,
        error: {
          code: 'INVALID_API_KEY',
          message: 'Invalid API key',
        },
      },
      401
    );
  }

  // Set service context
  c.set('auth', {
    userId: 'service',
    tenantId: c.req.header('X-Tenant-ID') || 'system',
    role: 'SUPER_ADMIN' as UserRole,
    permissions: ['*'],
    propertyAccess: ['*'],
  } as AuthContext);

  await next();
});

/**
 * Combined auth middleware that accepts both JWT and API key
 */
export const flexibleAuthMiddleware = createMiddleware(async (c, next) => {
  const authHeader = c.req.header('Authorization');
  const apiKey = c.req.header('X-API-Key');

  if (apiKey) {
    // API Key takes precedence for service-to-service calls
    const validApiKeys = (process.env.API_KEYS || '').split(',').filter(Boolean);

    if (validApiKeys.includes(apiKey)) {
      c.set('auth', {
        userId: 'service',
        tenantId: c.req.header('X-Tenant-ID') || 'system',
        role: 'SUPER_ADMIN' as UserRole,
        permissions: ['*'],
        propertyAccess: ['*'],
      } as AuthContext);

      await next();
      return;
    }
  }

  if (authHeader) {
    const token = extractBearerToken(authHeader);

    if (token) {
      const validation = validateAccessToken(token);

      if (validation.valid && validation.payload) {
        const payload = validation.payload;
        const tenantId = extractTenantId(c, payload);

        if (tenantId) {
          c.set('auth', {
            userId: payload.sub || payload.userId || '',
            tenantId,
            role: payload.role,
            permissions: payload.permissions || [],
            propertyAccess: payload.propertyAccess || [],
            email: payload.email,
            sessionId: payload.sessionId,
            tokenExp: payload.exp,
            tokenIat: payload.iat,
          } as AuthContext);

          await next();
          return;
        }
      }
    }
  }

  return c.json(
    {
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Valid authentication is required',
      },
    },
    401
  );
});

// ============================================================================
// Hono Context Type Extension
// ============================================================================

declare module 'hono' {
  interface ContextVariableMap {
    auth: AuthContext;
  }
}

export type { UserRole };
