/**
 * /api/v1/owner/superpowers/bulk-action — chat-callable bulk operation
 * surface (Wave SUPERPOWERS, ported from Borjie superpowers.hono.ts).
 *
 * Backs the `bossnyumba.ui.bulk_action` chat superpower. The brain
 * tool carries `requiresPolicyRuleLiteral=true` per CLAUDE.md hard
 * rule (HIGH-risk policy prefix must hit literal policy rules; no
 * reason-resolver generalisation). The whitelist matrix below is
 * duplicated from the brain-tool's superRefine so the API stays
 * defensible even if a future caller bypasses the chat tool and hits
 * the route directly.
 *
 * Real-estate domain entities + verbs (vs Borjie's mining vocabulary):
 *   leases             - mark_rent_paid | send_renewal_notice
 *   invoices           - export_tax_statement
 *   maintenance_cases  - close_ticket | acknowledge
 *   reminders          - snooze
 *   inspections        - archive
 *
 * Output shape mirrors Borjie: per-row failure manifest with REASONS
 * (vs Notion bulk's opaque "failed" count) so the FE can render
 * "Partial success — tap to see failed rows" beneath the bulk chip.
 *
 * Auth: Supabase JWT via authMiddleware. Tenant scope bound via
 *       databaseMiddleware (app.current_tenant_id GUC for RLS).
 *
 * Idempotency: enforced server-side via the db-idempotency middleware
 *              (closes H2 deferral). The `Idempotency-Key` header is
 *              folded into `idempotency_keys` with a partial unique
 *              index — a duplicate request collides and replays the
 *              cached response without re-running the dispatchers.
 *
 * Per-entity dispatchers are wired in `./bulk-action-dispatchers.ts`:
 *   mark_rent_paid   -> payments row (status=completed)
 *   send_renewal_notice / export_tax_statement -> event_outbox row
 *   close_ticket / acknowledge -> maintenance_requests update
 *   snooze           -> event_outbox nextRetryAt push
 *   archive          -> inspections.deletedAt set
 */

// share-links.hono.ts / pinned-items.hono.ts / mwikila-inbox.hono.ts.

import { Hono } from 'hono';
import { z } from 'zod';

import { undoJournal } from '@bossnyumba/database';
import { authMiddleware } from '../../../middleware/hono-auth';
import { databaseMiddleware } from '../../../middleware/database';
import { createDbIdempotencyMiddleware } from '../../../middleware/db-idempotency.middleware';
import { createLogger } from '../../../utils/logger';
import {
  dispatch,
  type BulkAction,
  type EntityKind,
} from './bulk-action-dispatchers';

const moduleLogger = createLogger('owner-superpowers-bulk');

// ─── Whitelist matrix (mirrors superpowers-tools.ts BulkInput) ────────

const BULK_WHITELIST: Readonly<Record<string, ReadonlyArray<string>>> =
  Object.freeze({
    leases: ['mark_rent_paid', 'send_renewal_notice'],
    invoices: ['export_tax_statement'],
    maintenance_cases: ['close_ticket', 'acknowledge'],
    reminders: ['snooze'],
    inspections: ['archive'],
  });

const bulkSchema = z
  .object({
    entityType: z.enum([
      'leases',
      'invoices',
      'maintenance_cases',
      'reminders',
      'inspections',
    ]),
    ids: z.array(z.string().min(1).max(120)).min(1).max(100),
    action: z.enum([
      'mark_rent_paid',
      'send_renewal_notice',
      'export_tax_statement',
      'close_ticket',
      'acknowledge',
      'snooze',
      'archive',
    ]),
    payload: z.record(z.string(), z.unknown()).optional().default({}),
    reason: z.string().min(1).max(400),
    provenance: z.record(z.string(), z.unknown()).optional().default({}),
  })
  .superRefine((v, ctx) => {
    const allowed = BULK_WHITELIST[v.entityType] ?? [];
    if (!allowed.includes(v.action)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          `action '${v.action}' not allowed on '${v.entityType}' ` +
          `- whitelist: ${allowed.join(',')}`,
        path: ['action'],
      });
    }
  });

// ─── Router ───────────────────────────────────────────────────────────

