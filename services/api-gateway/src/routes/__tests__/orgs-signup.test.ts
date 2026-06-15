/**
 * orgs.signup router + provisioning-service tests.
 *
 * Contract under test (drives the marketing OwnerSignUpForm):
 *
 *   POST /api/v1/orgs/signup
 *     happy path  → 201 { success, tenantId, ownerId,
 *                          signupStatus:'active', session } + Set-Cookie
 *                          bossnyumba-session (HttpOnly)
 *     duplicate   → 409 { success:false, error:'email_already_registered',
 *                          loginUrl } + NO session + NO Set-Cookie
 *     validation  → 400 { error:'validation_failed', issues:[{path,message}] }
 *     pending     → 201 signupStatus:'pending_sign_in' + NO cookie when the
 *                          session mint fails
 *     idempotent  → a re-POST after the first owner exists returns the same
 *                          uniform 409 (no second tenant, no session)
 *
 * The router is exercised through a fake `OrgSignupService`; the engine
 * (`createOrgSignupService`) is exercised directly with a fake Supabase
 * admin client + fake Drizzle handle + fake fetch, so no real Supabase
 * project or Postgres is required.
 *
 * NOTE — run command (do NOT run in 8GB CI inline):
 *   pnpm -C services/api-gateway exec vitest run src/routes/__tests__/orgs-signup.test.ts
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';

process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
process.env.BOSSNYUMBA_SKIP_DOTENV = 'true';

import { createOrgsRouter } from '../orgs.hono';
import type {
  OrgSignupService,
  OrgSignupResult,
} from '../../composition/org-signup-service';
import { createOrgSignupService } from '../../composition/org-signup-service';

// ---------------------------------------------------------------------------
// Router-level harness — fake service, real router
// ---------------------------------------------------------------------------

function mountRouter(service: OrgSignupService): Hono {
  const app = new Hono();
  app.route('/api/v1/orgs', createOrgsRouter({ service, cookieSecure: false }));
  return app;
}

const VALID_BODY = {
  orgName: 'Kilimani Holdings',
  ownerFullName: 'Asha Mwangi',
  ownerEmail: 'Asha@Example.com',
  ownerPassword: 'sup3r-secret-pw',
  country: 'TZ' as const,
};

function post(app: Hono, body: unknown): Promise<Response> {
  return app.request('/api/v1/orgs/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/v1/orgs/signup — router contract', () => {
  it('happy path: 201 active + session + bossnyumba-session cookie', async () => {
    const result: OrgSignupResult = {
      kind: 'created',
      tenantId: 'tn_123',
      ownerId: 'owner_123',
      signupStatus: 'active',
      session: {
        access_token: 'access-xyz',
        refresh_token: 'refresh-xyz',
        expires_in: 3600,
        token_type: 'bearer',
      },
    };
    const app = mountRouter({ signup: async () => result });

    const res = await post(app, VALID_BODY);
    expect(res.status).toBe(201);

    const json = (await res.json()) as {
      success: boolean;
      tenantId: string;
      ownerId: string;
      signupStatus: string;
      session: { access_token: string } | null;
    };
    expect(json.success).toBe(true);
    expect(json.tenantId).toBe('tn_123');
    expect(json.ownerId).toBe('owner_123');
    expect(json.signupStatus).toBe('active');
    expect(json.session?.access_token).toBe('access-xyz');
    // The refresh token MUST NOT leak in the JSON body (cookie-only).
    expect(JSON.stringify(json)).not.toContain('refresh-xyz');

    const cookie = res.headers.get('Set-Cookie') ?? '';
    expect(cookie).toContain('bossnyumba-session=');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
  });

  it('duplicate email: 409 + loginUrl + NO session + NO cookie', async () => {
    const app = mountRouter({
      signup: async (): Promise<OrgSignupResult> => ({
        kind: 'duplicate_email',
      }),
    });

    const res = await post(app, VALID_BODY);
    expect(res.status).toBe(409);
    expect(res.headers.get('Set-Cookie')).toBeNull();

    const json = (await res.json()) as {
      success: boolean;
      error: string;
      loginUrl: string;
      session?: unknown;
    };
    expect(json.success).toBe(false);
    expect(json.error).toBe('email_already_registered');
    expect(json.loginUrl).toContain('/sign-in');
    expect(json.session).toBeUndefined();
  });

  it('pending_sign_in: 201 with NO cookie when session mint failed', async () => {
    const app = mountRouter({
      signup: async (): Promise<OrgSignupResult> => ({
        kind: 'created',
        tenantId: 'tn_p',
        ownerId: 'owner_p',
        signupStatus: 'pending_sign_in',
        session: null,
      }),
    });

    const res = await post(app, VALID_BODY);
    expect(res.status).toBe(201);
    expect(res.headers.get('Set-Cookie')).toBeNull();
    const json = (await res.json()) as {
      signupStatus: string;
      session: unknown;
    };
    expect(json.signupStatus).toBe('pending_sign_in');
    expect(json.session).toBeNull();
  });

  it.each([
    [{ ...VALID_BODY, orgName: 'x' }, 'orgName'],
    [{ ...VALID_BODY, ownerEmail: 'not-an-email' }, 'ownerEmail'],
    [{ ...VALID_BODY, ownerPassword: 'short' }, 'ownerPassword'],
    [{ ...VALID_BODY, country: 'ZZ' }, 'country'],
  ])('validation: 400 for %o', async (body, expectedPath) => {
    // Never reaches the service — assert the service is not called.
    let called = false;
    const app = mountRouter({
      signup: async () => {
        called = true;
        throw new Error('should-not-run');
      },
    });

    const res = await post(app, body);
    expect(res.status).toBe(400);
    expect(called).toBe(false);

    const json = (await res.json()) as {
      success: boolean;
      error: string;
      issues: ReadonlyArray<{ path: string; message: string }>;
    };
    expect(json.success).toBe(false);
    expect(json.error).toBe('validation_failed');
    expect(json.issues.some((i) => i.path === expectedPath)).toBe(true);
  });

  it('provisioning failure: 500 with no leak + no cookie', async () => {
    const app = mountRouter({
      signup: async () => {
        throw new Error('db exploded with secret token=abc');
      },
    });
    const res = await post(app, VALID_BODY);
    expect(res.status).toBe(500);
    expect(res.headers.get('Set-Cookie')).toBeNull();
    const json = (await res.json()) as { error: string; message: string };
    expect(json.error).toBe('signup_failed');
    // The raw error message (which could carry secrets) must not surface.
    expect(JSON.stringify(json)).not.toContain('token=abc');
  });
});

// ---------------------------------------------------------------------------
// Engine-level harness — fake admin client + fake db + fake fetch
// ---------------------------------------------------------------------------

interface CreatedUser {
  readonly id: string;
  readonly email: string;
}

interface AppMetadataUpdate {
  readonly id: string;
  readonly appMetadata: Record<string, unknown>;
}

function fakeAdminClient(opts: {
  existingEmails: Set<string>;
  onCreate?: () => void;
  /** Force the app_metadata stamp to fail (covers the pending_sign_in fall-through). */
  failMetadataStamp?: boolean;
}) {
  const created: CreatedUser[] = [];
  const deleted: string[] = [];
  const metadataUpdates: AppMetadataUpdate[] = [];
  const client = {
    auth: {
      admin: {
        async createUser(attrs: { email: string }) {
          opts.onCreate?.();
          if (opts.existingEmails.has(attrs.email.toLowerCase())) {
            return {
              data: { user: null },
              error: { code: 'email_exists', message: 'email already registered' },
            };
          }
          const user = { id: `auth_${attrs.email}`, email: attrs.email };
          created.push(user);
          opts.existingEmails.add(attrs.email.toLowerCase());
          return { data: { user }, error: null };
        },
        async updateUserById(
          id: string,
          attrs: { app_metadata?: Record<string, unknown> },
        ) {
          if (opts.failMetadataStamp) {
            return {
              data: { user: null },
              error: { message: 'metadata stamp failed' },
            };
          }
          metadataUpdates.push({ id, appMetadata: attrs.app_metadata ?? {} });
          return { data: { user: { id } }, error: null };
        },
        async deleteUser(id: string) {
          deleted.push(id);
          return { data: { user: null }, error: null };
        },
      },
    },
  };
  return { client, created, deleted, metadataUpdates };
}

