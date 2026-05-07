// @ts-nocheck — Hono v4 status-code literal union widens c.json branches.

/**
 * /api/v1/portfolio — owner-portal PortfolioAtAGlance source.
 *
 * The owner-portal calls these three endpoints to render the portfolio
 * dashboard:
 *
 *   GET /portfolio/summary       totalUnits, occupancyRate, totalProperties
 *   GET /portfolio/performance   per-property revenue / NOI / cap rate
 *   GET /portfolio/growth        per-month collections trend
 *
 * Until an owner-scoped portfolio aggregator lands, each endpoint
 * returns an "honest empty" shape so the dashboard renders cleanly.
 *
 * Some of this data is already computable from the existing
 * `/owner/financial/stats` BFF (which scopes to `propertyAccess`); when
 * the FE/BE contracts are reconciled we can shim through to that here.
 *
 * TODO(api-gateway): swap each handler for a Drizzle query that joins
 * properties → units → leases → invoices → payments scoped to
 * `auth.propertyAccess` (cf. ownerPortalRouter.getOwnerScope).
 */

import { Hono } from 'hono';
import { authMiddleware } from '../middleware/hono-auth';

const portfolioRouter = new Hono();
portfolioRouter.use('*', authMiddleware);

portfolioRouter.get('/summary', (c) => {
  return c.json({
    success: true,
    data: {
      totalProperties: 0,
      totalUnits: 0,
      occupiedUnits: 0,
      vacantUnits: 0,
      occupancyRate: 0,
      activeLeases: 0,
      meta: { source: 'empty' },
    },
  });
});

portfolioRouter.get('/performance', (c) => {
  // Frontend expects an array of per-property performance rows.
  return c.json({ success: true, data: [] });
});

portfolioRouter.get('/growth', (c) => {
  // Frontend expects an array of per-month growth points.
  return c.json({ success: true, data: [] });
});

export default portfolioRouter;
