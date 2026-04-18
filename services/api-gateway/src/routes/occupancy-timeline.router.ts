/**
 * Occupancy Timeline API Routes (NEW 22)
 *
 *   GET /v1/units/:id/occupancy-timeline?page=&limit=
 *
 * Thin Hono wiring — binds to an OccupancyTimelineService instance
 * supplied by the gateway bootstrap. Returns 501 until bound.
 */

// @ts-nocheck — service binder wiring lands in a follow-up commit.

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { authMiddleware } from '../middleware/hono-auth';

const app = new Hono();
app.use('*', authMiddleware);

const QuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

function notImplemented(c: any) {
  return c.json(
    {
      success: false,
      error:
        'OccupancyTimelineService not yet bound to the API gateway. See services/domain-services/src/occupancy/occupancy-timeline-service.ts.',
    },
    501
  );
}

app.get(
  '/:id/occupancy-timeline',
  zValidator('query', QuerySchema),
  async (c: any) => {
    // const tenantId = c.get('tenantId');
    // const unitId = c.req.param('id');
    // const { page, limit } = c.req.valid('query');
    // const result = await service.getUnitTimeline(unitId, tenantId, { page, limit });
    // return c.json({ success: true, data: result });
    return notImplemented(c);
  }
);

export default app;
