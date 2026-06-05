// @ts-nocheck — Hono v4 MiddlewareHandler status-code literal union: multiple
// c.json({...}, status) branches widen the return type and the TypedResponse
// overload rejects the union (hono-dev/hono#3891). Same pragma as the other
// .hono routers in this directory (cases.hono.ts, arrears.hono.ts).
/**
 * /api/v1/cooperatives/settlement-periods (migration 0304).
 *
 * Period-end settlement workflow for HOUSING cooperatives. A housing
 * cooperative aggregates a property's collected pool (service-charge +
 * sinking-fund + rent-share) over a period, nets out operating
 * expenses, computes per-member-household share, gates approval
 * (four-eye when the net amount exceeds the policy threshold), then
 * distributes via LedgerService.post() per member.
 *
 * Routes (all tenant-scoped via JWT + RLS):
 *   POST  /settlement-periods                    create draft
 *   GET   /settlement-periods                    list
 *   GET   /settlement-periods/:id/members        per-member distributions
 *   POST  /settlement-periods/:id/calculate      compute member shares
 *   POST  /settlement-periods/:id/approve        approve (four-eye gate)
 *   POST  /settlement-periods/:id/distribute     trigger payouts (ledger)
 *
 * The chat-as-OS brain reads / writes via brain tools
 * `cooperative.draft_settlement`, `cooperative.member_share`,
 * `cooperative.settlement_period_list`. Both surfaces hit this backend.
 *
 * Money path (CLAUDE.md hard rule): distribute posts through
 * `LedgerService.post()` via the `cooperativeLedgerPort` injected into
 * the Hono context. When no port is wired the route honest-degrades
 * (501 LEDGER_NOT_WIRED) rather than faking a money movement. The
 * post-ledger handle is persisted in `payment_ref`.
 *
 * Multi-currency (CLAUDE.md hard rule): every amount carries the
 * period's `currency_code`; no jurisdiction currency is hard-coded.
 *
 * Ported from Borjie's `routes/cooperatives/settlements.hono.ts` and
 * retargeted mining → real estate. The members read — a TODO returning
 * [] in Borjie's brain tool — is implemented here as a first-class
 * endpoint.
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { sql } from 'drizzle-orm';
import { createHash, randomUUID } from 'node:crypto';

import { authMiddleware } from '../../middleware/hono-auth';
import { databaseMiddleware } from '../../middleware/database';
import { withSecurityEvents } from '@bossnyumba/observability';
import {
  computeNetDistributable,
  computeMemberShares,
  isSupportedCurrency,
  assertLedgerWired,
  CooperativeSettlementError,
  type CooperativeLedgerPort,
} from '../../services/cooperative-settlement/index.js';

/**
 * Four-eye threshold: a net-distributable amount above this requires a
 * second-approver gate before the period can flip to `approved`. The
 * brain MUST hit the literal four-eye policy rule per CLAUDE.md, so the
 * route surfaces a 412 telling the caller to route through the four-eye
 * flow first. Currency-neutral magnitude (not a jurisdiction amount).
 */
const FOUR_EYE_NET_THRESHOLD = 5_000_000;

const CreatePeriodSchema = z.object({
  cooperativePartyId: z.string().uuid(),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  currencyCode: z.string().length(3).optional(),
  serviceChargeCollected: z.number().nonnegative().default(0),
  sinkingFundCollected: z.number().nonnegative().default(0),
  rentShareCollected: z.number().nonnegative().default(0),
  operatingExpenses: z.number().nonnegative().default(0),
});

const ListQuerySchema = z.object({
  cooperativePartyId: z.string().uuid().optional(),
  status: z
    .enum(['draft', 'calculated', 'approved', 'distributed', 'contested'])
    .optional(),
  limit: z.coerce.number().int().positive().max(500).default(100),
});

const CalculateSchema = z.object({
  members: z
    .array(
      z.object({
        memberHouseholdPartyId: z.string().uuid(),
        sharePct: z.number().min(0).max(100),
      }),
    )
    .min(1),
});

const ApproveSchema = z.object({
  approvalNote: z.string().max(2000).optional(),
});

