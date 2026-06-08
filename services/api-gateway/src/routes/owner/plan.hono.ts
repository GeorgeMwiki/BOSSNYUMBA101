/**
 * /api/v1/owner/plan — MDR (Mr. Mwikila) plan tree (Phase E.7).
 *
 * Owner-visible, steerable plan tree. The MD proposes items; the owner
 * accepts / rejects / pauses / resumes / completes them, or proposes a
 * child item of their own. Status mutations are idempotent UPDATEs —
 * cancelled rows stay in the table (soft-delete via status='cancelled')
 * for audit, matching `mdr-plan.schema.ts`.
 *
 * Routes:
 *   GET    /items                  load this tenant's plan tree
 *   POST   /items                  owner proposes a new (child) item
 *   PATCH  /items/:id/accept       proposed → active  (records acceptedAt)
 *   PATCH  /items/:id/reject       proposed → cancelled
 *   PATCH  /items/:id/pause        active   → paused
 *   PATCH  /items/:id/resume       paused   → active
 *   PATCH  /items/:id/complete     active   → done
 *
 * Auth: Supabase JWT via authMiddleware. Tenant scope bound via
 *       databaseMiddleware (app.current_tenant_id GUC for RLS FORCE).
 *
 * Companion files:
 *   - packages/database/src/schemas/mdr-plan.schema.ts
 *   - packages/database/src/migrations/0161_mdr_plan.sql
 *   - apps/owner-portal/src/app/plan/page.tsx (FE wiring)
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { and, asc, eq } from 'drizzle-orm';

import { mdrPlanItems } from '@bossnyumba/database';
import { authMiddleware } from '../../middleware/hono-auth';
import { databaseMiddleware } from '../../middleware/database';
import { createLogger } from '../../utils/logger';

const moduleLogger = createLogger('owner-plan');

const HORIZONS = ['annual', 'quarterly', 'monthly', 'weekly', 'daily'] as const;

const proposeSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  horizon: z.enum(HORIZONS),
  parentId: z.string().uuid().nullable().optional(),
  startDate: z.string().max(40).nullable().optional(),
  dueDate: z.string().max(40).nullable().optional(),
});

type PlanAction = 'accept' | 'reject' | 'pause' | 'resume' | 'complete';

/**
 * Status transition table for the per-action endpoints. `from` is the
 * set of statuses the row may currently be in for the action to apply;
 * `to` is the resulting status. Out-of-state requests are rejected 409.
 */
const TRANSITIONS: Record<
  PlanAction,
  { from: ReadonlyArray<string>; to: string; stampsAccepted?: boolean }
> = {
  accept: { from: ['proposed'], to: 'active', stampsAccepted: true },
  reject: { from: ['proposed'], to: 'cancelled' },
  pause: { from: ['active'], to: 'paused' },
  resume: { from: ['paused'], to: 'active' },
  complete: { from: ['active'], to: 'done' },
};

const app = new Hono();
app.use('*', authMiddleware);
app.use('*', databaseMiddleware);

function dbUnavailable(c: any) {
  return c.json(
    {
      success: false,
      error: { code: 'PLAN_DB_UNAVAILABLE', message: 'Database not configured' },
    },
    503,
  );
}

/** Serialise a DB row into the FE `PlanItem` shape (camelCase, ISO dates). */
function toPlanItem(row: any) {
  return {
    id: row.id,
    parentId: row.parentId ?? null,
    horizon: row.horizon,
    title: row.title,
    description: row.description ?? null,
    status: row.status,
    proposedBy: row.proposedBy,
    startDate: row.startDate ?? null,
    dueDate: row.dueDate ?? null,
    ownerEditable: row.ownerEditable ?? true,
  };
}

// GET /items — load the tenant's full plan tree (ordered for the FE)
app.get('/items', async (c: any) => {
  const auth = c.get('auth') as { tenantId: string; userId: string };
  const db = c.get('db');
  if (!db) return dbUnavailable(c);

  try {
    const rows = await db
      .select()
      .from(mdrPlanItems)
      .where(eq(mdrPlanItems.tenantId, auth.tenantId))
      .orderBy(asc(mdrPlanItems.createdAt));
    return c.json({ success: true, items: rows.map(toPlanItem) });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    moduleLogger.error('owner-plan: list failed', {
      tenantId: auth.tenantId,
      error: message,
    });
    return c.json(
      { success: false, error: { code: 'PLAN_LIST_FAILED', message } },
      500,
    );
  }
});

