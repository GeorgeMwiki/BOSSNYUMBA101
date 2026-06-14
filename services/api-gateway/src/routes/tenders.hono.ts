/**
 * Tenders API (NEW 11 — Tenders + Bids).
 *
 *   POST /v1/tenders
 *   GET  /v1/tenders/:id
 *   POST /v1/tenders/:id/bids
 *   GET  /v1/tenders/:id/bids
 *   POST /v1/tenders/:id/award
 *   POST /v1/tenders/:id/cancel
 *   POST /v1/bids/:id/counter   (triggers AI negotiation)
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { sql } from 'drizzle-orm';
import { authMiddleware } from '../middleware/hono-auth';
import { databaseMiddleware } from '../middleware/database';

import { withSecurityEvents } from '@bossnyumba/observability';
const PublishTenderSchema = z
  .object({
    scope: z.string().min(1).max(2000),
    details: z.string().max(4000).optional(),
    budgetRangeMin: z.number().int().positive(),
    budgetRangeMax: z.number().int().positive(),
    // Client resolves currency from tenant region-config; no KES fallback.
    currency: z.string().min(3).max(8),
    visibility: z.enum(['public', 'invite_only']).default('public'),
    invitedVendorIds: z.array(z.string()).max(100).optional(),
    workOrderId: z.string().optional(),
    aiNegotiatorEnabled: z.boolean().default(true),
    negotiationPolicyId: z.string().optional(),
    closesAt: z.string().datetime(),
  })
  .refine((v) => v.budgetRangeMin <= v.budgetRangeMax, {
    message: 'budgetRangeMin must be <= budgetRangeMax',
  });

const SubmitBidSchema = z.object({
  // Optional: the applicant flow (tenant-mobile) omits vendorId and the
  // gateway resolves it from the JWT (`auth.userId`) so a bidder can never
  // impersonate another principal. The vendor-tender flow still passes it.
  vendorId: z.string().min(1).optional(),
  price: z.number().int().positive(),
  currency: z.string().max(8).optional(),
  // Optional for the rental-application flow (no vendor timeline); defaults to
  // 1 day when omitted so the bids.timeline_days NOT NULL column is satisfied.
  timelineDays: z.number().int().positive().optional(),
  paymentTerms: z.enum(['instant', '30d', '60d']).optional(),
  notes: z.string().max(4000).optional(),
  attachments: z.array(z.unknown()).max(20).optional(),
});

const AwardSchema = z.object({
  bidId: z.string().min(1),
  reason: z.string().max(1000).optional(),
});

const CancelSchema = z.object({
  reason: z.string().min(1).max(1000),
});

const CounterBidSchema = z.object({
  offer: z.number().int().positive(),
  rationale: z.string().max(2000).optional(),
});

// Tenant bid loop (#8) — applicant-facing message + transition schemas.
const BidMessageSchema = z.object({
  body: z.string().min(1).max(4000),
});

const TenderBidParamSchema = z.object({
  id: z.string().min(1),
  bidId: z.string().min(1),
});

const app = new Hono();
app.use('*', authMiddleware);
app.use('*', databaseMiddleware);

function tenderService(c: any) {
  const services = c.get('services') ?? {};
  return services.marketplace?.tender;
}
function negotiationService(c: any) {
  const services = c.get('services') ?? {};
  return services.negotiation;
}
function notImplemented(c: any, what: string) {
  return c.json(
    {
      success: false,
      error: {
        code: 'NOT_IMPLEMENTED',
        message: `${what} service not wired into api-gateway context`,
      },
    },
    503
  );
}

// ---------------------------------------------------------------------------
// Tenant bid loop (#8) — direct-DB helpers.
//
// The applicant-facing bid loop reads/writes the `bids` + `bid_messages`
// tables directly through the tenant-bound (RLS-active) drizzle handle on the
// context. There is no bid-messages repository, so these handlers use
// `db.execute(sql\`...\`)` — the same idiom as owner/mwikila-inbox.hono.ts.
//
// APPLICANT IDENTITY: a bid's owner (the applicant) is `bids.vendor_id`, which
// the tenant-mobile flow sets to the authenticated `auth.userId`. "My bids" and
// every applicant-scoped read/transition therefore filter on
// `vendor_id = auth.userId`. RLS already isolates the tenant; this filter adds
// the per-applicant uniform-404 anti-IDOR guard so one applicant can never see
// or mutate another applicant's bid within the same tenant.
// ---------------------------------------------------------------------------

function db(c: any) {
  return c.get('db');
}

function dbUnavailable(c: any) {
  return c.json(
    {
      success: false,
      error: {
        code: 'LIVE_DATA_NOT_CONFIGURED',
        message: 'A live database connection is required for this endpoint.',
      },
    },
    503
  );
}

/** Shape a `bids` row into the API bid view (camelCase). */
function toBidView(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    tenderId: String(row.tender_id),
    vendorId: String(row.vendor_id),
    price: Number(row.price),
    currency: String(row.currency),
    timelineDays: row.timeline_days == null ? null : Number(row.timeline_days),
    notes: row.notes == null ? null : String(row.notes),
    status: String(row.status),
    submittedAt:
      row.submitted_at instanceof Date
        ? row.submitted_at.toISOString()
        : row.submitted_at == null
          ? null
          : String(row.submitted_at),
    awardedAt:
      row.awarded_at instanceof Date
        ? row.awarded_at.toISOString()
        : row.awarded_at == null
          ? null
          : String(row.awarded_at),
  };
}

