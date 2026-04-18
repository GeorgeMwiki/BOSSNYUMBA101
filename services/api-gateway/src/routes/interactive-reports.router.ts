/**
 * Interactive Reports API Routes (NEW 17)
 *
 *   GET  /v1/reports/:id/interactive              → latest interactive version
 *   POST /v1/reports/:id/action-plans/:aid/ack    → acknowledge & route an action plan
 *
 * Router is thin — wires Hono to an InteractiveReportService that must
 * be bound by the gateway bootstrap. Until the service binder is wired,
 * handlers return 501.
 */

// @ts-nocheck — service binder wiring lands in a follow-up commit.

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { authMiddleware } from '../middleware/hono-auth';

const app = new Hono();
app.use('*', authMiddleware);

const AckBodySchema = z.object({
  actionKind: z
    .enum([
      'create_work_order',
      'create_approval_request',
      'acknowledge',
      'external_link',
    ])
    .optional(),
  metadata: z.record(z.unknown()).optional(),
});

function notImplemented(c: any) {
  return c.json(
    {
      success: false,
      error:
        'InteractiveReportService not yet bound to the API gateway. See services/reports/src/interactive/interactive-report-service.ts.',
    },
    501
  );
}

// GET /v1/reports/:id/interactive
app.get('/:id/interactive', async (c: any) => {
  // const tenantId = c.get('tenantId');
  // const reportInstanceId = c.req.param('id');
  // const version = await service.getLatest(tenantId, reportInstanceId);
  // if (!version) return c.json({ success: false, error: 'Not found' }, 404);
  // return c.json({ success: true, data: version });
  return notImplemented(c);
});

// POST /v1/reports/:id/action-plans/:aid/ack
app.post(
  '/:id/action-plans/:aid/ack',
  zValidator('json', AckBodySchema),
  async (c: any) => {
    // const tenantId = c.get('tenantId');
    // const userId = c.get('userId');
    // const interactiveReportVersionId = c.req.param('id');
    // const actionPlanId = c.req.param('aid');
    // const body = c.req.valid('json');
    // const result = await service.acknowledge({
    //   tenantId,
    //   interactiveReportVersionId,
    //   actionPlanId,
    //   acknowledgedBy: userId,
    //   metadata: body.metadata ?? {},
    // });
    // return c.json({ success: true, data: result });
    return notImplemented(c);
  }
);

export default app;