// POST /items — owner proposes a new (child) item
app.post('/items', async (c: any) => {
  const auth = c.get('auth') as { tenantId: string; userId: string };
  const db = c.get('db');
  if (!db) return dbUnavailable(c);

  const raw = await c.req.json().catch(() => null);
  const parsed = proposeSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid plan item payload',
          issues: parsed.error.issues,
        },
      },
      400,
    );
  }
  const input = parsed.data;

  try {
    // Guard parent ownership: a child may only attach to a row in the
    // caller's tenant. Prevents cross-tenant parent grafting.
    if (input.parentId) {
      const [parent] = await db
        .select({ id: mdrPlanItems.id })
        .from(mdrPlanItems)
        .where(
          and(
            eq(mdrPlanItems.tenantId, auth.tenantId),
            eq(mdrPlanItems.id, input.parentId),
          ),
        )
        .limit(1);
      if (!parent) {
        return c.json(
          {
            success: false,
            error: { code: 'PARENT_NOT_FOUND', message: 'Parent plan item not found' },
          },
          404,
        );
      }
    }

    const [row] = await db
      .insert(mdrPlanItems)
      .values({
        tenantId: auth.tenantId,
        parentId: input.parentId ?? null,
        horizon: input.horizon,
        title: input.title,
        description: input.description ?? null,
        status: 'proposed',
        proposedBy: 'owner',
        startDate: input.startDate ?? null,
        dueDate: input.dueDate ?? null,
      })
      .returning();

    moduleLogger.info('owner-plan: item proposed', {
      tenantId: auth.tenantId,
      itemId: row.id,
      horizon: row.horizon,
    });
    return c.json({ success: true, item: toPlanItem(row) }, 201);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    moduleLogger.error('owner-plan: propose failed', {
      tenantId: auth.tenantId,
      error: message,
    });
    return c.json(
      { success: false, error: { code: 'PLAN_INSERT_FAILED', message } },
      500,
    );
  }
});

/**
 * Shared per-action handler. Loads the row (tenant-scoped), validates the
 * current status is in the action's `from` set, then UPDATEs to `to`.
 */
async function applyAction(c: any, action: PlanAction) {
  const auth = c.get('auth') as { tenantId: string; userId: string };
  const db = c.get('db');
  const id = c.req.param('id');
  if (!db) return dbUnavailable(c);

  const transition = TRANSITIONS[action];

  try {
    const [existing] = await db
      .select()
      .from(mdrPlanItems)
      .where(
        and(eq(mdrPlanItems.tenantId, auth.tenantId), eq(mdrPlanItems.id, id)),
      )
      .limit(1);

    if (!existing) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Plan item not found' } },
        404,
      );
    }
    if (existing.status === transition.to) {
      // Idempotent: already in the target state — return the row as-is.
      return c.json({ success: true, item: toPlanItem(existing) });
    }
    if (!transition.from.includes(existing.status)) {
      return c.json(
        {
          success: false,
          error: {
            code: 'INVALID_TRANSITION',
            message: `Cannot ${action} a plan item with status '${existing.status}'`,
          },
        },
        409,
      );
    }

    const patch: Record<string, unknown> = {
      status: transition.to,
      updatedAt: new Date(),
    };
    if (transition.stampsAccepted) {
      patch.acceptedAt = new Date();
    }

    const [row] = await db
      .update(mdrPlanItems)
      .set(patch)
      .where(
        and(eq(mdrPlanItems.tenantId, auth.tenantId), eq(mdrPlanItems.id, id)),
      )
      .returning();

    moduleLogger.info('owner-plan: action applied', {
      tenantId: auth.tenantId,
      itemId: id,
      action,
      status: transition.to,
    });
    return c.json({ success: true, item: toPlanItem(row) });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    moduleLogger.error('owner-plan: action failed', {
      tenantId: auth.tenantId,
      itemId: id,
      action,
      error: message,
    });
    return c.json(
      { success: false, error: { code: 'PLAN_ACTION_FAILED', message } },
      500,
    );
  }
}

app.patch('/items/:id/accept', (c: any) => applyAction(c, 'accept'));
app.patch('/items/:id/reject', (c: any) => applyAction(c, 'reject'));
app.patch('/items/:id/pause', (c: any) => applyAction(c, 'pause'));
app.patch('/items/:id/resume', (c: any) => applyAction(c, 'resume'));
app.patch('/items/:id/complete', (c: any) => applyAction(c, 'complete'));

export const ownerPlanRouter = app;
export default ownerPlanRouter;
