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
 *   POST   /:id/approve               T0/T1 owner one-tap approve
 *   POST   /:id/deny                  T0/T1 owner one-tap deny
 *   POST   /:id/reverse               T2 owner reverses within window
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
const DELEGATION_CATEGORIES = [
  'rent_collection',
  'lease_renewal',
  'maintenance_dispatch',
  'tenant_screening',
  'vendor_selection',
  'unit_listing',
  'rent_pricing',
  'eviction_notice',
  'expense_authorisation',
  'monthly_close',
  'tax_filing_prep',
  'capital_works_proposal',
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

// ---------------------------------------------------------------------------
// Delegation matrix — 12 categories × 4 tiers default policy.
//
// The owner can override per-category in a follow-up commit; today we
// surface the canonical default so the FE can render the configuration
// screen without a database round-trip.
// ---------------------------------------------------------------------------

interface MatrixCell {
  readonly category: (typeof DELEGATION_CATEGORIES)[number];
  readonly tier: 'T0' | 'T1' | 'T2' | 'T3';
  readonly description: string;
  readonly descriptionSw: string;
}

const DEFAULT_MATRIX: ReadonlyArray<MatrixCell> = Object.freeze([
  // rent_collection — fully autonomous (Mwikila collects, owner sees
  // the running ledger).
  {
    category: 'rent_collection',
    tier: 'T3',
    description: 'Mwikila collects rent and credits the ledger; owner sees a daily summary.',
    descriptionSw: 'Mwikila hukusanya kodi na kuingiza kwenye leja; mmiliki anaona muhtasari wa kila siku.',
  },
  // lease_renewal — pre-approved within rent-cap band; owner is notified.
  {
    category: 'lease_renewal',
    tier: 'T2',
    description: 'Mwikila renews within the rent-cap band; owner can reverse within 24h.',
    descriptionSw: 'Mwikila huongeza muda wa kodi ndani ya bendi ya pango; mmiliki anaweza kubadilisha ndani ya saa 24.',
  },
  // maintenance_dispatch — pre-approved up to TZS 500k.
  {
    category: 'maintenance_dispatch',
    tier: 'T2',
    description: 'Mwikila dispatches up to TZS 500,000; above that owner taps to approve.',
    descriptionSw: 'Mwikila huagiza matengenezo hadi TZS 500,000; zaidi ya hapo mmiliki anabofya kuidhinisha.',
  },
  // tenant_screening — recommends; owner approves.
  {
    category: 'tenant_screening',
    tier: 'T1',
    description: 'Mwikila scores applicants and recommends; owner accepts the tenant.',
    descriptionSw: 'Mwikila huchambua waombaji na kupendekeza; mmiliki anakubali mpangaji.',
  },
  // vendor_selection — recommends; owner approves.
  {
    category: 'vendor_selection',
    tier: 'T1',
    description: 'Mwikila scorecards vendors and recommends; owner taps to pick.',
    descriptionSw: 'Mwikila huchambua wachuuzi na kupendekeza; mmiliki anachagua.',
  },
  // unit_listing — fully autonomous.
  {
    category: 'unit_listing',
    tier: 'T3',
    description: 'Mwikila lists vacant units to the marketplace and edits copy.',
    descriptionSw: 'Mwikila huongeza vyumba vya wazi sokoni na kuhariri maandishi.',
  },
  // rent_pricing — recommends; owner approves.
  {
    category: 'rent_pricing',
    tier: 'T1',
    description: 'Mwikila proposes new pricing; owner approves before publish.',
    descriptionSw: 'Mwikila hupendekeza bei mpya; mmiliki anakubali kabla ya kuchapisha.',
  },
  // eviction_notice — always T0 (legal high-stakes).
  {
    category: 'eviction_notice',
    tier: 'T0',
    description: 'Eviction notices require the owner\'s explicit one-tap consent.',
    descriptionSw: 'Notisi ya kufukuza inahitaji ridhaa wazi ya mmiliki.',
  },
  // expense_authorisation — pre-approved within budget envelope.
  {
    category: 'expense_authorisation',
    tier: 'T2',
    description: 'Mwikila authorises spend within the monthly envelope; owner reviews weekly.',
    descriptionSw: 'Mwikila huidhinisha matumizi ndani ya bajeti ya mwezi; mmiliki anapitia kila wiki.',
  },
  // monthly_close — recommends; owner signs off.
  {
    category: 'monthly_close',
    tier: 'T1',
    description: 'Mwikila prepares the monthly close; owner signs off the statement.',
    descriptionSw: 'Mwikila huandaa hesabu za mwisho wa mwezi; mmiliki anasaini taarifa.',
  },
  // tax_filing_prep — recommends; owner approves the filing.
  {
    category: 'tax_filing_prep',
    tier: 'T1',
    description: 'Mwikila prepares TRA/KRA/URA filings; owner approves submission.',
    descriptionSw: 'Mwikila huandaa rejea za kodi za TRA/KRA/URA; mmiliki anakubali kuwasilisha.',
  },
  // capital_works_proposal — always T0.
  {
    category: 'capital_works_proposal',
    tier: 'T0',
    description: 'Major capital works always require the owner\'s explicit consent.',
    descriptionSw: 'Kazi kubwa za mtaji kila wakati zinahitaji ridhaa ya mmiliki.',
  },
]);

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
  // GET /delegation-matrix — return the 12-category × T0-T3 matrix.
  //
  // Tenant-agnostic by default; future commit can read a per-tenant
  // override from a settings table without breaking this contract.
  // -------------------------------------------------------------------------
  app.get('/delegation-matrix', async (c: any) => {
    const auth = c.get('auth') ?? {};
    const { tenantId } = auth as { tenantId?: string };
    if (!tenantId) {
      const err = jsonError('UNAUTHORIZED', 'Authentication required', 401);
      return c.json(err.body, err.status);
    }
    return c.json(
      {
        success: true as const,
        data: DEFAULT_MATRIX,
        meta: {
          categories: DELEGATION_CATEGORIES.length,
          tiers: ['T0', 'T1', 'T2', 'T3'] as const,
          total: DEFAULT_MATRIX.length,
        },
      },
      200,
    );
  });

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