/** Shape a `bid_messages` row into the API message view. */
function toMessageView(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    bidId: String(row.bid_id),
    sender: String(row.sender),
    body: String(row.body),
    sentAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
  };
}

function rowsOf(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) return result as Record<string, unknown>[];
  const maybe = (result as { rows?: unknown[] })?.rows;
  return Array.isArray(maybe) ? (maybe as Record<string, unknown>[]) : [];
}

/**
 * Resolve a bid that BELONGS to the authenticated applicant on a given tender,
 * or null. The (tender_id, bid_id, vendor_id=userId) triple is the anti-IDOR
 * guard: a wrong applicant — or a bid on a different tender — resolves to null
 * and the caller returns a uniform 404 (never 403, which would confirm
 * existence).
 */
async function findApplicantBid(
  c: any,
  tenderId: string,
  bidId: string,
  applicantUserId: string
): Promise<Record<string, unknown> | null> {
  const handle = db(c);
  const result = await handle.execute(sql`
    SELECT id, tender_id, vendor_id, price, currency, timeline_days,
           notes, status, submitted_at, awarded_at
      FROM bids
     WHERE id = ${bidId}
       AND tender_id = ${tenderId}
       AND vendor_id = ${applicantUserId}
     LIMIT 1
  `);
  return rowsOf(result)[0] ?? null;
}

function uniformNotFound(c: any) {
  return c.json(
    { success: false, error: { code: 'NOT_FOUND', message: 'Bid not found' } },
    404
  );
}

app.post('/', zValidator('json', PublishTenderSchema), withSecurityEvents({ action: 'tender.create', resource: 'tender', severity: 'info' }, async (c) => {
  const auth = c.get('auth');
  const body = c.req.valid('json');
  const svc = tenderService(c);
  if (!svc) return notImplemented(c, 'Tender');
  const correlationId = c.req.header('x-correlation-id') ?? `corr_${Date.now()}`;
  const result = await svc.publish(
    auth.tenantId,
    body,
    auth.userId,
    correlationId
  );
  if (!result.ok)
    return c.json(
      { success: false, error: { code: result.error.code, message: result.error.message } },
      400
    );
  return c.json({ success: true, data: result.value }, 201);
}));