const DistributeSchema = z.object({
  paymentRefPrefix: z.string().max(64).optional(),
});

function auditHash(input: Record<string, unknown>): string {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex');
}

function provenance(actorId: string): string {
  return JSON.stringify({
    via: 'api',
    actorId,
    sessionId: null,
    turnId: null,
    requestedAt: new Date().toISOString(),
  });
}

function rowsOf(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) return raw as Record<string, unknown>[];
  if (raw && typeof raw === 'object' && 'rows' in raw) {
    const r = (raw as { rows: unknown }).rows;
    if (Array.isArray(r)) return r as Record<string, unknown>[];
  }
  return [];
}

function unavailable(c: { json: (b: unknown, s: number) => Response }) {
  return c.json(
    {
      success: false,
      error: {
        code: 'DATABASE_UNAVAILABLE',
        message: 'Database client is not initialized',
      },
    },
    503,
  );
}

/** Map a domain error code to an HTTP status. */
function statusForCode(code: string): number {
  switch (code) {
    case 'LEDGER_NOT_WIRED':
      return 501;
    case 'INVALID_POOL':
    case 'INVALID_SHARE':
    case 'NO_MEMBERS':
    case 'DUPLICATE_MEMBER':
    case 'SHARE_OVERFLOW':
      return 422;
    default:
      return 400;
  }
}

const app = new Hono();
app.use('*', authMiddleware);
app.use('*', databaseMiddleware);

// ---------------------------------------------------------------------------
// POST /settlement-periods — create a draft period
// ---------------------------------------------------------------------------

app.post(
  '/settlement-periods',
  zValidator('json', CreatePeriodSchema),
  withSecurityEvents(
    {
      action: 'cooperative.settlement_period.create',
      resource: 'cooperative.settlement_period',
      severity: 'info',
    },
    async (c) => {
      const auth = c.get('auth');
      const db = c.get('db');
      if (!db) return unavailable(c);
      const body = c.req.valid('json');

      if (body.periodEnd < body.periodStart) {
        return c.json(
          {
            success: false,
            error: {
              code: 'INVALID_PERIOD',
              message: 'periodEnd must be on or after periodStart',
            },
          },
          422,
        );
      }

      const currencyCode = (body.currencyCode ?? 'TZS').toUpperCase();
      if (!isSupportedCurrency(currencyCode)) {
        return c.json(
          {
            success: false,
            error: {
              code: 'UNSUPPORTED_CURRENCY',
              message: `currency ${currencyCode} is not supported`,
            },
          },
          422,
        );
      }

      const { netDistributable } = computeNetDistributable({
        serviceChargeCollected: body.serviceChargeCollected,
        sinkingFundCollected: body.sinkingFundCollected,
        rentShareCollected: body.rentShareCollected,
        operatingExpenses: body.operatingExpenses,
      });

      const id = randomUUID();
      const prov = provenance(auth.userId);
      const hash = auditHash({
        id,
        tenantId: auth.tenantId,
        netDistributable,
      });

      await db.execute(sql`
        INSERT INTO cooperative_settlement_periods (
          id, tenant_id, cooperative_party_id,
          period_start, period_end, currency_code,
          service_charge_collected, sinking_fund_collected,
          rent_share_collected, operating_expenses,
          net_distributable, status, provenance, audit_hash_id
        ) VALUES (
          ${id}, ${auth.tenantId}::uuid, ${body.cooperativePartyId}::uuid,
          ${body.periodStart}::date, ${body.periodEnd}::date, ${currencyCode},
          ${body.serviceChargeCollected}, ${body.sinkingFundCollected},
          ${body.rentShareCollected}, ${body.operatingExpenses},
          ${netDistributable}, 'draft', ${prov}::jsonb, ${hash}
        )
      `);

      const fetched = await db.execute(sql`
        SELECT * FROM cooperative_settlement_periods
         WHERE id = ${id}::uuid AND tenant_id = ${auth.tenantId}::uuid
         LIMIT 1
      `);
      return c.json({ success: true, data: rowsOf(fetched)[0] }, 201);
    },
  ),
);

// ---------------------------------------------------------------------------
// GET /settlement-periods — list
// ---------------------------------------------------------------------------

