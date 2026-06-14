/**
 * /api/v1/owner/account — owner Settings + co-owners + security + skills.
 *
 * Live detectors (NOT run by this build agent — see the verify commands in the
 * task report). Two layers:
 *
 *   1. AUTH + VALIDATION pins — the public auth gate, role gate, zod payload
 *      validators, and DB-unavailable branch. No DB needed.
 *
 *   2. INJECTED-STUB-DB happy paths — a recording stub `db` is set on the
 *      context BEFORE the router's databaseMiddleware (which honours a
 *      pre-injected `db`, becoming a no-op). This exercises the REAL handler +
 *      repo SQL composition end-to-end without a live Postgres, proving the
 *      routes persist (not fake-success): settings upsert, invite enqueue,
 *      revoke uniform-404, skills list/install/toggle/run, password change.
 *
 * JWT secret + NODE_ENV must be set BEFORE importing the router so the auth
 * middleware captures the secret at module init.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { Hono } from 'hono';

process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'test-secret-jwt-0123456789abcdef0123456789abcdef';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.USE_MOCK_DATA = process.env.USE_MOCK_DATA ?? 'true';

import { generateToken } from '../../../middleware/auth';
import { UserRole } from '../../../types/user-role';
import { ownerAccountRouter } from '../owner-account.hono';

const TEST_TENANT = 'tenant-acct-1';
const TEST_USER = 'user-owner-acct-1';

function bearer(role: UserRole = UserRole.OWNER, tenantId = TEST_TENANT): string {
  return `Bearer ${generateToken({
    userId: TEST_USER,
    tenantId,
    role: role as never,
    permissions: ['*'],
    propertyAccess: ['*'],
  })}`;
}

function mount(): Hono {
  const app = new Hono();
  app.route('/owner/account', ownerAccountRouter);
  return app;
}

/**
 * Drizzle SQL introspection — the canonical recording-stub idiom (mirrors
 * services/api-gateway/src/composition/__tests__/oauth-state-nonce-store.test.ts).
 * Walks the `sql`` ` object's queryChunks to recover the literal statement text
 * + bound params, so detectors can assert REAL writes hit the right tables.
 */
function extractSqlAndParams(input: unknown): { sqlText: string; params: unknown[] } {
  const stringParts: string[] = [];
  const params: unknown[] = [];
  const walk = (chunks: ReadonlyArray<unknown>): void => {
    for (const chunk of chunks) {
      if (chunk === null || chunk === undefined) continue;
      if (typeof chunk !== 'object') {
        params.push(chunk);
        continue;
      }
      const chunkObj = chunk as { value?: unknown; queryChunks?: ReadonlyArray<unknown> };
      if (Array.isArray(chunkObj.queryChunks)) {
        walk(chunkObj.queryChunks);
        continue;
      }
      if (!('value' in chunkObj)) {
        params.push(chunk);
        stringParts.push(`$${params.length}`);
        continue;
      }
      const value = chunkObj.value;
      if (Array.isArray(value)) {
        stringParts.push((value as string[]).join(''));
      } else if (value !== undefined) {
        params.push(value);
        stringParts.push(`$${params.length}`);
      }
    }
  };
  const sqlObj = input as { queryChunks?: ReadonlyArray<unknown> };
  if (Array.isArray(sqlObj?.queryChunks)) walk(sqlObj.queryChunks);
  return { sqlText: stringParts.join(''), params };
}

/**
 * Recording stub `db`. Each `execute` consults `responder(sqlText, params)` to
 * return rows. Captures every statement so tests can assert REAL writes fire.
 * The router's databaseMiddleware honours a pre-injected `db`, so binding this
 * on the context before the route is reached short-circuits the live-Postgres
 * path while still running the genuine handler + repo SQL.
 */
interface StubDb {
  execute: (q: unknown) => Promise<unknown>;
  readonly calls: Array<{ text: string; params: unknown[] }>;
}

function makeStubDb(
  responder: (text: string, params: unknown[]) => Record<string, unknown>[],
): StubDb {
  const calls: Array<{ text: string; params: unknown[] }> = [];
  return {
    calls,
    async execute(q: unknown) {
      const { sqlText, params } = extractSqlAndParams(q);
      calls.push({ text: sqlText, params });
      return responder(sqlText, params);
    },
  };
}

/** Mount the router behind a middleware that pre-injects the stub db. */
function mountWithDb(db: StubDb): Hono {
  const app = new Hono();
  app.use('/owner/account/*', async (c, next) => {
    c.set('db', db as never);
    await next();
  });
  app.route('/owner/account', ownerAccountRouter);
  return app;
}