// ---------------------------------------------------------------------------
// GET /bids/mine — the applicant's own bids ("My Bids") across all tenders.
//
// Registered BEFORE the parameterized `/:id` route so the literal two-segment
// path is unambiguous. Resolves the applicant from the JWT (`auth.userId` →
// bids.vendor_id); RLS already scopes to the tenant. Read-only, applicant-
// scoped — no other applicant's bids are ever returned.
// ---------------------------------------------------------------------------
app.get('/bids/mine', async (c) => {
  const auth = c.get('auth');
  const applicantUserId = auth?.userId;
  if (!applicantUserId)
    return c.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      401
    );
  const handle = db(c);
  if (!handle) return dbUnavailable(c);
  const result = await handle.execute(sql`
    SELECT id, tender_id, vendor_id, price, currency, timeline_days,
           notes, status, submitted_at, awarded_at
      FROM bids
     WHERE vendor_id = ${applicantUserId}
     ORDER BY submitted_at DESC
  `);
  const data = rowsOf(result).map(toBidView);
  return c.json({ success: true, data });
});

app.get('/:id', async (c) => {
  const auth = c.get('auth');
  const svc = tenderService(c);
  if (!svc) return notImplemented(c, 'Tender');
  const tender = await svc.findTender(auth.tenantId, c.req.param('id'));
  if (!tender)
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Tender not found' } },
      404
    );
  return c.json({ success: true, data: tender });
});

app.post('/:id/bids', zValidator('json', SubmitBidSchema), withSecurityEvents({ action: 'tender.create', resource: 'tender', severity: 'info' }, async (c) => {
  const auth = c.get('auth');
  const body = c.req.valid('json');
  const svc = tenderService(c);
  if (!svc) return notImplemented(c, 'Tender');
  const correlationId = c.req.header('x-correlation-id') ?? `corr_${Date.now()}`;
  // Applicant identity is canonical from the JWT. When the client supplies a
  // vendorId we honour it (vendor-tender flow); otherwise the bidder IS the
  // authenticated user (rental-application / tenant-mobile flow). timelineDays
  // defaults to 1 for the application flow (no vendor timeline). paymentTerms
  // (application flow) is folded into the bid notes so it is not lost.
  const vendorId = body.vendorId ?? auth.userId;
  const timelineDays = body.timelineDays ?? 1;
  const notes =
    body.paymentTerms && !body.notes
      ? `paymentTerms=${body.paymentTerms}`
      : body.notes;
  const result = await svc.bid(
    auth.tenantId,
    {
      vendorId,
      price: body.price,
      currency: body.currency,
      timelineDays,
      notes,
      attachments: body.attachments,
      tenderId: c.req.param('id'),
    },
    correlationId
  );
  if (!result.ok) {
    const status =
      result.error.code === 'NOT_FOUND'
        ? 404
        : result.error.code === 'TENDER_CLOSED'
          ? 409
          : 400;
    return c.json(
      { success: false, error: { code: result.error.code, message: result.error.message } },
      status
    );
  }
  return c.json({ success: true, data: result.value }, 201);
}));

app.get('/:id/bids', async (c) => {
  const auth = c.get('auth');
  const svc = tenderService(c);
  if (!svc) return notImplemented(c, 'Tender');
  const bids = await svc.listBids(auth.tenantId, c.req.param('id'));
  return c.json({ success: true, data: bids });
});

// ---------------------------------------------------------------------------
// Tenant bid loop (#8) — per-bid message thread + applicant status transitions.
// All four routes resolve the bid via `findApplicantBid` (tender_id + bid_id +
// vendor_id=userId) and return a uniform 404 when the bid is not the
// authenticated applicant's — anti-IDOR. RLS isolates the tenant; this adds the
// per-applicant guard.
// ---------------------------------------------------------------------------

// GET /:id/bids/:bidId/messages — list the bid's thread (oldest-first).
app.get(
  '/:id/bids/:bidId/messages',
  zValidator('param', TenderBidParamSchema),
  async (c) => {
    const auth = c.get('auth');
    const applicantUserId = auth?.userId;
    if (!applicantUserId)
      return c.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        401
      );
    const handle = db(c);
    if (!handle) return dbUnavailable(c);
    const { id: tenderId, bidId } = c.req.valid('param');

    const bid = await findApplicantBid(c, tenderId, bidId, applicantUserId);
    if (!bid) return uniformNotFound(c);

    const result = await handle.execute(sql`
      SELECT id, bid_id, sender, body, created_at
        FROM bid_messages
       WHERE bid_id = ${bidId}
       ORDER BY created_at ASC
    `);
    const data = rowsOf(result).map(toMessageView);
    return c.json({ success: true, data });
  }
);

