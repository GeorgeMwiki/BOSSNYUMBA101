/**
 * Marketplace RFB (Request-For-Application) route tests — H37.
 *
 * The tenant-mobile app (apps/tenant-mobile/src/api/rfb.ts) calls a
 * /marketplace/rfb prefix that had ZERO backend until migration 0331 +
 * the RFB routes in marketplace.hono.ts landed. These tests pin the wire
 * contract those routes now expose:
 *
 *   POST  /marketplace/rfb            create   → 201 { id, createdAt, expiresAt }
 *   GET   /marketplace/rfb/mine       list     → 200 { rfbs: [...] }
 *   POST  /marketplace/rfb/:id/cancel cancel   → 200 { id, status }
 *   PATCH /marketplace/rfb/:id        cancel alias (mobile client uses this)
 *
 * Strategy (mirrors cases-router.test.ts): exercise the router WITHOUT a
 * live Postgres by pre-injecting a stub `db.execute` onto the request
 * context — `databaseMiddleware` honours an existing `db` binding instead
 * of building a real client. A real HS256 JWT is minted so the production
 * `authMiddleware` runs unmodified. The stub holds an in-memory table so
 * anti-IDOR + uniform-404 behaviour can be asserted end-to-end.
 *
 * SECURITY CONTRACTS UNDER TEST:
 *   - anonymous callers are rejected (401) on every verb.
 *   - applicant_user_id is ALWAYS the JWT subject (never client input).
 *   - list_mine filters by applicant_user_id (a co-tenant's request is invisible).
 *   - cancel is uniform-404 for: missing id, another renter's id, and an
 *     already-cancelled id (no leak of which).
 *   - the cancel PATCH body only accepts { status: 'cancelled' } (400 otherwise).
 */

import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import jwt from 'jsonwebtoken';

// Set the JWT secret BEFORE the hoisted router import below. hono-auth captures
// `const JWT_SECRET = getJwtSecret()` at MODULE LOAD, so if the env is set after
// the (hoisted) `import '../marketplace.hono'` runs, authMiddleware verifies with
// a different secret than mintJwt signs with and every authed request 401s.
// vi.hoisted runs before all imports in this file, closing that timing gap.
vi.hoisted(() => {
  process.env.JWT_SECRET =
    process.env.JWT_SECRET ?? 'test-secret-jwt-0123456789abcdef0123456789abcdef';
  process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
  process.env.BOSSNYUMBA_SKIP_DOTENV = 'true';
});

import { marketplaceRouter } from '../marketplace.hono';
import { getJwtSecret } from '../../config/jwt';

const TENANT = 'tnt_rfb_test';
const APPLICANT = 'usr_rfb_applicant';
const OTHER_APPLICANT = 'usr_rfb_other';

// ── In-memory rfb_requests stub ────────────────────────────────────────────

interface RfbRow {
  id: string;
  tenant_id: string;
  applicant_user_id: string;
  unit_type: string;
  grade_min: string | null;
  floor_area_min: string;
  floor_area_max: string | null;
  unit_price: string;
  currency: string;
  delivery_by: string;
  location_lat: string | null;
  location_lon: string | null;
  radius_km: string;
  notes: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  expires_at: string;
  cancelled_at: string | null;
}

/**
 * Split a drizzle `sql\`...\`` query into its lowercased raw text AND the bound
 * parameter values in template order.
 *
 * In this drizzle version `queryChunks` is a flat, top-level-interleaved array:
 *   - a `StringChunk` (object with a `.value` string[] of raw SQL fragments), OR
 *   - an interpolated VALUE stored directly — a primitive (`'idv'`, `42`),
 *     `null`, or a nested `SQL` object (e.g. a `sql.raw`/sub-template).
 * Each non-StringChunk element is one bound parameter, in order. We do NOT
 * recurse into nested SQL objects for params here — the RFB queries only
 * interpolate scalars, so a flat top-level scan is exact.
 */
function inspect(query: unknown): { raw: string; params: unknown[] } {
  const chunks = (query as { queryChunks?: unknown[] }).queryChunks ?? [];
  const parts: string[] = [];
  const params: unknown[] = [];
  const isStringChunk = (node: unknown): node is { value: unknown } =>
    typeof node === 'object' &&
    node !== null &&
    'value' in (node as Record<string, unknown>) &&
    Array.isArray((node as { value: unknown }).value) &&
    !('queryChunks' in (node as Record<string, unknown>));
  for (const node of chunks) {
    if (isStringChunk(node)) {
      for (const s of node.value as unknown[]) {
        if (typeof s === 'string') parts.push(s);
      }
      continue;
    }
    // Anything else at the top level is an interpolated bound parameter
    // (including `null`, a number, a string, or a nested SQL fragment).
    params.push(node);
  }
  return { raw: parts.join(' ').toLowerCase(), params };
}

