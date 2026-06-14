/**
 * /api/v1/owner/mwikila-inbox — Mr. Mwikila autonomous-MD "Acting on
 * your behalf" inbox + delegation matrix surface.
 *
 * Closes G1-C from the gap-closure roadmap. Mirrors the Borjie
 * mwikila-inbox.hono.ts contract but reads/writes against BossNyumba's
 * existing `sovereign_approvals` table — no new service layer needed.
 *
 * Routes (all auth + tenant-scoped):
 *   GET    /                          paginated inbox (pending + recent)
 *   GET    /delegation-matrix         12-category × T0-T3 tier matrix
 *   PATCH  /delegation-matrix/:cat    set one category's delegation tier
 *   POST   /:id/approve               T0/T1 owner one-tap approve
 *   POST   /:id/deny                  T0/T1 owner one-tap deny
 *   POST   /:id/reverse               T2 owner reverses within window
 *
 * The delegation matrix is per-tenant: the canonical default tiers live
 * in DEFAULT_MATRIX and any owner override is persisted in the
 * `owner_delegation_prefs` table (migration 0290, RLS FORCE). The GET
 * merges the override over the default; the PATCH upserts the override.
 *
 * Mapping to sovereign_approvals:
 *   - `action_id`  -> inbox row id
 *   - `stakes`     -> delegation tier hint (medium=T1, high=T2, critical=T3)
 *   - `status`     -> approved | rejected | pending | one-eye | expired
 *   - `payload`    -> action-specific context (category, summary, etc.)
 *   - `summary`    -> bilingual sw/en summary (FE renders via locale)
 *
 * Tenant isolation: every read filters on tenant_id from JWT. Approve/
 * deny mutations also require the tenant predicate to fail at the
 * WITH CHECK guard.
 */

// dsar.router.ts.

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { and, desc, eq, sql } from 'drizzle-orm';

import { sovereignApprovals } from '@bossnyumba/database';

import { authMiddleware } from '../../middleware/hono-auth';
import { databaseMiddleware } from '../../middleware/database';
import { getSharedPerTenantRateBudget } from '../../middleware/per-tenant-rate-budget';
import { createLogger } from '../../utils/logger';

const moduleLogger = createLogger('owner-mwikila-inbox');

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const INBOX_STATUSES = [
  'pending',
  'one-eye',
  'approved',
  'rejected',
  'expired',
] as const;

// The 12-category × T0-T3 delegation matrix for real-estate. T0 is the
// owner's first-tap consent, T1 is "stay-informed-after-the-fact", T2
// gives Mwikila pre-approval with a reversal window, T3 is full
// autonomy (silent execution).
//
// The category strings are canonical across the surface — they match the
// migration-0290 `owner_delegation_prefs` CHECK constraint, the
// migration-0291 `mwikila_actions_inbox` CHECK constraint, and the owner
// portal's MwikilaInbox / MwikilaDelegation category enums. Do not drift
// them apart: the FE binds rows by exact category string.
const DELEGATION_CATEGORIES = [
  'rent-scheduling',
  'regulatory-filings',
  'lease-renewals',
  'payroll-prep',
  'listing-counter-offers',
  'maintenance-approvals-low-value',
  'tenant-communications',
  'evictions-initial-notice',
  'capex',
  'inventory',
  'marketplace-listings',
  'contractor-engagement',
] as const;

const ListQuerySchema = z.object({
  status: z.enum(INBOX_STATUSES).optional(),
  category: z.enum(DELEGATION_CATEGORIES).optional(),
  limit: z
    .union([
      z.number().int().min(1).max(200),
      z
        .string()
        .regex(/^\d+$/)
        .transform((s) => Number(s)),
    ])
    .optional(),
  cursor: z.string().optional(),
});

const ReverseBodySchema = z
  .object({
    reversalToken: z.string().uuid(),
  })
  .strict();

// PATCH /delegation-matrix/:category — set one category's delegation
// tier and (optionally) its reversal window, envelope cap, and notes.
// Bounds mirror the migration-0290 CHECK constraints so a write that
// passes zod also passes the database guard.
const DelegationCategoryParamSchema = z.object({
  category: z.enum(DELEGATION_CATEGORIES),
});

