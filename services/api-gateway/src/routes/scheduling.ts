// @ts-nocheck — Hono v4 status-code union; read-only handlers use structural casts over services.db.
/**
 * Scheduling router — Wave 18 real-data wiring.
 *
 *   GET    /events            — list scheduled events for the tenant
 *   GET    /events/:id        — single event
 *   POST   /events            — 501 (needs domain validation)
 *   PUT    /events/:id        — 501
 *   DELETE /events/:id        — 501
 *   GET    /availability      — 501
 *   PUT    /availability      — 501
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { withRateLimit } from '../middleware/rate-limit';
import { and, desc, eq } from 'drizzle-orm';
import { scheduledEvents } from '@bossnyumba/database';

const ScheduledEventBaseSchema = z
  .object({
    type: z.string().min(1).max(60),
    title: z.string().min(1).max(200),
    startAt: z.string().datetime(),
    endAt: z.string().datetime().optional(),
    timezone: z.string().min(1).max(60).optional(),
    description: z.string().max(5_000).optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .strict();
const CreateScheduledEventSchema = ScheduledEventBaseSchema;
const UpdateScheduledEventSchema = ScheduledEventBaseSchema.partial();
const UpdateAvailabilitySchema = z
  .object({
    slots: z
      .array(
        z.object({
          startAt: z.string().datetime(),
          endAt: z.string().datetime(),
          capacity: z.number().int().min(0).max(10_000).optional(),
        }),
      )
      .max(500),
  })
  .strict();
import { authMiddleware } from '../middleware/hono-auth';
import { routeCatch } from '../utils/safe-error';

const app = new Hono();
app.use('*', withRateLimit({ key: 'scheduling', max: 120, window: '1m' }));
app.use('*', authMiddleware);

function dbUnavailable(c) {
  return c.json(
    {
      success: false,
      error: {
        code: 'DATABASE_UNAVAILABLE',
        message: 'Scheduling requires a live DATABASE_URL.',
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
        message: `${verb} is not yet wired — read endpoints are live.`,
      },
    },
    501,
  );
}

app.get('/events', async (c) => {
  const db = (c.get('services') ?? {}).db;
  if (!db) return dbUnavailable(c);
  const tenantId = c.get('tenantId');
  const limit = Math.min(200, Math.max(1, Number(c.req.query('limit') ?? '50') || 50));
  try {
    const rows = await db
      .select()
      .from(scheduledEvents)
      .where(eq(scheduledEvents.tenantId, tenantId))
      .orderBy(desc(scheduledEvents.startAt))
      .limit(limit);
    return c.json({ success: true, data: rows });
  } catch (err) {
    return routeCatch(c, err, {
      code: 'SCHEDULING_QUERY_FAILED',
      status: 503,
      fallback: 'Query failed',
    });
  }
});

app.get('/events/:id', async (c) => {
  const db = (c.get('services') ?? {}).db;
  if (!db) return dbUnavailable(c);
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  try {
    const [row] = await db
      .select()
      .from(scheduledEvents)
      .where(and(eq(scheduledEvents.tenantId, tenantId), eq(scheduledEvents.id, id)))
      .limit(1);
    if (!row) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Event not found' } },
        404,
      );
    }
    return c.json({ success: true, data: row });
  } catch (err) {
    return routeCatch(c, err, {
      code: 'SCHEDULING_QUERY_FAILED',
      status: 503,
      fallback: 'Query failed',
    });
  }
});

// Root GET lands here too — return the events list for the tenant so a
// quick smoke-test against `/api/v1/scheduling` yields 200 instead of 404.
app.get('/', async (c) => {
  const db = (c.get('services') ?? {}).db;
  if (!db) return dbUnavailable(c);
  const tenantId = c.get('tenantId');
  try {
    const rows = await db
      .select()
      .from(scheduledEvents)
      .where(eq(scheduledEvents.tenantId, tenantId))
      .orderBy(desc(scheduledEvents.startAt))
      .limit(50);
    return c.json({ success: true, data: rows });
  } catch (err) {
    return routeCatch(c, err, {
      code: 'SCHEDULING_QUERY_FAILED',
      status: 503,
      fallback: 'Query failed',
    });
  }
});

app.post('/events', async (c) => {
  const raw = await c.req.json().catch(() => ({}));
  const parsed = CreateScheduledEventSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json(
      { success: false, error: { code: 'INVALID_INPUT', message: parsed.error.message } },
      400,
    );
  }
  return notImplemented(c, 'Creating events');
});

app.put('/events/:id', async (c) => {
  const raw = await c.req.json().catch(() => ({}));
  const parsed = UpdateScheduledEventSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json(
      { success: false, error: { code: 'INVALID_INPUT', message: parsed.error.message } },
      400,
    );
  }
  return notImplemented(c, 'Updating events');
});

app.delete('/events/:id', (c) => notImplemented(c, 'Deleting events'));
app.get('/availability', (c) => notImplemented(c, 'Reading availability'));
app.put('/availability', async (c) => {
  const raw = await c.req.json().catch(() => ({}));
  const parsed = UpdateAvailabilitySchema.safeParse(raw);
  if (!parsed.success) {
    return c.json(
      { success: false, error: { code: 'INVALID_INPUT', message: parsed.error.message } },
      400,
    );
  }
  return notImplemented(c, 'Updating availability');
});

export const schedulingRouter = app;
