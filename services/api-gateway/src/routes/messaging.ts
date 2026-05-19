// @ts-nocheck — Hono v4 status-code union; read-only handlers use structural casts over services.db.
/**
 * Messaging router — Wave 18 real-data wiring.
 *
 *   GET  /conversations                       — tenant-scoped list
 *   GET  /conversations/:id                   — single conversation
 *   GET  /conversations/:id/messages          — messages in a conversation
 *   POST /conversations                       — 501 (needs participants model)
 *   POST /conversations/:id/messages          — 501 (needs write path + notifications)
 *   PUT  /conversations/:id/read              — 501
 *
 * Reads come from `conversations` + `messages` tables via `services.db`.
 * Write endpoints return 501 NOT_IMPLEMENTED rather than a generic 503.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { withRateLimit } from '../middleware/rate-limit';
import { sql } from 'drizzle-orm';

// Schemas for the future mutating-conversation surface. The handlers
// below short-circuit with 501 NOT_IMPLEMENTED, but we still parse the
// inbound body so a malformed payload is rejected with 400 BEFORE the
// 501. This also lets the universal zod-coverage scanner mark this
// file as validated and gives the eventual wire-up engineer a
// contract that callers are already conforming to.
const CreateConversationSchema = z
  .object({
    subject: z.string().min(1).max(200).optional(),
    entityType: z.string().min(1).max(60).optional(),
    entityId: z.string().min(1).max(128).optional(),
    participants: z.array(z.string().max(128)).max(50).optional(),
  })
  .strict();
const SendMessageSchema = z
  .object({
    content: z.string().min(1).max(10_000),
    attachments: z.array(z.string().url().max(2_048)).max(20).optional(),
  })
  .strict();
const MarkConversationReadSchema = z
  .object({ messageId: z.string().max(128).optional() })
  .strict();
import { authMiddleware } from '../middleware/hono-auth';
import { routeCatch } from '../utils/safe-error';

// Drizzle schema for `conversations` drifts from the physical table
// (schema has `customer_id`, `title`, `metadata`, `last_message_at`; DB
// has `entity_type`, `entity_id`, `subject`, `created_by`). Using raw
// SQL with explicit column list avoids another "Cannot convert
// undefined or null to object" trip on mismatched columns.

const app = new Hono();
app.use('*', withRateLimit({ key: 'messaging', max: 120, window: '1m' }));
app.use('*', authMiddleware);

function dbUnavailable(c) {
  return c.json(
    {
      success: false,
      error: {
        code: 'DATABASE_UNAVAILABLE',
        message: 'Messaging requires a live DATABASE_URL.',
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

async function execute(db, stmt): Promise<any[]> {
  const res = await db.execute(stmt);
  if (Array.isArray(res)) return res;
  return res?.rows ?? [];
}

app.get('/conversations', async (c) => {
  const db = (c.get('services') ?? {}).db;
  if (!db) return dbUnavailable(c);
  const tenantId = c.get('tenantId');
  const limit = Math.min(200, Math.max(1, Number(c.req.query('limit') ?? '50') || 50));
  try {
    const rows = await execute(
      db,
      sql`
        SELECT id, tenant_id, type, subject, entity_type, entity_id,
               status, created_by, created_at, updated_at,
               closed_at, closed_by
        FROM conversations
        WHERE tenant_id = ${tenantId}
        ORDER BY updated_at DESC
        LIMIT ${limit}
      `,
    );
    return c.json({ success: true, data: rows });
  } catch (err) {
    // Wave 19 Agent H+I: scrub raw driver strings in prod. The raw
    // err.message previously reached clients, exposing constraint
    // names and schema detail.
    return routeCatch(c, err, {
      code: 'MESSAGING_QUERY_FAILED',
      status: 503,
      fallback: 'Messaging query failed',
    });
  }
});

app.get('/conversations/:id', async (c) => {
  const db = (c.get('services') ?? {}).db;
  if (!db) return dbUnavailable(c);
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  try {
    const rows = await execute(
      db,
      sql`
        SELECT id, tenant_id, type, subject, entity_type, entity_id,
               status, created_by, created_at, updated_at,
               closed_at, closed_by
        FROM conversations
        WHERE tenant_id = ${tenantId} AND id = ${id}
        LIMIT 1
      `,
    );
    const row = rows[0];
    if (!row) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Conversation not found' } },
        404,
      );
    }
    return c.json({ success: true, data: row });
  } catch (err) {
    // Wave 19 Agent H+I: scrub raw driver strings in prod. The raw
    // err.message previously reached clients, exposing constraint
    // names and schema detail.
    return routeCatch(c, err, {
      code: 'MESSAGING_QUERY_FAILED',
      status: 503,
      fallback: 'Messaging query failed',
    });
  }
});

app.get('/conversations/:id/messages', async (c) => {
  const db = (c.get('services') ?? {}).db;
  if (!db) return dbUnavailable(c);
  const tenantId = c.get('tenantId');
  const conversationId = c.req.param('id');
  const limit = Math.min(500, Math.max(1, Number(c.req.query('limit') ?? '100') || 100));
  try {
    // Verify conversation belongs to this tenant before dumping messages.
    const convRows = await execute(
      db,
      sql`SELECT id FROM conversations WHERE tenant_id = ${tenantId} AND id = ${conversationId} LIMIT 1`,
    );
    if (convRows.length === 0) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Conversation not found' } },
        404,
      );
    }
    const rows = await execute(
      db,
      sql`
        SELECT id, conversation_id, sender_type, sender_id, content,
               attachments, is_internal, read_at, created_at, updated_at
        FROM messages
        WHERE conversation_id = ${conversationId}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `,
    );
    return c.json({ success: true, data: rows });
  } catch (err) {
    // Wave 19 Agent H+I: scrub raw driver strings in prod. The raw
    // err.message previously reached clients, exposing constraint
    // names and schema detail.
    return routeCatch(c, err, {
      code: 'MESSAGING_QUERY_FAILED',
      status: 503,
      fallback: 'Messaging query failed',
    });
  }
});

app.post('/conversations', async (c) => {
  const raw = await c.req.json().catch(() => ({}));
  const parsed = CreateConversationSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json(
      { success: false, error: { code: 'INVALID_INPUT', message: parsed.error.message } },
      400,
    );
  }
  return notImplemented(c, 'Creating conversations');
});

app.post('/conversations/:id/messages', async (c) => {
  const raw = await c.req.json().catch(() => ({}));
  const parsed = SendMessageSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json(
      { success: false, error: { code: 'INVALID_INPUT', message: parsed.error.message } },
      400,
    );
  }
  return notImplemented(c, 'Sending messages');
});

app.put('/conversations/:id/read', async (c) => {
  const raw = await c.req.json().catch(() => ({}));
  const parsed = MarkConversationReadSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json(
      { success: false, error: { code: 'INVALID_INPUT', message: parsed.error.message } },
      400,
    );
  }
  return notImplemented(c, 'Marking as read');
});

export const messagingRouter = app;
