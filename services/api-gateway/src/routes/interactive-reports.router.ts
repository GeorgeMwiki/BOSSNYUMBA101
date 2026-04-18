/**
 * Interactive Reports API Routes (NEW 17)
 *
 *   GET  /                                       → list versions for the tenant
 *   GET  /:id/interactive                        → latest interactive version
 *                                                  for a report instance id
 *   POST /:id/action-plans/:aid/ack              → acknowledge an action plan
 *                                                  (requires InteractiveReportService
 *                                                  to be bound)
 *
 * GET paths read `interactive_report_versions` directly via the
 * composition-root Drizzle client so they return real rows without
 * requiring the full `InteractiveReportService` (which needs storage +
 * html-generator + action-plan handler) to be wired.
 */

// @ts-nocheck — Hono context types are open-ended by design in this project.

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { and, desc, eq } from 'drizzle-orm';
import { interactiveReportVersions } from '@bossnyumba/database';
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

function notConfigured(c: any) {
  return c.json(
    {
      success: false,
      error:
        'Interactive reports database not configured — DATABASE_URL unset',
    },
    503
  );
}

// GET / — list all interactive-report versions for the tenant.
app.get('/', async (c: any) => {
  const services = c.get('services');
  const db = services?.db;
  if (!db) return notConfigured(c);
  const tenantId = c.get('tenantId');
  const rows = await db
    .select()
    .from(interactiveReportVersions)
    .where(eq(interactiveReportVersions.tenantId, tenantId))
    .orderBy(desc(interactiveReportVersions.generatedAt))
    .limit(100);
  return c.json({ success: true, data: rows });
});

// GET /:id/interactive — latest version for a report instance
app.get('/:id/interactive', async (c: any) => {
  const services = c.get('services');
  const db = services?.db;
  if (!db) return notConfigured(c);
  const tenantId = c.get('tenantId');
  const reportInstanceId = c.req.param('id');
  const rows = await db
    .select()
    .from(interactiveReportVersions)
    .where(
      and(
        eq(interactiveReportVersions.tenantId, tenantId),
        eq(interactiveReportVersions.reportInstanceId, reportInstanceId)
      )
    )
    .orderBy(desc(interactiveReportVersions.version))
    .limit(1);
  if (!rows[0]) {
    return c.json(
      { success: false, error: 'No interactive report version found' },
      404
    );
  }
  return c.json({ success: true, data: rows[0] });
});

// POST /:id/action-plans/:aid/ack
app.post(
  '/:id/action-plans/:aid/ack',
  zValidator('json', AckBodySchema),
  async (c: any) => {
    const service = c.get('interactiveReportService');
    if (!service) {
      return c.json(
        {
          success: false,
          error:
            'InteractiveReportService not yet bound (pending reports-package wiring).',
        },
        503
      );
    }
    const tenantId = c.get('tenantId');
    const userId = c.get('userId');
    const interactiveReportVersionId = c.req.param('id');
    const actionPlanId = c.req.param('aid');
    const body = c.req.valid('json');
    try {
      const result = await service.acknowledge({
        tenantId,
        interactiveReportVersionId,
        actionPlanId,
        acknowledgedBy: userId,
        metadata: body.metadata ?? {},
      });
      return c.json({ success: true, data: result });
    } catch (error: any) {
      const message =
        error instanceof Error ? error.message : 'Acknowledgement failed';
      const code = error?.code ?? 'ACK_FAILED';
      const status = code === 'NOT_FOUND' ? 404 : 400;
      return c.json({ success: false, error: { code, message } }, status);
    }
  }
);

export default app;