const app = new Hono();
app.use('*', authMiddleware);
app.use('*', databaseMiddleware);
app.use(
  '*',
  createDbIdempotencyMiddleware({ resourceKind: 'owner.bulk-action' }),
);

// POST / — chat-callable bulk operation.
//
// For each id in the batch, this:
//   1. Records an undo-journal entry (so the owner gets a 5-min Undo chip).
//   2. Invokes the real per-entity dispatcher (payments / outbox /
//      maintenance update / inspections soft-delete).
//   3. Records per-row outcomes for the FE failure-manifest panel.
app.post('/', async (c: any) => {
  const auth = c.get('auth') as { tenantId: string; userId: string };
  const db = c.get('db');
  if (!db) {
    return c.json(
      {
        success: false,
        error: {
          code: 'BULK_DB_UNAVAILABLE',
          message: 'Database not configured',
        },
      },
      503,
    );
  }
  const raw = await c.req.json().catch(() => null);
  const parsed = bulkSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid bulk payload',
          issues: parsed.error.issues,
        },
      },
      400,
    );
  }
  const input = parsed.data;

  // The Idempotency-Key header is now ALSO enforced by the
  // db-idempotency middleware (server-side hard uniqueness via
  // idempotency_keys). We continue to fold it into provenance so the
  // undo-journal carries the same audit trail.
  const idempotencyKey = c.req.header('idempotency-key') ?? null;
  const provenance = {
    ...input.provenance,
    ...(idempotencyKey && { idempotencyKey }),
  };

  const undoIds: string[] = [];
  const processedIds: string[] = [];
  const failedRows: Array<{ readonly id: string; readonly reason: string }> = [];
  const dispatchArtifacts: Array<{
    readonly id: string;
    readonly artifactId: string;
    readonly artifactKind: string;
  }> = [];

  for (const id of input.ids) {
    try {
      // 1. Append undo-journal row first so the chip lights up even if
      //    the dispatcher partially fails (the user can still Undo
      //    the recorded intent and inspect the failure).
      const [row] = await db
        .insert(undoJournal)
        .values({
          tenantId: auth.tenantId,
          actorId: auth.userId,
          entityType: input.entityType,
          entityId: id,
          actionKind: 'bulk_update',
          toolId: 'bossnyumba.ui.bulk_action',
          beforeState: null,
          afterState: { action: input.action, payload: input.payload },
          windowSeconds: 300,
          provenance,
        })
        .returning();
      undoIds.push(row.id);

      // 2. Invoke the REAL per-entity dispatcher.
      const outcome = await dispatch(
        {
          db,
          tenantId: auth.tenantId,
          actorId: auth.userId,
          idempotencyKey,
          reason: input.reason,
        },
        input.entityType as EntityKind,
        input.action as BulkAction,
        id,
        input.payload,
      );

      if (outcome.ok) {
        processedIds.push(id);
        if (outcome.artifactId && outcome.artifactKind) {
          dispatchArtifacts.push({
            id,
            artifactId: outcome.artifactId,
            artifactKind: outcome.artifactKind,
          });
        }
      } else {
        failedRows.push({
          id,
          reason: outcome.reason ?? `dispatch failed for ${input.action}`,
        });
        moduleLogger.warn('owner-superpowers-bulk: dispatcher reported failure', {
          tenantId: auth.tenantId,
          entityType: input.entityType,
          action: input.action,
          id,
          reason: outcome.reason,
        });
      }
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      failedRows.push({ id, reason });
      moduleLogger.warn('owner-superpowers-bulk: row threw', {
        tenantId: auth.tenantId,
        entityType: input.entityType,
        action: input.action,
        id,
        error: reason,
      });
    }
  }

  const processed = processedIds.length;
  const failed = failedRows.length;

  moduleLogger.info('owner-superpowers-bulk: complete', {
    tenantId: auth.tenantId,
    userId: auth.userId,
    entityType: input.entityType,
    action: input.action,
    processed,
    failed,
    ...(idempotencyKey && { idempotencyKey }),
  });

  return c.json({
    success: true,
    data: {
      accepted: true,
      processed,
      failed,
      processedIds,
      failedIds: failedRows,
      undoJournalIds: undoIds,
      dispatchArtifacts,
    },
  });
});

export const ownerSuperpowersBulkActionRouter = app;
export default ownerSuperpowersBulkActionRouter;