const DelegationUpdateSchema = z
  .object({
    tier: z.enum(['T0', 'T1', 'T2', 'T3']),
    reversalWindowHours: z
      .number()
      .int()
      .min(1)
      .max(168)
      .nullable()
      .optional(),
    envelopeThreshold: z.number().min(0).nullable().optional(),
    envelopeThresholdCurrency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .optional(),
    notes: z.string().max(2000).nullable().optional(),
  })
  .strict();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jsonError(
  code: string,
  message: string,
  status: 400 | 401 | 403 | 404 | 409 | 500 | 503,
) {
  return { status, body: { success: false as const, error: { code, message } } };
}

function dbUnavailable(c: any) {
  const err = jsonError(
    'DATABASE_UNAVAILABLE',
    'Database client is not initialized',
    503,
  );
  return c.json(err.body, err.status);
}

// zValidator short-circuits on a bad request with its OWN default shape
// (no `error.code`); route this hook through it so every validation failure
// returns the same `{ success:false, error:{ code, message } }` envelope as
// the rest of the router.
function validationHook(
  result: { success: boolean; error?: z.ZodError },
  c: any,
) {
  if (!result.success) {
    const first = result.error?.issues?.[0];
    const message = first
      ? `${first.path.join('.') || 'request'}: ${first.message}`
      : 'invalid request';
    const e = jsonError('VALIDATION_ERROR', message, 400);
    return c.json(e.body, e.status);
  }
}

function tierFromStakes(stakes: string | null | undefined): 'T0' | 'T1' | 'T2' | 'T3' {
  switch (stakes) {
    case 'critical':
      return 'T3';
    case 'high':
      return 'T2';
    case 'medium':
      return 'T1';
    default:
      return 'T0';
  }
}

// Coerce a raw `owner_delegation_prefs` row (snake_case, NUMERIC arrives
// as a string from pg) into the camelCase MatrixCell the FE consumes.
function rowToMatrixCell(row: Record<string, unknown>): MatrixCell {
  const rawThreshold = row.envelope_threshold;
  const envelopeThreshold =
    rawThreshold === null || rawThreshold === undefined
      ? null
      : Number(rawThreshold);
  return {
    category: row.category as (typeof DELEGATION_CATEGORIES)[number],
    tier: row.tier as Tier,
    reversalWindowHours:
      row.reversal_window_hours === null ||
      row.reversal_window_hours === undefined
        ? null
        : Number(row.reversal_window_hours),
    envelopeThreshold: Number.isNaN(envelopeThreshold)
      ? null
      : envelopeThreshold,
    envelopeThresholdCurrency:
      (row.envelope_threshold_currency as string | null) ?? 'TZS',
    notes: (row.notes as string | null) ?? null,
  };
}

// ---------------------------------------------------------------------------
// Delegation matrix — 12 categories × 4 tiers default policy.
//
// The owner can override per-category in a follow-up commit; today we
// surface the canonical default so the FE can render the configuration
// screen without a database round-trip.
// ---------------------------------------------------------------------------

type Tier = 'T0' | 'T1' | 'T2' | 'T3';

// One row of the delegation matrix as the owner portal renders it. The
// shape matches MwikilaDelegation.tsx's DelegationPref so the FE binds a
// row by exact category string and reads tier / reversal window /
// envelope cap directly off the response.
interface MatrixCell {
  readonly category: (typeof DELEGATION_CATEGORIES)[number];
  readonly tier: Tier;
  readonly reversalWindowHours: number | null;
  readonly envelopeThreshold: number | null;
  readonly envelopeThresholdCurrency: string;
  readonly notes: string | null;
}

// Canonical safe defaults. T0 = inform-only is the safest tier; any
// category not yet overridden by the owner falls back to its default
// here. Owners persist per-category overrides via PATCH (see below),
// which the GET merges over these defaults.
const DEFAULT_TIERS: Readonly<
  Record<(typeof DELEGATION_CATEGORIES)[number], Tier>
> = Object.freeze({
  'rent-scheduling': 'T2',
  'regulatory-filings': 'T1',
  'lease-renewals': 'T2',
  'payroll-prep': 'T1',
  'listing-counter-offers': 'T1',
  'maintenance-approvals-low-value': 'T2',
  'tenant-communications': 'T1',
  'evictions-initial-notice': 'T0',
  capex: 'T0',
  inventory: 'T1',
  'marketplace-listings': 'T3',
  'contractor-engagement': 'T1',
});

