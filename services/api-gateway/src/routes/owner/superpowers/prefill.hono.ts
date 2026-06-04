/**
 * /api/v1/owner/superpowers/prefill — chat-emitted form prefill ack
 * (Wave SUPERPOWERS, ported from Borjie superpowers.hono.ts).
 *
 * Backs the `bossnyumba.ui.prefill_form` chat superpower. The brain
 * tool pushes a {formId, values} envelope into a form the owner has
 * open or will open next; the owner sees a "Mr. Mwikila pre-filled
 * this" pill at the top of the form and reviews before submitting.
 *
 * Routes:
 *   POST /                ack a prefill emission (audit-only)
 *   POST /undo-field      per-field undo banner ack
 *
 * Per-field undo (SOTA depth vs v0 per-form undo): owners can revert
 * a single prefilled field without rolling back the entire prefill.
 * Each field-level undo lands as a `prefill` journal entry keyed by
 * `formId + fieldName` so the FE companion banner can stamp "Undo
 * just N fields" per-row. The entry carries `{ beforeValue, afterValue }`
 * for replay.
 *
 * Real-estate form vocabulary (not enforced at this surface — the FE
 * is the form registry): lease_draft / unit_listing / invoice_draft /
 * maintenance_request / kyc_application / move_in_checklist /
 * move_out_checklist / rent_payment_record / inspection_report.
 *
 * Auth: Supabase JWT via authMiddleware. Tenant scope bound via
 *       databaseMiddleware (app.current_tenant_id GUC for RLS).
 *
 * Idempotency: the ack endpoint is naturally idempotent (audit-only,
 *              no DB write). /undo-field is idempotent by journal-id
 *              once the entry lands.
 */

// share-links.hono.ts / pinned-items.hono.ts / mwikila-inbox.hono.ts.

import { Hono } from 'hono';
import { z } from 'zod';

import { undoJournal } from '@bossnyumba/database';
import { authMiddleware } from '../../../middleware/hono-auth';
import { databaseMiddleware } from '../../../middleware/database';
import { createLogger } from '../../../utils/logger';

const moduleLogger = createLogger('owner-superpowers-prefill');

// ─── Schemas ──────────────────────────────────────────────────────────

const prefillSchema = z.object({
  formId: z.string().min(1).max(120),
  values: z.record(
    z.string(),
    z.union([z.string(), z.number(), z.boolean(), z.null()]),
  ),
  submitOnAccept: z.boolean().optional().default(false),
  reason: z.string().min(1).max(400).optional(),
  provenance: z.record(z.string(), z.unknown()).optional().default({}),
});

const prefillUndoFieldSchema = z.object({
  formId: z.string().min(1).max(120),
  fieldName: z.string().min(1).max(120),
  beforeValue: z
    .union([z.string(), z.number(), z.boolean(), z.null()])
    .optional(),
  afterValue: z
    .union([z.string(), z.number(), z.boolean(), z.null()])
    .optional(),
  reason: z.string().min(1).max(400).optional(),
  provenance: z.record(z.string(), z.unknown()).optional().default({}),
});

// ─── Router ───────────────────────────────────────────────────────────

const app = new Hono();
app.use('*', authMiddleware);
app.use('*', databaseMiddleware);

// POST / — ack a prefill emission (audit-only, no DB write).
//
// The actual prefill emission travels via SSE through the chat
// orchestrator; this endpoint exists so the FE can confirm receipt
// + the API can record a structured Pino audit line tagged with
// the form id and value count.
app.post('/', async (c: any) => {
  const auth = c.get('auth') as { tenantId: string; userId: string };
  const raw = await c.req.json().catch(() => null);
  const parsed = prefillSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid prefill payload',
          issues: parsed.error.issues,
        },
      },
      400,
    );
  }
  const idempotencyKey = c.req.header('idempotency-key') ?? null;
  moduleLogger.info('owner-superpowers-prefill: ack', {
    tenantId: auth.tenantId,
    userId: auth.userId,
    formId: parsed.data.formId,
    valueCount: Object.keys(parsed.data.values).length,
    submitOnAccept: parsed.data.submitOnAccept,
    ...(idempotencyKey && { idempotencyKey }),
  });
  return c.json({
    success: true,
    data: {
      accepted: true,
      formId: parsed.data.formId,
      valueCount: Object.keys(parsed.data.values).length,
      emittedAt: new Date().toISOString(),
    },
  });
});

// POST /undo-field — per-field undo banner ack.
//
// Records an undo journal entry for a single field within a prefill.
// The FE companion banner reads GET /api/v1/owner/undo-journal/recent
// to render per-field "Undo this change" chips. Combined with the
// per-field beforeValue / afterValue captured here, the banner can
// offer granular rollback without affecting other fields the owner
// kept.
app.post('/undo-field', async (c: any) => {
  const auth = c.get('auth') as { tenantId: string; userId: string };
  const db = c.get('db');
  if (!db) {
    return c.json(
      {
        success: false,
        error: {
          code: 'PREFILL_DB_UNAVAILABLE',
          message: 'Database not configured',
        },
      },
      503,
    );
  }
  const raw = await c.req.json().catch(() => null);
  const parsed = prefillUndoFieldSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid prefill-undo-field payload',
          issues: parsed.error.issues,
        },
      },
      400,
    );
  }
  const input = parsed.data;

  try {
    const [row] = await db
      .insert(undoJournal)
      .values({
        tenantId: auth.tenantId,
        actorId: auth.userId,
        // entityType convention `prefill_field:<formId>` so the FE can
        // group per-form per-field journal entries when rendering the
        // companion banner.
        entityType: `prefill_field:${input.formId}`,
        entityId: input.fieldName,
        actionKind: 'prefill',
        toolId: 'bossnyumba.ui.prefill_form',
        beforeState:
          input.beforeValue !== undefined
            ? { value: input.beforeValue }
            : null,
        afterState:
          input.afterValue !== undefined
            ? { value: input.afterValue }
            : null,
        windowSeconds: 300,
        provenance: {
          ...input.provenance,
          formId: input.formId,
          fieldName: input.fieldName,
          ...(input.reason !== undefined && { reason: input.reason }),
        },
      })
      .returning();

    moduleLogger.info('owner-superpowers-prefill: field-undo recorded', {
      tenantId: auth.tenantId,
      userId: auth.userId,
      formId: input.formId,
      fieldName: input.fieldName,
      journalId: row.id,
    });

    return c.json(
      {
        success: true,
        data: {
          journalId: row.id,
          formId: input.formId,
          fieldName: input.fieldName,
          windowSeconds: row.windowSeconds,
        },
      },
      201,
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    moduleLogger.error('owner-superpowers-prefill: field-undo insert failed', {
      tenantId: auth.tenantId,
      error: message,
    });
    return c.json(
      { success: false, error: { code: 'UNDO_INSERT_FAILED', message } },
      500,
    );
  }
});

export const ownerSuperpowersPrefillRouter = app;
export default ownerSuperpowersPrefillRouter;