// POST /:id/bids/:bidId/messages — append a message from the applicant.
app.post(
  '/:id/bids/:bidId/messages',
  zValidator('param', TenderBidParamSchema),
  zValidator('json', BidMessageSchema),
  withSecurityEvents(
    { action: 'tender.create', resource: 'tender', severity: 'info' },
    async (c) => {
      const auth = c.get('auth');
      const applicantUserId = auth?.userId;
      const tenantId = auth?.tenantId;
      if (!applicantUserId || !tenantId)
        return c.json(
          { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
          401
        );
      const handle = db(c);
      if (!handle) return dbUnavailable(c);
      const { id: tenderId, bidId } = c.req.valid('param');
      const { body } = c.req.valid('json');

      const bid = await findApplicantBid(c, tenderId, bidId, applicantUserId);
      if (!bid) return uniformNotFound(c);

      const result = await handle.execute(sql`
        INSERT INTO bid_messages (
          tenant_id, bid_id, tender_id, sender, sender_user_id, body
        ) VALUES (
          ${tenantId}, ${bidId}, ${tenderId}, 'applicant', ${applicantUserId}, ${body}
        )
        RETURNING id, bid_id, sender, body, created_at
      `);
      const saved = rowsOf(result)[0];
      if (!saved)
        return c.json(
          {
            success: false,
            error: { code: 'BID_MESSAGE_WRITE_FAILED', message: 'message insert returned no row' },
          },
          500
        );
      return c.json({ success: true, data: toMessageView(saved) }, 201);
    }
  )
);

// POST /:id/bids/:bidId/accept — applicant accepts (e.g. an owner counter),
// transitioning the bid to `awarded`. Compare-and-set: only a bid currently in
// `submitted` or `negotiating` may be accepted; the UPDATE's WHERE clause is
// the guard, so a concurrent transition cannot double-apply.
app.post(
  '/:id/bids/:bidId/accept',
  zValidator('param', TenderBidParamSchema),
  withSecurityEvents(
    { action: 'tender.create', resource: 'tender', severity: 'info' },
    async (c) => {
      const auth = c.get('auth');
      const applicantUserId = auth?.userId;
      if (!applicantUserId)
        return c.json(
          { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
          401
        );
      const handle = db(c);
      if (!handle) return dbUnavailable(c);
      const { id: tenderId, bidId } = c.req.valid('param');

      const bid = await findApplicantBid(c, tenderId, bidId, applicantUserId);
      if (!bid) return uniformNotFound(c);

      const result = await handle.execute(sql`
        UPDATE bids
           SET status = 'awarded',
               awarded_at = now(),
               updated_at = now()
         WHERE id = ${bidId}
           AND tender_id = ${tenderId}
           AND vendor_id = ${applicantUserId}
           AND status IN ('submitted', 'negotiating')
        RETURNING id, tender_id, vendor_id, price, currency, timeline_days,
                  notes, status, submitted_at, awarded_at
      `);
      const updated = rowsOf(result)[0];
      if (!updated)
        return c.json(
          {
            success: false,
            error: {
              code: 'BID_NOT_TRANSITIONABLE',
              message: `Bid is ${String(bid.status)}; cannot accept`,
            },
          },
          409
        );
      return c.json({ success: true, data: toBidView(updated) });
    }
  )
);

// POST /:id/bids/:bidId/withdraw — applicant withdraws their own bid,
// transitioning to `withdrawn`. Same compare-and-set guard: only a live bid
// (`submitted`/`negotiating`) may be withdrawn.
app.post(
  '/:id/bids/:bidId/withdraw',
  zValidator('param', TenderBidParamSchema),
  withSecurityEvents(
    { action: 'tender.create', resource: 'tender', severity: 'info' },
    async (c) => {
      const auth = c.get('auth');
      const applicantUserId = auth?.userId;
      if (!applicantUserId)
        return c.json(
          { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
          401
        );
      const handle = db(c);
      if (!handle) return dbUnavailable(c);
      const { id: tenderId, bidId } = c.req.valid('param');

      const bid = await findApplicantBid(c, tenderId, bidId, applicantUserId);
      if (!bid) return uniformNotFound(c);

      const result = await handle.execute(sql`
        UPDATE bids
           SET status = 'withdrawn',
               updated_at = now()
         WHERE id = ${bidId}
           AND tender_id = ${tenderId}
           AND vendor_id = ${applicantUserId}
           AND status IN ('submitted', 'negotiating')
        RETURNING id, tender_id, vendor_id, price, currency, timeline_days,
                  notes, status, submitted_at, awarded_at
      `);
      const updated = rowsOf(result)[0];
      if (!updated)
        return c.json(
          {
            success: false,
            error: {
              code: 'BID_NOT_TRANSITIONABLE',
              message: `Bid is ${String(bid.status)}; cannot withdraw`,
            },
          },
          409
        );
      return c.json({ success: true, data: toBidView(updated) });
    }
  )
);

app.post('/:id/award', zValidator('json', AwardSchema), withSecurityEvents({ action: 'tender.create', resource: 'tender', severity: 'info' }, async (c) => {
  const auth = c.get('auth');
  const body = c.req.valid('json');
  const svc = tenderService(c);
  if (!svc) return notImplemented(c, 'Tender');
  const correlationId = c.req.header('x-correlation-id') ?? `corr_${Date.now()}`;
  const result = await svc.awardTender(
    auth.tenantId,
    {
      tenderId: c.req.param('id'),
      bidId: body.bidId,
      awardedBy: auth.userId,
      reason: body.reason,
    },
    correlationId
  );
  if (!result.ok)
    return c.json(
      { success: false, error: { code: result.error.code, message: result.error.message } },
      400
    );
  return c.json({ success: true, data: result.value });
}));

app.post('/:id/cancel', zValidator('json', CancelSchema), withSecurityEvents({ action: 'tender.create', resource: 'tender', severity: 'info' }, async (c) => {
  const auth = c.get('auth');
  const body = c.req.valid('json');
  const svc = tenderService(c);
  if (!svc) return notImplemented(c, 'Tender');
  const correlationId = c.req.header('x-correlation-id') ?? `corr_${Date.now()}`;
  const result = await svc.cancelTender(
    auth.tenantId,
    c.req.param('id'),
    body.reason,
    auth.userId,
    correlationId
  );
  if (!result.ok)
    return c.json(
      { success: false, error: { code: result.error.code, message: result.error.message } },
      400
    );
  return c.json({ success: true, data: result.value });
}));

// Note: /v1/bids/:id/counter is mounted as a separate router entry in the
// gateway; we expose the handler here for composition.
export const tendersRouter = app;

export function mountBidCounterRoute(bidsApp: Hono) {
  bidsApp.post(
    '/:id/counter',
    zValidator('json', CounterBidSchema),
    withSecurityEvents({ action: 'tender.create', resource: 'tender', severity: 'info' }, async (c) => {
      const auth = c.get('auth');
      const body = c.req.valid('json');
      const svc = negotiationService(c);
      if (!svc)
        return c.json(
          {
            success: false,
            error: {
              code: 'NOT_IMPLEMENTED',
              message: 'Negotiation service not wired in',
            },
          },
          503
        );
      const correlationId =
        c.req.header('x-correlation-id') ?? `corr_${Date.now()}`;
      // Counter-offer on a bid resolves to negotiation.submitCounter; the
      // negotiation linked to the bid must exist (created on first counter).
      const result = await svc.submitCounter(
        auth.tenantId,
        {
          negotiationId: c.req.param('id'),
          actor: 'owner',
          actorUserId: auth.userId,
          offer: body.offer,
          rationale: body.rationale,
        },
        correlationId
      );
      if (!result.ok)
        return c.json(
          {
            success: false,
            error: { code: result.error.code, message: result.error.message },
          },
          400
        );
      return c.json({ success: true, data: result.value });
    })
  );
  return bidsApp;
}
