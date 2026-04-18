/**
 * Document Render API Routes
 *
 *   GET  /              — list render jobs for the tenant (DB-backed)
 *   GET  /jobs          — alias for GET /
 *   GET  /jobs/:id      — fetch a single render job
 *   POST /jobs          — enqueue a render job (requires render worker wiring)
 *
 * Reads render jobs directly from `document_render_jobs` via the
 * composition-root Drizzle client so GET endpoints return real data.
 * POST /jobs returns 503 until the render worker + RendererFactory are
 * wired.
 *
 * Guardrail: rendererKind is restricted to document kinds (text,
 * docxtemplater, react-pdf, typst). Nano-banana imagery has its own route
 * and is NEVER accepted here.
 */

// @ts-nocheck — Hono context types are open-ended by design in this project.

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { documentRenderJobs } from '@bossnyumba/database';
import { authMiddleware } from '../middleware/hono-auth';

const app = new Hono();
app.use('*', authMiddleware);

const DocumentRendererKindSchema = z.enum([
  'text',
  'docxtemplater',
  'react-pdf',
  'typst',
]);

const EnqueueSchema = z.object({
  templateId: z.string().min(1),
  templateVersion: z.string().default('1'),
  rendererKind: DocumentRendererKindSchema,
  inputs: z.record(z.unknown()).default({}),
  relatedEntityType: z.string().optional(),
  relatedEntityId: z.string().optional(),
});

const ListQuerySchema = z.object({
  status: z
    .enum(['queued', 'running', 'succeeded', 'failed', 'cancelled'])
    .optional(),
  templateId: z.string().optional(),
  relatedEntityType: z.string().optional(),
  relatedEntityId: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
});

function notConfigured(c: any) {
  return c.json(
    {
      success: false,
      error:
        'Document render database not configured — DATABASE_URL unset',
    },
    503
  );
}

async function listJobs(c: any) {
  const services = c.get('services');
  const db = services?.db;
  if (!db) return notConfigured(c);
  const tenantId = c.get('tenantId');
  const query = c.req.valid?.('query') ?? {};
  const limit = query.limit ?? 50;
  const offset = query.offset ?? 0;
  const conditions = [eq(documentRenderJobs.tenantId, tenantId)];
  if (query.status) {
    conditions.push(eq(documentRenderJobs.status, query.status));
  }
  if (query.templateId) {
    conditions.push(eq(documentRenderJobs.templateId, query.templateId));
  }
  if (query.relatedEntityType) {
    conditions.push(
      eq(documentRenderJobs.relatedEntityType, query.relatedEntityType)
    );
  }
  if (query.relatedEntityId) {
    conditions.push(
      eq(documentRenderJobs.relatedEntityId, query.relatedEntityId)
    );
  }
  const rows = await db
    .select()
    .from(documentRenderJobs)
    .where(and(...conditions))
    .orderBy(desc(documentRenderJobs.requestedAt))
    .limit(limit)
    .offset(offset);
  return c.json({ success: true, data: rows });
}

app.get('/', zValidator('query', ListQuerySchema), listJobs);
app.get('/jobs', zValidator('query', ListQuerySchema), listJobs);

app.get('/jobs/:id', async (c: any) => {
  const services = c.get('services');
  const db = services?.db;
  if (!db) return notConfigured(c);
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const rows = await db
    .select()
    .from(documentRenderJobs)
    .where(
      and(
        eq(documentRenderJobs.id, id),
        eq(documentRenderJobs.tenantId, tenantId)
      )
    )
    .limit(1);
  if (!rows[0]) {
    return c.json({ success: false, error: 'Job not found' }, 404);
  }
  return c.json({ success: true, data: rows[0] });
});

app.post('/jobs', zValidator('json', EnqueueSchema), async (c: any) => {
  return c.json(
    {
      success: false,
      error:
        'Render worker not yet bound. Enqueue via the CLI or wait for the worker to be wired.',
    },
    503
  );
});

export default app;
