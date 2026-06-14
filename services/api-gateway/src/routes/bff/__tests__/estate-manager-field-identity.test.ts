/**
 * Estate Manager BFF — field-capture (#7) + applicant-identity (#9) route tests.
 *
 * These cover the NEW write surfaces the staff-mobile and tenant-mobile clients
 * call (they previously 404'd):
 *
 *   POST /manager/attendance | /task-acks | /incidents | /shift-reports
 *   POST /manager/applicants/kyc
 *   GET  /manager/applicants/kyc/:id/status
 *   POST|PUT /manager/applicants/profile
 *   PUT  /manager/applicants/profile/notifications
 *
 * The repo binds the RLS tenant GUC via `withTenantContext` (db.transaction).
 * The fake db below implements `.transaction(cb)` and a queue-driven
 * `tx.execute` that returns the first 3 GUC-bind calls as empty, then the
 * programmed rows for the repo's own statements. This lets us assert the route
 * wiring, validation, auth/role gating, and the JWT-derived applicant scoping
 * without a live Postgres.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { Hono } from 'hono';

process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'test-secret-jwt-0123456789abcdef0123456789abcdef';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.USE_MOCK_DATA = process.env.USE_MOCK_DATA ?? 'true';

import { generateToken } from '../../../middleware/auth';
import { UserRole } from '../../../types/user-role';
import { estateManagerAppRouter } from '../estate-manager-app';

const TEST_TENANT = 'tenant-1';
const STAFF_USER = 'user-staff-1';
const RENTER_USER = 'user-renter-1';

function bearer(userId: string, role: string): string {
  return `Bearer ${generateToken({
    userId,
    tenantId: TEST_TENANT,
    role: role as never,
    permissions: ['*'],
    propertyAccess: ['*'],
  })}`;
}

/**
 * Fake drizzle db. `.transaction(cb)` runs cb with a tx whose `execute`
 * returns the next programmed result, AFTER swallowing the 3 GUC-bind
 * statements `withTenantContext` issues per transaction.
 *
 * `results` is a flat queue of row arrays the repo's data statements consume
 * in order. Pass `[]` for a statement that should return no rows.
 */
function makeFakeDb(results: unknown[][]) {
  const queue = [...results];
  let gucBindsSeen = 0;
  const tx = {
    execute: async () => {
      // The first 3 execute calls per transaction are the GUC binds
      // (current_tenant_id / tenant_id / is_service_role). Swallow them.
      if (gucBindsSeen < 3) {
        gucBindsSeen += 1;
        return [];
      }
      return queue.shift() ?? [];
    },
  };
  return {
    db: {
      transaction: async (cb: (t: typeof tx) => Promise<unknown>) => {
        gucBindsSeen = 0; // reset per transaction
        return cb(tx);
      },
    },
    remaining: () => queue.length,
  };
}

function mount(services: unknown): Hono {
  const app = new Hono();
  app.use('*', async (c, next) => {
    if (services !== undefined) c.set('services', services);
    await next();
  });
  app.route('/manager', estateManagerAppRouter);
  return app;
}

beforeAll(() => {
  expect(process.env.JWT_SECRET?.length).toBeGreaterThanOrEqual(32);
});

// ---------------------------------------------------------------------------
// #7 — Staff field captures
// ---------------------------------------------------------------------------