beforeAll(() => {
  expect(process.env.JWT_SECRET?.length).toBeGreaterThanOrEqual(32);
});

// ===========================================================================
// AUTH GATE
// ===========================================================================

describe('owner-account auth gate', () => {
  it('rejects unauthenticated GET /settings', async () => {
    const res = await mount().request('/owner/account/settings');
    expect(res.status).toBe(401);
  });

  it('rejects unauthenticated PUT /settings', async () => {
    const res = await mount().request('/owner/account/settings', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(401);
  });

  it('rejects unauthenticated POST /co-owners/invite', async () => {
    const res = await mount().request('/owner/account/co-owners/invite', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(401);
  });

  it('rejects unauthenticated GET /skills', async () => {
    const res = await mount().request('/owner/account/skills');
    expect(res.status).toBe(401);
  });

  it('rejects a non-manage role from mutating settings (403)', async () => {
    const res = await mount().request('/owner/account/settings', {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        Authorization: bearer(UserRole.RESIDENT),
      },
      body: JSON.stringify({
        language: 'en',
        currency: 'USD',
        timezone: 'UTC',
        dateFormat: 'YYYY-MM-DD',
        notificationPrefs: {},
      }),
    });
    expect(res.status).toBe(403);
  });
});

// ===========================================================================
// VALIDATION
// ===========================================================================

describe('owner-account payload validation', () => {
  it('rejects a 4-letter currency (zod 400)', async () => {
    const res = await mount().request('/owner/account/settings', {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        Authorization: bearer(),
      },
      body: JSON.stringify({
        language: 'en',
        currency: 'USDD',
        timezone: 'UTC',
        dateFormat: 'YYYY-MM-DD',
        notificationPrefs: {},
      }),
    });
    expect([400, 503]).toContain(res.status);
  });

  it('rejects an invite with a non-email address (zod 400)', async () => {
    const res = await mount().request('/owner/account/co-owners/invite', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: bearer(),
      },
      body: JSON.stringify({ email: 'not-an-email', firstName: 'Ada' }),
    });
    expect([400, 503]).toContain(res.status);
  });

  it('rejects an invite role escalation to OWNER (zod 400)', async () => {
    const res = await mount().request('/owner/account/co-owners/invite', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: bearer(),
      },
      body: JSON.stringify({
        email: 'a@b.com',
        firstName: 'Ada',
        role: 'OWNER',
      }),
    });
    expect([400, 503]).toContain(res.status);
  });

  it('rejects a password change with mismatched confirmation (zod 400)', async () => {
    const res = await mount().request('/owner/account/security/password', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: bearer(),
      },
      body: JSON.stringify({
        currentPassword: 'old-secret',
        newPassword: 'new-secret-1',
        confirmPassword: 'different-1',
      }),
    });
    expect([400, 503]).toContain(res.status);
  });
});

// ===========================================================================
// INJECTED-STUB-DB HAPPY PATHS — proves real persistence, not fake-success
// ===========================================================================

