/**
 * Document Chat API Routes (NEW 15)
 *
 *   POST /sessions                 — startSession
 *   POST /sessions/:id/ask         — ask (RAG + citations required)
 *   POST /sessions/:id/messages    — group-chat peer message
 *   GET  /sessions/:id/messages    — listMessages
 *   GET  /sessions/:id
 *
 * CITATION ENFORCEMENT: the underlying DocumentChatService rejects any
 * assistant response that is missing citations — handlers surface that
 * as a 502 to the client so the UI can prompt a retry.
 */

// @ts-nocheck — service binder wiring lands in a follow-up commit.

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { authMiddleware } from '../middleware/hono-auth';

const app = new Hono();
app.use('*', authMiddleware);

const StartSessionSchema = z.object({
  scope: z.enum(['single_document', 'multi_document', 'group_chat']).default('single_document'),
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

function notImplemented(c: any) {
  return c.json(
    {
      success: false,
      error: 'DocumentChatService not yet bound to the API gateway.',
    },
    501
  );
}

app.post('/sessions', zValidator('json', StartSessionSchema), notImplemented);
app.post('/sessions/:id/ask', zValidator('json', AskSchema), notImplemented);
app.post('/sessions/:id/messages', zValidator('json', PostMessageSchema), notImplemented);
app.get('/sessions/:id/messages', notImplemented);
app.get('/sessions/:id', notImplemented);

export default app;
