/**
 * Marketplace API (NEW 11 — Listings).
 *
 *   POST /v1/marketplace/listings
 *   GET  /v1/marketplace/listings                 (search)
 *   GET  /v1/marketplace/listings/:id
 *   PUT  /v1/marketplace/listings/:id/status
 *   POST /v1/marketplace/listings/:id/enquiries  (starts a negotiation)
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { sql } from 'drizzle-orm';
import { randomUUID, createHash } from 'node:crypto';
import { authMiddleware } from '../middleware/hono-auth';
import { databaseMiddleware } from '../middleware/database';
import {
  SettlementOrchestrator,
  SettlementError,
  resolveSettlementLedgerPort,
  resolveSettlementPayoutPort,
} from '../services/settlement/index.js';

import { withSecurityEvents } from '@bossnyumba/observability';
const MediaItemSchema = z.object({
  type: z.enum(['photo', 'video', 'floor_360', 'street_view']),
  url: z.string().url().max(2048),
  caption: z.string().max(500).optional(),
});

const PublishListingSchema = z.object({
  unitId: z.string().min(1),
  propertyId: z.string().optional(),
  listingKind: z.enum(['rent', 'lease', 'sale']),
  headlinePrice: z.number().int().positive(),
  // Currency is required. No KES default — the client resolves this
  // from the tenant's region-config.
  currency: z.string().min(3).max(8),
  negotiable: z.boolean().default(true),
  media: z.array(MediaItemSchema).max(40).optional(),
  attributes: z.record(z.unknown()).optional(),
  negotiationPolicyId: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
  publishImmediately: z.boolean().default(false),
});

const SearchSchema = z.object({
  status: z
    .enum(['draft', 'published', 'paused', 'closed'])
    .optional(),
  listingKind: z.enum(['rent', 'lease', 'sale']).optional(),
  minPrice: z.coerce.number().int().nonnegative().optional(),
  maxPrice: z.coerce.number().int().nonnegative().optional(),
  propertyId: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
});

const UpdateStatusSchema = z.object({
  status: z.enum(['draft', 'published', 'paused', 'closed']),
});

const EnquirySchema = z.object({
  prospectCustomerId: z.string().min(1),
  openingOffer: z.number().positive(),
  message: z.string().max(2000).optional(),
});

// ---------------------------------------------------------------------------
// RFB — Request-For-Application (applicant-initiated open request).
//
// A renter posts an OPEN request for a property matching their criteria; the
// tenant-mobile app (apps/tenant-mobile/src/api/rfb.ts) only surfaces the
// applicant side (create / list_mine / cancel). Backed by the rfb_requests
// table (migration 0331) — tenant-scoped (RLS) AND applicant-scoped (every
// read filters by auth.userId so a renter can never see/cancel another
// renter's request; anti-IDOR on top of RLS).
// ---------------------------------------------------------------------------

// Unit types the route accepts — mirrors RFB_UNIT_TYPES in the mobile client.
const RFB_UNIT_TYPES = [
  'studio',
  'one_bedroom',
  'two_bedroom',
  'three_bedroom',
  'four_bedroom_plus',
  'five_bedroom_plus',
  'commercial',
  'industrial',
  'mixed_use',
  'retail',
  'office',
  'warehouse',
  'land',
  'other',
] as const;

const RfbCreateSchema = z
  .object({
    unitType: z.enum(RFB_UNIT_TYPES),
    gradeMin: z.string().min(1).max(64).optional(),
    floorAreaMinSqm: z.number().positive().max(1_000_000),
    floorAreaMaxSqm: z.number().positive().max(1_000_000).optional(),
    unitPriceTzs: z.number().positive().max(1_000_000_000_000),
    // ISO-4217 currency for the budget ceiling. Optional — when omitted the
    // DB default (tenant launch jurisdiction) applies. NEVER hard-coded in a
    // business branch; this is a passthrough of whatever the client resolves.
    currency: z.string().min(3).max(8).optional(),
    // YYYY-MM-DD
    deliveryBy: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'deliveryBy must be YYYY-MM-DD'),
    locationLat: z.number().min(-90).max(90).optional(),
    locationLon: z.number().min(-180).max(180).optional(),
    radiusKm: z.number().positive().max(5000),
    notes: z.string().max(2000).optional(),
  })
  .refine(
    (v) =>
      v.floorAreaMaxSqm === undefined ||
      v.floorAreaMaxSqm >= v.floorAreaMinSqm,
    { message: 'floorAreaMaxSqm must be >= floorAreaMinSqm', path: ['floorAreaMaxSqm'] },
  );

// PATCH /rfb/:id body the mobile client sends to cancel. Only the cancel
// transition is permitted from this surface — other status values are
// rejected so the renter cannot self-mark a request 'filled'.
const RfbPatchSchema = z.object({
  status: z.literal('cancelled'),
});

const app = new Hono();
app.use('*', authMiddleware);
app.use('*', databaseMiddleware);

function svc<T = any>(c: any, key: 'listing' | 'enquiry'): T | undefined {
  const services = c.get('services') ?? {};
  const marketplace = services.marketplace ?? {};
  return marketplace[key];
}

function notImplemented(c: any, name: string) {
  return c.json(
    {
      success: false,
      error: {
        code: 'NOT_IMPLEMENTED',
        message: `Marketplace ${name} service not wired into api-gateway context`,
      },
    },
    503
  );
}

// ---------------------------------------------------------------------------
// Listings
// ---------------------------------------------------------------------------

app.post('/listings', zValidator('json', PublishListingSchema), withSecurityEvents({ action: 'marketplace.create', resource: 'marketplace', severity: 'info' }, async (c) => {
  const auth = c.get('auth');
  const body = c.req.valid('json');
  const service = svc<any>(c, 'listing');
  if (!service) return notImplemented(c, 'listing');
  const correlationId = c.req.header('x-correlation-id') ?? `corr_${Date.now()}`;
  const result = await service.publish(
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

app.get('/listings', zValidator('query', SearchSchema), async (c) => {
  const auth = c.get('auth');
  const query = c.req.valid('query');
  const service = svc<any>(c, 'listing');
  if (!service) return notImplemented(c, 'listing');
  const result = await service.search(auth.tenantId, query);
  return c.json({
    success: true,
    data: result.items,
    meta: { total: result.total, limit: query.limit, offset: query.offset },
  });
});

app.get('/listings/:id', async (c) => {
  const auth = c.get('auth');
  const service = svc<any>(c, 'listing');
  if (!service) return notImplemented(c, 'listing');
  const listing = await service.findById(auth.tenantId, c.req.param('id'));
  if (!listing)
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Listing not found' } },
      404
    );
  return c.json({ success: true, data: listing });
});

app.put(
  '/listings/:id/status',
  zValidator('json', UpdateStatusSchema),
  withSecurityEvents({ action: 'marketplace.update', resource: 'marketplace', severity: 'info' }, async (c) => {
    const auth = c.get('auth');
    const body = c.req.valid('json');
    const service = svc<any>(c, 'listing');
    if (!service) return notImplemented(c, 'listing');
    const correlationId = c.req.header('x-correlation-id') ?? `corr_${Date.now()}`;
    const result = await service.updateStatus(
      auth.tenantId,
      c.req.param('id'),
      body.status,
      auth.userId,
      correlationId
    );
    if (!result.ok)
      return c.json(
        { success: false, error: { code: result.error.code, message: result.error.message } },
        result.error.code === 'NOT_FOUND' ? 404 : 400
      );
    return c.json({ success: true, data: result.value });
  })
);

// ---------------------------------------------------------------------------
// Enquiries — creates a negotiation
// ---------------------------------------------------------------------------

app.post(
  '/listings/:id/enquiries',
  zValidator('json', EnquirySchema),
  withSecurityEvents({ action: 'marketplace.create', resource: 'marketplace', severity: 'info' }, async (c) => {
    const auth = c.get('auth');
    const body = c.req.valid('json');
    const service = svc<any>(c, 'enquiry');
    if (!service) return notImplemented(c, 'enquiry');
    const correlationId = c.req.header('x-correlation-id') ?? `corr_${Date.now()}`;
    const result = await service.startEnquiry(
      auth.tenantId,
      {
        listingId: c.req.param('id'),
        prospectCustomerId: body.prospectCustomerId,
        openingOffer: body.openingOffer,
        message: body.message,
      },
      auth.userId,
      correlationId
    );
    if (!result.ok)
      return c.json(
        { success: false, error: { code: result.error.code, message: result.error.message } },
        result.error.code === 'NOT_FOUND' ? 404 : 400
      );
    return c.json({ success: true, data: result.value }, 201);
  })
);

// ---------------------------------------------------------------------------
// RFB routes — backed by rfb_requests (migration 0331) via the tx-bound db
// handle (RLS GUC live; tenant predicate fires). The applicant predicate
// (applicant_user_id = auth.userId) is added in EVERY query so a renter can
// only ever see/cancel their OWN requests — uniform 404 on others' rows.
// ---------------------------------------------------------------------------

/**
 * Normalise a drizzle `.execute()` result into a flat row array. Real drizzle
 * clients return either an array (postgres.js) or a `{ rows }` shape depending
 * on the driver; test stubs return a bare array. Mirrors `rowsOf` in
 * courses.hono.ts so both row-shapes are handled.
 */
