/**
 * Applications API Routes (NEW 18)
 *
 *   POST /v1/applications/route   → returns station master id for an
 *                                   application location + asset type
 *
 * Thin wiring — binds to a StationMasterRouter supplied by the
 * bootstrap. Returns 501 until bound.
 */

// @ts-nocheck — service binder wiring lands in a follow-up commit.

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { authMiddleware } from '../middleware/hono-auth';

const app = new Hono();
app.use('*', authMiddleware);

const RouteBodySchema = z.object({
  applicationId: z.string().min(1),
  assetType: z.enum(['residential', 'commercial', 'land', 'mixed_use']),
  location: z.object({
    city: z.string().optional(),
    country: z.string().optional(),
    regionId: z.string().optional(),
    propertyId: z.string().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    tags: z.array(z.string()).optional(),
  }),
});

function notImplemented(c: any) {
  return c.json(
    {
      success: false,
      error:
        'StationMasterRouter not yet bound to the API gateway. See services/domain-services/src/routing/station-master-router.ts.',
    },
    501
  );
}

app.post('/route', zValidator('json', RouteBodySchema), async (c: any) => {
  // const tenantId = c.get('tenantId');
  // const body = c.req.valid('json');
  // const result = await router.routeApplication({
  //   ...body,
  //   tenantId,
  // });
  // return c.json({ success: true, data: result });
  return notImplemented(c);
});

export default app;