describe('POST /manager/attendance (field capture)', () => {
  it('rejects anonymous callers (401)', async () => {
    const res = await mount({ db: {} }).request('/manager/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: 'q1' }),
    });
    expect(res.status).toBe(401);
  });

  it('rejects a RESIDENT (operator surface — 403)', async () => {
    const res = await mount({ db: {} }).request('/manager/attendance', {
      method: 'POST',
      headers: {
        Authorization: bearer(RENTER_USER, UserRole.RESIDENT),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ clientId: 'q1' }),
    });
    expect(res.status).toBe(403);
  });

  it('422 on a payload missing the client-supplied id', async () => {
    const { db } = makeFakeDb([]);
    const res = await mount({ db }).request('/manager/attendance', {
      method: 'POST',
      headers: {
        Authorization: bearer(STAFF_USER, UserRole.MAINTENANCE_STAFF),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ checkInAt: '2026-06-14T08:00:00.000Z' }),
    });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('persists a fresh capture and returns 201 with the durable record', async () => {
    const row = {
      id: 'fc_x',
      tenant_id: TEST_TENANT,
      client_id: 'q1',
      capture_type: 'attendance',
      staff_id: STAFF_USER,
      property_id: 'prop-1',
      unit_id: null,
      body: { checkInAt: '2026-06-14T08:00:00.000Z' },
      captured_at: '2026-06-14T08:00:00.000Z',
      created_at: '2026-06-14T08:00:05.000Z',
    };
    // First statement = INSERT ... RETURNING (returns the new row).
    const { db } = makeFakeDb([[row]]);
    const res = await mount({ db }).request('/manager/attendance', {
      method: 'POST',
      headers: {
        Authorization: bearer(STAFF_USER, UserRole.MAINTENANCE_STAFF),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        clientId: 'q1',
        propertyId: 'prop-1',
        capturedAt: '2026-06-14T08:00:00.000Z',
        body: { checkInAt: '2026-06-14T08:00:00.000Z' },
      }),
    });
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.id).toBe('fc_x');
    expect(json.data.deduped).toBe(false);
  });

  it('idempotent re-POST returns 200 deduped (INSERT conflict → re-read)', async () => {
    const existing = {
      id: 'fc_x',
      tenant_id: TEST_TENANT,
      client_id: 'q1',
      capture_type: 'attendance',
      staff_id: STAFF_USER,
      property_id: null,
      unit_id: null,
      body: {},
      captured_at: null,
      created_at: '2026-06-14T08:00:05.000Z',
    };
    // 1st statement = INSERT ON CONFLICT DO NOTHING RETURNING → [] (conflict).
    // 2nd statement = SELECT existing row.
    const { db } = makeFakeDb([[], [existing]]);
    const res = await mount({ db }).request('/manager/attendance', {
      method: 'POST',
      headers: {
        Authorization: bearer(STAFF_USER, UserRole.MAINTENANCE_STAFF),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ clientId: 'q1' }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.deduped).toBe(true);
  });

  it('503 when services.db is unavailable', async () => {
    const res = await mount({}).request('/manager/attendance', {
      method: 'POST',
      headers: {
        Authorization: bearer(STAFF_USER, UserRole.MAINTENANCE_STAFF),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ clientId: 'q1' }),
    });
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.error.code).toBe('DATABASE_UNAVAILABLE');
  });
});

describe('field-capture sibling routes share the handler', () => {
  it.each([
    ['/manager/task-acks', 'task_ack'],
    ['/manager/incidents', 'incident'],
    ['/manager/shift-reports', 'shift_report'],
  ])('%s persists with the right capture_type', async (path, captureType) => {
    const row = {
      id: 'fc_y',
      tenant_id: TEST_TENANT,
      client_id: 'q2',
      capture_type: captureType,
      staff_id: STAFF_USER,
      property_id: null,
      unit_id: null,
      body: {},
      captured_at: null,
      created_at: '2026-06-14T09:00:00.000Z',
    };
    const { db } = makeFakeDb([[row]]);
    const res = await mount({ db }).request(path, {
      method: 'POST',
      headers: {
        Authorization: bearer(STAFF_USER, UserRole.MAINTENANCE_STAFF),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ clientId: 'q2' }),
    });
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.captureType).toBe(captureType);
  });
});

// ---------------------------------------------------------------------------
// #9 — Applicant identity (renter self-service)
// ---------------------------------------------------------------------------

describe('POST /manager/applicants/kyc', () => {
  const validKyc = {
    personal: { fullName: 'A Renter', phone: '+255700000000', email: 'r@example.com' },
    nida: { frontImageUri: 'file://f', backImageUri: 'file://b' },
    company: { tin: '123', registrationDocUri: 'file://d', registrationDocName: 'reg.pdf' },
    aml: { sourceOfFunds: 'salary', isPep: false, sanctionsConsent: true },
  };

  it('allows a RESIDENT (renter self-service surface)', async () => {
    const kycRow = {
      id: 'kyc_1',
      stage: 'submitted',
      updated_at: '2026-06-14T10:00:00.000Z',
      rejection_reason: null,
    };
    const { db } = makeFakeDb([[kycRow]]);
    const res = await mount({ db }).request('/manager/applicants/kyc', {
      method: 'POST',
      headers: {
        Authorization: bearer(RENTER_USER, UserRole.RESIDENT),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(validKyc),
    });
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.id).toBe('kyc_1');
    expect(json.data.stage).toBe('submitted');
  });

  it('422 on an invalid email', async () => {
    const { db } = makeFakeDb([]);
    const res = await mount({ db }).request('/manager/applicants/kyc', {
      method: 'POST',
      headers: {
        Authorization: bearer(RENTER_USER, UserRole.RESIDENT),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...validKyc,
        personal: { ...validKyc.personal, email: 'not-an-email' },
      }),
    });
    expect(res.status).toBe(422);
  });
});

