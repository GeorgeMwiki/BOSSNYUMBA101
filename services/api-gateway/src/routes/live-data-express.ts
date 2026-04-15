// @ts-nocheck
/**
 * Generic live-data Express router.
 *
 * Express counterpart to `createProtectedLiveDataRouter`. Provides a
 * tenant-scoped read-only listing endpoint for any module whose feature
 * label resolves to a known entity in the live-data registry.
 */

import { Router } from 'express';
import {
  authMiddleware as expressAuthMiddleware,
  type AuthenticatedRequest,
} from '../middleware/auth';
import { getDatabaseClient, isUsingMockData } from '../middleware/database';
import {
  TenantRepository,
  UserRepository,
  PropertyRepository,
  UnitRepository,
  CustomerRepository,
  LeaseRepository,
  InvoiceRepository,
  PaymentRepository,
} from '@bossnyumba/database';
import {
  listHandlerFor,
  resolveListHandler,
  type ListHandler,
} from '../adapters/live-data-registry';

export interface LiveDataExpressOptions {
  entity?: string;
  handler?: ListHandler;
}

function clampInt(value: unknown, def: number, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

function buildExpressRepos() {
  const db = getDatabaseClient();
  if (!db) return null;
  return {
    tenants: new TenantRepository(db),
    users: new UserRepository(db),
    properties: new PropertyRepository(db),
    units: new UnitRepository(db),
    customers: new CustomerRepository(db),
    leases: new LeaseRepository(db),
    invoices: new InvoiceRepository(db),
    payments: new PaymentRepository(db),
  } as any;
}

export function createLiveDataExpressRouter(
  feature: string,
  options: LiveDataExpressOptions = {}
) {
  const router = Router();

  const handler: ListHandler | null =
    options.handler ??
    (options.entity ? listHandlerFor(options.entity) : resolveListHandler(feature));

  if (handler) {
    router.get('/', expressAuthMiddleware, async (req, res, next) => {
      try {
        if (isUsingMockData()) {
          return res.status(503).json({
            success: false,
            error: {
              code: 'LIVE_DATA_NOT_CONFIGURED',
              message: `${feature} requires a live database connection.`,
            },
          });
        }

        const repos = buildExpressRepos();
        if (!repos) {
          return res.status(503).json({
            success: false,
            error: {
              code: 'LIVE_DATA_NOT_CONFIGURED',
              message: `${feature} requires a live database connection.`,
            },
          });
        }

        const auth = (req as AuthenticatedRequest).auth;
        if (!auth?.tenantId) {
          return res.status(401).json({
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'Authenticated tenant context required.' },
          });
        }

        const q = req.query as Record<string, string | undefined>;
        const page = clampInt(q.page, 1, 1, 10_000);
        const pageSize = clampInt(q.pageSize, 20, 1, 100);
        const sortOrderRaw = (q.sortOrder || 'desc').toLowerCase();
        const sortOrder = sortOrderRaw === 'asc' ? 'asc' : 'desc';

        const filters: Record<string, string | undefined> = {};
        for (const key of ['status', 'propertyId', 'unitId', 'customerId', 'type', 'category']) {
          if (typeof q[key] === 'string' && q[key]) filters[key] = q[key];
        }

        const result = await handler(repos, {
          tenantId: auth.tenantId,
          page,
          pageSize,
          sortBy: q.sortBy,
          sortOrder,
          search: q.search,
          filters,
        });

        return res.json({ success: true, data: result.items, pagination: result.pagination });
      } catch (err) {
        next(err);
      }
    });
  }

  router.all('*', (_req, res) => {
    res.status(503).json({
      success: false,
      error: {
        code: 'LIVE_DATA_NOT_IMPLEMENTED',
        message: `${feature} endpoint is not available on the generic live-data router.`,
      },
    });
  });

  return router;
}