function makeDbStub() {
  const table: RfbRow[] = [];
  let seq = 0;
  const db = {
    execute: async (query: unknown) => {
      const { raw, params } = inspect(query);

      if (raw.includes('insert into rfb_requests')) {
        // Params are appended in template order; map by position from the
        // VALUES list in the route.
        const [
          id,
          tenant_id,
          applicant_user_id,
          unit_type,
          grade_min,
          floor_area_min,
          floor_area_max,
          unit_price,
          currencyArg,
          delivery_by,
          location_lat,
          location_lon,
          radius_km,
          notes,
        ] = params as any[];
        const now = '2026-06-14T00:00:00.000Z';
        const expires = '2026-07-14T00:00:00.000Z';
        const row: RfbRow = {
          id: String(id),
          tenant_id: String(tenant_id),
          applicant_user_id: String(applicant_user_id),
          unit_type: String(unit_type),
          grade_min: grade_min == null ? null : String(grade_min),
          floor_area_min: String(floor_area_min),
          floor_area_max: floor_area_max == null ? null : String(floor_area_max),
          unit_price: String(unit_price),
          // COALESCE($currency, 'TZS') — the param is the first COALESCE arg.
          currency: currencyArg == null ? 'TZS' : String(currencyArg),
          delivery_by: String(delivery_by),
          location_lat: location_lat == null ? null : String(location_lat),
          location_lon: location_lon == null ? null : String(location_lon),
          radius_km: String(radius_km),
          notes: notes == null ? null : String(notes),
          status: 'open',
          created_at: now,
          updated_at: now,
          expires_at: expires,
          cancelled_at: null,
        };
        table.push(row);
        seq += 1;
        return [{ id: row.id, created_at: row.created_at, expires_at: row.expires_at }];
      }

      if (raw.includes('update rfb_requests')) {
        // WHERE id=$1 AND tenant_id=$2 AND applicant_user_id=$3 AND status='open'
        const [id, tenant_id, applicant_user_id] = params as string[];
        const match = table.find(
          (r) =>
            r.id === id &&
            r.tenant_id === tenant_id &&
            r.applicant_user_id === applicant_user_id &&
            r.status === 'open',
        );
        if (!match) return [];
        match.status = 'cancelled';
        match.cancelled_at = '2026-06-14T01:00:00.000Z';
        return [{ id: match.id, status: match.status }];
      }

      if (raw.includes('from rfb_requests')) {
        // SELECT ... WHERE tenant_id=$1 AND applicant_user_id=$2 ORDER BY ...
        const [tenant_id, applicant_user_id] = params as string[];
        const rows = table
          .filter(
            (r) =>
              r.tenant_id === tenant_id &&
              r.applicant_user_id === applicant_user_id,
          )
          .slice()
          .reverse();
        return rows;
      }

      return [];
    },
  };
  return { db, table, count: () => seq };
}

function mintJwt(userId: string): string {
  return jwt.sign(
    {
      userId,
      tenantId: TENANT,
      role: 'RESIDENT',
      permissions: ['*'],
      propertyAccess: ['*'],
    },
    getJwtSecret(),
    { algorithm: 'HS256', expiresIn: '2h' },
  );
}

function buildApp() {
  const app = new Hono();
  const stub = makeDbStub();
  app.use('*', async (c, next) => {
    // Pre-inject the stub — databaseMiddleware becomes a no-op and skips the
    // tenant transaction (no live Postgres needed).
    c.set('db', stub.db as unknown as never);
    await next();
  });
  app.route('/marketplace', marketplaceRouter);
  return { app, stub };
}

const VALID_BODY = {
  unitType: 'two_bedroom',
  gradeMin: 'B',
  floorAreaMinSqm: 60,
  floorAreaMaxSqm: 90,
  unitPriceTzs: 850000,
  deliveryBy: '2026-09-01',
  locationLat: -6.7924,
  locationLon: 39.2083,
  radiusKm: 10,
  notes: 'Quiet area near transit',
};

function authHeaders(userId: string) {
  return {
    Authorization: `Bearer ${mintJwt(userId)}`,
    'Content-Type': 'application/json',
  };
}

// ────────────────────────────────────────────────────────────────────────────
// POST /marketplace/rfb — create
// ────────────────────────────────────────────────────────────────────────────

