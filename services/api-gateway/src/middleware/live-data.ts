// @ts-nocheck
/**
 * Live-data middleware.
 *
 * Ensures a live database connection is available and injects a
 * tenant-scoped repository accessor into the Hono context. Routes downstream
 * can call `c.get('scopedRepos')` to operate on real data without plumbing
 * tenant IDs through every call site.
 */

import { createMiddleware } from 'hono/factory';
import { buildScopedRepos, type ScopedRepos } from '../adapters/scoped-repos';
import { isUsingMockData } from './database';

declare module 'hono' {
  interface ContextVariableMap {
    scopedRepos: ScopedRepos;
    liveDataFeature: string;
  }
}

/**
 * Guard a route behind a live-data connection and a resolved tenant context.
 *
 * Behaviour:
 *  - In `test` mode, passes through with a best-effort scoped-repo injection.
 *  - Without DB connection, returns 503 `LIVE_DATA_NOT_CONFIGURED`.
 *  - Without auth/tenant context, returns 401 `UNAUTHORIZED`.
 *  - Otherwise injects `scopedRepos` for tenant-scoped data access.
 */
export function liveDataRequired(feature: string) {
  return createMiddleware(async (c, next) => {
    c.set('liveDataFeature', feature);

    const auth = c.get('auth');
    const repos = c.get('repos');

    if (process.env.NODE_ENV === 'test') {
      c.set('scopedRepos', buildScopedRepos(repos ?? null, auth?.tenantId ?? 'test-tenant'));
      await next();
      return;
    }

    if (isUsingMockData() || !repos) {
      return c.json(
        {
          success: false,
          error: {
            code: 'LIVE_DATA_NOT_CONFIGURED',
            message: `${feature} requires a live database connection.`,
          },
        },
        503
      );
    }

    if (!auth?.tenantId) {
      return c.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: `${feature} requires an authenticated tenant context.`,
          },
        },
        401
      );
    }

    c.set('scopedRepos', buildScopedRepos(repos, auth.tenantId));
    await next();
  });
}

/**
 * Return the tenant-scoped repository accessor for the current request.
 * Throws if the middleware has not run.
 */
export function getScopedRepos(c: any): ScopedRepos {
  const scoped = c.get('scopedRepos') as ScopedRepos | undefined;
  if (!scoped) {
    throw new Error('scopedRepos not initialised. Ensure liveDataRequired() middleware is mounted.');
  }
  return scoped;
}
