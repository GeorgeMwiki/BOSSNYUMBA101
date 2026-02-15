/**
 * Error Handler Middleware
 * 
 * Centralized error handling for the BOSSNYUMBA API Gateway.
 * Provides consistent error responses, logging, and error classification.
 */

import { Context, MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { ZodError } from 'zod';
import { createLogger } from '../utils/logger';

const logger = createLogger('error-handler');

// ============================================================================
// Error Types
// ============================================================================

export type ErrorCode =
  // Authentication errors (401)
  | 'AUTH_REQUIRED'
  | 'INVALID_TOKEN'
  | 'TOKEN_EXPIRED'
  | 'MFA_REQUIRED'
  | 'ACCOUNT_LOCKED'
  | 'INVALID_CREDENTIALS'
  // Authorization errors (403)
  | 'FORBIDDEN'
  | 'INSUFFICIENT_PERMISSIONS'
  | 'TENANT_ACCESS_DENIED'
  | 'PROPERTY_ACCESS_DENIED'
  | 'APPROVAL_REQUIRED'
  // Validation errors (400)
  | 'VALIDATION_ERROR'
  | 'INVALID_REQUEST'
  | 'MISSING_REQUIRED_FIELD'
  | 'INVALID_FORMAT'
  | 'DUPLICATE_ENTRY'
  // Resource errors (404)
  | 'NOT_FOUND'
  | 'RESOURCE_NOT_FOUND'
  | 'USER_NOT_FOUND'
  | 'PROPERTY_NOT_FOUND'
  | 'TENANT_NOT_FOUND'
  // Conflict errors (409)
  | 'CONFLICT'
  | 'RESOURCE_ALREADY_EXISTS'
  | 'INVALID_STATE_TRANSITION'
  // Rate limiting (429)
  | 'RATE_LIMITED'
  | 'TOO_MANY_REQUESTS'
  | 'QUOTA_EXCEEDED'
  // Server errors (500)
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE'
  | 'DATABASE_ERROR'
  | 'EXTERNAL_SERVICE_ERROR';

export interface ErrorDetails {
  field?: string;
  message: string;
  code?: string;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: ErrorDetails[];
    requestId?: string;
    timestamp: string;
  };
}

// ============================================================================
// Custom Error Classes
// ============================================================================

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly details?: ErrorDetails[];
  public readonly isOperational: boolean;

  constructor(
    statusCode: number,
    code: ErrorCode,
    message: string,
    details?: ErrorDetails[],
    isOperational = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message: string, details?: ErrorDetails[]): ApiError {
    return new ApiError(400, 'VALIDATION_ERROR', message, details);
  }

  static unauthorized(message = 'Authentication required', code: ErrorCode = 'AUTH_REQUIRED'): ApiError {
    return new ApiError(401, code, message);
  }

  static forbidden(message = 'Access denied', code: ErrorCode = 'FORBIDDEN'): ApiError {
    return new ApiError(403, code, message);
  }

  static notFound(resource = 'Resource', code: ErrorCode = 'NOT_FOUND'): ApiError {
    return new ApiError(404, code, `${resource} not found`);
  }

  static conflict(message: string, code: ErrorCode = 'CONFLICT'): ApiError {
    return new ApiError(409, code, message);
  }

  static tooManyRequests(message = 'Too many requests', retryAfter?: number): ApiError {
    const error = new ApiError(429, 'RATE_LIMITED', message);
    if (retryAfter) {
      (error as unknown as { retryAfter: number }).retryAfter = retryAfter;
    }
    return error;
  }

  static internal(message = 'Internal server error'): ApiError {
    return new ApiError(500, 'INTERNAL_ERROR', message, undefined, false);
  }

  static serviceUnavailable(service: string): ApiError {
    return new ApiError(503, 'SERVICE_UNAVAILABLE', `${service} is temporarily unavailable`);
  }
}

// ============================================================================
// Error Response Formatter
// ============================================================================