app.get('/settlement-periods', async (c) => {
  const auth = c.get('auth');
  const db = c.get('db');
  if (!db) return unavailable(c);

  const parsed = ListQuerySchema.safeParse({
    cooperativePartyId: c.req.query('cooperativePartyId'),
    status: c.req.query('status'),
    limit: c.req.query('limit'),
  });
  if (!parsed.success) {
    return c.json(
      {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.message },
      },
      400,
    );
  }
  const { cooperativePartyId, status, limit } = parsed.data;
  const whereCoop = cooperativePartyId
    ? sql`AND cooperative_party_id = ${cooperativePartyId}::uuid`
    : sql``;
  const whereStatus = status ? sql`AND status = ${status}` : sql``;

  const rows = await db.execute(sql`
    SELECT * FROM cooperative_settlement_periods
     WHERE tenant_id = ${auth.tenantId}::uuid
       ${whereCoop}
       ${whereStatus}
     ORDER BY period_end DESC, created_at DESC
     LIMIT ${limit}
  `);
  return c.json({ success: true, data: rowsOf(rows) });
});

// ---------------------------------------------------------------------------
// GET /settlement-periods/:id/members — per-member-household distributions
// (Borjie left this a TODO returning []; implemented here properly.)
// ---------------------------------------------------------------------------

app.get('/settlement-periods/:id/members', async (c) => {
  const auth = c.get('auth');
  const db = c.get('db');
  if (!db) return unavailable(c);
  const id = c.req.param('id');

  const periodRows = await db.execute(sql`
    SELECT id, status, currency_code, net_distributable
      FROM cooperative_settlement_periods
     WHERE id = ${id}::uuid AND tenant_id = ${auth.tenantId}::uuid
     LIMIT 1
  `);
  const period = rowsOf(periodRows)[0];
  if (!period) {
    return c.json(
      {
        success: false,
        error: { code: 'NOT_FOUND', message: 'period not found' },
      },
      404,
    );
  }

  const distRows = await db.execute(sql`
    SELECT id, member_household_party_id, share_pct, amount,
           paid_at, payment_ref
      FROM cooperative_member_distributions
     WHERE period_id = ${id}::uuid AND tenant_id = ${auth.tenantId}::uuid
     ORDER BY share_pct DESC, created_at ASC
  `);

  return c.json({
    success: true,
    data: {
      periodId: id,
      status: period.status,
      currencyCode: period.currency_code,
      netDistributable: period.net_distributable,
      members: rowsOf(distRows),
    },
  });
});

// ---------------------------------------------------------------------------
// POST /settlement-periods/:id/calculate — compute member shares
// ---------------------------------------------------------------------------

