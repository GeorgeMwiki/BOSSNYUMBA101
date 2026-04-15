/**
 * HTTP Logger Middleware (Hono)
 *
 * Emits structured logs for every HTTP request with:
 *   - requestId (UUID, also reflected via X-Request-Id header)
 *   - tenantId, userId, activeOrgId (extracted from auth context if present)
 *   - method, path, status, latencyMs
 *
 * Also emits an `emitHttpRequest` metric when the response completes.
 */

import type { Context, MiddlewareHandler } from 'hono';
import { randomUUID } from 'crypto';
import { emitHttpRequest } from '../metrics/emitters/http.js';

export const REQUEST_ID_HEADER = 'X-Request-Id';
export const REQUEST_ID_CONTEXT_KEY = 'requestId';

/**
 * Shape of the auth context the middleware will look for on `c.get('auth')`.
 * All fields are optional to keep the middleware compatible with unauthenticated
 * routes (e.g. /health, /auth/login).
 */
export interface HttpLoggerAuthContext {
  userId?: string;
  tenantId?: string;
  activeOrgId?: string;
  orgId?: string;
}

export interface HttpLoggerOptions {
  /** Service name for log enrichment */
  service?: string;
  /** Optional logger. Defaults to console-backed structured JSON. */
  log?: (entry: Record<string, unknown>) => void;
  /** Header name used for the request id (default: X-Request-Id). */
  headerName?: string;
  /** If provided, this is used instead of auto-generating a UUID. */
  generateRequestId?: () => string;
}

function defaultLog(entry: Record<string, unknown>): void {
  // Structured single-line JSON; production setups should swap this for pino.
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(entry));
}

function extractAuth(c: Context): HttpLoggerAuthContext {
  try {
    const auth = (c.get as (k: string) => unknown)('auth') as
      | HttpLoggerAuthContext
      | undefined;
    if (!auth || typeof auth !== 'object') return {};
    return {
      userId: auth.userId,
      tenantId: auth.tenantId,
      activeOrgId: auth.activeOrgId ?? auth.orgId,
    };
  } catch {
    return {};
  }
}

/**
 * Factory that returns a Hono middleware which logs requests and emits metrics.
 */
export function httpLogger(options: HttpLoggerOptions = {}): MiddlewareHandler {
  const log = options.log ?? defaultLog;
  const headerName = options.headerName ?? REQUEST_ID_HEADER;
  const genId = options.generateRequestId ?? randomUUID;
  const service = options.service;

  return async (c, next) => {
    const incomingId = c.req.header(headerName);
    const requestId = incomingId && incomingId.length > 0 ? incomingId : genId();

    // Expose requestId to downstream handlers and clients
    (c.set as (k: string, v: unknown) => void)(REQUEST_ID_CONTEXT_KEY, requestId);
    c.header(headerName, requestId);

    const method = c.req.method;
    const path = c.req.path;
    const startedAt = Date.now();

    // Emit request.start before auth runs (auth context not yet populated)
    log({
      level: 'info',
      event: 'http.request.start',
      service,
      requestId,
      method,
      path,
      timestamp: new Date().toISOString(),
    });

    let errored: Error | undefined;
    try {
      await next();
    } catch (err) {
      errored = err as Error;
      throw err;
    } finally {
      const latencyMs = Date.now() - startedAt;
      const status = errored ? 500 : c.res.status;
      const auth = extractAuth(c);

      log({
        level: errored ? 'error' : 'info',
        event: 'http.request.end',
        service,
        requestId,
        method,
        path,
        status,
        latencyMs,
        tenantId: auth.tenantId,
        userId: auth.userId,
        activeOrgId: auth.activeOrgId,
        ...(errored && {
          error: { name: errored.name, message: errored.message },
        }),
        timestamp: new Date().toISOString(),
      });

      // Fire-and-forget metric emission
      try {
        emitHttpRequest({
          method,
          path,
          status,
          latencyMs,
          tenantId: auth.tenantId,
        });
      } catch {
        // metrics must never break the request path
      }
    }
  };
}

/**
 * Convenience accessor: read the request id stashed on the Hono context.
 */
export function getRequestId(c: Context): string | undefined {
  try {
    return (c.get as (k: string) => unknown)(REQUEST_ID_CONTEXT_KEY) as
      | string
      | undefined;
  } catch {
    return undefined;
  }
}
