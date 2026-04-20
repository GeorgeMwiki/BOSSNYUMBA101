// @ts-nocheck — Hono v4 status-code union; read-only handlers use structural casts over services.db.
/**
 * Inspections router — Wave 18 real-data wiring.
 *
 * GET  /                — list inspections, tenant-scoped
 * GET  /:id             — single inspection
 * POST /                — 501 (schedule needs domain service; tracked)
 * PUT  /:id/start       — 501
 * POST /:id/items       — 501
 * PUT  /:id/complete    — 501
 * POST /:id/sign        — 501
 *
 * Reads come from the `inspections` table via `services.db`. Write
 * endpoints return 501 NOT_IMPLEMENTED rather than 503 so clients can
 * distinguish "feature coming" from "service degraded".
 */

import { Hono } from 'hono';
import { and, desc, eq } from 'drizzle-orm';
import { inspections } from '@bossnyumba/database';
import { authMiddleware } from '../middleware/hono-auth';
import { routeCatch } from '../utils/safe-error';

const app = new Hono();
app.use('*', authMiddleware);

function dbUnavailable(c) {
  return c.json(
    {
      success: false,
      error: {
        code: 'DATABASE_UNAVAILABLE',
        message: 'Inspections requires a live DATABASE_URL.',
      },
    },
    503,
  );
}

function notImplemented(c, verb) {
  return c.json(
    {
      success: false,
      error: {
        code: 'NOT_IMPLEMENTED',
        message: `${verb} inspections is not yet wired — read endpoints are live.`,
      },
    },
    501,
  );
}

app.get('/', async (c) => {
  const db = (c.get('services') ?? {}).db;
  if (!db) return dbUnavailable(c);
  const tenantId = c.get('tenantId');
  const limit = Math.min(200, Math.max(1, Number(c.req.query('limit') ?? '50') || 50));
  try {
    const rows = await db
      .select()
      .from(inspections)
      .where(eq(inspections.tenantId, tenantId))
      .orderBy(desc(inspections.createdAt))
      .limit(limit);
    return c.json({ success: true, data: rows });
  } catch (err) {
    return routeCatch(c, err, {
      code: 'INSPECTIONS_QUERY_FAILED',
      status: 503,
      fallback: 'Query failed',
    });
  }
});

app.get('/:id', async (c) => {
  const db = (c.get('services') ?? {}).db;
  if (!db) return dbUnavailable(c);
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  try {
    const [row] = await db
      .select()
      .from(inspections)
      .where(and(eq(inspections.tenantId, tenantId), eq(inspections.id, id)))
      .limit(1);
    if (!row) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Inspection not found' } },
        404,
      );
    }
    return c.json({ success: true, data: row });
  } catch (err) {
    return routeCatch(c, err, {
      code: 'INSPECTIONS_QUERY_FAILED',
      status: 503,
      fallback: 'Query failed',
    });
  }
});

app.post('/', (c) => notImplemented(c, 'Scheduling'));
app.put('/:id/start', (c) => notImplemented(c, 'Starting'));
app.post('/:id/items', (c) => notImplemented(c, 'Adding items to'));
app.put('/:id/complete', (c) => notImplemented(c, 'Completing'));
app.post('/:id/sign', (c) => notImplemented(c, 'Signing'));

export const inspectionsRouter = app;
