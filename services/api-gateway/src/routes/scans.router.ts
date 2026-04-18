/**
 * Scans API Routes (NEW 14)
 *
 *   GET  /                          — list scan bundles (DB-backed)
 *   GET  /bundles                   — alias for GET /
 *   GET  /bundles/:id               — fetch a single bundle
 *   POST /bundles                   — create new scan bundle (requires ScanService)
 *   POST /bundles/:id/pages         — upload one page (requires ScanService)
 *   POST /bundles/:id/ocr           — trigger OCR across pages (requires ScanService)
 *   POST /bundles/:id/submit        — assemble + link to document
 *
 * GET paths read `scan_bundles` directly via the composition-root
 * Drizzle client so they return real rows without the heavier
 * `ScanService` (which needs storage + OCR provider) being bound.
 */

// @ts-nocheck — Hono context types are open-ended by design in this project.

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { and, desc, eq } from 'drizzle-orm';
import { scanBundles } from '@bossnyumba/database';
import { authMiddleware } from '../middleware/hono-auth';

const app = new Hono();
app.use('*', authMiddleware);

const CreateBundleSchema = z.object({
  title: z.string().max(200).optional(),
  purpose: z.string().max(500).optional(),
});

const UploadPageSchema = z.object({
  dataUrl: z.string().startsWith('data:'),
  mimeType: z.string().default('image/png'),
  widthPx: z.number().int().positive().optional(),
  heightPx: z.number().int().positive().optional(),
  quad: z
    .array(z.object({ x: z.number(), y: z.number() }))
    .length(4)
    .optional(),
});

function notConfigured(c: any) {
  return c.json(
    {
      success: false,
      error: 'Scan bundles database not configured — DATABASE_URL unset',
    },
    503
  );
}

function noService(c: any) {
  return c.json(
    {
      success: false,
      error:
        'ScanService not yet bound (requires object storage + OCR provider).',
    },
    503
  );
}

async function listBundles(c: any) {
  const services = c.get('services');
  const db = services?.db;
  if (!db) return notConfigured(c);
  const tenantId = c.get('tenantId');
  const rows = await db
    .select()
    .from(scanBundles)
    .where(eq(scanBundles.tenantId, tenantId))
    .orderBy(desc(scanBundles.createdAt))
    .limit(100);
  return c.json({ success: true, data: rows });
}

app.get('/', listBundles);
app.get('/bundles', listBundles);

app.get('/bundles/:id', async (c: any) => {
  const services = c.get('services');
  const db = services?.db;
  if (!db) return notConfigured(c);
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const rows = await db
    .select()
    .from(scanBundles)
    .where(and(eq(scanBundles.id, id), eq(scanBundles.tenantId, tenantId)))
    .limit(1);
  if (!rows[0]) {
    return c.json({ success: false, error: 'Bundle not found' }, 404);
  }
  return c.json({ success: true, data: rows[0] });
});

app.post('/bundles', zValidator('json', CreateBundleSchema), noService);
app.post(
  '/bundles/:id/pages',
  zValidator('json', UploadPageSchema),
  noService
);
app.post('/bundles/:id/ocr', noService);
app.post('/bundles/:id/submit', noService);

export default app;
