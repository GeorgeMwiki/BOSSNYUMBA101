/**
 * Identity wiring — composition-root binding for `@bossnyumba/identity`.
 *
 * Builds the three cross-org identity services and their Postgres repos from
 * the singleton Drizzle client:
 *
 *   - PostgresTenantIdentityRepository  — global phone-keyed principals
 *   - PostgresOrgMembershipRepository   — per-org join rows (+ shadow users)
 *       (wired with DefaultUserShadowWriter)
 *   - PostgresInviteCodeRepository      — redeemable codes (atomic redeem)
 *   - OtpService                        — phone OTP issuance/verify, dispatched
 *       through `NotificationsSmsDispatcher` (via the `otp-factory`)
 *
 * The OTP factory resolves a durable store (Redis when REDIS_URL is set) and
 * binds the notifications `enqueue` function. Identity does NOT depend on the
 * notifications package directly (acyclic graph rule), so the enqueue function
 * is supplied here through a lazy dynamic import of
 * `@bossnyumba/notifications-service`. When that package or its provider is not
 * reachable, OTP SMS dispatch fails CLOSED with a clear error rather than
 * silently dropping the code.
 *
 * Degraded mode: when DATABASE_URL is unset `getDb()` returns null and
 * `buildIdentityServices` resolves to `null`. The identity router then returns
 * 503 IDENTITY_NOT_CONFIGURED (the project-wide pure-DB convention).
 *
 * tenant_identities is CROSS-ORG (a unique phone index, deliberately NO RLS),
 * so tenant scope is NOT enforced at the DB layer for that table — it is the
 * route/service layer's job. This wiring exposes only the services; the route
 * (`routes/identity.hono.ts`) derives org/tenant from the verified JWT and
 * never trusts a client-supplied tenantId.
 */

import {
  TenantIdentityService,
  InviteCodeService,
  OrgMembershipService,
  PostgresTenantIdentityRepository,
  PostgresOrgMembershipRepository,
  PostgresInviteCodeRepository,
  DefaultUserShadowWriter,
  createOtpService,
  type OtpService,
  type EnqueueNotificationFn,
  type EnqueueNotificationPayload,
  type EnqueueNotificationResult,
} from '@bossnyumba/identity';
import { createMiddleware } from 'hono/factory';
import type { Logger } from 'pino';

/**
 * The bag of identity services exposed to the route layer via
 * `c.get('services').identity`.
 */
export interface IdentityServices {
  readonly tenantIdentity: TenantIdentityService;
  readonly inviteCode: InviteCodeService;
  readonly orgMembership: OrgMembershipService;
  readonly otp: OtpService;
  /**
   * Platform-default ISO-3166 alpha-2 country code used to normalize phones
   * during OTP onboarding when the caller does not supply one. Tanzania is the
   * launch jurisdiction; overridable via `IDENTITY_DEFAULT_COUNTRY` so this is
   * never hard-coded in a business-logic path.
   */
  readonly defaultCountryCode: string;
}

/**
 * Minimal structural shape of the Drizzle client the repos consume. The repo
 * client interfaces are intentionally loose (`(...args) => any`), so the real
 * postgres-js Drizzle client is structurally compatible; we accept `unknown`
 * here and narrow at the single construction boundary below.
 */
type DrizzleLike = unknown;

function resolveDefaultCountryCode(): string {
  const raw = process.env.IDENTITY_DEFAULT_COUNTRY?.trim();
  if (raw && /^[A-Za-z]{2}$/.test(raw)) return raw.toUpperCase();
  // Launch jurisdiction. NOT a hard-coded business rule — it is the platform
  // bootstrap default and is overridable via env above.
  return 'TZ';
}

/**
 * Build an `enqueue` adapter backed by the notifications service when it is
 * installable, else a fail-closed stub. Kept lazy so the api-gateway does not
 * take a hard dependency on `@bossnyumba/notifications-service`.
 */