/**
 * Fake Drizzle handle: `withServiceRoleContext` calls `db.transaction(fn)`
 * and inside binds GUCs via `tx.execute(...)`, then runs three
 * `tx.insert(table).values(row)` calls. We record the inserted rows.
 */
function fakeDb(opts: { failOnUsersInsert?: boolean } = {}) {
  const inserts: Array<{ row: Record<string, unknown> }> = [];
  let insertCount = 0;
  const tx = {
    async execute() {
      return undefined;
    },
    insert() {
      return {
        async values(row: Record<string, unknown>) {
          insertCount += 1;
          // 3rd insert is the owner user row.
          if (opts.failOnUsersInsert && insertCount === 3) {
            throw new Error('users insert failed');
          }
          inserts.push({ row });
          return undefined;
        },
      };
    },
  };
  const db = {
    async transaction<T>(fn: (t: unknown) => Promise<T>): Promise<T> {
      return fn(tx);
    },
    async execute() {
      return undefined;
    },
    insert() {
      return tx.insert();
    },
  };
  return { db, inserts };
}

function fakeFetchOk(): typeof fetch {
  return (async () =>
    new Response(
      JSON.stringify({
        access_token: 'AT',
        refresh_token: 'RT',
        expires_in: 3600,
        token_type: 'bearer',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )) as unknown as typeof fetch;
}

function fakeFetchFail(): typeof fetch {
  return (async () =>
    new Response('nope', { status: 400 })) as unknown as typeof fetch;
}

const CONFIG = {
  supabaseUrl: 'https://test.supabase.co',
  supabaseServiceRoleKey: 'service-role-key-xxxxxxxxxxxxxxxxxxxx',
  supabaseAnonKey: 'anon-key-xxxxxxxxxxxxxxxxxxxxxxxx',
};

const INPUT = {
  orgName: 'Kilimani Holdings',
  ownerFullName: 'Asha Mwangi',
  ownerEmail: 'asha@example.com',
  ownerPassword: 'sup3r-secret-pw',
  country: 'TZ' as const,
};

describe('createOrgSignupService — provisioning engine', () => {
  let existingEmails: Set<string>;

  beforeEach(() => {
    existingEmails = new Set<string>();
  });

  it('creates auth user + tenant/org/owner rows + mints active session', async () => {
    const admin = fakeAdminClient({ existingEmails });
    const { db, inserts } = fakeDb();
    const service = createOrgSignupService({
      db: db as never,
      config: CONFIG,
      createAdminClient: (() => admin.client) as never,
      fetchImpl: fakeFetchOk(),
    });

    const result = await service.signup(INPUT);
    expect(result.kind).toBe('created');
    if (result.kind !== 'created') return;
    expect(result.signupStatus).toBe('active');
    expect(result.session?.access_token).toBe('AT');
    // ownerId IS the Supabase auth user id (same principal everywhere).
    expect(result.ownerId).toBe('auth_asha@example.com');

    // Three rows: tenants, organizations, users.
    expect(inserts).toHaveLength(3);
    const ownerRow = inserts[2].row;
    expect(ownerRow.isOwner).toBe(true);
    expect(ownerRow.id).toBe('auth_asha@example.com');
    expect(ownerRow.firstName).toBe('Asha');
    expect(ownerRow.lastName).toBe('Mwangi');
    // No password hash is persisted on the platform row — Supabase owns creds.
    expect(ownerRow.passwordHash).toBeUndefined();

    // The Supabase user's app_metadata is stamped with the tenant binding +
    // owner role BEFORE the session mint, so the minted token carries the
    // server-managed tenant_id the gateway's Supabase-JWT verifier requires.
    expect(admin.metadataUpdates).toHaveLength(1);
    const stamp = admin.metadataUpdates[0];
    expect(stamp.id).toBe('auth_asha@example.com');
    expect(stamp.appMetadata.tenant_id).toBe(result.tenantId);
    expect(stamp.appMetadata.roles).toEqual(['OWNER']);
  });

  it('app_metadata stamp failure → created but pending_sign_in (no session minted)', async () => {
    const admin = fakeAdminClient({ existingEmails, failMetadataStamp: true });
    const { db } = fakeDb();
    let minted = false;
    const service = createOrgSignupService({
      db: db as never,
      config: CONFIG,
      createAdminClient: (() => admin.client) as never,
      // If the stamp short-circuits correctly, mint must NEVER be called —
      // a token without app_metadata.tenant_id is useless to the cockpit.
      fetchImpl: (async () => {
        minted = true;
        return new Response('{}', { status: 200 });
      }) as unknown as typeof fetch,
    });

    const result = await service.signup(INPUT);
    expect(result.kind).toBe('created');
    if (result.kind !== 'created') return;
    expect(result.signupStatus).toBe('pending_sign_in');
    expect(result.session).toBeNull();
    expect(minted).toBe(false);
  });

  it('duplicate auth email → duplicate_email, NO platform rows, NO session', async () => {
    existingEmails.add('asha@example.com');
    const admin = fakeAdminClient({ existingEmails });
    const { db, inserts } = fakeDb();
    const service = createOrgSignupService({
      db: db as never,
      config: CONFIG,
      createAdminClient: (() => admin.client) as never,
      fetchImpl: fakeFetchOk(),
    });

    const result = await service.signup(INPUT);
    expect(result.kind).toBe('duplicate_email');
    expect(inserts).toHaveLength(0);
    expect(admin.created).toHaveLength(0);
  });

  it('idempotent re-POST: second signup with same email is uniform duplicate', async () => {
    const admin = fakeAdminClient({ existingEmails });
    const { db } = fakeDb();
    const service = createOrgSignupService({
      db: db as never,
      config: CONFIG,
      createAdminClient: (() => admin.client) as never,
      fetchImpl: fakeFetchOk(),
    });

    const first = await service.signup(INPUT);
    expect(first.kind).toBe('created');

    const second = await service.signup(INPUT);
    expect(second.kind).toBe('duplicate_email');
    // Exactly one auth user ever created across both attempts.
    expect(admin.created).toHaveLength(1);
  });

  it('session mint failure → created but pending_sign_in (no session)', async () => {
    const admin = fakeAdminClient({ existingEmails });
    const { db } = fakeDb();
    const service = createOrgSignupService({
      db: db as never,
      config: CONFIG,
      createAdminClient: (() => admin.client) as never,
      fetchImpl: fakeFetchFail(),
    });

    const result = await service.signup(INPUT);
    expect(result.kind).toBe('created');
    if (result.kind !== 'created') return;
    expect(result.signupStatus).toBe('pending_sign_in');
    expect(result.session).toBeNull();
  });

  it('provisioning failure rolls back the orphaned auth user', async () => {
    const admin = fakeAdminClient({ existingEmails });
    const { db } = fakeDb({ failOnUsersInsert: true });
    const service = createOrgSignupService({
      db: db as never,
      config: CONFIG,
      createAdminClient: (() => admin.client) as never,
      fetchImpl: fakeFetchOk(),
    });

    await expect(service.signup(INPUT)).rejects.toThrow();
    // The auth user created before the failed insert must be deleted so a
    // retry with the same email is not permanently blocked.
    expect(admin.deleted).toEqual(['auth_asha@example.com']);
  });
});
