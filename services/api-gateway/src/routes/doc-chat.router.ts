/**
 * Document Chat API Routes (NEW 15)
 *
 *   GET  /                           — list all sessions for the tenant
 *   GET  /sessions                   — alias for GET /
 *   POST /sessions                   — startSession (requires DocumentChatService)
 *   POST /sessions/:id/ask           — ask (requires DocumentChatService + OCR/RAG)
 *   POST /sessions/:id/messages      — group-chat peer message
 *   GET  /sessions/:id/messages      — listMessages (DB-backed)
 *   GET  /sessions/:id               — load session (DB-backed)
 *
 * The GET paths read the DB directly via the composition-root Drizzle
 * client so GET on the router root returns 200 without requiring the
 * heavier `DocumentChatService` (which needs Anthropic + OCR creds) to
 * be wired yet. POST paths that mutate or invoke the LLM continue to
 * 503 until the service is bound.
 */

// @ts-nocheck — Hono context types are open-ended by design in this project.

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { and, desc, eq } from 'drizzle-orm';
import {
  docChatSessions,
  docChatMessages,
} from '@bossnyumba/database';
import { authMiddleware } from '../middleware/hono-auth';

const app = new Hono();
app.use('*', authMiddleware);

const StartSessionSchema = z.object({
  scope: z
    .enum(['single_document', 'multi_document', 'group_chat'])
    .default('single_document'),
  documentIds: z.array(z.string().min(1)).min(1),
  participants: z.array(z.string()).optional(),
  title: z.string().max(200).optional(),
});

const AskSchema = z.object({
  question: z.string().min(1).max(4000),
});

const PostMessageSchema = z.object({
  content: z.string().min(1).max(4000),
});

function notConfigured(c: any) {
  return c.json(
    {
      success: false,
      error: 'DocChat database not configured — DATABASE_URL unset',
    },
    503
  );
}

function noService(c: any) {
  return c.json(
    {
      success: false,
      error:
        'DocumentChatService not yet bound (requires Anthropic + embeddings).',
    },
    503
  );
}

async function listSessions(c: any) {
  const services = c.get('services');
  const db = services?.db;
  if (!db) return notConfigured(c);
  const tenantId = c.get('tenantId');
  const rows = await db
    .select()
    .from(docChatSessions)
    .where(eq(docChatSessions.tenantId, tenantId))
    .orderBy(desc(docChatSessions.createdAt))
    .limit(100);
  return c.json({ success: true, data: rows });
}

app.get('/', listSessions);
app.get('/sessions', listSessions);

app.get('/sessions/:id', async (c: any) => {
  const services = c.get('services');
  const db = services?.db;
  if (!db) return notConfigured(c);
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const rows = await db
    .select()
    .from(docChatSessions)
    .where(
      and(eq(docChatSessions.id, id), eq(docChatSessions.tenantId, tenantId))
    )
    .limit(1);
  if (!rows[0]) {
    return c.json(
      { success: false, error: 'Session not found' },
      404
    );
  }
  return c.json({ success: true, data: rows[0] });
});

app.get('/sessions/:id/messages', async (c: any) => {
  const services = c.get('services');
  const db = services?.db;
  if (!db) return notConfigured(c);
  const tenantId = c.get('tenantId');
  const sessionId = c.req.param('id');
  const rows = await db
    .select()
    .from(docChatMessages)
    .where(
      and(
        eq(docChatMessages.sessionId, sessionId),
        eq(docChatMessages.tenantId, tenantId)
      )
    )
    .orderBy(docChatMessages.createdAt);
  return c.json({ success: true, data: rows });
});

app.post('/sessions', zValidator('json', StartSessionSchema), noService);
app.post('/sessions/:id/ask', zValidator('json', AskSchema), noService);
app.post(
  '/sessions/:id/messages',
  zValidator('json', PostMessageSchema),
  noService
);

export default app;
