/**
 * Audit Middleware - BOSSNYUMBA API Gateway
 * 
 * Automatically logs HTTP requests and responses for audit trail.
 * Integrates with the observability package for consistent audit logging.
 */

import { createMiddleware } from 'hono/factory';
import type { Context } from 'hono';
import type { AuthContext } from './hono-auth.js';
import {
  logAuditEvent,
  logAuditSuccess,
  logAuditFailure,
  logAuditDenied,
  type AuditUser,
  type AuditResource,
  type AuditDetails,
} from '@bossnyumba/observability';
import type { AuditCategory, AuditRequestContext } from '@bossnyumba/observability';

// ============================================================================
// Types
// ============================================================================

export interface AuditMiddlewareConfig {
  /** Skip auditing for these paths (supports patterns) */
  skipPaths?: string[];
  /** Skip auditing for these methods */
  skipMethods?: string[];
  /** Include request body in audit (be careful with sensitive data) */
  includeRequestBody?: boolean;
  /** Include response body in audit */
  includeResponseBody?: boolean;
  /** Maximum body size to include */
  maxBodySize?: number;
  /** Sensitive fields to redact from bodies */
  sensitiveFields?: string[];
  /** Custom category resolver */
  categoryResolver?: (c: Context) => AuditCategory;
  /** Custom action resolver */
  actionResolver?: (c: Context) => string;
  /** Custom resource resolver */
  resourceResolver?: (c: Context) => AuditResource | null;
  /** Error handler */
  onError?: (error: Error, c: Context) => void;
}

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_SKIP_PATHS = [
  '/health',
  '/healthz',
  '/ready',
  '/readiness',
  '/metrics',
  '/favicon.ico',
];

const DEFAULT_SKIP_METHODS = ['OPTIONS'];

const DEFAULT_SENSITIVE_FIELDS = [
  'password',
  'token',
  'accessToken',
  'refreshToken',
  'secret',
  'apiKey',
  'authorization',
  'creditCard',
  'cardNumber',
  'cvv',
  'ssn',
];

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get client IP from request
 */
function getClientIP(c: Context): string {
  const forwarded = c.req.header('X-Forwarded-For');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return c.req.header('X-Real-IP') || c.req.header('CF-Connecting-IP') || 'unknown';
}

/**
 * Build request context from Hono context
 */
function buildRequestContext(c: Context): AuditRequestContext {
  return {
    requestId: c.get('requestId') || c.req.header('X-Request-ID'),
    traceId: c.req.header('X-Trace-ID') || c.req.header('traceparent')?.split('-')[1],
    spanId: c.req.header('X-Span-ID'),
    httpMethod: c.req.method,
    httpPath: c.req.path,
    sourceService: c.req.header('X-Source-Service'),
  };
}

/**
 * Build audit user from auth context
 */
function buildAuditUser(c: Context): AuditUser {
  const auth = c.get('auth') as AuthContext | undefined;
  
  return {
    id: auth?.userId || 'anonymous',
    name: auth?.userName,
    email: auth?.email,
    roles: auth?.role ? [auth.role] : undefined,
    ipAddress: getClientIP(c),
    userAgent: c.req.header('User-Agent'),
  };
}

/**
 * Infer action from HTTP method
 */
function inferAction(method: string): string {
  const actionMap: Record<string, string> = {
    GET: 'VIEW',
    POST: 'CREATE',
    PUT: 'UPDATE',
    PATCH: 'UPDATE',
    DELETE: 'DELETE',
  };
  return actionMap[method] || method;
}

/**
 * Infer category from path
 */
function inferCategory(path: string): AuditCategory {
  const categoryPatterns: Array<[RegExp, AuditCategory]> = [
    [/^\/auth/, 'AUTH'],
    [/^\/users/, 'USER'],
    [/^\/properties/, 'PROPERTY'],
    [/^\/units/, 'PROPERTY'],
    [/^\/leases/, 'LEASE'],
    [/^\/payments/, 'PAYMENT'],
    [/^\/invoices/, 'PAYMENT'],
    [/^\/maintenance/, 'MAINTENANCE'],
    [/^\/work-orders/, 'MAINTENANCE'],
    [/^\/documents/, 'DOCUMENT'],
    [/^\/messages/, 'COMMUNICATION'],
    [/^\/notifications/, 'COMMUNICATION'],
    [/^\/tenants/, 'TENANT'],
    [/^\/organizations/, 'TENANT'],
  ];

  for (const [pattern, category] of categoryPatterns) {
    if (pattern.test(path)) {
      return category;
    }
  }

  return 'SYSTEM';
}

/**
 * Infer resource from path and body
 */
function inferResource(c: Context, body?: unknown): AuditResource | null {
  const path = c.req.path;
  const method = c.req.method;
  
  // Extract resource type from path
  const segments = path.split('/').filter(Boolean);
  if (segments.length === 0) return null;

  const resourceType = segments[0]
    .replace(/-/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase())
    .replace(/s$/, ''); // Remove trailing 's' for singular

  // Try to extract ID from path or body
  let resourceId = segments[1] || 'unknown';
  
  if (method === 'POST' && body && typeof body === 'object') {
    const bodyObj = body as Record<string, unknown>;
    resourceId = (bodyObj.id as string) || resourceId;
  }

  return {
    type: resourceType,
    id: resourceId,
  };
}

/**
 * Redact sensitive fields from object
 */