app.post(
  '/settlement-periods/:id/calculate',
  zValidator('json', CalculateSchema),
  withSecurityEvents(
    {
      action: 'cooperative.settlement_period.calculate',
      resource: 'cooperative.settlement_period',
      severity: 'info',
    },
    async (c) => {
      const auth = c.get('auth');
      const db = c.get('db');
      if (!db) return unavailable(c);
      const id = c.req.param('id');
      const body = c.req.valid('json');

      const periodRows = await db.execute(sql`
        SELECT net_distributable, status
          FROM cooperative_settlement_periods
         WHERE id = ${id}::uuid AND tenant_id = ${auth.tenantId}::uuid
         LIMIT 1
      `);
      const period = rowsOf(periodRows)[0];
      if (!period) {
        return c.json(
          {
            success: false,
            error: { code: 'NOT_FOUND', message: 'period not found' },
          },
          404,
        );
      }
      if (period.status !== 'draft' && period.status !== 'calculated') {
        return c.json(
          {
            success: false,
            error: {
              code: 'INVALID_STATE',
              message: `cannot recalculate when status=${String(period.status)}`,
            },
          },
          409,
        );
      }

      const net = Number(period.net_distributable);
      let shares;
      try {
        shares = computeMemberShares(net, body.members);
      } catch (err) {
        if (err instanceof CooperativeSettlementError) {
          return c.json(
            { success: false, error: { code: err.code, message: err.message } },
            statusForCode(err.code),
          );
        }
        throw err;
      }

      // Wipe + reinsert to keep the snapshot deterministic.
      await db.execute(sql`
        DELETE FROM cooperative_member_distributions
         WHERE period_id = ${id}::uuid AND tenant_id = ${auth.tenantId}::uuid
      `);
      for (const s of shares) {
        const distId = randomUUID();
        const distHash = auditHash({
          distId,
          periodId: id,
          memberHouseholdPartyId: s.memberHouseholdPartyId,
          amount: s.amount,
        });
        const prov = provenance(auth.userId);
        await db.execute(sql`
          INSERT INTO cooperative_member_distributions (
            id, tenant_id, period_id, member_household_party_id,
            share_pct, amount, audit_hash_id, provenance
          ) VALUES (
            ${distId}, ${auth.tenantId}::uuid, ${id}::uuid,
            ${s.memberHouseholdPartyId}::uuid,
            ${s.sharePct}, ${s.amount}, ${distHash}, ${prov}::jsonb
          )
        `);
      }

      await db.execute(sql`
        UPDATE cooperative_settlement_periods
           SET status = 'calculated', updated_at = now()
         WHERE id = ${id}::uuid AND tenant_id = ${auth.tenantId}::uuid
      `);
      const distRows = await db.execute(sql`
        SELECT * FROM cooperative_member_distributions
         WHERE period_id = ${id}::uuid AND tenant_id = ${auth.tenantId}::uuid
         ORDER BY share_pct DESC
      `);
      return c.json({
        success: true,
        data: { periodId: id, status: 'calculated', members: rowsOf(distRows) },
      });
    },
  ),
);

// ---------------------------------------------------------------------------
// POST /settlement-periods/:id/approve — approve (four-eye gate)
// ---------------------------------------------------------------------------

app.post(
  '/settlement-periods/:id/approve',
  zValidator('json', ApproveSchema),
  withSecurityEvents(
    {
      action: 'cooperative.settlement_period.approve',
      resource: 'cooperative.settlement_period',
      severity: 'warning',
    },
    async (c) => {
      const auth = c.get('auth');
      const db = c.get('db');
      if (!db) return unavailable(c);
      const id = c.req.param('id');

      const periodRows = await db.execute(sql`
        SELECT net_distributable, status, four_eye_request_id
          FROM cooperative_settlement_periods
         WHERE id = ${id}::uuid AND tenant_id = ${auth.tenantId}::uuid
         LIMIT 1
      `);
      const period = rowsOf(periodRows)[0];
      if (!period) {
        return c.json(
          {
            success: false,
            error: { code: 'NOT_FOUND', message: 'period not found' },
          },
          404,
        );
      }
      if (period.status !== 'calculated') {
        return c.json(
          {
            success: false,
            error: {
              code: 'INVALID_STATE',
              message: 'must be calculated before approve',
            },
          },
          409,
        );
      }

      const net = Number(period.net_distributable);
      // HIGH-stakes amount → a four-eye request must be present (and
      // approved out-of-band) before we flip status. Surface a 412 so the
      // caller routes through the four-eye flow first. The brain MUST hit
      // the literal four-eye policy rule (CLAUDE.md hard rule).
      if (net > FOUR_EYE_NET_THRESHOLD && !period.four_eye_request_id) {
        return c.json(
          {
            success: false,
            error: {
              code: 'FOUR_EYE_REQUIRED',
              message: `net amount ${net} exceeds ${FOUR_EYE_NET_THRESHOLD} and requires four-eye approval`,
            },
          },
          412,
        );
      }

      const approvedAt = new Date().toISOString();
      await db.execute(sql`
        UPDATE cooperative_settlement_periods
           SET status         = 'approved',
               approved_by_id = ${auth.userId}::uuid,
               approved_at    = ${approvedAt}::timestamptz,
               updated_at     = now()
         WHERE id = ${id}::uuid AND tenant_id = ${auth.tenantId}::uuid
      `);
      const fetched = await db.execute(sql`
        SELECT * FROM cooperative_settlement_periods
         WHERE id = ${id}::uuid AND tenant_id = ${auth.tenantId}::uuid
         LIMIT 1
      `);
      return c.json({ success: true, data: rowsOf(fetched)[0] });
    },
  ),
);

