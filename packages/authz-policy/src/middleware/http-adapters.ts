/**
 * HTTP framework adapters for the authorization middleware.
 *
 * Provides concrete Express- and Hono-style middleware factories that wrap the
 * framework-agnostic {@link AuthorizationMiddleware}. These adapters keep the
 * authorization logic in a single place while delivering an ergonomic API for
 * the two framework families used across the platform.
 *
 * They are intentionally structurally typed (duck-typing) so the package can
 * stay framework-agnostic in its dependency graph — no hard imports of
 * Express or Hono are required.
 */

import type {
  AuthorizationMiddleware,
} from './authorization-middleware.js';
import {
  type AuthContext,
  AuthenticationError,
  AuthorizationError,
  runWithAuthContextAsync,
} from './auth-context.js';
import type { ResourceContext } from '../engine/authorization-service.js';

// ---------------------------------------------------------------------------
// Express adapter
// ---------------------------------------------------------------------------

/** Minimal structural type for an Express-like request. */
export interface ExpressLikeRequest {
  method: string;
  path: string;
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
  params?: Record<string, string>;
  query?: Record<string, unknown>;
  body?: unknown;
  // The adapter will populate `auth` on the request for downstream handlers.
  auth?: AuthContext;
  [key: string]: unknown;
}

/** Minimal structural type for an Express-like response. */
export interface ExpressLikeResponse {
  status(code: number): this;
  json(body: unknown): this;
  setHeader(name: string, value: string): this;
}

export type ExpressNext = (err?: unknown) => void;

/**
 * Build an Express authorization middleware for a given resource/action.
 *
 * The middleware expects an {@link AuthContext} to have been attached by a
 * preceding authentication middleware as `req.auth`. Tenant context is
 * propagated via AsyncLocalStorage using {@link runWithAuthContextAsync}.
 */
export function createExpressAuthorize(
  authMiddleware: AuthorizationMiddleware,
  options: {
    resource: string;
    action: string;
    extractResource?: (req: ExpressLikeRequest) => Partial<ResourceContext>;
  }
) {
  return async (
    req: ExpressLikeRequest,
    res: ExpressLikeResponse,
    next: ExpressNext
  ): Promise<void> => {
    try {
      const authContext = req.auth;
      if (!authContext) {
        throw new AuthenticationError('Authentication required');
      }

      authMiddleware.validateAuthContext(authContext, req.path);

      const resource: ResourceContext = {
        type: options.resource,
        ...options.extractResource?.(req),
      };

      await runWithAuthContextAsync(authContext, async () => {
        await authMiddleware.authorizeRequest(
          authContext,
          options.action,
          resource
        );
        await new Promise<void>((resolve, reject) => {
          try {
            // Pass through to next handler inside the context.
            next();
            resolve();
          } catch (err) {
            reject(err);
          }
        });
      });
    } catch (err) {
      if (err instanceof AuthenticationError) {
        res.status(401).json({
          error: { code: err.code, message: err.message },
        });
        return;
      }
      if (err instanceof AuthorizationError) {
        res.status(403).json({
          error: {
            code: err.code,
            message: err.message,
            resource: err.resource,
            action: err.action,
          },
        });
        return;
      }
      next(err);
    }
  };
}

// ---------------------------------------------------------------------------
// Hono adapter
// ---------------------------------------------------------------------------

/**
 * Minimal structural type for a Hono-like context.
 * Matches the shape of Hono v3/v4 without importing Hono types.
 */
export interface HonoLikeContext {
  req: {
    method: string;
    path: string;
    header(name?: string): string | Record<string, string> | undefined;
    param(name?: string): string | Record<string, string> | undefined;
  };
  get<T = unknown>(key: string): T | undefined;
  set(key: string, value: unknown): void;
  json(
    body: unknown,
    status?: number,
    headers?: Record<string, string>
  ): Response;
}

export type HonoNext = () => Promise<void>;

/**
 * Build a Hono authorization middleware for a given resource/action.
 *
 * Expects an authenticated {@link AuthContext} to have been placed on
 * `c.set('auth', ...)` by an earlier middleware.
 */
export function createHonoAuthorize(
  authMiddleware: AuthorizationMiddleware,
  options: {
    resource: string;
    action: string;
    extractResource?: (c: HonoLikeContext) => Partial<ResourceContext>;
  }
) {
  return async (c: HonoLikeContext, next: HonoNext): Promise<Response | void> => {
    try {
      const authContext = c.get<AuthContext>('auth');
      if (!authContext) {
        throw new AuthenticationError('Authentication required');
      }

      authMiddleware.validateAuthContext(authContext, c.req.path);

      const resource: ResourceContext = {
        type: options.resource,
        ...options.extractResource?.(c),
      };

      let nextErr: unknown;
      await runWithAuthContextAsync(authContext, async () => {
        await authMiddleware.authorizeRequest(
          authContext,
          options.action,
          resource
        );
        try {
          await next();
        } catch (err) {
          nextErr = err;
        }
      });
      if (nextErr) throw nextErr;
    } catch (err) {
      if (err instanceof AuthenticationError) {
        return c.json(
          { error: { code: err.code, message: err.message } },
          401
        );
      }
      if (err instanceof AuthorizationError) {
        return c.json(
          {
            error: {
              code: err.code,
              message: err.message,
              resource: err.resource,
              action: err.action,
            },
          },
          403
        );
      }
      throw err;
    }
  };
}
