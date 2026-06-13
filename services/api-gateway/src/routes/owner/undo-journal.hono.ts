/**
 * /api/v1/owner/undo-journal — generic undo ledger (Wave SUPERPOWERS,
 * ported from Borjie 0112 / superpowers-tools.ts).
 *
 * Backs the `bossnyumba.ui.undo_last_action` chat superpower. Every
 * WRITE brain tool can append a row via `POST /` and the owner gets a
 * 5-minute "Undo (4:58)" chip on every chat-initiated write.
 *
 * Routes:
 *   POST /                            append an undo journal entry
 *   POST /undo-last                   undo the most recent reversible action
 *   POST /undo-by-id                  reverse a specific journal entry
 *   POST /redo-by-id                  re-apply a previously undone entry
 *   GET  /recent                      list the actor's reversible window
 *
 * Auth:  Supabase JWT via authMiddleware. Tenant scope bound by
 *        databaseMiddleware (`app.current_tenant_id` GUC for RLS).
 *
 * Idempotency: append (POST /) is naturally idempotent at the journal
 *              layer when a caller supplies a deterministic
 *              Idempotency-Key header — the same key collapses to a
 *              single row via the unique provenance.idempotencyKey
 *              index check. /undo-last is idempotent by construction
 *              (subsequent calls find no candidate and return undone:false).
 *              /undo-by-id and /redo-by-id are idempotent by id +
 *              undoneAt-state checks (409 on already-undone/not-undone).
 *
 * RLS: FORCE-enabled on `undo_journal` via migration 0298. The route
 *      does NOT double-filter — Postgres enforces tenant isolation.
 *
 * Pino logger only — no console.log per CLAUDE.md hard rule.
 */

// share-links.hono.ts / pinned-items.hono.ts / mwikila-inbox.hono.ts.

import { Hono } from 'hono';
import { z } from 'zod';
import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm';

import {
  undoJournal,
  UNDO_ACTION_KINDS,
  DEFAULT_UNDO_WINDOW_SECONDS,
} from '@bossnyumba/database';
import { authMiddleware } from '../../middleware/hono-auth';
import { databaseMiddleware } from '../../middleware/database';
import { getSharedPerTenantRateBudget } from '../../middleware/per-tenant-rate-budget';
import { createLogger } from '../../utils/logger';

const moduleLogger = createLogger('owner-undo-journal');

// ─── Schemas ──────────────────────────────────────────────────────────

const appendSchema = z.object({
  entityType: z.string().min(1).max(60),
  entityId: z.string().min(1).max(120),
  actionKind: z.enum(UNDO_ACTION_KINDS),
  toolId: z.string().min(1).max(120).optional(),
  beforeState: z.record(z.string(), z.unknown()).optional(),
  afterState: z.record(z.string(), z.unknown()).optional(),
  windowSeconds: z
    .number()
    .int()
    .min(0)
    .max(3600)
    .default(DEFAULT_UNDO_WINDOW_SECONDS),
  provenance: z.record(z.string(), z.unknown()).optional().default({}),
});

const undoLastSchema = z.object({
  entityRef: z
    .object({
      entityType: z.string().min(1).max(60),
      entityId: z.string().min(1).max(120),
    })
    .strict()
    .optional(),
  reason: z.string().min(1).max(400).optional(),
});

// Targeted rollback: owners can pick a row from /recent and reverse it
// without affecting the rest of the reversible window (parity with the
// Notion "right-click audit-log row → Rollback" pattern).
const undoByIdSchema = z.object({
  journalId: z.string().uuid(),
  reason: z.string().min(1).max(400).optional(),
});

// Redo: re-apply a previously undone action. The original performedAt
// + windowSeconds gates the redo so a user cannot resurrect rollbacks
// beyond the reversible window. Provenance accrues a `redoHistory`
// trail so the toggle chain is auditable.
const redoByIdSchema = z.object({
  journalId: z.string().uuid(),
  reason: z.string().min(1).max(400).optional(),
});

// ─── Router ───────────────────────────────────────────────────────────

const app = new Hono();
app.use('*', authMiddleware);
app.use('*', databaseMiddleware);
app.use('*', getSharedPerTenantRateBudget({ surface: 'api' }).handler);

// POST / — append an undo journal entry
app.post('/', async (c: any) => {
  const auth = c.get('auth') as { tenantId: string; userId: string };
  const db = c.get('db');
  if (!db) {
    return c.json(
      {
        success: false,
        error: {
          code: 'UNDO_DB_UNAVAILABLE',
          message: 'Database not configured',
        },
      },
      503,
    );
  }
  const raw = await c.req.json().catch(() => null);
  const parsed = appendSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid undo payload',
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
        entityType: input.entityType,
        entityId: input.entityId,
        actionKind: input.actionKind,
        ...(input.toolId !== undefined && { toolId: input.toolId }),
        ...(input.beforeState !== undefined && { beforeState: input.beforeState }),
        ...(input.afterState !== undefined && { afterState: input.afterState }),
        windowSeconds: input.windowSeconds,
        provenance: input.provenance,
      })
      .returning();
    return c.json({ success: true, data: { entry: row } }, 201);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    moduleLogger.error('owner-undo-journal: insert failed', {
      tenantId: auth.tenantId,
      error: message,
    });
    return c.json(
      { success: false, error: { code: 'UNDO_INSERT_FAILED', message } },
      500,
    );
  }
});

