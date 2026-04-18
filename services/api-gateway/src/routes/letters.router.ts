/**
 * Letters API Routes (NEW 10)
 *
 * CRUD + workflow for on-demand tenant letters.
 *   POST   /          — createRequest
 *   POST   /:id/draft — materialize a draft from template payload
 *   POST   /:id/submit-for-approval
 *   POST   /:id/approve
 *   POST   /:id/reject
 *   GET    /:id/download
 *   GET    /:id
 *
 * The router itself is thin — it wires Hono to a LetterService instance
 * that must be bound by the gateway bootstrap. Until the service binder
 * is wired, handlers return 501 NOT_IMPLEMENTED.
 */

// @ts-nocheck — service binder wiring lands in a follow-up commit.

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { authMiddleware } from '../middleware/hono-auth';

const app = new Hono();
app.use('*', authMiddleware);

const LetterTypeSchema = z.enum([
  'residency_proof',
  'tenancy_confirmation',
  'payment_confirmation',
  'tenant_reference',
]);

const CreateSchema = z.object({
  letterType: LetterTypeSchema,
  customerId: z.string().optional(),
  payload: z.record(z.unknown()).default({}),
});

const DraftSchema = z.object({
  type: LetterTypeSchema,
  data: z.record(z.unknown()),
});

const ApproveSchema = z.object({
  issuedDocumentId: z.string().min(1),
});

const RejectSchema = z.object({
  reason: z.string().min(1).max(500),
});

function notImplemented(c: any) {
  return c.json(
    {
      success: false,
      error: 'LetterService not yet bound to the API gateway. See letter-service.ts.',
    },
    501
  );
}

app.post('/', zValidator('json', CreateSchema), notImplemented);
app.post('/:id/draft', zValidator('json', DraftSchema), notImplemented);
app.post('/:id/submit-for-approval', notImplemented);
app.post('/:id/approve', zValidator('json', ApproveSchema), notImplemented);
app.post('/:id/reject', zValidator('json', RejectSchema), notImplemented);
app.get('/:id/download', notImplemented);
app.get('/:id', notImplemented);

export default app;