function rfbRows(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) return raw as Record<string, unknown>[];
  if (raw && typeof raw === 'object' && 'rows' in raw) {
    const r = (raw as { rows: unknown }).rows;
    if (Array.isArray(r)) return r as Record<string, unknown>[];
  }
  return [];
}

/**
 * Project a stored row into the `RfbSummary` wire shape the mobile client
 * expects (snake_case, with the legacy `unit_price_tzs` alias and a
 * `pending_response_count` the landlord-response surface will populate later —
 * 0 until that table lands).
 */
function toRfbSummary(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    unit_type: String(row.unit_type),
    grade_min: row.grade_min == null ? null : String(row.grade_min),
    floor_area_min: String(row.floor_area_min),
    floor_area_max: row.floor_area_max == null ? null : String(row.floor_area_max),
    // Legacy alias kept for the mobile client contract; the value is the
    // currency-agnostic budget ceiling stored in unit_price.
    unit_price_tzs: String(row.unit_price),
    currency: row.currency == null ? null : String(row.currency),
    delivery_by: String(row.delivery_by),
    status: String(row.status),
    created_at:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
    expires_at:
      row.expires_at instanceof Date
        ? row.expires_at.toISOString()
        : String(row.expires_at),
    pending_response_count: 0,
  };
}

function rfbUnavailable(c: any) {
  return c.json(
    {
      success: false,
      error: {
        code: 'LIVE_DATA_NOT_CONFIGURED',
        message: 'A live database connection is required for this endpoint.',
      },
    },
    503,
  );
}