describe('GET /manager/applicants/kyc/:id/status', () => {
  it("returns 404 (uniform anti-IDOR) when the record is not the renter's", async () => {
    // SELECT scoped by tenant + applicant_id + id returns no rows.
    const { db } = makeFakeDb([[]]);
    const res = await mount({ db }).request(
      '/manager/applicants/kyc/someone-elses-id/status',
      {
        headers: { Authorization: bearer(RENTER_USER, UserRole.RESIDENT) },
      },
    );
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error.code).toBe('NOT_FOUND');
  });

  it('returns the record when it belongs to the renter', async () => {
    const { db } = makeFakeDb([
      [
        {
          id: 'kyc_1',
          stage: 'reviewing',
          updated_at: '2026-06-14T11:00:00.000Z',
          rejection_reason: null,
        },
      ],
    ]);
    const res = await mount({ db }).request('/manager/applicants/kyc/kyc_1/status', {
      headers: { Authorization: bearer(RENTER_USER, UserRole.RESIDENT) },
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.stage).toBe('reviewing');
  });
});

describe('PUT/POST /manager/applicants/profile', () => {
  it('persists preferredLang (never hard-coded) and hydrates it back', async () => {
    const profileRow = {
      id: 'prof_1',
      applicant_id: RENTER_USER,
      company_name: 'Acme',
      phone: '+255700000000',
      preferred_lang: 'sw',
      notif_new_listings: true,
      notif_bid_updates: true,
      notif_document_ready: true,
      notif_price_alerts: true,
      updated_at: '2026-06-14T12:00:00.000Z',
    };
    const { db } = makeFakeDb([[profileRow]]);
    const res = await mount({ db }).request('/manager/applicants/profile', {
      method: 'PUT',
      headers: {
        Authorization: bearer(RENTER_USER, UserRole.RESIDENT),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ companyName: 'Acme', preferredLang: 'sw' }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.preferredLang).toBe('sw');
    expect(json.data.companyName).toBe('Acme');
  });

  it('422 on an invalid preferredLang', async () => {
    const { db } = makeFakeDb([]);
    const res = await mount({ db }).request('/manager/applicants/profile', {
      method: 'POST',
      headers: {
        Authorization: bearer(RENTER_USER, UserRole.RESIDENT),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ preferredLang: 'fr' }),
    });
    expect(res.status).toBe(422);
  });
});

describe('PUT /manager/applicants/profile/notifications', () => {
  it('updates and returns the hydrated notification block', async () => {
    const profileRow = {
      id: 'prof_1',
      applicant_id: RENTER_USER,
      company_name: null,
      phone: null,
      preferred_lang: 'en',
      notif_new_listings: false,
      notif_bid_updates: true,
      notif_document_ready: false,
      notif_price_alerts: true,
      updated_at: '2026-06-14T13:00:00.000Z',
    };
    const { db } = makeFakeDb([[profileRow]]);
    const res = await mount({ db }).request(
      '/manager/applicants/profile/notifications',
      {
        method: 'PUT',
        headers: {
          Authorization: bearer(RENTER_USER, UserRole.RESIDENT),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          newListings: false,
          bidUpdates: true,
          documentReady: false,
          priceAlerts: true,
        }),
      },
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toEqual({
      newListings: false,
      bidUpdates: true,
      documentReady: false,
      priceAlerts: true,
    });
  });

  it('422 on a missing boolean flag', async () => {
    const { db } = makeFakeDb([]);
    const res = await mount({ db }).request(
      '/manager/applicants/profile/notifications',
      {
        method: 'PUT',
        headers: {
          Authorization: bearer(RENTER_USER, UserRole.RESIDENT),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ newListings: true }),
      },
    );
    expect(res.status).toBe(422);
  });
});
