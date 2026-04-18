// @ts-nocheck
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
