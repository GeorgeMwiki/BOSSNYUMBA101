/**
 * Request ID propagation — SCAFFOLDED 10
 *
 * Ensures every request has a stable `X-Request-Id` that:
 *   (a) is echoed back to the caller on the response,
 *   (b) is attached to the Hono context / Express request for downstream
 *       handlers to log against,
 *   (c) is forwarded to outbound `fetch` calls made during this request
 *       via `createRequestFetch(requestId)`.
 *
 * If the caller supplies an existing `X-Request-Id` header we preserve it
 * (useful for cross-service trace correlation from the BFF layer). Otherwise
 * we mint a fresh UUID.
 */

import { randomUUID } from 'node:crypto';
import type { MiddlewareHandler, Context } from 'hono';
import type { NextFunction, Request, Response } from 'express';

declare module 'hono' {
  interface ContextVariableMap {
    requestId: string;
  }
}

const HEADER = 'x-request-id';

function pickId(incoming: string | undefined | null): string {
  if (incoming && /^[A-Za-z0-9._-]{8,128}$/.test(incoming)) return incoming;
  return randomUUID();
}

// ---------------------------------------------------------------------------
// Hono
// ---------------------------------------------------------------------------

export function createHonoRequestIdMiddleware(): MiddlewareHandler {
  return async (c: Context, next) => {
    const id = pickId(c.req.header(HEADER));
    c.set('requestId', id);
    c.header('x-request-id', id);
    await next();
  };
}

// ---------------------------------------------------------------------------
// Express
// ---------------------------------------------------------------------------

export function createExpressRequestIdMiddleware() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const id = pickId(req.header(HEADER));
    (req as Request & { requestId: string }).requestId = id;
    res.setHeader('x-request-id', id);
    next();
  };
}

// ---------------------------------------------------------------------------
// Outbound fetch wrapper — propagate request id to downstream services.
// ---------------------------------------------------------------------------

export function createRequestFetch(requestId: string): typeof fetch {
  return ((input, init = {}) => {
    const headers = new Headers(init.headers);
    if (!headers.has('x-request-id')) {
      headers.set('x-request-id', requestId);
    }
    return fetch(input, { ...init, headers });
  }) as typeof fetch;
}