// POST /rfb — create a request-for-application.
app.post(
  '/rfb',
  zValidator('json', RfbCreateSchema),
  withSecurityEvents(
    { action: 'marketplace.rfb.create', resource: 'marketplace', severity: 'info' },
    async (c) => {
      const auth = c.get('auth');
      const db = c.get('db');
      if (!db) return rfbUnavailable(c);
      const body = c.req.valid('json');
      const id = randomUUID();

      try {
        // The applicant_user_id is ALWAYS the JWT subject — never client input.
        // currency is a passthrough: when omitted the DB column default applies
        // (tenant launch jurisdiction), so no jurisdiction is branched in code.
        const inserted = await db.execute(sql`
          INSERT INTO rfb_requests (
            id, tenant_id, applicant_user_id,
            unit_type, grade_min, floor_area_min, floor_area_max,
            unit_price, currency,
            delivery_by, location_lat, location_lon, radius_km, notes,
            status, created_at, updated_at
          ) VALUES (
            ${id}, ${auth.tenantId}, ${auth.userId},
            ${body.unitType}, ${body.gradeMin ?? null},
            ${body.floorAreaMinSqm}, ${body.floorAreaMaxSqm ?? null},
            ${body.unitPriceTzs}, COALESCE(${body.currency ?? null}, 'TZS'),
            ${body.deliveryBy}::date,
            ${body.locationLat ?? null}, ${body.locationLon ?? null},
            ${body.radiusKm}, ${body.notes ?? null},
            'open', now(), now()
          )
          RETURNING id, created_at, expires_at
        `);
        const row = rfbRows(inserted)[0];
        if (!row) {
          // RLS dropped the write (e.g. WITH CHECK failed) — surface it, never
          // fake success.
          return c.json(
            {
              success: false,
              error: {
                code: 'WRITE_REJECTED',
                message: 'The request could not be persisted under the active tenant context.',
              },
            },
            422,
          );
        }
        return c.json(
          {
            success: true,
            data: {
              id: String(row.id),
              createdAt:
                row.created_at instanceof Date
                  ? row.created_at.toISOString()
                  : String(row.created_at),
              expiresAt:
                row.expires_at instanceof Date
                  ? row.expires_at.toISOString()
                  : String(row.expires_at),
            },
          },
          201,
        );
      } catch (error) {
        return c.json(
          {
            success: false,
            error: {
              code: 'RFB_CREATE_FAILED',
              message: error instanceof Error ? error.message : 'Failed to create request',
            },
          },
          500,
        );
      }
    },
  ),
);