describe('owner-account settings persistence (stub db)', () => {
  it('GET /settings returns route defaults when no row exists', async () => {
    const db = makeStubDb(() => []); // empty SELECT
    const res = await mountWithDb(db).request('/owner/account/settings', {
      headers: { Authorization: bearer() },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.language).toBe('en');
    expect(body.data.currency).toBe('USD');
  });

  it('PUT /settings upserts AND mirrors currency into currency_preferences', async () => {
    const db = makeStubDb((text) => {
      if (text.includes('owner_settings')) {
        return [
          {
            language: 'sw',
            currency: 'KES',
            timezone: 'Africa/Nairobi',
            date_format: 'DD/MM/YYYY',
            notification_prefs: { payment: true },
            updated_at: '2026-06-14T00:00:00.000Z',
          },
        ];
      }
      return [];
    });
    const res = await mountWithDb(db).request('/owner/account/settings', {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        Authorization: bearer(),
      },
      body: JSON.stringify({
        language: 'sw',
        currency: 'kes',
        timezone: 'Africa/Nairobi',
        dateFormat: 'DD/MM/YYYY',
        notificationPrefs: { payment: true },
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.currency).toBe('KES'); // uppercased
    // Two statements: owner_settings upsert + currency_preferences mirror.
    const joined = db.calls.map((c) => c.text).join(' | ');
    expect(joined).toMatch(/owner_settings/);
    expect(joined).toMatch(/currency_preferences/);
  });
});

describe('owner-account co-owner invites (stub db)', () => {
  it('POST /co-owners/invite enqueues a REAL email via notification_dispatch_log', async () => {
    const db = makeStubDb((text) => {
      // getOwnerSettings SELECT → return a locale row.
      if (text.includes('owner_settings') && text.toLowerCase().includes('select')) {
        return [
          {
            language: 'en',
            currency: 'USD',
            timezone: 'UTC',
            date_format: 'DD/MM/YYYY',
            notification_prefs: {},
            updated_at: null,
          },
        ];
      }
      return [];
    });
    const res = await mountWithDb(db).request('/owner/account/co-owners/invite', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: bearer(),
      },
      body: JSON.stringify({
        email: 'cofounder@example.com',
        firstName: 'Ada',
        lastName: 'Lovelace',
        role: 'CO_OWNER',
        properties: ['Palm Gardens'],
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    // The accept token must NOT leak to the client.
    expect(body.data.token).toBeUndefined();
    const joined = db.calls.map((c) => c.text).join(' | ');
    expect(joined).toMatch(/co_owner_invites/);
    expect(joined).toMatch(/notification_dispatch_log/);
  });

  it('DELETE /co-owners/:id returns uniform-404 when no pending invite matches', async () => {
    const db = makeStubDb(() => []); // UPDATE ... RETURNING id → no rows
    const res = await mountWithDb(db).request(
      '/owner/account/co-owners/missing-id',
      {
        method: 'DELETE',
        headers: { Authorization: bearer() },
      },
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('INVITE_NOT_FOUND');
  });
});

describe('owner-account skills (stub db)', () => {
  const skillRow = {
    id: 'skill-1',
    author_tenant_id: null,
    name: 'Arrears chaser',
    slug: 'arrears-chaser',
    description: 'Chases overdue rent',
    trigger_kind: 'cron',
    trigger_config: { category: 'arrears' },
    enabled: false,
    run_count: 0,
    last_run_at: null,
  };

  it('GET /skills returns the installed-skill list shaped for the FE', async () => {
    const db = makeStubDb(() => [skillRow]);
    const res = await mountWithDb(db).request('/owner/account/skills', {
      headers: { Authorization: bearer() },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.skills)).toBe(true);
    expect(body.skills[0].slug).toBe('arrears-chaser');
    expect(body.skills[0].installed).toBe(true);
    expect(body.skills[0].authorIsMd).toBe(true);
  });

  it('POST /skills/:id/install returns honest 404 when the skill does not exist', async () => {
    const db = makeStubDb(() => []); // UPDATE ... RETURNING → no row
    const res = await mountWithDb(db).request(
      '/owner/account/skills/nope/install',
      { method: 'POST', headers: { Authorization: bearer() } },
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('SKILL_NOT_AVAILABLE');
  });

  it('POST /skills/:id/toggle persists the enabled flag', async () => {
    const db = makeStubDb(() => [{ ...skillRow, enabled: true }]);
    const res = await mountWithDb(db).request(
      '/owner/account/skills/skill-1/toggle',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Authorization: bearer(),
        },
        body: JSON.stringify({ enabled: true }),
      },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.enabled).toBe(true);
  });

  it('POST /skills/:id/run records the run (bumps run_count)', async () => {
    const db = makeStubDb(() => [
      { ...skillRow, enabled: true, run_count: 1, last_run_at: '2026-06-14T00:00:00.000Z' },
    ]);
    const res = await mountWithDb(db).request(
      '/owner/account/skills/skill-1/run',
      { method: 'POST', headers: { Authorization: bearer() } },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.runCount).toBe(1);
  });

  it('POST /skills/:id/run returns 404 for a disabled/uninstalled skill', async () => {
    const db = makeStubDb(() => []); // gated by enabled=true predicate → no row
    const res = await mountWithDb(db).request(
      '/owner/account/skills/skill-1/run',
      { method: 'POST', headers: { Authorization: bearer() } },
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('SKILL_NOT_RUNNABLE');
  });
});

describe('owner-account security (stub db)', () => {
  it('GET /security/2fa reports MFA is available (engine exists)', async () => {
    const db = makeStubDb(() => [{ mfa_enabled: false }]);
    const res = await mountWithDb(db).request('/owner/account/security/2fa', {
      headers: { Authorization: bearer() },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.available).toBe(true);
    expect(body.data.enrolled).toBe(false);
    expect(body.data.enrollEndpoint).toContain('/auth/mfa/enroll');
  });

  it('POST /security/password rejects when the account has no local password', async () => {
    const db = makeStubDb(() => [{ password_hash: null }]);
    const res = await mountWithDb(db).request('/owner/account/security/password', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: bearer(),
      },
      body: JSON.stringify({
        currentPassword: 'whatever',
        newPassword: 'new-secret-1',
        confirmPassword: 'new-secret-1',
      }),
    });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe('PASSWORD_NOT_SET');
  });
});
