// @ts-nocheck
/**
 * Compliance Exports Router
 *
 *   POST /compliance/exports                - schedule a new export
 *   POST /compliance/exports/:id/generate   - generate a scheduled export
 *   GET  /compliance/exports/:id/download   - get signed download URL
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { authMiddleware } from '../middleware/hono-auth';

const ScheduleSchema = z.object({
  exportType: z.enum(['tz_tra', 'ke_dpa', 'ke_kra', 'tz_land_act']),
  periodStart: z.string(),
  periodEnd: z.string(),
  regulatorContext: z.record(z.unknown()).default({}),
});

export const complianceRouter = new Hono();

complianceRouter.use('*', authMiddleware);

complianceRouter.post(
  '/exports',
  zValidator('json', ScheduleSchema),
  async (c) => {
    const body = c.req.valid('json');
    const tenantId = c.get('tenantId');
    const userId = c.get('userId');
    const service = c.get('complianceExportService');
    const manifest = await service.schedule({
      tenantId,
      exportType: body.exportType,
      periodStart: body.periodStart,
      periodEnd: body.periodEnd,
      regulatorContext: body.regulatorContext,
      requestedBy: userId,
    });
    return c.json({ success: true, data: manifest }, 201);
  },
);

complianceRouter.post('/exports/:id/generate', async (c) => {
  const id = c.req.param('id');
  const tenantId = c.get('tenantId');
  const service = c.get('complianceExportService');
  try {
    const manifest = await service.generate(id, tenantId);
    return c.json({ success: true, data: manifest });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Generation failed';
    return c.json({ success: false, error: { message } }, 400);
  }
});

complianceRouter.get('/exports/:id/download', async (c) => {
  const id = c.req.param('id');
  const tenantId = c.get('tenantId');
  const service = c.get('complianceExportService');
  try {
    const { url, manifest } = await service.download(id, tenantId);
    return c.json({ success: true, data: { url, manifest } });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Download failed';
    return c.json({ success: false, error: { message } }, 400);
  }
});

export default complianceRouter;
