/**
 * Station Master Coverage API Routes (NEW 18)
 *
 *   PUT /v1/staff/:id/coverage   → replace the coverage set for a station master
 *
 * Thin wiring — returns 501 until bound to a coverage repository /
 * service at bootstrap time.
 */

// @ts-nocheck — service binder wiring lands in a follow-up commit.

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { authMiddleware } from '../middleware/hono-auth';

const app = new Hono();
app.use('*', authMiddleware);

const CoverageItemSchema = z.object({
  kind: z.enum(['tag', 'polygon', 'city', 'property_ids', 'region']),
  value: z.record(z.unknown()),
  priority: z.number().int().nonnegative().default(100),
});

const PutCoverageBodySchema = z.object({
  coverages: z.array(CoverageItemSchema).max(200),
});

function notImplemented(c: any) {
  return c.json(
    {
      success: false,
      error:
        'StationMasterCoverageRepository not yet bound to the API gateway. See packages/database/src/schemas/station-master-coverage.schema.ts.',
    },
    501
  );
}

app.put(
  '/:id/coverage',
  zValidator('json', PutCoverageBodySchema),
  async (c: any) => {
    // const tenantId = c.get('tenantId');
    // const updatedBy = c.get('userId');
    // const stationMasterId = c.req.param('id');
    // const body = c.req.valid('json');
    // await repository.putForStationMaster({
    //   tenantId,
    //   stationMasterId,
    //   coverages: body.coverages.map((c) => ({
    //     coverage: { kind: c.kind, value: c.value } as Coverage,
    //     priority: c.priority,
    //   })),
    //   updatedBy,
    // });
    // return c.json({ success: true });
    return notImplemented(c);
  }
);

export default app;