function formatErrorResponse(
  code: ErrorCode,
  message: string,
  details?: ErrorDetails[],
  requestId?: string
): ApiErrorResponse {
  return {
    success: false,
    error: {
      code,
      message,
      details,
      requestId,
      timestamp: new Date().toISOString(),
    },
  };
}

function formatZodError(error: ZodError): ErrorDetails[] {
  return error.errors.map((err) => ({
    field: err.path.join('.'),
    message: err.message,
    code: err.code,
  }));
}

// ============================================================================
// Error Handler Middleware
// ============================================================================

export const errorHandler: MiddlewareHandler = async (c, next) => {
  try {
    await next();
  } catch (error) {
    const requestId = c.req.header('x-request-id') ?? crypto.randomUUID();

    // Log error
    logger.error('Request error', {
      requestId,
      method: c.req.method,
      path: c.req.path,
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : String(error),
    });

    // Handle different error types
    if (error instanceof ApiError) {
      const response = formatErrorResponse(
        error.code,
        error.message,
        error.details,
        requestId
      );
      
      // Add retry-after header for rate limiting
      const retryAfter = (error as unknown as { retryAfter?: number }).retryAfter;
      if (retryAfter) {
        c.header('Retry-After', String(retryAfter));
      }

      return c.json(response, error.statusCode as 400 | 401 | 403 | 404 | 409 | 429 | 500 | 503);
    }

    if (error instanceof ZodError) {
      const response = formatErrorResponse(
        'VALIDATION_ERROR',
        'Request validation failed',
        formatZodError(error),
        requestId
      );
      return c.json(response, 400);
    }

    if (error instanceof HTTPException) {
      const response = formatErrorResponse(
        error.status === 401 ? 'AUTH_REQUIRED' :
        error.status === 403 ? 'FORBIDDEN' :
        error.status === 404 ? 'NOT_FOUND' :
        error.status === 429 ? 'RATE_LIMITED' :
        'INTERNAL_ERROR',
        error.message,
        undefined,
        requestId
      );
      return c.json(response, error.status);
    }

    // Handle unknown errors
    const isDev = process.env.NODE_ENV !== 'production';
    const response = formatErrorResponse(
      'INTERNAL_ERROR',
      isDev && error instanceof Error ? error.message : 'An unexpected error occurred',
      undefined,
      requestId
    );
    return c.json(response, 500);
  }
};

// ============================================================================
// Not Found Handler
// ============================================================================

export const notFoundHandler = (c: Context) => {
  const requestId = c.req.header('x-request-id') ?? crypto.randomUUID();
  const response = formatErrorResponse(
    'NOT_FOUND',
    `Route ${c.req.method} ${c.req.path} not found`,
    undefined,
    requestId
  );
  return c.json(response, 404);
};

// ============================================================================
// Async Handler Wrapper
// ============================================================================

type AsyncHandler<T extends Context = Context> = (c: T) => Promise<Response | void>;

export function asyncHandler<T extends Context = Context>(
  fn: AsyncHandler<T>
): AsyncHandler<T> {
  return async (c: T) => {
    try {
      return await fn(c);
    } catch (error) {
      throw error; // Let the error handler middleware handle it
    }
  };
}

// ============================================================================
// Error Logging Utility
// ============================================================================

export function logError(error: unknown, context?: Record<string, unknown>): void {
  if (error instanceof ApiError) {
    if (error.isOperational) {
      logger.warn('Operational error', {
        code: error.code,
        message: error.message,
        ...context,
      });
    } else {
      logger.error('Programming error', {
        code: error.code,
        message: error.message,
        stack: error.stack,
        ...context,
      });
    }
  } else if (error instanceof Error) {
    logger.error('Unexpected error', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      ...context,
    });
  } else {
    logger.error('Unknown error', {
      error: String(error),
      ...context,
    });
  }
}

// ============================================================================
// Type Guards
// ============================================================================

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function isOperationalError(error: unknown): boolean {
  if (error instanceof ApiError) {
    return error.isOperational;
  }
  return false;
}
