/**
 * Rate Limiting Middleware - BOSSNYUMBA
 *
 * Implements request rate limiting with:
 * - Token bucket algorithm
 * - Sliding window counters
 * - Role-based tiers
 * - Endpoint-specific limits
 * - IP and user-based tracking
 * - Redis-ready interface (in-memory for dev)
 */

import { createMiddleware } from 'hono/factory';
import type { Context } from 'hono';
import type { AuthContext } from './auth.middleware';
import type { UserRole } from '../types/user-role';

// ============================================================================
// Types
// ============================================================================

export interface RateLimitConfig {
  /** Maximum requests per window */
  maxRequests: number;
  /** Window size in seconds */
  windowSizeSeconds: number;
  /** Burst allowance (extra requests allowed momentarily) */
  burstSize?: number;
  /** Skip counting successful requests */
  skipSuccessful?: boolean;
  /** Custom key generator */
  keyGenerator?: (c: Context) => string;
  /** Error message override */
  message?: string;
}

export interface RateLimitState {
  tokens: number;
  lastRefill: number;
  requestCount: number;
  windowStart: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  reset: number;
  limit: number;
  retryAfter?: number;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
}

// ============================================================================
// Configuration
// ============================================================================

/** Rate limits by role */
const ROLE_LIMITS: Record<UserRole | 'anonymous', RateLimitConfig> = {
  SUPER_ADMIN: { maxRequests: 10000, windowSizeSeconds: 60, burstSize: 500 },
  ADMIN: { maxRequests: 5000, windowSizeSeconds: 60, burstSize: 250 },
  SUPPORT: { maxRequests: 2000, windowSizeSeconds: 60, burstSize: 100 },
  TENANT_ADMIN: { maxRequests: 2000, windowSizeSeconds: 60, burstSize: 100 },
  PROPERTY_MANAGER: { maxRequests: 1000, windowSizeSeconds: 60, burstSize: 50 },
  ACCOUNTANT: { maxRequests: 500, windowSizeSeconds: 60, burstSize: 25 },
  MAINTENANCE_STAFF: { maxRequests: 500, windowSizeSeconds: 60, burstSize: 25 },
  OWNER: { maxRequests: 300, windowSizeSeconds: 60, burstSize: 15 },
  RESIDENT: { maxRequests: 200, windowSizeSeconds: 60, burstSize: 10 },
  anonymous: { maxRequests: 100, windowSizeSeconds: 60, burstSize: 5 },
};

/** Endpoint-specific rate limits */
const ENDPOINT_LIMITS: Record<string, RateLimitConfig> = {
  // Auth endpoints - strict limits
  'POST:/api/v1/auth/login': {
    maxRequests: 10,
    windowSizeSeconds: 60,
    skipSuccessful: false,
    message: 'Too many login attempts',
  },
  'POST:/api/v1/auth/register': {
    maxRequests: 5,
    windowSizeSeconds: 300,
    message: 'Registration rate limited',
  },
  'POST:/api/v1/auth/forgot-password': {
    maxRequests: 3,
    windowSizeSeconds: 300,
    message: 'Password reset rate limited',
  },
  'POST:/api/v1/auth/mfa/verify': {
    maxRequests: 5,
    windowSizeSeconds: 60,
    message: 'Too many MFA attempts',
  },
  'POST:/api/v1/auth/refresh': {
    maxRequests: 30,
    windowSizeSeconds: 60,
  },

  // Webhook endpoints - high volume
  'POST:/api/v1/webhooks/*': { maxRequests: 10000, windowSizeSeconds: 60 },

  // Report generation - resource intensive
  'POST:/api/v1/reports/generate': {
    maxRequests: 10,
    windowSizeSeconds: 60,
    message: 'Report generation rate limited',
  },
  'GET:/api/v1/reports/audit-pack/*': {
    maxRequests: 5,
    windowSizeSeconds: 60,
  },
  'POST:/api/v1/reports/export': {
    maxRequests: 5,
    windowSizeSeconds: 60,
  },

  // Notifications - controlled
  'POST:/api/v1/notifications/send': {
    maxRequests: 100,
    windowSizeSeconds: 60,
  },
  'POST:/api/v1/notifications/broadcast': {
    maxRequests: 5,
    windowSizeSeconds: 300,
    message: 'Broadcast notifications rate limited',
  },

  // Payment operations - sensitive
  'POST:/api/v1/payments': {
    maxRequests: 50,
    windowSizeSeconds: 60,
  },
  'POST:/api/v1/payments/*/refund': {
    maxRequests: 10,
    windowSizeSeconds: 60,
    message: 'Refund operations rate limited',
  },

  // File operations
  'POST:/api/v1/documents/upload': {
    maxRequests: 20,
    windowSizeSeconds: 60,
    message: 'File upload rate limited',
  },

  // Search/List - prevent abuse
  'GET:/api/v1/search/*': {
    maxRequests: 60,
    windowSizeSeconds: 60,
  },
};

// ============================================================================
// Rate Limit Store
// ============================================================================

