/**
 * Owner org-signup provisioning service — the single tenant-creation
 * engine behind `POST /api/v1/orgs/signup` (marketing OwnerSignUpForm).
 *
 * Why this module exists
 * ----------------------
 * The marketing OwnerSignUpForm posts the SaaS-owner shape
 * (`orgName + ownerFullName + ownerEmail + ownerPassword + country`) and
 * expects ONE server-side flow that:
 *
 *   1. creates the canonical Supabase Auth user (the project's canonical
 *      identity store — `auth.users`, which carries the GLOBAL-unique
 *      email constraint and is what `signInWithPassword` authenticates
 *      against), then
 *   2. creates the platform `tenants` + `organizations` + owner `users`
 *      rows (the 0001_initial canonical schema) atomically, then
 *   3. mints a Supabase session so the owner lands authenticated.
 *
 * There is exactly ONE place that writes the tenant/owner rows: this
 * service. The router is a thin HTTP shell over it. The legacy
 * `onboarding.hono.ts` flow is an in-memory bcrypt PILOT store that does
 * NOT touch Supabase or Drizzle — reusing it would mean provisioning into
 * a throwaway Map, so the canonical engine lives here instead.
 *
 * Identity / RLS invariants
 * -------------------------
 * - Signup is a PRE-AUTH, CROSS-TENANT provisioning op: no tenant exists
 *   yet, so the Drizzle writes run under `withServiceRoleContext` (the
 *   0179 service-role bypass) — never inside a tenant GUC, never
 *   double-filtered. This mirrors `durable-wake-store.ts`.
 * - Duplicate-email defence lives at the Supabase `auth.users` layer
 *   (global-unique email). The platform `users` table is only
 *   unique-per-tenant, so it cannot be the enumeration boundary. We never
 *   leak whether an account exists beyond a uniform 409 + loginUrl.
 * - The owner `users.id` is the Supabase auth user id, so the gateway's
 *   canonical Supabase-JWT verifier (`verifySupabaseJwt`) resolves the
 *   same principal on every later request.
 * - After the platform rows exist, the Supabase user's `app_metadata` is
 *   stamped with `{ tenant_id, roles: ['OWNER'] }` BEFORE the session is
 *   minted, so the minted access token carries the server-managed tenant
 *   binding the gateway's verifier REQUIRES (`verifyAndProjectSupabaseToken`
 *   rejects a token whose `app_metadata.tenant_id` is absent). Without this
 *   stamp the owner cockpit's `/auth/me` would reject the freshly-minted
 *   token and bounce a new owner straight back to /login.
 *
 * No secrets are logged. Config (Supabase url/keys, db handle) is injected
 * by the composition root — this module never reads `process.env`.
 */

import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import {
  tenants,
  organizations,
  users,
  withServiceRoleContext,
} from '@bossnyumba/database';
import { createSupabaseAdminClient } from '@bossnyumba/supabase-client';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type SupportedCountry = 'TZ' | 'KE' | 'UG' | 'NG';

export interface OrgSignupInput {
  readonly orgName: string;
  readonly ownerFullName: string;
  /** Already trimmed + lowercased by the caller. */
  readonly ownerEmail: string;
  readonly ownerPassword: string;
  readonly country: SupportedCountry;
}

export interface OrgSignupSession {
  readonly access_token: string;
  readonly refresh_token: string;
  readonly expires_in: number;
  readonly token_type: string;
}

export type OrgSignupResult =
  | {
      readonly kind: 'created';
      readonly tenantId: string;
      readonly ownerId: string;
      /**
       * 'active'        → email confirmed + session minted (cookie set).
       * 'pending_sign_in' → user provisioned but no live session (the
       *                     owner must sign in). Returned when session
       *                     minting could not complete.
       */
      readonly signupStatus: 'active' | 'pending_sign_in';
      readonly session: OrgSignupSession | null;
    }
  | {
      /**
       * The Supabase auth email is already taken. Uniform / anti-
       * enumeration: we never reveal whether a session exists, never mint
       * one, and never create platform rows. The caller maps this to a
       * 409 + loginUrl.
       */
      readonly kind: 'duplicate_email';
    };

