// @ts-nocheck
/**
 * Generic live-data Hono router.
 *
 * Serves tenant-scoped read-only listings for any module whose feature label
 * maps to a known entity in the live-data registry. Supports:
 *   - JWT auth (via authMiddleware)
 *   - pagination (`page`, `pageSize`)
 *   - sorting (`sortBy`, `sortOrder`)
 *   - filtering (`status`, `propertyId`, `unitId`, `customerId`, `search`)
 *
 * Mutating requests (POST/PUT/PATCH/DELETE) are still rejected with a 503 so
 * that feature-owners are forced to implement their own write paths with
 * authorization and audit logging.
 */

import { Hono } from 'hono';
import { authMiddleware } from '../middleware/hono-auth';
import { databaseMiddleware } from '../middleware/database';
import { liveDataRequired, getScopedRepos } from '../middleware/live-data';
import {
  listHandlerFor,
  resolveListHandler,
  type ListHandler,
} from '../adapters/live-data-registry';

export interface LiveDataRouterOptions {
  /** Explicit entity key, otherwise resolved from the feature label. */
  entity?: string;
  /** Custom list handler (wins over entity resolution). */
  handler?: ListHandler;
}

function clampInt(value: string | undefined, def: number, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

export function createProtectedLiveDataRouter(
  feature: string,
  options: LiveDataRouterOptions = {}
) {
  const handler: ListHandler | null =
    options.handler ??
    (options.entity ? listHandlerFor(options.entity) : resolveListHandler(feature));

  const app = new Hono();

  app.use('*', authMiddleware);
  app.use('*', databaseMiddleware);
  app.use('*', liveDataRequired(feature));

  if (handler) {
    app.get('/', async (c) => {
      const auth = c.get('auth');
      const repos = c.get('repos');
      const scoped = getScopedRepos(c);

      const page = clampInt(c.req.query('page'), 1, 1, 10_000);
      const pageSize = clampInt(c.req.query('pageSize'), 20, 1, 100);
      const sortBy = c.req.query('sortBy') || undefined;
      const sortOrderRaw = (c.req.query('sortOrder') || 'desc').toLowerCase();
      const sortOrder = sortOrderRaw === 'asc' ? 'asc' : 'desc';
      const search = c.req.query('search') || undefined;

      const filters: Record<string, string | undefined> = {};
      for (const key of ['status', 'propertyId', 'unitId', 'customerId', 'type', 'category']) {
        const v = c.req.query(key);
        if (v) filters[key] = v;
      }

      const result = await handler(repos, {
        tenantId: scoped.tenantId || auth.tenantId,
        page,
        pageSize,
        sortBy,
        sortOrder,
        search,
        filters,
      });

      return c.json({ success: true, data: result.items, pagination: result.pagination });
    });
  }

  // Everything that isn't a supported GET falls back to a 503 so that callers
  // know a dedicated implementation is still required for that verb.
  app.all('*', (c) =>
    c.json(
      {
        success: false,
        error: {
          code: 'LIVE_DATA_NOT_IMPLEMENTED',
          message: `${feature} endpoint is not available on the generic live-data router.`,
        },
      },
      503
    )
  );

  return app;
}