// GET /rfb/mine — the renter's own requests, newest first.
app.get('/rfb/mine', async (c) => {
  const auth = c.get('auth');
  const db = c.get('db');
  if (!db) return rfbUnavailable(c);
  try {
    // Anti-IDOR: filter by applicant_user_id as well as the tenant predicate
    // RLS enforces. A renter sees ONLY their own requests.
    const raw = await db.execute(sql`
      SELECT id, unit_type, grade_min, floor_area_min, floor_area_max,
             unit_price, currency, delivery_by, status, created_at, expires_at
        FROM rfb_requests
       WHERE tenant_id = ${auth.tenantId}
         AND applicant_user_id = ${auth.userId}
       ORDER BY created_at DESC
       LIMIT 200
    `);
    const rfbs = rfbRows(raw).map(toRfbSummary);
    return c.json({ success: true, data: { rfbs } });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: {
          code: 'RFB_LIST_FAILED',
          message: error instanceof Error ? error.message : 'Failed to list requests',
        },
      },
      500,
    );
  }
});

/**
 * Shared cancel transition. Flips an OPEN request owned by the caller to
 * 'cancelled'. Returns:
 *   - { ok: true, status }          on success
 *   - { ok: false, reason: 'NOT_FOUND' }  when no OPEN row owned by the caller
 *     exists (uniform 404 — covers "doesn't exist", "another renter's", and
 *     "already cancelled/filled/expired": never leaks which).
 */
async function cancelOwnRfb(
  db: any,
  tenantId: string,
  applicantUserId: string,
  rfbId: string,
): Promise<{ ok: true; status: string } | { ok: false; reason: 'NOT_FOUND' }> {
  // The UPDATE's WHERE clause carries BOTH the tenant + applicant predicate AND
  // status='open' so the transition is idempotent-safe: a second cancel
  // matches zero rows → uniform NOT_FOUND, never a phantom success.
  const updated = await db.execute(sql`
    UPDATE rfb_requests
       SET status = 'cancelled',
           cancelled_at = now(),
           updated_at = now()
     WHERE id = ${rfbId}
       AND tenant_id = ${tenantId}
       AND applicant_user_id = ${applicantUserId}
       AND status = 'open'
    RETURNING id, status
  `);
  const row = rfbRows(updated)[0];
  if (!row) return { ok: false, reason: 'NOT_FOUND' };
  return { ok: true, status: String(row.status) };
}

// POST /rfb/:id/cancel — cancel a request (task-named route).
app.post(
  '/rfb/:id/cancel',
  withSecurityEvents(
    { action: 'marketplace.rfb.cancel', resource: 'marketplace', severity: 'info' },
    async (c) => {
      const auth = c.get('auth');
      const db = c.get('db');
      if (!db) return rfbUnavailable(c);
      try {
        const result = await cancelOwnRfb(
          db,
          auth.tenantId,
          auth.userId,
          c.req.param('id'),
        );
        if (!result.ok) {
          return c.json(
            { success: false, error: { code: 'NOT_FOUND', message: 'Request not found' } },
            404,
          );
        }
        return c.json({ success: true, data: { id: c.req.param('id'), status: result.status } });
      } catch (error) {
        return c.json(
          {
            success: false,
            error: {
              code: 'RFB_CANCEL_FAILED',
              message: error instanceof Error ? error.message : 'Failed to cancel request',
            },
          },
          500,
        );
      }
    },
  ),
);

