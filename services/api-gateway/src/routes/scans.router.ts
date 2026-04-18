/**
 * Scans API Routes (NEW 14)
 *
 *   POST /bundles                       — create new scan bundle
 *   POST /bundles/:id/pages             — upload one page (data URL)
 *   POST /bundles/:id/ocr               — trigger OCR across pages
 *   POST /bundles/:id/submit            — assemble + link to document
 *   GET  /bundles/:id
 *   GET  /bundles
 */

// @ts-nocheck — service binder wiring lands in a follow-up commit.

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
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

function notImplemented(c: any) {
  return c.json(
    {
      success: false,
      error: 'ScanService not yet bound to the API gateway.',
    },
    501
  );
}

app.post('/bundles', zValidator('json', CreateBundleSchema), notImplemented);
app.post('/bundles/:id/pages', zValidator('json', UploadPageSchema), notImplemented);
app.post('/bundles/:id/ocr', notImplemented);
app.post('/bundles/:id/submit', notImplemented);
app.get('/bundles/:id', notImplemented);
app.get('/bundles', notImplemented);

export default app;
