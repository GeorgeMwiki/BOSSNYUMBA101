/**
 * Global Error Handler Middleware - BOSSNYUMBA
 *
 * Implements comprehensive error handling:
 * - Standardized error response format
 * - Error classification and categorization
 * - Logging integration
 * - Request context preservation
 * - Security-aware error messages
 */

import { createMiddleware } from 'hono/factory';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { ZodError } from 'zod';

// ============================================================================
// Error Types
// ============================================================================

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'BAD_REQUEST'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE'
  | 'GATEWAY_TIMEOUT'
  | 'UNPROCESSABLE_ENTITY'
  | 'PAYMENT_REQUIRED'
  | 'METHOD_NOT_ALLOWED'
  | 'PAYLOAD_TOO_LARGE'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'PRECONDITION_FAILED'
  | 'TOO_MANY_REQUESTS'
  | 'TOKEN_EXPIRED'
  | 'INVALID_TOKEN'
  | 'TENANT_NOT_FOUND'
  | 'TENANT_INACTIVE'
  | 'FEATURE_NOT_AVAILABLE'
  | 'LIMIT_EXCEEDED'
  | 'EXTERNAL_SERVICE_ERROR'
  | 'DATABASE_ERROR';

export interface ErrorDetails {
  field?: string;
  path?: string;
  value?: unknown;
  constraint?: string;
  [key: string]: unknown;
}

export interface ApiError {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: ErrorDetails | ErrorDetails[];
    requestId?: string;
    timestamp?: string;
    path?: string;
    // Only included in development
    stack?: string;
  };
}

// ============================================================================
// Custom Error Classes
// ============================================================================

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: ErrorDetails | ErrorDetails[];
  public readonly isOperational: boolean;

  constructor(
    code: ErrorCode,
    message: string,
    statusCode = 500,
    details?: ErrorDetails | ErrorDetails[],
    isOperational = true
  ) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = isOperational;
    this.name = 'AppError';

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: ErrorDetails | ErrorDetails[]) {
    super('VALIDATION_ERROR', message, 400, details);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required', code: ErrorCode = 'UNAUTHORIZED') {
    super(code, message, 401);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'Access denied') {
    super('FORBIDDEN', message, 403);
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    const message = id ? `${resource} with ID '${id}' not found` : `${resource} not found`;
    super('NOT_FOUND', message, 404);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: ErrorDetails) {
    super('CONFLICT', message, 409, details);
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends AppError {
  public readonly retryAfter: number;

  constructor(message = 'Rate limit exceeded', retryAfter = 60) {
    super('TOO_MANY_REQUESTS', message, 429);
    this.retryAfter = retryAfter;
    this.name = 'RateLimitError';
  }
}

export class ExternalServiceError extends AppError {
  public readonly service: string;

  constructor(service: string, message: string) {
    super('EXTERNAL_SERVICE_ERROR', `${service}: ${message}`, 502);
    this.service = service;
    this.name = 'ExternalServiceError';
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, details?: ErrorDetails) {
    super('DATABASE_ERROR', message, 500, details, false);
    this.name = 'DatabaseError';
  }
}

// ============================================================================
// Error Factory Functions
// ============================================================================

export const Errors = {
  badRequest: (message: string, details?: ErrorDetails | ErrorDetails[]) =>
    new AppError('BAD_REQUEST', message, 400, details),

  unauthorized: (message = 'Unauthorized') =>
    new AuthenticationError(message),

  tokenExpired: () =>
    new AuthenticationError('Token has expired', 'TOKEN_EXPIRED'),

  invalidToken: () =>
    new AuthenticationError('Invalid token', 'INVALID_TOKEN'),

  forbidden: (message = 'Access denied') =>
    new AuthorizationError(message),

  notFound: (resource: string, id?: string) =>
    new NotFoundError(resource, id),

  conflict: (message: string, details?: ErrorDetails) =>
    new ConflictError(message, details),

  validation: (message: string, details?: ErrorDetails | ErrorDetails[]) =>
    new ValidationError(message, details),

  rateLimited: (message?: string, retryAfter?: number) =>
    new RateLimitError(message, retryAfter),

  serviceUnavailable: (message = 'Service temporarily unavailable') =>
    new AppError('SERVICE_UNAVAILABLE', message, 503),

  internalError: (message = 'An unexpected error occurred') =>
    new AppError('INTERNAL_ERROR', message, 500, undefined, false),

  externalService: (service: string, message: string) =>
    new ExternalServiceError(service, message),

  database: (message: string, details?: ErrorDetails) =>
    new DatabaseError(message, details),

  featureNotAvailable: (feature: string) =>
    new AppError('FEATURE_NOT_AVAILABLE', `Feature '${feature}' is not available on your plan`, 403),

  limitExceeded: (limit: string, currentValue: number, maxValue: number) =>
    new AppError('LIMIT_EXCEEDED', `${limit} limit exceeded`, 403, {
      limit,
      currentValue,
      maxValue,
    }),
};

// ============================================================================
// Error Response Formatting
// ============================================================================

function formatZodError(error: ZodError): ErrorDetails[] {
  return error.errors.map((e) => ({
    field: e.path.join('.'),
    path: e.path.join('.'),
    message: e.message,
    code: e.code,
  }));
}

function createErrorResponse(
  error: Error,
  c: Context,
  statusCode: number,
  code: ErrorCode,
  message: string,
  details?: ErrorDetails | ErrorDetails[]
): ApiError {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const requestId = c.get('requestId') as string | undefined;

  const response: ApiError = {
    success: false,
    error: {
      code,
      message,
      requestId,
      timestamp: new Date().toISOString(),
      path: c.req.path,
    },
  };

  if (details) {
    response.error.details = details;
  }

  // Only include stack trace in development
  if (isDevelopment && error.stack) {
    response.error.stack = error.stack;
  }

  return response;
}

// ============================================================================
// Error Handler Middleware
// ============================================================================

/**
 * Global error handler - catches all unhandled errors
 */
export const errorHandlerMiddleware = createMiddleware(async (c, next) => {
  try {
    await next();
  } catch (error) {
    // Log the error
    console.error('[Error Handler]', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      path: c.req.path,
      method: c.req.method,
      requestId: c.get('requestId'),
    });

    // Handle different error types
    if (error instanceof AppError) {
      const response = createErrorResponse(
        error,
        c,
        error.statusCode,
        error.code,
        error.message,
        error.details
      );

      if (error instanceof RateLimitError) {
        c.header('Retry-After', String(error.retryAfter));
      }

      return c.json(response, error.statusCode);
    }

    if (error instanceof HTTPException) {
      const code = httpStatusToErrorCode(error.status);
      const response = createErrorResponse(
        error,
        c,
        error.status,
        code,
        error.message
      );
      return c.json(response, error.status);
    }

    if (error instanceof ZodError) {
      const details = formatZodError(error);
      const response = createErrorResponse(
        error,
        c,
        400,
        'VALIDATION_ERROR',
        'Request validation failed',
        details
      );
      return c.json(response, 400);
    }

    // Handle generic errors
    const isError = error instanceof Error;
    const message =
      process.env.NODE_ENV === 'development' && isError
        ? error.message
        : 'An unexpected error occurred';

    const response = createErrorResponse(
      isError ? error : new Error(String(error)),
      c,
      500,
      'INTERNAL_ERROR',
      message
    );

    return c.json(response, 500);
  }
});