// GET /recent — list the actor's reversible window (20 rows, performed
// within DEFAULT_UNDO_WINDOW_SECONDS, un-undone).
app.get('/recent', async (c: any) => {
  const auth = c.get('auth') as { tenantId: string; userId: string };
  const db = c.get('db');
  if (!db) {
    return c.json(
      {
        success: false,
        error: {
          code: 'UNDO_DB_UNAVAILABLE',
          message: 'Database not configured',
        },
      },
      503,
    );
  }
  const cutoff = new Date(Date.now() - DEFAULT_UNDO_WINDOW_SECONDS * 1000);
  const rows = await db
    .select()
    .from(undoJournal)
    .where(
      and(
        eq(undoJournal.tenantId, auth.tenantId),
        eq(undoJournal.actorId, auth.userId),
        isNull(undoJournal.undoneAt),
        gt(undoJournal.performedAt, cutoff),
      ),
    )
    .orderBy(desc(undoJournal.performedAt))
    .limit(20);
  return c.json({
    success: true,
    data: { entries: rows, count: rows.length },
  });
});

// POST /undo-last — reverse the most recent reversible action.
app.post('/undo-last', async (c: any) => {
  const auth = c.get('auth') as { tenantId: string; userId: string };
  const db = c.get('db');
  if (!db) {
    return c.json(
      {
        success: false,
        error: {
          code: 'UNDO_DB_UNAVAILABLE',
          message: 'Database not configured',
        },
      },
      503,
    );
  }
  const raw = await c.req.json().catch(() => ({}));
  const parsed = undoLastSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid undo-last payload',
          issues: parsed.error.issues,
        },
      },
      400,
    );
  }
  const input = parsed.data;

  const conditions = [
    eq(undoJournal.tenantId, auth.tenantId),
    eq(undoJournal.actorId, auth.userId),
    isNull(undoJournal.undoneAt),
    sql`${undoJournal.performedAt} + (${undoJournal.windowSeconds} || ' seconds')::interval > now()`,
  ];
  if (input.entityRef) {
    conditions.push(eq(undoJournal.entityType, input.entityRef.entityType));
    conditions.push(eq(undoJournal.entityId, input.entityRef.entityId));
  }

  const [candidate] = await db
    .select()
    .from(undoJournal)
    .where(and(...conditions))
    .orderBy(desc(undoJournal.performedAt))
    .limit(1);

  if (!candidate) {
    return c.json({
      success: true,
      data: {
        undone: false,
        journalId: null,
        actionKind: null,
        entityType: null,
        entityId: null,
      },
    });
  }

  // Mark the journal entry as undone. Replay of `beforeState` into the
  // source entity is dispatched per-entity-owner (real-estate domain
  // owners: leases / invoices / maintenance / reminders / inspections)
  // so each domain supplies its own reverse strategy without coupling.
  const [row] = await db
    .update(undoJournal)
    .set({
      undoneAt: new Date(),
      undoneById: auth.userId,
      ...(input.reason !== undefined && { undoReason: input.reason }),
    })
    .where(eq(undoJournal.id, candidate.id))
    .returning();

  moduleLogger.info('owner-undo-journal: undone', {
    tenantId: auth.tenantId,
    userId: auth.userId,
    journalId: row.id,
    entityType: row.entityType,
    entityId: row.entityId,
    actionKind: row.actionKind,
  });

  return c.json({
    success: true,
    data: {
      undone: true,
      journalId: row.id,
      actionKind: row.actionKind,
      entityType: row.entityType,
      entityId: row.entityId,
    },
  });
});