describe('POST /marketplace/rfb', () => {
  it('rejects anonymous callers (401)', async () => {
    const { app } = buildApp();
    const res = await app.request('/marketplace/rfb', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_BODY),
    });
    expect(res.status).toBe(401);
  });

  it('creates a request and returns 201 { id, createdAt, expiresAt }', async () => {
    const { app, stub } = buildApp();
    const res = await app.request('/marketplace/rfb', {
      method: 'POST',
      headers: authHeaders(APPLICANT),
      body: JSON.stringify(VALID_BODY),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body.success).toBe(true);
    expect(body.data.id).toBeTruthy();
    expect(body.data.createdAt).toBeTruthy();
    expect(body.data.expiresAt).toBeTruthy();
    expect(stub.count()).toBe(1);
    // applicant_user_id is the JWT subject — never client input.
    expect(stub.table[0].applicant_user_id).toBe(APPLICANT);
    expect(stub.table[0].tenant_id).toBe(TENANT);
  });

  it('defaults currency to the tenant launch jurisdiction when omitted', async () => {
    const { app, stub } = buildApp();
    await app.request('/marketplace/rfb', {
      method: 'POST',
      headers: authHeaders(APPLICANT),
      body: JSON.stringify(VALID_BODY),
    });
    // No currency sent → COALESCE applies the DB/route default (TZS launch).
    expect(stub.table[0].currency).toBe('TZS');
  });

  it('persists a client-supplied currency verbatim (multi-currency)', async () => {
    const { app, stub } = buildApp();
    await app.request('/marketplace/rfb', {
      method: 'POST',
      headers: authHeaders(APPLICANT),
      body: JSON.stringify({ ...VALID_BODY, currency: 'KES' }),
    });
    expect(stub.table[0].currency).toBe('KES');
  });

  it('rejects an invalid unitType (400)', async () => {
    const { app } = buildApp();
    const res = await app.request('/marketplace/rfb', {
      method: 'POST',
      headers: authHeaders(APPLICANT),
      body: JSON.stringify({ ...VALID_BODY, unitType: 'castle' }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects floorAreaMax < floorAreaMin (400)', async () => {
    const { app } = buildApp();
    const res = await app.request('/marketplace/rfb', {
      method: 'POST',
      headers: authHeaders(APPLICANT),
      body: JSON.stringify({ ...VALID_BODY, floorAreaMinSqm: 90, floorAreaMaxSqm: 60 }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects a malformed deliveryBy (400)', async () => {
    const { app } = buildApp();
    const res = await app.request('/marketplace/rfb', {
      method: 'POST',
      headers: authHeaders(APPLICANT),
      body: JSON.stringify({ ...VALID_BODY, deliveryBy: '01-09-2026' }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects a non-positive unitPriceTzs (400)', async () => {
    const { app } = buildApp();
    const res = await app.request('/marketplace/rfb', {
      method: 'POST',
      headers: authHeaders(APPLICANT),
      body: JSON.stringify({ ...VALID_BODY, unitPriceTzs: 0 }),
    });
    expect(res.status).toBe(400);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// GET /marketplace/rfb/mine — list_mine
// ────────────────────────────────────────────────────────────────────────────

describe('GET /marketplace/rfb/mine', () => {
  it('rejects anonymous callers (401)', async () => {
    const { app } = buildApp();
    const res = await app.request('/marketplace/rfb/mine');
    expect(res.status).toBe(401);
  });

  it("returns only the caller's own requests (anti-IDOR)", async () => {
    const { app } = buildApp();
    // Applicant posts two; another renter posts one.
    await app.request('/marketplace/rfb', {
      method: 'POST',
      headers: authHeaders(APPLICANT),
      body: JSON.stringify(VALID_BODY),
    });
    await app.request('/marketplace/rfb', {
      method: 'POST',
      headers: authHeaders(APPLICANT),
      body: JSON.stringify({ ...VALID_BODY, unitType: 'studio' }),
    });
    await app.request('/marketplace/rfb', {
      method: 'POST',
      headers: authHeaders(OTHER_APPLICANT),
      body: JSON.stringify(VALID_BODY),
    });

    const res = await app.request('/marketplace/rfb/mine', {
      headers: { Authorization: `Bearer ${mintJwt(APPLICANT)}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.success).toBe(true);
    expect(body.data.rfbs).toHaveLength(2);
    // The other renter's request never appears.
    expect(
      body.data.rfbs.every((r: any) => r.status === 'open'),
    ).toBe(true);
  });

  it('returns the wire-shape RfbSummary (snake_case + currency)', async () => {
    const { app } = buildApp();
    await app.request('/marketplace/rfb', {
      method: 'POST',
      headers: authHeaders(APPLICANT),
      body: JSON.stringify({ ...VALID_BODY, currency: 'UGX' }),
    });
    const res = await app.request('/marketplace/rfb/mine', {
      headers: { Authorization: `Bearer ${mintJwt(APPLICANT)}` },
    });
    const body = (await res.json()) as any;
    const summary = body.data.rfbs[0];
    expect(summary).toMatchObject({
      unit_type: 'two_bedroom',
      unit_price_tzs: '850000',
      currency: 'UGX',
      status: 'open',
      pending_response_count: 0,
    });
    expect(summary.id).toBeTruthy();
    expect(summary.delivery_by).toBeTruthy();
    expect(summary.expires_at).toBeTruthy();
  });

  it('returns an empty array when the caller has no requests', async () => {
    const { app } = buildApp();
    const res = await app.request('/marketplace/rfb/mine', {
      headers: { Authorization: `Bearer ${mintJwt(APPLICANT)}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data.rfbs).toEqual([]);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// POST /marketplace/rfb/:id/cancel  +  PATCH /marketplace/rfb/:id
// ────────────────────────────────────────────────────────────────────────────

async function createOne(app: Hono, userId: string): Promise<string> {
  const res = await app.request('/marketplace/rfb', {
    method: 'POST',
    headers: authHeaders(userId),
    body: JSON.stringify(VALID_BODY),
  });
  const body = (await res.json()) as any;
  return body.data.id as string;
}

describe('POST /marketplace/rfb/:id/cancel', () => {
  it('rejects anonymous callers (401)', async () => {
    const { app } = buildApp();
    const res = await app.request('/marketplace/rfb/some-id/cancel', {
      method: 'POST',
    });
    expect(res.status).toBe(401);
  });

  it('cancels the caller’s own open request (200, status cancelled)', async () => {
    const { app, stub } = buildApp();
    const id = await createOne(app, APPLICANT);
    const res = await app.request(`/marketplace/rfb/${id}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${mintJwt(APPLICANT)}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data.status).toBe('cancelled');
    expect(stub.table[0].status).toBe('cancelled');
  });

  it('returns uniform 404 for an unknown id', async () => {
    const { app } = buildApp();
    const res = await app.request('/marketplace/rfb/does-not-exist/cancel', {
      method: 'POST',
      headers: { Authorization: `Bearer ${mintJwt(APPLICANT)}` },
    });
    expect(res.status).toBe(404);
    const body = (await res.json()) as any;
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it("returns uniform 404 when cancelling another renter's request (anti-IDOR)", async () => {
    const { app, stub } = buildApp();
    const id = await createOne(app, OTHER_APPLICANT);
    const res = await app.request(`/marketplace/rfb/${id}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${mintJwt(APPLICANT)}` },
    });
    expect(res.status).toBe(404);
    // The victim's request remains untouched.
    expect(stub.table[0].status).toBe('open');
  });

  it('returns uniform 404 on a double-cancel (idempotent-safe)', async () => {
    const { app } = buildApp();
    const id = await createOne(app, APPLICANT);
    const first = await app.request(`/marketplace/rfb/${id}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${mintJwt(APPLICANT)}` },
    });
    expect(first.status).toBe(200);
    const second = await app.request(`/marketplace/rfb/${id}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${mintJwt(APPLICANT)}` },
    });
    expect(second.status).toBe(404);
  });
});

describe('PATCH /marketplace/rfb/:id (mobile-client cancel alias)', () => {
  it('cancels via the PATCH alias with { status: cancelled } (200)', async () => {
    const { app, stub } = buildApp();
    const id = await createOne(app, APPLICANT);
    const res = await app.request(`/marketplace/rfb/${id}`, {
      method: 'PATCH',
      headers: authHeaders(APPLICANT),
      body: JSON.stringify({ status: 'cancelled' }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data.status).toBe('cancelled');
    expect(stub.table[0].status).toBe('cancelled');
  });

  it('rejects a non-cancel status in the PATCH body (400)', async () => {
    const { app } = buildApp();
    const id = await createOne(app, APPLICANT);
    const res = await app.request(`/marketplace/rfb/${id}`, {
      method: 'PATCH',
      headers: authHeaders(APPLICANT),
      body: JSON.stringify({ status: 'filled' }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects anonymous PATCH callers (401)', async () => {
    const { app } = buildApp();
    const res = await app.request('/marketplace/rfb/some-id', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled' }),
    });
    expect(res.status).toBe(401);
  });
});