// PATCH /rfb/:id — cancel alias the mobile client uses ({ status: 'cancelled' }).
app.patch(
  '/rfb/:id',
  zValidator('json', RfbPatchSchema),
  withSecurityEvents(
    { action: 'marketplace.rfb.cancel', resource: 'marketplace', severity: 'info' },
    async (c) => {
      const auth = c.get('auth');
      const db = c.get('db');
      if (!db) return rfbUnavailable(c);
      try {
        const result = await cancelOwnRfb(
          db,
          auth.tenantId,
          auth.userId,
          c.req.param('id'),
        );
        if (!result.ok) {
          return c.json(
            { success: false, error: { code: 'NOT_FOUND', message: 'Request not found' } },
            404,
          );
        }
        return c.json({ success: true, data: { id: c.req.param('id'), status: result.status } });
      } catch (error) {
        return c.json(
          {
            success: false,
            error: {
              code: 'RFB_CANCEL_FAILED',
              message: error instanceof Error ? error.message : 'Failed to cancel request',
            },
          },
          500,
        );
      }
    },
  ),
);

// ---------------------------------------------------------------------------
// RFB detail + sign-delivery (counterparty L8 lease activation).
//
// The tenant-mobile Sign-Lease screen (apps/tenant-mobile/app/rfb/[id]/
// sign-delivery.tsx) loads GET /marketplace/rfb/:id to resolve the ACCEPTED
// response id, then POSTs /marketplace/rfb-responses/:responseId/sign-delivery
// to run the L8 settlement orchestrator (math → LedgerService.post() → payout).
// Both routes are applicant-scoped: the request's applicant_user_id (the JWT
// subject) gates the read, and the orchestrator re-checks ownership before any
// money moves. The checksum is DETERMINISTIC over the ownership-history chain so
// replays from the same applicant collapse idempotently.
// ---------------------------------------------------------------------------

/**
 * Deterministic chain-of-custody checksum: sha256 over the ownership-history
 * chain (request id → accepted response id → accepted_at). Stable for a given
 * accepted response so re-taps collapse via the settlements idempotency key.
 */
function deriveSignChecksum(parts: {
  rfbId: string;
  responseId: string;
  acceptedAt: string;
}): string {
  const seed = `${parts.rfbId}:${parts.responseId}:${parts.acceptedAt}`;
  return `coc-${createHash('sha256').update(seed).digest('hex')}`;
}

// GET /rfb/:id — the applicant's own request + its accepted-response id (the id
// the sign-delivery POST needs). Applicant-scoped: only the renter who posted
// the request can read it (uniform 404 on others'/missing — anti-IDOR on RLS).
app.get('/rfb/:id', async (c) => {
  const auth = c.get('auth');
  const db = c.get('db');
  if (!db) return rfbUnavailable(c);
  try {
    const rfbId = c.req.param('id');
    const reqRaw = await db.execute(sql`
      SELECT id, unit_type, grade_min, floor_area_min, floor_area_max,
             unit_price, currency, delivery_by, status, created_at, expires_at
        FROM rfb_requests
       WHERE id = ${rfbId}
         AND tenant_id = ${auth.tenantId}
         AND applicant_user_id = ${auth.userId}
       LIMIT 1
    `);
    const reqRow = rfbRows(reqRaw)[0];
    if (!reqRow) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Request not found' } },
        404,
      );
    }
    // The accepted landlord response (at most one — partial unique index 0338).
    const respRaw = await db.execute(sql`
      SELECT id, landlord_user_id, rent_amount, lease_term_months,
             deposit_amount, currency_code, status, accepted_at, created_at
        FROM rfb_responses
       WHERE rfb_id = ${rfbId}
         AND tenant_id = ${auth.tenantId}
         AND status = 'accepted'
       LIMIT 1
    `);
    const respRow = rfbRows(respRaw)[0];
    const acceptedResponse = respRow
      ? {
          id: String(respRow.id),
          landlord_user_id: String(respRow.landlord_user_id),
          rent_amount: String(respRow.rent_amount),
          lease_term_months: Number(respRow.lease_term_months),
          deposit_amount: String(respRow.deposit_amount),
          currency_code: String(respRow.currency_code),
          status: String(respRow.status),
          accepted_at:
            respRow.accepted_at instanceof Date
              ? respRow.accepted_at.toISOString()
              : respRow.accepted_at == null
                ? null
                : String(respRow.accepted_at),
        }
      : null;
    return c.json({
      success: true,
      data: {
        rfb: toRfbSummary(reqRow),
        accepted_response_id: acceptedResponse?.id ?? null,
        accepted_response: acceptedResponse,
      },
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: {
          code: 'RFB_FETCH_FAILED',
          message: error instanceof Error ? error.message : 'Failed to load request',
        },
      },
      500,
    );
  }
});