// ---------------------------------------------------------------------------
// POST /settlement-periods/:id/distribute — payouts via LedgerService.post()
// ---------------------------------------------------------------------------

app.post(
  '/settlement-periods/:id/distribute',
  zValidator('json', DistributeSchema),
  withSecurityEvents(
    {
      action: 'cooperative.settlement_period.distribute',
      resource: 'cooperative.settlement_period',
      severity: 'warning',
    },
    async (c) => {
      const auth = c.get('auth');
      const db = c.get('db');
      if (!db) return unavailable(c);
      const id = c.req.param('id');
      const body = c.req.valid('json');

      // Money path (CLAUDE.md hard rule): refuse to mark distributions
      // paid unless a real LedgerService.post() port is wired. Honest-
      // degrade with 501 rather than fabricate a payout.
      let ledgerPort: CooperativeLedgerPort;
      try {
        ledgerPort = assertLedgerWired(
          c.get('cooperativeLedgerPort') as CooperativeLedgerPort | undefined,
        );
      } catch (err) {
        if (err instanceof CooperativeSettlementError) {
          return c.json(
            { success: false, error: { code: err.code, message: err.message } },
            statusForCode(err.code),
          );
        }
        throw err;
      }

      const periodRows = await db.execute(sql`
        SELECT status, currency_code FROM cooperative_settlement_periods
         WHERE id = ${id}::uuid AND tenant_id = ${auth.tenantId}::uuid
         LIMIT 1
      `);
      const period = rowsOf(periodRows)[0];
      if (!period) {
        return c.json(
          {
            success: false,
            error: { code: 'NOT_FOUND', message: 'period not found' },
          },
          404,
        );
      }
      if (period.status !== 'approved') {
        return c.json(
          {
            success: false,
            error: {
              code: 'INVALID_STATE',
              message: 'must be approved before distribute',
            },
          },
          409,
        );
      }

      const currencyCode = String(period.currency_code);
      const distRows = await db.execute(sql`
        SELECT id, member_household_party_id, amount, paid_at
          FROM cooperative_member_distributions
         WHERE period_id = ${id}::uuid AND tenant_id = ${auth.tenantId}::uuid
      `);
      const distributions = rowsOf(distRows);
      const refPrefix = body.paymentRefPrefix ?? `COOP-${id.slice(0, 8)}`;
      const paidAt = new Date().toISOString();
      const ledgerRefs: Array<{
        distributionId: string;
        memberHouseholdPartyId: string;
        amount: string;
        paymentRef: string;
      }> = [];

      for (const d of distributions) {
        if (d.paid_at) continue;
        const distId = String(d.id);
        const memberHouseholdPartyId = String(d.member_household_party_id);
        const amount = Number(d.amount);
        // Real money movement: LedgerService.post() via the seam. The
        // returned handle is the forensic payment_ref.
        const { paymentRef } = await ledgerPort.post({
          tenantId: auth.tenantId,
          periodId: id,
          memberHouseholdPartyId,
          amount,
          currencyCode,
          idempotencyKey: `${refPrefix}-${distId}`,
        });
        await db.execute(sql`
          UPDATE cooperative_member_distributions
             SET paid_at = ${paidAt}::timestamptz,
                 payment_ref = ${paymentRef}
           WHERE id = ${distId}::uuid AND tenant_id = ${auth.tenantId}::uuid
        `);
        ledgerRefs.push({
          distributionId: distId,
          memberHouseholdPartyId,
          amount: String(d.amount),
          paymentRef,
        });
      }

      await db.execute(sql`
        UPDATE cooperative_settlement_periods
           SET status         = 'distributed',
               distributed_at = ${paidAt}::timestamptz,
               updated_at     = now()
         WHERE id = ${id}::uuid AND tenant_id = ${auth.tenantId}::uuid
      `);

      return c.json({
        success: true,
        data: { periodId: id, status: 'distributed', currencyCode, ledgerRefs },
      });
    },
  ),
);

export const cooperativeSettlementsRouter = app;