interface RateLimitStore {
  get(key: string): RateLimitState | undefined;
  set(key: string, state: RateLimitState): void;
  delete(key: string): void;
  isBlocked(key: string): boolean;
  block(key: string, durationSeconds: number): void;
}

class InMemoryRateLimitStore implements RateLimitStore {
  private store = new Map<string, RateLimitState>();
  private blocked = new Map<string, number>();
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor() {
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  get(key: string): RateLimitState | undefined {
    return this.store.get(key);
  }

  set(key: string, state: RateLimitState): void {
    this.store.set(key, state);
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  isBlocked(key: string): boolean {
    const blockedUntil = this.blocked.get(key);
    if (!blockedUntil) return false;
    if (Date.now() > blockedUntil) {
      this.blocked.delete(key);
      return false;
    }
    return true;
  }

  block(key: string, durationSeconds: number): void {
    this.blocked.set(key, Date.now() + durationSeconds * 1000);
  }

  private cleanup(): void {
    const now = Date.now();
    const maxAge = 600000; // 10 minutes

    for (const [key, state] of this.store) {
      if (now - state.windowStart > maxAge) {
        this.store.delete(key);
      }
    }

    for (const [key, blockedUntil] of this.blocked) {
      if (now > blockedUntil) {
        this.blocked.delete(key);
      }
    }
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.store.clear();
    this.blocked.clear();
  }
}

const store: RateLimitStore = new InMemoryRateLimitStore();

// ============================================================================
// Token Bucket Rate Limiter
// ============================================================================

class TokenBucketLimiter {
  check(key: string, config: RateLimitConfig): RateLimitResult {
    const now = Date.now();
    const windowMs = config.windowSizeSeconds * 1000;
    const refillRate = config.maxRequests / config.windowSizeSeconds;

    let state = store.get(key);

    if (!state) {
      state = {
        tokens: config.maxRequests,
        lastRefill: now,
        requestCount: 0,
        windowStart: now,
      };
    } else {
      // Refill tokens
      const elapsed = (now - state.lastRefill) / 1000;
      const tokensToAdd = elapsed * refillRate;
      const maxTokens = config.maxRequests + (config.burstSize || 0);

      state.tokens = Math.min(maxTokens, state.tokens + tokensToAdd);
      state.lastRefill = now;

      // Reset window if expired
      if (now - state.windowStart > windowMs) {
        state.requestCount = 0;
        state.windowStart = now;
      }
    }

    if (state.tokens < 1) {
      const timeToRefill = (1 - state.tokens) / refillRate;
      store.set(key, state);

      return {
        allowed: false,
        remaining: 0,
        reset: Math.ceil((state.windowStart + windowMs) / 1000),
        limit: config.maxRequests,
        retryAfter: Math.ceil(timeToRefill),
      };
    }

    state.tokens -= 1;
    state.requestCount += 1;
    store.set(key, state);

    return {
      allowed: true,
      remaining: Math.floor(state.tokens),
      reset: Math.ceil((state.windowStart + windowMs) / 1000),
      limit: config.maxRequests,
    };
  }

  restore(key: string): void {
    const state = store.get(key);
    if (state) {
      state.tokens += 1;
      store.set(key, state);
    }
  }
}

const limiter = new TokenBucketLimiter();

// ============================================================================
// Utility Functions
// ============================================================================

function getClientIP(c: Context): string {
  const forwarded = c.req.header('X-Forwarded-For');
  if (forwarded) return forwarded.split(',')[0].trim();

  const realIP = c.req.header('X-Real-IP');
  if (realIP) return realIP;

  return c.req.header('CF-Connecting-IP') || 'unknown';
}

function generateKey(c: Context, config?: RateLimitConfig): string {
  if (config?.keyGenerator) {
    return config.keyGenerator(c);
  }

  const auth = c.get('auth') as AuthContext | undefined;
  const ip = getClientIP(c);

  if (auth) {
    return `rate:${auth.tenantId}:${auth.userId}`;
  }

  return `rate:ip:${ip}`;
}

function matchEndpoint(method: string, path: string): RateLimitConfig | null {
  const key = `${method}:${path}`;

  // Exact match
  if (ENDPOINT_LIMITS[key]) {
    return ENDPOINT_LIMITS[key];
  }

  // Wildcard match
  for (const [pattern, config] of Object.entries(ENDPOINT_LIMITS)) {
    if (pattern.includes('*')) {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      if (regex.test(key)) {
        return config;
      }
    }
  }

  return null;
}

function getConfigForRequest(c: Context): RateLimitConfig {
  const method = c.req.method;
  const path = c.req.path;

  // Check endpoint-specific limits first
  const endpointConfig = matchEndpoint(method, path);
  if (endpointConfig) {
    return endpointConfig;
  }

  // Fall back to role-based limits
  const auth = c.get('auth') as AuthContext | undefined;
  const role = auth?.role || 'anonymous';

  return ROLE_LIMITS[role] || ROLE_LIMITS.anonymous;
}

// ============================================================================
// Middleware Functions
// ============================================================================

/**
 * Global rate limiting middleware
 */
export const rateLimitMiddleware = createMiddleware(async (c, next) => {
  const ip = getClientIP(c);
  const blockKey = `block:ip:${ip}`;

  // Check if IP is blocked
  if (store.isBlocked(blockKey)) {
    return c.json(
      {
        success: false,
        error: {
          code: 'TOO_MANY_REQUESTS',
          message: 'Access temporarily blocked',
        },
      },
      429
    );
  }

  const config = getConfigForRequest(c);
  const key = generateKey(c, config);

  const result = limiter.check(key, config);

  // Set rate limit headers
  c.header('X-RateLimit-Limit', String(result.limit));
  c.header('X-RateLimit-Remaining', String(result.remaining));
  c.header('X-RateLimit-Reset', String(result.reset));

  if (!result.allowed) {
    c.header('Retry-After', String(result.retryAfter || 60));

    return c.json(
      {
        success: false,
        error: {
          code: 'TOO_MANY_REQUESTS',
          message: config.message || 'Rate limit exceeded. Please try again later.',
          retryAfter: result.retryAfter,
        },
      },
      429
    );
  }

  await next();

  // Restore token for successful requests if configured
  if (config.skipSuccessful) {
    const status = c.res.status;
    if (status >= 200 && status < 300) {
      limiter.restore(key);
    }
  }
});

/**
 * Custom rate limiter for specific routes
 */
export const customRateLimit = (config: RateLimitConfig) => {
  return createMiddleware(async (c, next) => {
    const key = generateKey(c, config);
    const result = limiter.check(key, config);

    c.header('X-RateLimit-Limit', String(result.limit));
    c.header('X-RateLimit-Remaining', String(result.remaining));
    c.header('X-RateLimit-Reset', String(result.reset));

    if (!result.allowed) {
      c.header('Retry-After', String(result.retryAfter || 60));

      return c.json(
        {
          success: false,
          error: {
            code: 'TOO_MANY_REQUESTS',
            message: config.message || 'Rate limit exceeded',
            retryAfter: result.retryAfter,
          },
        },
        429
      );
    }

    await next();
  });
};

/**
 * Login-specific rate limiter with progressive penalties
 */
export const loginRateLimiter = createMiddleware(async (c, next) => {
  const ip = getClientIP(c);
  const key = `login:${ip}`;

  if (store.isBlocked(`block:${key}`)) {
    return c.json(
      {
        success: false,
        error: {
          code: 'TOO_MANY_ATTEMPTS',
          message: 'Too many failed login attempts. Please try again later.',
        },
      },
      429
    );
  }

  const config: RateLimitConfig = {
    maxRequests: 10,
    windowSizeSeconds: 900, // 15 minutes
    skipSuccessful: true,
  };

  const result = limiter.check(key, config);

  if (!result.allowed) {
    // Block IP after too many failures
    store.block(`block:${key}`, 900);

    return c.json(
      {
        success: false,
        error: {
          code: 'TOO_MANY_ATTEMPTS',
          message: 'Too many login attempts. Account temporarily locked.',
          retryAfter: 900,
        },
      },
      429
    );
  }

  await next();

  // Restore on successful login
  const status = c.res.status;
  if (status >= 200 && status < 300) {
    limiter.restore(key);
  }
});

/**
 * Sensitive operation rate limiter
 */
export const sensitiveOperationRateLimiter = (operationName: string, maxRequests = 5) => {
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

    const key = `sensitive:${operationName}:${auth.tenantId}:${auth.userId}`;

    const config: RateLimitConfig = {
      maxRequests,
      windowSizeSeconds: 3600, // 1 hour
      message: `${operationName} operation rate limited`,
    };

    const result = limiter.check(key, config);

    if (!result.allowed) {
      return c.json(
        {
          success: false,
          error: {
            code: 'TOO_MANY_REQUESTS',
            message: config.message,
            retryAfter: result.retryAfter,
          },
        },
        429
      );
    }

    await next();
  });
};

/**
 * IP blocking utility
 */
export function blockIP(ip: string, durationSeconds = 3600): void {
  store.block(`block:ip:${ip}`, durationSeconds);
}

/**
 * Check if IP is blocked
 */
export function isIPBlocked(ip: string): boolean {
  return store.isBlocked(`block:ip:${ip}`);
}

/**
 * Get rate limit info for current request
 */
export function getRateLimitInfo(c: Context): RateLimitInfo | null {
  const limit = c.res.headers.get('X-RateLimit-Limit');
  const remaining = c.res.headers.get('X-RateLimit-Remaining');
  const reset = c.res.headers.get('X-RateLimit-Reset');

  if (!limit || !remaining || !reset) return null;

  return {
    limit: parseInt(limit, 10),
    remaining: parseInt(remaining, 10),
    reset: parseInt(reset, 10),
  };
}

export { store as rateLimitStore, limiter as rateLimiter, ROLE_LIMITS, ENDPOINT_LIMITS };