// ---------------------------------------------------------------------------
// Dependency surface (injected at the composition root — no process.env here)
// ---------------------------------------------------------------------------

/** Minimal Drizzle handle this service needs (insert under service-role ctx). */
export interface OrgSignupDbClient {
  transaction: <T>(fn: (tx: unknown) => Promise<T>) => Promise<T>;
  execute: (query: unknown) => Promise<unknown>;
  insert: (table: unknown) => { values: (row: unknown) => Promise<unknown> };
}

export interface OrgSignupServiceConfig {
  /** `https://<ref>.supabase.co`. */
  readonly supabaseUrl: string;
  /** Service-role key (RLS-bypass; admin auth). NEVER reaches the browser. */
  readonly supabaseServiceRoleKey: string;
  /** Public anon key — required for the password-grant session mint. */
  readonly supabaseAnonKey: string;
}

export interface OrgSignupServiceDeps {
  /** Drizzle client (from `getDb()`); null when DATABASE_URL is unset. */
  readonly db: OrgSignupDbClient | null;
  readonly config: OrgSignupServiceConfig;
  /**
   * Supabase admin client factory — overridable in tests so we never hit
   * a real Supabase project. Defaults to the canonical
   * `createSupabaseAdminClient`.
   */
  readonly createAdminClient?: typeof createSupabaseAdminClient;
  /** Injected for tests; defaults to global fetch (password-grant mint). */
  readonly fetchImpl?: typeof fetch;
  /** Structured logger (Pino). No PII/secrets are ever passed in. */
  readonly logger?: {
    info?(obj: Record<string, unknown>, msg?: string): void;
    warn?(obj: Record<string, unknown>, msg?: string): void;
    error?(obj: Record<string, unknown>, msg?: string): void;
  };
}

export interface OrgSignupService {
  signup(input: OrgSignupInput): Promise<OrgSignupResult>;
}

// ---------------------------------------------------------------------------
// Helpers (pure)
// ---------------------------------------------------------------------------

function newId(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}

/**
 * URL/slug-safe tenant slug derived from the org name plus a short random
 * suffix so two orgs with the same name never collide on the unique
 * `tenants_slug_idx`.
 */
function buildSlug(orgName: string): string {
  const base = orgName
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  const suffix = randomUUID().slice(0, 8);
  return `${base || 'org'}-${suffix}`;
}

/** Split a full name into (firstName, lastName) for the `users` NOT-NULLs. */
function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: 'Owner', lastName: '—' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '—' };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
}

/** Supabase REST error code for an already-registered email. */
function isDuplicateEmailError(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') return false;
  const p = payload as Record<string, unknown>;
  const code = typeof p.code === 'string' ? p.code : '';
  const msg = typeof p.message === 'string' ? p.message.toLowerCase() : '';
  const errorCode = typeof p.error_code === 'string' ? p.error_code : '';
  return (
    code === 'email_exists' ||
    errorCode === 'email_exists' ||
    /already.*registered|already been registered|already exists|user already/i.test(
      msg,
    )
  );
}

/**
 * Normalise a Drizzle `.execute()` result into a plain row array. postgres-js
 * hands back an array-like directly; some drivers wrap it in `{ rows }`. Mirrors
 * `rowsOf` in `cluster-lock.ts` so the existence probe reads either shape.
 */