// POST /undo-by-id — reverse a specific journal entry by id.
// The 5-minute window still applies; RLS + actor-id check guarantee
// only the journal's owner can undo their own row.
app.post('/undo-by-id', async (c: any) => {
  const auth = c.get('auth') as { tenantId: string; userId: string };
  const db = c.get('db');
  if (!db) {
    return c.json(
      {
        success: false,
        error: {
          code: 'UNDO_DB_UNAVAILABLE',
          message: 'Database not configured',
        },
      },
      503,
    );
  }
  const raw = await c.req.json().catch(() => null);
  const parsed = undoByIdSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid undo-by-id payload',
          issues: parsed.error.issues,
        },
      },
      400,
    );
  }
  const input = parsed.data;

  const [candidate] = await db
    .select()
    .from(undoJournal)
    .where(
      and(
        eq(undoJournal.id, input.journalId),
        eq(undoJournal.tenantId, auth.tenantId),
        eq(undoJournal.actorId, auth.userId),
      ),
    )
    .limit(1);

  if (!candidate) {
    return c.json(
      {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Journal entry not found' },
      },
      404,
    );
  }
  if (candidate.undoneAt) {
    return c.json(
      {
        success: false,
        error: { code: 'ALREADY_UNDONE', message: 'Already undone' },
      },
      409,
    );
  }
  const windowEnd =
    new Date(candidate.performedAt).getTime() +
    candidate.windowSeconds * 1000;
  if (windowEnd <= Date.now()) {
    return c.json(
      {
        success: false,
        error: { code: 'WINDOW_LAPSED', message: 'Undo window has lapsed' },
      },
      410,
    );
  }

  const [row] = await db
    .update(undoJournal)
    .set({
      undoneAt: new Date(),
      undoneById: auth.userId,
      ...(input.reason !== undefined && { undoReason: input.reason }),
    })
    .where(eq(undoJournal.id, candidate.id))
    .returning();

  moduleLogger.info('owner-undo-journal: undone-by-id', {
    tenantId: auth.tenantId,
    userId: auth.userId,
    journalId: row.id,
    entityType: row.entityType,
    entityId: row.entityId,
    actionKind: row.actionKind,
  });

  return c.json({
    success: true,
    data: {
      undone: true,
      journalId: row.id,
      actionKind: row.actionKind,
      entityType: row.entityType,
      entityId: row.entityId,
    },
  });
});

// POST /redo-by-id — re-apply a previously undone action.
// The original performedAt + windowSeconds gates the redo so an ancient
// undone entry cannot be revived. Provenance accrues a `redoHistory`
// trail for full audit reconstruction.
app.post('/redo-by-id', async (c: any) => {
  const auth = c.get('auth') as { tenantId: string; userId: string };
  const db = c.get('db');
  if (!db) {
    return c.json(
      {
        success: false,
        error: {
          code: 'UNDO_DB_UNAVAILABLE',
          message: 'Database not configured',
        },
      },
      503,
    );
  }
  const raw = await c.req.json().catch(() => null);
  const parsed = redoByIdSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid redo-by-id payload',
          issues: parsed.error.issues,
        },
      },
      400,
    );
  }
  const input = parsed.data;

  const [candidate] = await db
    .select()
    .from(undoJournal)
    .where(
      and(
        eq(undoJournal.id, input.journalId),
        eq(undoJournal.tenantId, auth.tenantId),
        eq(undoJournal.actorId, auth.userId),
      ),
    )
    .limit(1);

  if (!candidate) {
    return c.json(
      {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Journal entry not found' },
      },
      404,
    );
  }
  if (!candidate.undoneAt) {
    return c.json(
      {
        success: false,
        error: {
          code: 'NOT_UNDONE',
          message: 'Entry has not been undone — nothing to redo',
        },
      },
      409,
    );
  }
  const windowEnd =
    new Date(candidate.performedAt).getTime() +
    candidate.windowSeconds * 1000;
  if (windowEnd <= Date.now()) {
    return c.json(
      {
        success: false,
        error: { code: 'WINDOW_LAPSED', message: 'Redo window has lapsed' },
      },
      410,
    );
  }

  const priorProvenance =
    (candidate.provenance as Record<string, unknown> | null) ?? {};
  const priorRedoHistory = Array.isArray(priorProvenance.redoHistory)
    ? (priorProvenance.redoHistory as ReadonlyArray<Record<string, unknown>>)
    : [];
  const nextProvenance = {
    ...priorProvenance,
    redoHistory: [
      ...priorRedoHistory,
      {
        redoneAt: new Date().toISOString(),
        redoneById: auth.userId,
        priorUndoneAt:
          candidate.undoneAt instanceof Date
            ? candidate.undoneAt.toISOString()
            : String(candidate.undoneAt),
        priorUndoneById: candidate.undoneById ?? null,
        ...(input.reason !== undefined && { reason: input.reason }),
      },
    ],
  };

  const [row] = await db
    .update(undoJournal)
    .set({
      undoneAt: null,
      undoneById: null,
      undoReason: null,
      provenance: nextProvenance,
    })
    .where(eq(undoJournal.id, candidate.id))
    .returning();

  moduleLogger.info('owner-undo-journal: redone-by-id', {
    tenantId: auth.tenantId,
    userId: auth.userId,
    journalId: row.id,
    entityType: row.entityType,
    entityId: row.entityId,
    actionKind: row.actionKind,
  });

  return c.json({
    success: true,
    data: {
      redone: true,
      journalId: row.id,
      actionKind: row.actionKind,
      entityType: row.entityType,
      entityId: row.entityId,
    },
  });
});

export const ownerUndoJournalRouter = app;
export default ownerUndoJournalRouter;
