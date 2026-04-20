// @ts-nocheck — Hono v4 status-code union; handlers use structural casts over services.db.
/**
 * Feedback router — Wave 18 real-data wiring.
 *
 *   POST /                            — submit feedback
 *   GET  /                            — tenant-scoped feedback list
 *   GET  /:id                         — single feedback
 *   POST /complaints                  — create complaint (delegates to /api/v1/complaints logic)
 *   GET  /complaints/:id              — single complaint
 *   PUT  /complaints/:id/resolve      — mark complaint resolved
 *
 * Persists to `feedback_submissions` + `complaint_records` (migration
 * 0092). Previously the whole router was fixture data gated behind
 * `liveDataRequired`, which forced every GET to 503.
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { and, desc, eq } from 'drizzle-orm';
import {
  feedbackSubmissions,
  complaintRecords,
} from '@bossnyumba/database';
import { authMiddleware } from '../middleware/hono-auth';

const submitFeedbackSchema = z.object({
  type: z.enum(['general', 'bug', 'feature', 'improvement']),
  subject: z.string().min(1).max(200),
  message: z.string().min(1).max(5000),
  rating: z.number().int().min(1).max(5).optional(),
  context: z.record(z.unknown()).optional(),
});

const createComplaintSchema = z.object({
  subject: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  category: z.enum(['maintenance', 'neighbor', 'payment', 'lease', 'other']).optional(),
  relatedEntityType: z.string().optional(),
  relatedEntityId: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
});

const resolveComplaintSchema = z.object({
  resolution: z.string().min(1).max(2000),
  resolutionNotes: z.string().max(1000).optional(),
});

const app = new Hono();
app.use('*', authMiddleware);

function dbUnavailable(c) {
  return c.json(
    {
      success: false,
      error: {
        code: 'DATABASE_UNAVAILABLE',
        message: 'Feedback requires a live DATABASE_URL.',
      },
    },
    503,
  );
}

function newId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

// --- Feedback endpoints -----------------------------------------------------

app.post('/', zValidator('json', submitFeedbackSchema), async (c) => {
  const db = (c.get('services') ?? {}).db;
  if (!db) return dbUnavailable(c);
  const auth = c.get('auth');
  const body = c.req.valid('json');
  try {
    const id = newId('fbk');
    await db.insert(feedbackSubmissions).values({
      id,
      tenantId: auth.tenantId,
      userId: auth.userId,
      type: body.type,
      subject: body.subject,
      message: body.message,
      rating: body.rating,
      context: body.context ?? {},
      status: 'submitted',
    });
    return c.json({ success: true, data: { id, status: 'submitted' } }, 201);
  } catch (err) {
    return c.json(
      { success: false, error: { code: 'FEEDBACK_WRITE_FAILED', message: String(err) } },
      503,
    );
  }
});

app.get('/', async (c) => {
  const db = (c.get('services') ?? {}).db;
  if (!db) return dbUnavailable(c);
  const tenantId = c.get('tenantId');
  const limit = Math.min(200, Math.max(1, Number(c.req.query('limit') ?? '50') || 50));
  const type = c.req.query('type');
  try {
    const rows = await db
      .select()
      .from(feedbackSubmissions)
      .where(
        type
          ? and(
              eq(feedbackSubmissions.tenantId, tenantId),
              eq(feedbackSubmissions.type, type),
            )
          : eq(feedbackSubmissions.tenantId, tenantId),
      )
      .orderBy(desc(feedbackSubmissions.createdAt))
      .limit(limit);
    return c.json({ success: true, data: rows });
  } catch (err) {
    return c.json(
      { success: false, error: { code: 'FEEDBACK_QUERY_FAILED', message: String(err) } },
      503,
    );
  }
});

// --- Complaints (mounted under /feedback/complaints/*) --------------------

app.post('/complaints', zValidator('json', createComplaintSchema), async (c) => {
  const db = (c.get('services') ?? {}).db;
  if (!db) return dbUnavailable(c);
  const auth = c.get('auth');
  const body = c.req.valid('json');
  try {
    const id = newId('cmp');
    await db.insert(complaintRecords).values({
      id,
      tenantId: auth.tenantId,
      userId: auth.userId,
      subject: body.subject,
      description: body.description,
      category: body.category ?? 'other',
      relatedEntityType: body.relatedEntityType,
      relatedEntityId: body.relatedEntityId,
      priority: body.priority,
      status: 'open',
    });
    return c.json({ success: true, data: { id, status: 'open' } }, 201);
  } catch (err) {
    return c.json(
      { success: false, error: { code: 'COMPLAINT_WRITE_FAILED', message: String(err) } },
      503,
    );
  }
});

app.get('/complaints/:id', async (c) => {
  const db = (c.get('services') ?? {}).db;
  if (!db) return dbUnavailable(c);
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  try {
    const [row] = await db
      .select()
      .from(complaintRecords)
      .where(
        and(eq(complaintRecords.tenantId, tenantId), eq(complaintRecords.id, id)),
      )
      .limit(1);
    if (!row) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Complaint not found' } },
        404,
      );
    }
    return c.json({ success: true, data: row });
  } catch (err) {
    return c.json(
      { success: false, error: { code: 'COMPLAINT_QUERY_FAILED', message: String(err) } },
      503,
    );
  }
});

app.put(
  '/complaints/:id/resolve',
  zValidator('json', resolveComplaintSchema),
  async (c) => {
    const db = (c.get('services') ?? {}).db;
    if (!db) return dbUnavailable(c);
    const auth = c.get('auth');
    const id = c.req.param('id');
    const body = c.req.valid('json');
    try {
      await db
        .update(complaintRecords)
        .set({
          status: 'resolved',
          resolution: body.resolution,
          resolutionNotes: body.resolutionNotes,
          resolvedBy: auth.userId,
          resolvedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(complaintRecords.tenantId, auth.tenantId),
            eq(complaintRecords.id, id),
          ),
        );
      return c.json({ success: true, data: { id, status: 'resolved' } });
    } catch (err) {
      return c.json(
        { success: false, error: { code: 'COMPLAINT_RESOLVE_FAILED', message: String(err) } },
        503,
      );
    }
  },
);

// --- Single feedback by id (must come after /complaints/:id) --------------

app.get('/:id', async (c) => {
  const db = (c.get('services') ?? {}).db;
  if (!db) return dbUnavailable(c);
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  try {
    const [row] = await db
      .select()
      .from(feedbackSubmissions)
      .where(
        and(
          eq(feedbackSubmissions.tenantId, tenantId),
          eq(feedbackSubmissions.id, id),
        ),
      )
      .limit(1);
    if (!row) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Feedback not found' } },
        404,
      );
    }
    return c.json({ success: true, data: row });
  } catch (err) {
    return c.json(
      { success: false, error: { code: 'FEEDBACK_QUERY_FAILED', message: String(err) } },
      503,
    );
  }
});

export const feedbackRouter = app;