function buildEnqueue(logger: Logger): EnqueueNotificationFn {
  let cached: Promise<EnqueueNotificationFn> | null = null;

  async function resolveReal(): Promise<EnqueueNotificationFn> {
    // The notifications service is NOT a hard dependency of the api-gateway
    // (keeps the package graph acyclic + the bundle lean). Resolve the
    // specifier through a runtime variable so TypeScript treats this as a
    // dynamic `import(string)` rather than a static module reference it would
    // try (and fail) to resolve at type-check time. The result is narrowed to
    // the identity-exported `EnqueueNotificationFn` port at the boundary.
    const specifier = '@bossnyumba/notifications-service';
    const mod = (await import(specifier).catch(() => null)) as
      | { enqueueNotification?: EnqueueNotificationFn }
      | null;
    const real = mod?.enqueueNotification;
    if (typeof real !== 'function') {
      logger.warn(
        'identity-wiring: @bossnyumba/notifications-service.enqueueNotification ' +
          'unavailable — OTP SMS dispatch will fail closed',
      );
      return failClosedEnqueue;
    }
    logger.info('identity-wiring: OTP SMS dispatch bound to notifications-service');
    return real;
  }

  // Return a stable function that resolves (and memoizes) the real impl on
  // first call. This keeps boot non-blocking and tolerant of a missing dep.
  return async (
    payload: EnqueueNotificationPayload,
  ): Promise<EnqueueNotificationResult> => {
    if (!cached) cached = resolveReal();
    const fn = await cached;
    return fn(payload);
  };
}

/** Fail-closed enqueue — surfaces clearly so the OTP record is rolled back. */
const failClosedEnqueue: EnqueueNotificationFn = async () => {
  throw new Error(
    'notifications-service unavailable: cannot dispatch OTP SMS',
  );
};

/**
 * Construct the identity services. Returns `null` when the DB client is null
 * (degraded mode). Async because the OTP factory may resolve a Redis store.
 */
export async function buildIdentityServices(
  db: DrizzleLike | null,
  logger: Logger,
): Promise<IdentityServices | null> {
  if (db === null || db === undefined) {
    logger.warn(
      'identity-wiring: DATABASE_URL unset — identity routes will 503',
    );
    return null;
  }

  // Repos. The repo client interfaces are deliberately structural; cast once
  // here at the composition boundary (no `any` leaks into the route layer).
  const identityRepo = new PostgresTenantIdentityRepository(
    db as never,
  );
  const membershipRepo = new PostgresOrgMembershipRepository(
    db as never,
    new DefaultUserShadowWriter(),
  );
  const inviteRepo = new PostgresInviteCodeRepository(
    db as never,
    membershipRepo,
  );

  // OTP — durable store (Redis when configured) + notifications-backed SMS.
  // tenantId on the factory is the per-request OTP tenant; we pass a neutral
  // bootstrap tenant here and the route supplies the real recipient context
  // through the dispatched notification payload. The factory requires a
  // non-empty tenantId, so use a stable platform sentinel.
  const otp = await createOtpService({
    enqueue: buildEnqueue(logger),
    tenantId: 'platform',
    logger: {
      warn: (message, meta) =>
        logger.warn({ value: meta ?? {} }, `[identity.otp] ${message}`),
    },
  });

  const tenantIdentity = new TenantIdentityService({
    identityRepo,
    membershipRepo,
    otpService: otp,
  });
  const inviteCode = new InviteCodeService({ inviteRepo, identityRepo });
  const orgMembership = new OrgMembershipService({
    membershipRepo,
    identityRepo,
  });

  logger.info('identity-wiring: identity services live (Postgres-backed)');
  return {
    tenantIdentity,
    inviteCode,
    orgMembership,
    otp,
    defaultCountryCode: resolveDefaultCountryCode(),
  };
}

/**
 * Hono middleware that merges the identity services into the existing
 * `c.get('services')` bag under the `identity` key, so the identity router can
 * read `(c.get('services') ?? {}).identity` exactly like other optional
 * service slices (cf. `cot-query.hono.ts`).
 *
 * `servicesPromise` is awaited once per request (resolution is memoized by the
 * caller). When it resolves to `null` the key is left unset and the route
 * returns 503.
 */
export function createIdentityContextMiddleware(
  servicesPromise: Promise<IdentityServices | null>,
) {
  return createMiddleware(async (c, next) => {
    const identity = await servicesPromise;
    const existing = (c.get('services') ?? {}) as Record<string, unknown>;
    c.set('services', { ...existing, identity } as never);
    await next();
  });
}
