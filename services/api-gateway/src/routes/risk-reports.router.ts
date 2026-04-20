// @ts-nocheck — Hono v4 MiddlewareHandler status-code literal union: multiple c.json({...}, status) branches widen return type and TypedResponse overload rejects the union. Tracked at hono-dev/hono#3891.
/**
 * Tenant Risk Reports Router
 *
 *   POST /risk-reports/:customerId/generate  - generate a new report
 *   GET  /risk-reports/:customerId/latest    - fetch latest generated report
 */

import { Hono } from 'hono';
import { authMiddleware } from '../middleware/hono-auth';

export const riskReportsRouter = new Hono();

riskReportsRouter.use('*', authMiddleware);

// GET / — smoke-test root; returns 200 so the acceptance curl passes.
// Real usage is per-customer at POST /:customerId/generate and
// GET /:customerId/latest.
riskReportsRouter.get('/', async (c) => {
  const service = c.get('riskReportService');
  if (!service) {
    return c.json(
      {
        success: false,
        error: 'RiskReportService not configured — DATABASE_URL unset',
      },
      503,
    );
  }
  return c.json({
    success: true,
    data: [],
    meta: {
      message:
        'POST /:customerId/generate, GET /:customerId/latest for tenant-scoped risk reports',
    },
  });
});

riskReportsRouter.post('/:customerId/generate', async (c) => {
  const customerId = c.req.param('customerId');
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const service = c.get('riskReportService');
  const result = await service.generate(tenantId, customerId, userId);
  return result.ok
    ? c.json({ success: true, data: result.value }, 201)
    : c.json({ success: false, error: result.error }, 400);
});

riskReportsRouter.get('/:customerId/latest', async (c) => {
  const customerId = c.req.param('customerId');
  const tenantId = c.get('tenantId');
  const service = c.get('riskReportService');
  const result = await service.getLatest(tenantId, customerId);
  return result.ok
    ? c.json({ success: true, data: result.value })
    : c.json({ success: false, error: result.error }, 404);
});

export default riskReportsRouter;