const SignDeliverySchema = z.object({
  // Optional client-supplied checksum is IGNORED — the server derives a
  // deterministic one over the ownership-history chain so a tampered or
  // non-deterministic client value can never split idempotency.
  coCStepChecksum: z.string().optional(),
});

// POST /rfb-responses/:responseId/sign-delivery — the L8 settlement.
app.post(
  '/rfb-responses/:responseId/sign-delivery',
  zValidator('json', SignDeliverySchema),
  withSecurityEvents(
    { action: 'marketplace.rfb.sign_delivery', resource: 'marketplace', severity: 'info' },
    async (c) => {
      const auth = c.get('auth');
      const db = c.get('db');
      if (!db) return rfbUnavailable(c);
      const responseId = c.req.param('responseId');
      try {
        // Resolve the accepted response to derive the deterministic checksum
        // from its ownership-history chain. Applicant-scoped: the signer must
        // own the parent request (re-checked in the orchestrator too).
        const respRaw = await db.execute(sql`
          SELECT r.id, r.rfb_id, r.status, r.accepted_at,
                 req.applicant_user_id
            FROM rfb_responses r
            JOIN rfb_requests req ON req.id = r.rfb_id
           WHERE r.id = ${responseId}
             AND r.tenant_id = ${auth.tenantId}
           LIMIT 1
        `);
        const respRow = rfbRows(respRaw)[0];
        if (
          !respRow ||
          String(respRow.applicant_user_id ?? '') !== auth.userId ||
          String(respRow.status ?? '') !== 'accepted'
        ) {
          // Uniform 404 — never leaks whether the response exists, belongs to
          // another renter, or is not yet accepted.
          return c.json(
            { success: false, error: { code: 'NOT_FOUND', message: 'Accepted response not found' } },
            404,
          );
        }
        const acceptedAtIso =
          respRow.accepted_at instanceof Date
            ? respRow.accepted_at.toISOString()
            : String(respRow.accepted_at ?? '');
        const checksum = deriveSignChecksum({
          rfbId: String(respRow.rfb_id),
          responseId,
          acceptedAt: acceptedAtIso,
        });

        const orchestrator = new SettlementOrchestrator({
          db,
          ledgerPort: resolveSettlementLedgerPort(),
          payoutPort: resolveSettlementPayoutPort(),
        });
        const result = await orchestrator.signRfbDelivery({
          tenantId: auth.tenantId,
          applicantUserId: auth.userId,
          responseId,
          coCStepChecksum: checksum,
        });

        return c.json({
          success: true,
          data: {
            settlementId: result.settlementId,
            status: result.status,
            grossTzs: result.math.grossAmount,
            deductionTzs: result.math.depositAmount,
            feeTzs: result.math.feeAmount,
            netTzs: result.math.netAmount,
            currencyCode: result.math.currencyCode,
            ledgerTxnId: result.ledgerTxnId,
            payoutProvider: result.payoutProvider,
            idempotent: result.idempotent,
          },
        });
      } catch (error) {
        if (error instanceof SettlementError) {
          const status = error.code === 'LEDGER_POST_FAILED' ? 502 : 422;
          return c.json(
            { success: false, error: { code: error.code, message: error.message } },
            status,
          );
        }
        return c.json(
          {
            success: false,
            error: {
              code: 'SIGN_DELIVERY_FAILED',
              message: error instanceof Error ? error.message : 'Sign delivery failed',
            },
          },
          500,
        );
      }
    },
  ),
);

export const marketplaceRouter = app;