function redactSensitive(
  obj: unknown,
  sensitiveFields: string[]
): unknown {
  if (!obj || typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(item => redactSensitive(item, sensitiveFields));
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (sensitiveFields.some(f => key.toLowerCase().includes(f.toLowerCase()))) {
      result[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      result[key] = redactSensitive(value, sensitiveFields);
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Check if path matches any skip pattern
 */
function shouldSkipPath(path: string, skipPaths: string[]): boolean {
  return skipPaths.some(pattern => {
    if (pattern.includes('*')) {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      return regex.test(path);
    }
    return path === pattern || path.startsWith(pattern);
  });
}

// ============================================================================
// Middleware
// ============================================================================

/**
 * Create audit middleware with custom configuration
 */
export const createAuditMiddleware = (config: AuditMiddlewareConfig = {}) => {
  const {
    skipPaths = DEFAULT_SKIP_PATHS,
    skipMethods = DEFAULT_SKIP_METHODS,
    includeRequestBody = false,
    includeResponseBody = false,
    maxBodySize = 10000,
    sensitiveFields = DEFAULT_SENSITIVE_FIELDS,
    categoryResolver,
    actionResolver,
    resourceResolver,
    onError,
  } = config;

  return createMiddleware(async (c, next) => {
    const startTime = Date.now();
    const path = c.req.path;
    const method = c.req.method;

    // Skip if path or method should be skipped
    if (shouldSkipPath(path, skipPaths) || skipMethods.includes(method)) {
      return next();
    }

    // Capture request body if needed
    let requestBody: unknown;
    if (includeRequestBody && ['POST', 'PUT', 'PATCH'].includes(method)) {
      try {
        const contentType = c.req.header('Content-Type') || '';
        if (contentType.includes('application/json')) {
          requestBody = await c.req.json();
        }
      } catch {
        // Ignore body parsing errors
      }
    }

    // Execute the request
    await next();

    // Calculate duration
    const duration = Date.now() - startTime;

    // Build audit event data
    const user = buildAuditUser(c);
    const action = actionResolver ? actionResolver(c) : inferAction(method);
    const resource = resourceResolver
      ? resourceResolver(c)
      : inferResource(c, requestBody);
    const category = categoryResolver ? categoryResolver(c) : inferCategory(path);

    if (!resource) {
      return; // Can't audit without a resource
    }

    // Determine outcome from response status
    const status = c.res.status;
    const isSuccess = status >= 200 && status < 300;
    const isDenied = status === 401 || status === 403;
    const isError = status >= 500;

    // Build metadata
    const metadata: Record<string, unknown> = {
      httpStatus: status,
      durationMs: duration,
      path,
      method,
    };

    if (includeRequestBody && requestBody) {
      const redacted = redactSensitive(requestBody, sensitiveFields);
      const bodyStr = JSON.stringify(redacted);
      if (bodyStr.length <= maxBodySize) {
        metadata.requestBody = redacted;
      } else {
        metadata.requestBody = '[TRUNCATED]';
      }
    }

    // Build audit details
    const details: AuditDetails = {
      category,
      request: buildRequestContext(c),
      metadata,
    };

    // Get auth context for tenant info
    const auth = c.get('auth') as AuthContext | undefined;
    if (auth?.tenantId) {
      details.tenant = {
        tenantId: auth.tenantId,
        tenantName: auth.tenantName,
      };
    }

    try {
      if (isDenied) {
        await logAuditDenied(
          user,
          action,
          resource,
          status === 401 ? 'Authentication required' : 'Insufficient permissions',
          details
        );
      } else if (isError) {
        await logAuditFailure(
          user,
          action,
          resource,
          `Server error: ${status}`,
          details
        );
      } else if (isSuccess) {
        await logAuditSuccess(user, action, resource, details);
      } else {
        // 4xx errors (other than auth)
        await logAuditFailure(
          user,
          action,
          resource,
          `Client error: ${status}`,
          details
        );
      }
    } catch (error) {
      if (onError && error instanceof Error) {
        onError(error, c);
      }
      // Don't throw - audit failures shouldn't break the request
    }
  });
};

/**
 * Default audit middleware with standard configuration
 */
export const auditMiddleware = createAuditMiddleware();

/**
 * Audit middleware for sensitive operations (includes request body)
 */
export const sensitiveAuditMiddleware = createAuditMiddleware({
  includeRequestBody: true,
  includeResponseBody: false,
});

/**
 * Audit middleware for admin operations
 */
export const adminAuditMiddleware = createAuditMiddleware({
  includeRequestBody: true,
  sensitiveFields: [
    ...DEFAULT_SENSITIVE_FIELDS,
    'internalNotes',
    'adminNotes',
  ],
});

// ============================================================================
// Utility Middleware
// ============================================================================

/**
 * Skip audit for specific routes
 */
export const skipAudit = createMiddleware(async (c, next) => {
  c.set('skipAudit', true);
  await next();
});

/**
 * Manual audit logging helper
 */
export async function auditRequest(
  c: Context,
  action: string,
  resource: AuditResource,
  details?: Partial<AuditDetails>
): Promise<void> {
  const user = buildAuditUser(c);
  const requestContext = buildRequestContext(c);

  const auth = c.get('auth') as AuthContext | undefined;
  const tenant = auth?.tenantId
    ? { tenantId: auth.tenantId, tenantName: auth.tenantName }
    : undefined;

  await logAuditEvent(user, action, resource, {
    ...details,
    request: requestContext,
    tenant: details?.tenant || tenant,
  });
}

// Extend Hono context types
declare module 'hono' {
  interface ContextVariableMap {
    skipAudit?: boolean;
  }
}
