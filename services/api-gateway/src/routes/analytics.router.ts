// @ts-nocheck — Hono v4 status-code literal union widens c.json branches.

/**
 * /api/v1/analytics — owner-portal AnalyticsSummary card source.
 *
 * The owner-portal Analytics dashboard calls `GET /analytics/summary` to
 * populate top-of-page KPI tiles (occupancy %, revenue MoM, NOI, arrears
 * trend). Until a dedicated analytics service / read-model is wired up,
 * this BFF returns a zeroed shape so the page renders the empty state
 * instead of stalling on a never-resolving fetch.
 *
 * NEVER fabricate data. Each metric is reported as 0 (or null where the
 * frontend's fallback expects it) and `meta.source = 'empty'` is set so
 * the UI can opt to render an em-dash if it prefers.
 *
 * TODO(api-gateway): replace the empty body with a real call to a
 * dedicated analytics aggregator (probably a thin Drizzle query over
 * `payments`/`invoices`/`leases` filtered to the caller's
 * `propertyAccess` set, identical to the owner-portal's existing
 * /financial/stats logic but returning the wider AnalyticsSummary
 * shape).
 */

import { Hono } from 'hono';
import { authMiddleware } from '../middleware/hono-auth';

const analyticsRouter = new Hono();
analyticsRouter.use('*', authMiddleware);

analyticsRouter.get('/summary', (c) => {
  return c.json({
    success: true,
    data: {
      occupancyRate: 0,
      monthlyRevenue: 0,
      revenueGrowth: 0,
      netOperatingIncome: 0,
      arrearsBalance: 0,
      collectionRate: 0,
      totalProperties: 0,
      totalUnits: 0,
      activeLeases: 0,
      meta: {
        source: 'empty',
        note:
          'analytics aggregator not yet wired — returning zeroed shape so the dashboard renders an empty state',
      },
    },
  });
});

export default analyticsRouter;