function rowsOf(result: unknown): ReadonlyArray<Record<string, unknown>> {
  if (Array.isArray(result)) {
    return result as ReadonlyArray<Record<string, unknown>>;
  }
  const wrapped = (result as { rows?: ReadonlyArray<Record<string, unknown>> })
    ?.rows;
  return Array.isArray(wrapped) ? wrapped : [];
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createOrgSignupService(
  deps: OrgSignupServiceDeps,
): OrgSignupService {
  const createAdmin = deps.createAdminClient ?? createSupabaseAdminClient;
  const fetchImpl = deps.fetchImpl ?? fetch;

  async function mintSession(
    email: string,
    password: string,
  ): Promise<OrgSignupSession | null> {
    try {
      const url = `${deps.config.supabaseUrl.replace(/\/+$/, '')}/auth/v1/token?grant_type=password`;
      const res = await fetchImpl(url, {
        method: 'POST',
        headers: {
          apikey: deps.config.supabaseAnonKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        deps.logger?.warn?.(
          { service: 'org-signup', step: 'mint-session', status: res.status },
          'org-signup: password-grant session mint failed — returning pending_sign_in',
        );
        return null;
      }
      const json = (await res.json().catch(() => null)) as
        | Record<string, unknown>
        | null;
      if (
        !json ||
        typeof json.access_token !== 'string' ||
        typeof json.refresh_token !== 'string'
      ) {
        return null;
      }
      return {
        access_token: json.access_token,
        refresh_token: json.refresh_token,
        expires_in:
          typeof json.expires_in === 'number' ? json.expires_in : 3600,
        token_type:
          typeof json.token_type === 'string' ? json.token_type : 'bearer',
      };
    } catch (err) {
      deps.logger?.warn?.(
        {
          service: 'org-signup',
          step: 'mint-session',
          error: err instanceof Error ? err.message : 'unknown',
        },
        'org-signup: session mint threw — returning pending_sign_in',
      );
      return null;
    }
  }

  async function provisionPlatformRows(args: {
    readonly tenantId: string;
    readonly orgId: string;
    readonly ownerId: string;
    readonly orgName: string;
    readonly country: SupportedCountry;
    readonly ownerEmail: string;
    readonly firstName: string;
    readonly lastName: string;
    readonly fullName: string;
  }): Promise<void> {
    const db = deps.db;
    if (!db) {
      throw new Error('org-signup: DATABASE_URL unset — cannot provision tenant');
    }
    const now = new Date();
    // Cross-tenant, pre-auth provisioning → service-role context. The
    // three inserts run inside one transaction so a partial tenant (no
    // owner / no org) can never be observed. `withServiceRoleContext`
    // wraps `db.transaction` and binds the bypass GUC.
    await withServiceRoleContext(db as never, async (tx) => {
      const txDb = tx as unknown as OrgSignupDbClient;
      await txDb.insert(tenants).values({
        id: args.tenantId,
        name: args.orgName,
        slug: buildSlug(args.orgName),
        status: 'trial',
        subscriptionTier: 'starter',
        primaryEmail: args.ownerEmail,
        country: args.country,
        createdAt: now,
        updatedAt: now,
        createdBy: args.ownerId,
      });
      await txDb.insert(organizations).values({
        id: args.orgId,
        tenantId: args.tenantId,
        code: 'ROOT',
        name: args.orgName,
        level: 0,
        path: args.orgId,
        isActive: true,
        createdAt: now,
        updatedAt: now,
        createdBy: args.ownerId,
      });
      await txDb.insert(users).values({
        id: args.ownerId,
        tenantId: args.tenantId,
        organizationId: args.orgId,
        email: args.ownerEmail,
        firstName: args.firstName,
        lastName: args.lastName,
        displayName: args.fullName,
        status: 'active',
        isOwner: true,
        activatedAt: now,
        createdAt: now,
        updatedAt: now,
      });
    });
  }

  /**
   * Resolve the Supabase auth user id for an email by paginating the admin
   * `listUsers` API. There is no first-class get-by-email on the admin API,
   * so we walk pages (capped) and match on a lowercased email — the caller
   * already trimmed + lowercased `input.ownerEmail`. Returns `null` when no
   * auth user exists or the lookup is inconclusive (heal then defers to the
   * uniform duplicate path). Never throws: a lookup failure must not turn a
   * benign duplicate into a 500.
   */
  async function findAuthUserIdByEmail(
    admin: ReturnType<typeof createAdmin>,
    email: string,
  ): Promise<string | null> {
    const target = email.trim().toLowerCase();
    const perPage = 200;
    // Cap the walk so a large project can never make signup unbounded; the
    // orphaned-account window we heal is recent, so the user is on an early
    // page in practice. Beyond the cap we fall back to the duplicate path.
    const maxPages = 20;
    try {
      for (let page = 1; page <= maxPages; page += 1) {
        const { data, error } = await admin.auth.admin.listUsers({
          page,
          perPage,
        });
        if (error) {
          deps.logger?.warn?.(
            { service: 'org-signup', step: 'heal-lookup', page },
            'org-signup: listUsers failed during heal lookup — deferring to duplicate path',
          );
          return null;
        }
        const list = data?.users ?? [];
        const match = list.find(
          (u) => (u.email ?? '').trim().toLowerCase() === target,
        );
        if (match?.id) {
          return match.id;
        }
        // Last (short) page reached → email is genuinely absent.
        if (list.length < perPage) {
          return null;
        }
      }
      return null;
    } catch (err) {
      deps.logger?.warn?.(
        {
          service: 'org-signup',
          step: 'heal-lookup',
          error: err instanceof Error ? err.message : 'unknown',
        },
        'org-signup: heal lookup threw — deferring to duplicate path',
      );
      return null;
    }
  }

  /**
   * Whether the platform owner `users` row already exists for this auth user
   * id. Because `provisionPlatformRows` writes the tenant + org + owner rows
   * inside ONE transaction, the platform side is all-or-nothing: an owner row
   * present means the account is fully provisioned (genuine duplicate); its
   * absence with an existing auth user is the orphaned half-state we heal.
   * Runs under service-role context (no tenant exists in the GUC yet).
   */
  async function ownerRowExists(authUserId: string): Promise<boolean> {
    const db = deps.db;
    if (!db) {
      throw new Error('org-signup: DATABASE_URL unset — cannot inspect tenant');
    }
    return await withServiceRoleContext(db as never, async (tx) => {
      const txDb = tx as unknown as OrgSignupDbClient;
      // Literal `users` / `id` identifiers (the 0001 canonical names — see the
      // `users` schema); only the auth-user id is a BOUND parameter, never
      // interpolated. Mirrors the raw-SQL probe style in `cluster-lock.ts`.
      const result = await txDb.execute(
        sql`SELECT 1 FROM users WHERE id = ${authUserId} LIMIT 1`,
      );
      return rowsOf(result).length > 0;
    });
  }

  /**
   * Shared finalisation for both the fresh-signup and heal paths: provision
   * the platform rows (idempotently — only called when no owner row exists),
   * stamp `app_metadata.tenant_id` + OWNER role, then mint the session. A
   * provisioning failure rolls the orphaned auth user back ONLY on the fresh
   * path (`rollbackAuthUserOnFailure`); on the heal path we keep the existing
   * auth user so a later retry can heal again rather than destroying identity.
   */
  async function finalizeProvisioning(args: {
    readonly admin: ReturnType<typeof createAdmin>;
    readonly authUserId: string;
    readonly input: OrgSignupInput;
    readonly fullName: string;
    readonly firstName: string;
    readonly lastName: string;
    readonly rollbackAuthUserOnFailure: boolean;
  }): Promise<OrgSignupResult> {
    const { admin, authUserId, input, fullName, firstName, lastName } = args;
    const tenantId = newId('tn');
    const orgId = newId('org');
    // The platform owner-user id IS the Supabase auth user id so the
    // gateway's Supabase-JWT verifier resolves the same principal later.
    const ownerId = authUserId;

    try {
      await provisionPlatformRows({
        tenantId,
        orgId,
        ownerId,
        orgName: input.orgName.trim(),
        country: input.country,
        ownerEmail: input.ownerEmail,
        firstName,
        lastName,
        fullName,
      });
    } catch (err) {
      if (args.rollbackAuthUserOnFailure) {
        try {
          await admin.auth.admin.deleteUser(authUserId);
        } catch {
          // Best-effort compensation; surface the original failure below.
          deps.logger?.error?.(
            { service: 'org-signup', step: 'compensate-delete-auth-user' },
            'org-signup: failed to roll back orphaned auth user after provisioning error',
          );
        }
      }
      throw err instanceof Error ? err : new Error('provisioning_failed');
    }

    // Stamp the Supabase user's server-managed `app_metadata` with the tenant
    // binding + owner role BEFORE minting the session, so the minted access
    // token carries `app_metadata.tenant_id` — which the gateway's
    // Supabase-JWT verifier REQUIRES (a token without it is rejected, bouncing
    // the new owner back to /login). app_metadata is immutable to the client,
    // so this is the trusted tenant source. If stamping fails we fall through
    // to pending_sign_in rather than minting a token the cockpit cannot use.
    let metadataStamped = true;
    try {
      const { error: updateError } = await admin.auth.admin.updateUserById(
        authUserId,
        {
          app_metadata: {
            tenant_id: tenantId,
            roles: ['OWNER'],
          },
        },
      );
      if (updateError) {
        metadataStamped = false;
        deps.logger?.warn?.(
          { service: 'org-signup', step: 'stamp-app-metadata' },
          'org-signup: failed to stamp app_metadata.tenant_id — returning pending_sign_in',
        );
      }
    } catch (err) {
      metadataStamped = false;
      deps.logger?.warn?.(
        {
          service: 'org-signup',
          step: 'stamp-app-metadata',
          error: err instanceof Error ? err.message : 'unknown',
        },
        'org-signup: stamping app_metadata threw — returning pending_sign_in',
      );
    }

    // Mint the session (active model). If minting (or the metadata stamp
    // above) failed we still report a created account, but as
    // pending_sign_in (no cookie) so the owner can complete via the sign-in
    // form once their account is fully usable.
    const session = metadataStamped
      ? await mintSession(input.ownerEmail, input.ownerPassword)
      : null;

    deps.logger?.info?.(
      {
        service: 'org-signup',
        step: 'complete',
        tenantId,
        signupStatus: session ? 'active' : 'pending_sign_in',
      },
      'org-signup: tenant + owner provisioned',
    );

    return {
      kind: 'created',
      tenantId,
      ownerId,
      signupStatus: session ? 'active' : 'pending_sign_in',
      session,
    };
  }

  /**
   * Heal an orphaned half-state: a prior signup created the Supabase auth user
   * but crashed before (or during) platform provisioning, leaving an auth user
   * with no tenant + no `app_metadata.tenant_id`. On a same-email retry we
   * detect that orphan and idempotently re-provision + re-stamp + mint instead
   * of returning a dead-end 409. When the account is genuinely complete (owner
   * row already present) we keep the uniform duplicate response. Any
   * inconclusive lookup also defers to the duplicate path — heal never widens
   * the enumeration surface or hijacks a real account.
   */
  async function healOrphanOrDuplicate(args: {
    readonly admin: ReturnType<typeof createAdmin>;
    readonly input: OrgSignupInput;
    readonly fullName: string;
    readonly firstName: string;
    readonly lastName: string;
  }): Promise<OrgSignupResult> {
    const { admin, input } = args;
    // No DB handle → we cannot inspect platform rows, so we cannot safely
    // assert an orphan. Fall back to the uniform duplicate response.
    if (!deps.db) {
      return { kind: 'duplicate_email' };
    }

    const authUserId = await findAuthUserIdByEmail(admin, input.ownerEmail);
    if (!authUserId) {
      return { kind: 'duplicate_email' };
    }

    let alreadyProvisioned: boolean;
    try {
      alreadyProvisioned = await ownerRowExists(authUserId);
    } catch (err) {
      // Inspecting the platform side failed — do NOT re-provision blindly
      // (that risks a duplicate-key throw against a real account). Defer.
      deps.logger?.warn?.(
        {
          service: 'org-signup',
          step: 'heal-inspect',
          error: err instanceof Error ? err.message : 'unknown',
        },
        'org-signup: could not inspect platform rows during heal — deferring to duplicate path',
      );
      return { kind: 'duplicate_email' };
    }

    if (alreadyProvisioned) {
      // Fully provisioned account → genuine duplicate. Uniform response.
      return { kind: 'duplicate_email' };
    }

    deps.logger?.info?.(
      { service: 'org-signup', step: 'heal-reprovision' },
      'org-signup: healing orphaned auth user (no platform rows) — re-provisioning',
    );

    // Heal: re-provision against the EXISTING auth user id (idempotent — only
    // reached when no owner row exists). Keep the auth user on failure so a
    // later retry can heal again rather than destroying the identity.
    return await finalizeProvisioning({
      admin,
      authUserId,
      input,
      fullName: args.fullName,
      firstName: args.firstName,
      lastName: args.lastName,
      rollbackAuthUserOnFailure: false,
    });
  }

  async function signup(input: OrgSignupInput): Promise<OrgSignupResult> {
    const admin = createAdmin({
      url: deps.config.supabaseUrl,
      serviceRoleKey: deps.config.supabaseServiceRoleKey,
    });

    const fullName = input.ownerFullName.trim();
    const { firstName, lastName } = splitName(fullName);

    // 1. Create the canonical Supabase auth user. `email_confirm: true`
    //    admin-confirms the address: the SaaS owner just proved control by
    //    typing the password into the trusted marketing form, so we issue
    //    an immediately-usable account (mirrors the sign-IN funnel, which
    //    authenticates via signInWithPassword and requires a confirmed
    //    user). Duplicate email → route through the heal path: if the auth
    //    user is an orphaned half-state (created earlier, but provisioning
    //    crashed so it has no tenant + no app_metadata.tenant_id) we
    //    idempotently re-provision instead of returning a dead-end 409;
    //    a fully-provisioned account stays a uniform duplicate.
    let authUserId: string;
    try {
      const { data, error } = await admin.auth.admin.createUser({
        email: input.ownerEmail,
        password: input.ownerPassword,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          country: input.country,
          signup_source: 'marketing_owner_form',
        },
      });
      if (error) {
        if (isDuplicateEmailError(error)) {
          return await healOrphanOrDuplicate({
            admin,
            input,
            fullName,
            firstName,
            lastName,
          });
        }
        deps.logger?.error?.(
          { service: 'org-signup', step: 'create-auth-user' },
          'org-signup: Supabase admin.createUser failed',
        );
        throw new Error('auth_user_creation_failed');
      }
      const id = data?.user?.id;
      if (!id || typeof id !== 'string') {
        throw new Error('auth_user_creation_returned_no_id');
      }
      authUserId = id;
    } catch (err) {
      // `createUser` can throw (network) OR resolve with `error`. The
      // resolved-error duplicate case is handled above; a thrown
      // duplicate (some SDK versions throw) is healed here too.
      if (isDuplicateEmailError((err as { cause?: unknown })?.cause ?? err)) {
        return await healOrphanOrDuplicate({
          admin,
          input,
          fullName,
          firstName,
          lastName,
        });
      }
      throw err;
    }

    // 2-4. Provision the platform rows atomically, stamp the tenant binding
    //       into app_metadata, then mint the session. On the fresh path a
    //       provisioning failure rolls the just-created auth user back so a
    //       retry with the same email is not permanently blocked by a
    //       half-provisioned account (idempotent re-POST safety).
    return await finalizeProvisioning({
      admin,
      authUserId,
      input,
      fullName,
      firstName,
      lastName,
      rollbackAuthUserOnFailure: true,
    });
  }

  return { signup };
}
