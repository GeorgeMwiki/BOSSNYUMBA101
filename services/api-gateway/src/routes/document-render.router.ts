/**
 * Document Render API Routes
 *
 *   POST /jobs    — enqueue a render job { templateId, rendererKind, inputs }
 *   GET  /jobs/:id
 *   GET  /jobs    — list (filters: status, templateId, relatedEntity)
 *
 * Guardrail: rendererKind is restricted to document kinds (text,
 * docxtemplater, react-pdf, typst). Nano-banana imagery has its own route
 * and is NEVER accepted here.
 */

// @ts-nocheck — render worker binder lands in a follow-up commit.

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { authMiddleware } from '../middleware/hono-auth';

const app = new Hono();
app.use('*', authMiddleware);

const DocumentRendererKindSchema = z.enum(['text', 'docxtemplater', 'react-pdf', 'typst']);

const EnqueueSchema = z.object({
  templateId: z.string().min(1),
  templateVersion: z.string().default('1'),
  rendererKind: DocumentRendererKindSchema,
  inputs: z.record(z.unknown()).default({}),
  relatedEntityType: z.string().optional(),
  relatedEntityId: z.string().optional(),
});

const ListQuerySchema = z.object({
  status: z.enum(['queued', 'running', 'succeeded', 'failed', 'cancelled']).optional(),
  templateId: z.string().optional(),
  relatedEntityType: z.string().optional(),
  relatedEntityId: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
});

function notImplemented(c: any) {
  return c.json(
    {
      success: false,
      error:
        'Render worker not yet bound. Wire RendererFactory + document_render_jobs repository to complete.',
    },
    501
  );
}

app.post('/jobs', zValidator('json', EnqueueSchema), notImplemented);
app.get('/jobs/:id', notImplemented);
app.get('/jobs', zValidator('query', ListQuerySchema), notImplemented);

export default app;