const DEFAULT_MATRIX: ReadonlyArray<MatrixCell> = Object.freeze(
  DELEGATION_CATEGORIES.map((category) => ({
    category,
    tier: DEFAULT_TIERS[category],
    reversalWindowHours: null,
    envelopeThreshold: null,
    envelopeThresholdCurrency: 'TZS',
    notes: null,
  })),
);

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export function createMwikilaInboxRouter(): Hono {
  const app = new Hono();
  app.use('*', authMiddleware);
  app.use('*', databaseMiddleware);
  app.use('*', getSharedPerTenantRateBudget({ surface: 'api' }).handler);

  // -------------------------------------------------------------------------
  // GET / — paginated inbox.
  //
  // Defaults: status=pending if not provided. Filter by category (folded
  // from payload.category) and limit. Cursor is the last row's
  // `proposed_at` ISO string (DESC pagination).
  // -------------------------------------------------------------------------
  app.get('/', zValidator('query', ListQuerySchema), async (c: any) => {
    const auth = c.get('auth') ?? {};
    const { tenantId } = auth as { tenantId?: string };
    if (!tenantId) {
      const err = jsonError('UNAUTHORIZED', 'Authentication required', 401);
      return c.json(err.body, err.status);
    }
    const db = c.get('db');
    if (!db) return dbUnavailable(c);
    const q = c.req.valid('query') as z.infer<typeof ListQuerySchema>;

    try {
      const statusFilter = q.status ?? 'pending';
      const limit = q.limit ?? 50;

      const conditions = [
        eq(sovereignApprovals.tenantId, tenantId),
        eq(sovereignApprovals.status, statusFilter),
      ];
      if (q.cursor) {
        conditions.push(
          sql`${sovereignApprovals.proposedAt} < ${q.cursor}::timestamptz`,
        );
      }

      const rows = await db
        .select()
        .from(sovereignApprovals)
        .where(and(...conditions))
        .orderBy(desc(sovereignApprovals.proposedAt))
        .limit(limit + 1);

      // Filter by category from payload after the SQL fetch (sov approvals
      // does not currently index payload->category). Acceptable for the
      // launch surface; can move to a generated column later.
      const filtered = q.category
        ? rows.filter(
            (r: Record<string, unknown>) =>
              (r.payload as Record<string, unknown>)?.category === q.category,
          )
        : rows;

      const hasNext = filtered.length > limit;
      const page = filtered.slice(0, limit).map((r: Record<string, unknown>) => {
        const payload = (r.payload as Record<string, unknown>) ?? {};
        return {
          id: r.actionId,
          tenantId: r.tenantId,
          proposerUserId: r.proposerUserId,
          thoughtId: r.thoughtId,
          summary: r.summary,
          summarySw: payload.summarySw ?? null,
          summaryEn: payload.summaryEn ?? null,
          toolName: r.toolName,
          category: payload.category ?? null,
          stakes: r.stakes,
          delegationTier: tierFromStakes(r.stakes as string),
          status: r.status,
          signatures: r.signatures,
          proposedAt: r.proposedAt,
          expiresAt: r.expiresAt,
          payload,
        };
      });

      const nextCursor = hasNext
        ? new Date(String(page[page.length - 1]?.proposedAt)).toISOString()
        : null;

      return c.json(
        {
          success: true as const,
          data: page,
          meta: { total: page.length, nextCursor, hasNext },
        },
        200,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'inbox list failed';
      moduleLogger.error('mwikila inbox list failed', {
        evt: 'mwikila_inbox_list_failed',
        tenantId,
        reason: message,
      });
      const e = jsonError('MWIKILA_INBOX_LIST_FAILED', message, 500);
      return c.json(e.body, e.status);
    }
  });

  // -------------------------------------------------------------------------
  // GET /delegation-matrix — return the 12-category × T0-T3 matrix for the
  // tenant: canonical defaults with any persisted per-category override
  // (owner_delegation_prefs, migration 0290) merged on top.
  // -------------------------------------------------------------------------
  app.get('/delegation-matrix', async (c: any) => {
    const auth = c.get('auth') ?? {};
    const { tenantId } = auth as { tenantId?: string };
    if (!tenantId) {
      const err = jsonError('UNAUTHORIZED', 'Authentication required', 401);
      return c.json(err.body, err.status);
    }
    const db = c.get('db');
    if (!db) return dbUnavailable(c);

    try {
      const result = await db.execute(sql`
        SELECT category, tier, reversal_window_hours, envelope_threshold,
               envelope_threshold_currency, notes
          FROM owner_delegation_prefs
         WHERE tenant_id = ${tenantId}
      `);
      const overrideRows =
        (result as unknown as Record<string, unknown>[]) ?? [];
      const overrides = new Map(
        overrideRows.map((r) => [String(r.category), rowToMatrixCell(r)]),
      );

      // Merge: an override fully replaces the default cell for its
      // category; categories without an override keep the default.
      const data = DEFAULT_MATRIX.map(
        (cell) => overrides.get(cell.category) ?? cell,
      );

      return c.json(
        {
          success: true as const,
          data,
          meta: {
            categories: DELEGATION_CATEGORIES.length,
            tiers: ['T0', 'T1', 'T2', 'T3'] as const,
            total: data.length,
            overridden: overrides.size,
          },
        },
        200,
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'delegation matrix read failed';
      moduleLogger.error('mwikila delegation matrix read failed', {
        evt: 'mwikila_delegation_matrix_read_failed',
        tenantId,
        reason: message,
      });
      const e = jsonError('MWIKILA_DELEGATION_READ_FAILED', message, 500);
      return c.json(e.body, e.status);
    }
  });

  // -------------------------------------------------------------------------
  // PATCH /delegation-matrix/:category — set one category's delegation
  // tier (and optionally reversal window, envelope cap, notes). Upserts
  // the per-tenant override into owner_delegation_prefs (migration 0290,
  // RLS FORCE). The unique (tenant_id, category) index makes this
  // idempotent; ON CONFLICT updates in place. Returns the merged cell.
  // -------------------------------------------------------------------------
  app.patch(
    '/delegation-matrix/:category',
    zValidator('param', DelegationCategoryParamSchema, validationHook),
    zValidator('json', DelegationUpdateSchema, validationHook),
    async (c: any) => {
      const auth = c.get('auth') ?? {};
      const { tenantId, userId } = auth as {
        tenantId?: string;
        userId?: string;
      };
      if (!tenantId || !userId) {
        const err = jsonError('UNAUTHORIZED', 'Authentication required', 401);
        return c.json(err.body, err.status);
      }
      const db = c.get('db');
      if (!db) return dbUnavailable(c);

      const { category } = c.req.valid('param') as z.infer<
        typeof DelegationCategoryParamSchema
      >;
      const body = c.req.valid('json') as z.infer<typeof DelegationUpdateSchema>;

      const reversalWindowHours = body.reversalWindowHours ?? null;
      const envelopeThreshold = body.envelopeThreshold ?? null;
      const envelopeThresholdCurrency =
        body.envelopeThresholdCurrency ?? 'TZS';
      const notes = body.notes ?? null;

      try {
        const result = await db.execute(sql`
          INSERT INTO owner_delegation_prefs (
            tenant_id, category, tier, reversal_window_hours,
            envelope_threshold, envelope_threshold_currency,
            set_by_user_id, set_at, notes, created_at, updated_at
          ) VALUES (
            ${tenantId}, ${category}, ${body.tier}, ${reversalWindowHours},
            ${envelopeThreshold}, ${envelopeThresholdCurrency},
            ${userId}, NOW(), ${notes}, NOW(), NOW()
          )
          ON CONFLICT (tenant_id, category) DO UPDATE SET
            tier                        = EXCLUDED.tier,
            reversal_window_hours       = EXCLUDED.reversal_window_hours,
            envelope_threshold          = EXCLUDED.envelope_threshold,
            envelope_threshold_currency = EXCLUDED.envelope_threshold_currency,
            set_by_user_id              = EXCLUDED.set_by_user_id,
            set_at                      = NOW(),
            notes                       = EXCLUDED.notes,
            updated_at                  = NOW()
          RETURNING category, tier, reversal_window_hours, envelope_threshold,
                    envelope_threshold_currency, notes
        `);
        const rows = (result as unknown as Record<string, unknown>[]) ?? [];
        const saved = rows[0];
        if (!saved) {
          const err = jsonError(
            'MWIKILA_DELEGATION_WRITE_FAILED',
            'delegation upsert returned no row',
            500,
          );
          return c.json(err.body, err.status);
        }

        return c.json(
          { success: true as const, data: rowToMatrixCell(saved) },
          200,
        );
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'delegation write failed';
        moduleLogger.error('mwikila delegation matrix write failed', {
          evt: 'mwikila_delegation_matrix_write_failed',
          tenantId,
          category,
          reason: message,
        });
        const e = jsonError('MWIKILA_DELEGATION_WRITE_FAILED', message, 500);
        return c.json(e.body, e.status);
      }
    },
  );

  // -------------------------------------------------------------------------
  // POST /:id/approve — owner approves a pending action.
  // -------------------------------------------------------------------------
  app.post('/:id/approve', async (c: any) => {
    const auth = c.get('auth') ?? {};
    const { tenantId, userId } = auth as {
      tenantId?: string;
      userId?: string;
    };
    if (!tenantId || !userId) {
      const err = jsonError('UNAUTHORIZED', 'Authentication required', 401);
      return c.json(err.body, err.status);
    }
    const db = c.get('db');
    if (!db) return dbUnavailable(c);
    const id = c.req.param('id');

    try {
      const [existing] = await db
        .select()
        .from(sovereignApprovals)
        .where(
          and(
            eq(sovereignApprovals.actionId, id),
            eq(sovereignApprovals.tenantId, tenantId),
          ),
        )
        .limit(1);
      if (!existing) {
        const err = jsonError('NOT_FOUND', 'Inbox row not found', 404);
        return c.json(err.body, err.status);
      }
      if (existing.status !== 'pending' && existing.status !== 'one-eye') {
        const err = jsonError(
          'WRONG_STATUS',
          `Cannot approve a row in status "${existing.status}"`,
          409,
        );
        return c.json(err.body, err.status);
      }

      const signatures = Array.isArray(existing.signatures)
        ? [...existing.signatures]
        : [];
      signatures.push({
        kind: 'approve',
        userId,
        signedAt: new Date().toISOString(),
      });

      await db
        .update(sovereignApprovals)
        .set({
          status: 'approved',
          signatures,
          updatedAt: new Date(),
        })
        .where(eq(sovereignApprovals.actionId, id));

      return c.json(
        {
          success: true as const,
          data: { id, status: 'approved' as const },
        },
        200,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'approve failed';
      moduleLogger.error('mwikila inbox approve failed', {
        evt: 'mwikila_inbox_approve_failed',
        tenantId,
        id,
        reason: message,
      });
      const e = jsonError('MWIKILA_INBOX_APPROVE_FAILED', message, 500);
      return c.json(e.body, e.status);
    }
  });

  // -------------------------------------------------------------------------
  // POST /:id/deny — owner denies a pending action.
  // -------------------------------------------------------------------------
  app.post('/:id/deny', async (c: any) => {
    const auth = c.get('auth') ?? {};
    const { tenantId, userId } = auth as {
      tenantId?: string;
      userId?: string;
    };
    if (!tenantId || !userId) {
      const err = jsonError('UNAUTHORIZED', 'Authentication required', 401);
      return c.json(err.body, err.status);
    }
    const db = c.get('db');
    if (!db) return dbUnavailable(c);
    const id = c.req.param('id');

    try {
      const [existing] = await db
        .select()
        .from(sovereignApprovals)
        .where(
          and(
            eq(sovereignApprovals.actionId, id),
            eq(sovereignApprovals.tenantId, tenantId),
          ),
        )
        .limit(1);
      if (!existing) {
        const err = jsonError('NOT_FOUND', 'Inbox row not found', 404);
        return c.json(err.body, err.status);
      }
      if (existing.status !== 'pending' && existing.status !== 'one-eye') {
        const err = jsonError(
          'WRONG_STATUS',
          `Cannot deny a row in status "${existing.status}"`,
          409,
        );
        return c.json(err.body, err.status);
      }

      const signatures = Array.isArray(existing.signatures)
        ? [...existing.signatures]
        : [];
      signatures.push({
        kind: 'deny',
        userId,
        signedAt: new Date().toISOString(),
      });

      await db
        .update(sovereignApprovals)
        .set({
          status: 'rejected',
          signatures,
          updatedAt: new Date(),
        })
        .where(eq(sovereignApprovals.actionId, id));

      return c.json(
        {
          success: true as const,
          data: { id, status: 'rejected' as const },
        },
        200,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'deny failed';
      moduleLogger.error('mwikila inbox deny failed', {
        evt: 'mwikila_inbox_deny_failed',
        tenantId,
        id,
        reason: message,
      });
      const e = jsonError('MWIKILA_INBOX_DENY_FAILED', message, 500);
      return c.json(e.body, e.status);
    }
  });

  // -------------------------------------------------------------------------
  // POST /:id/reverse — T2 owner reverses an already-approved action
  // within the reversal window. Validates the reversalToken matches the
  // one stored in payload.reversalToken.
  // -------------------------------------------------------------------------
  app.post(
    '/:id/reverse',
    zValidator('json', ReverseBodySchema),
    async (c: any) => {
      const auth = c.get('auth') ?? {};
      const { tenantId, userId } = auth as {
        tenantId?: string;
        userId?: string;
      };
      if (!tenantId || !userId) {
        const err = jsonError('UNAUTHORIZED', 'Authentication required', 401);
        return c.json(err.body, err.status);
      }
      const db = c.get('db');
      if (!db) return dbUnavailable(c);
      const id = c.req.param('id');
      const { reversalToken } = c.req.valid('json') as z.infer<
        typeof ReverseBodySchema
      >;

      try {
        const [existing] = await db
          .select()
          .from(sovereignApprovals)
          .where(
            and(
              eq(sovereignApprovals.actionId, id),
              eq(sovereignApprovals.tenantId, tenantId),
            ),
          )
          .limit(1);
        if (!existing) {
          const err = jsonError('NOT_FOUND', 'Inbox row not found', 404);
          return c.json(err.body, err.status);
        }
        if (existing.status !== 'approved') {
          const err = jsonError(
            'WRONG_STATUS',
            `Cannot reverse a row in status "${existing.status}"`,
            409,
          );
          return c.json(err.body, err.status);
        }

        const payload = (existing.payload as Record<string, unknown>) ?? {};
        const storedToken = payload.reversalToken as string | undefined;
        if (!storedToken || storedToken !== reversalToken) {
          const err = jsonError(
            'REVERSAL_TOKEN_MISMATCH',
            'Reversal token does not match the action proposal',
            409,
          );
          return c.json(err.body, err.status);
        }

        const reversalWindowMs =
          (payload.reversalWindowMs as number | undefined) ??
          24 * 60 * 60 * 1000;
        const proposedAt = new Date(String(existing.proposedAt));
        if (Date.now() - proposedAt.getTime() > reversalWindowMs) {
          const err = jsonError(
            'REVERSAL_WINDOW_EXPIRED',
            'The reversal window has elapsed',
            409,
          );
          return c.json(err.body, err.status);
        }

        const signatures = Array.isArray(existing.signatures)
          ? [...existing.signatures]
          : [];
        signatures.push({
          kind: 'reverse',
          userId,
          signedAt: new Date().toISOString(),
        });

        await db
          .update(sovereignApprovals)
          .set({
            status: 'rejected',
            signatures,
            updatedAt: new Date(),
          })
          .where(eq(sovereignApprovals.actionId, id));

        return c.json(
          {
            success: true as const,
            data: {
              id,
              status: 'rejected' as const,
              reversal: { by: userId, at: new Date().toISOString() },
            },
          },
          200,
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : 'reverse failed';
        moduleLogger.error('mwikila inbox reverse failed', {
          evt: 'mwikila_inbox_reverse_failed',
          tenantId,
          id,
          reason: message,
        });
        const e = jsonError('MWIKILA_INBOX_REVERSE_FAILED', message, 500);
        return c.json(e.body, e.status);
      }
    },
  );

  return app;
}

export const mwikilaInboxRouter = createMwikilaInboxRouter();
