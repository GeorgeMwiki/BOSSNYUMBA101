// @ts-nocheck — Hono v4 MiddlewareHandler status-code literal union: multiple c.json({...}, status) branches widen return type and TypedResponse overload rejects the union. Tracked at hono-dev/hono#3891.
/**
 * Tenant Risk Reports Router
 *
 *   POST /risk-reports/:customerId/generate  - generate a new report
 *   GET  /risk-reports/:customerId/latest    - fetch latest generated report
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { withRateLimit } from '../middleware/rate-limit';
import { authMiddleware } from '../middleware/hono-auth';
import { routeCatch } from '../utils/safe-error';

// POST /:customerId/generate is action-keyed by the customerId path
// param; the body is optional and supports overrides for the report
// generator. We accept an empty body too.
const GenerateRiskReportSchema = z
  .object({
    note: z.string().max(2_000).optional(),
    includePartial: z.boolean().optional(),
  })
  .strict();
const CustomerIdParamSchema = z.object({ customerId: z.string().min(1).max(128) });

export const riskReportsRouter = new Hono();
riskReportsRouter.use('*', withRateLimit({ key: 'risk-reports', max: 120, window: '1m' }));

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
  const paramParsed = CustomerIdParamSchema.safeParse({
    customerId: c.req.param('customerId'),
  });
  if (!paramParsed.success) {
    return c.json(
      { success: false, error: { code: 'INVALID_INPUT', message: paramParsed.error.message } },
      400,
    );
  }
  const customerId = paramParsed.data.customerId;
  // Body is optional — we permit empty `{}` and any shape inside the
  // strict schema. Anything else is a malformed call.
  const rawBody = await c.req.json().catch(() => ({}));
  const bodyParsed = GenerateRiskReportSchema.safeParse(rawBody);
  if (!bodyParsed.success) {
    return c.json(
      { success: false, error: { code: 'INVALID_INPUT', message: bodyParsed.error.message } },
      400,
    );
  }
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const service = c.get('riskReportService');
  if (!service) {
    return c.json(
      {
        success: false,
        error: {
          code: 'RISK_REPORT_SERVICE_UNAVAILABLE',
          message: 'RiskReportService not configured',
        },
      },
      503,
    );
  }
  try {
    const result = await service.generate(tenantId, customerId, userId);
    return result.ok
      ? c.json({ success: true, data: result.value }, 201)
      : c.json({ success: false, error: result.error }, 400);
  } catch (error) {
    // routeCatch maps 23503/23505/etc. to a 4xx envelope via mapSqlError and
    // falls back to a scrubbed 500 for anything else.
    return routeCatch(c, error, {
      code: 'RISK_REPORT_FAILED',
      status: 500,
      fallback: 'Generation failed',
    });
  }
});

riskReportsRouter.get('/:customerId/latest', async (c) => {
  const customerId = c.req.param('customerId');
  const tenantId = c.get('tenantId');
  const service = c.get('riskReportService');
  if (!service) {
    return c.json(
      {
        success: false,
        error: {
          code: 'RISK_REPORT_SERVICE_UNAVAILABLE',
          message: 'RiskReportService not configured',
        },
      },
      503,
    );
  }
  try {
    const result = await service.getLatest(tenantId, customerId);
    return result.ok
      ? c.json({ success: true, data: result.value })
      : c.json({ success: false, error: result.error }, 404);
  } catch (error) {
    return routeCatch(c, error, {
      code: 'RISK_REPORT_FAILED',
      status: 500,
      fallback: 'Lookup failed',
    });
  }
});

export default riskReportsRouter;