/**
 * 404 Not Found handler
 */
export const notFoundHandler = (c: Context) => {
  const response: ApiError = {
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${c.req.method} ${c.req.path} not found`,
      requestId: c.get('requestId') as string | undefined,
      timestamp: new Date().toISOString(),
      path: c.req.path,
    },
  };

  return c.json(response, 404);
};

/**
 * Method not allowed handler
 */
export const methodNotAllowedHandler = (c: Context, allowedMethods: string[]) => {
  const response: ApiError = {
    success: false,
    error: {
      code: 'METHOD_NOT_ALLOWED',
      message: `Method ${c.req.method} not allowed. Allowed: ${allowedMethods.join(', ')}`,
      requestId: c.get('requestId') as string | undefined,
      timestamp: new Date().toISOString(),
      path: c.req.path,
    },
  };

  c.header('Allow', allowedMethods.join(', '));
  return c.json(response, 405);
};

// ============================================================================
// Utility Functions
// ============================================================================

function httpStatusToErrorCode(status: number): ErrorCode {
  const mapping: Record<number, ErrorCode> = {
    400: 'BAD_REQUEST',
    401: 'UNAUTHORIZED',
    403: 'FORBIDDEN',
    404: 'NOT_FOUND',
    405: 'METHOD_NOT_ALLOWED',
    409: 'CONFLICT',
    413: 'PAYLOAD_TOO_LARGE',
    415: 'UNSUPPORTED_MEDIA_TYPE',
    422: 'UNPROCESSABLE_ENTITY',
    429: 'TOO_MANY_REQUESTS',
    500: 'INTERNAL_ERROR',
    502: 'EXTERNAL_SERVICE_ERROR',
    503: 'SERVICE_UNAVAILABLE',
    504: 'GATEWAY_TIMEOUT',
  };

  return mapping[status] || 'INTERNAL_ERROR';
}

/**
 * Wrap async route handlers to catch errors
 */
export function asyncHandler<T>(
  fn: (c: Context) => Promise<T>
): (c: Context) => Promise<T> {
  return async (c: Context) => {
    try {
      return await fn(c);
    } catch (error) {
      throw error; // Let error handler middleware catch it
    }
  };
}

/**
 * Assert condition or throw error
 */
export function assert(
  condition: boolean,
  error: AppError | string
): asserts condition {
  if (!condition) {
    throw typeof error === 'string' ? Errors.badRequest(error) : error;
  }
}

/**
 * Assert value is not null/undefined or throw NotFound
 */
export function assertFound<T>(
  value: T | null | undefined,
  resource: string,
  id?: string
): asserts value is T {
  if (value === null || value === undefined) {
    throw Errors.notFound(resource, id);
  }
}

// ============================================================================
// Export Error Types
// ============================================================================

export type {
  ErrorDetails as ApiErrorDetails,
  ErrorCode as ApiErrorCode,
};
