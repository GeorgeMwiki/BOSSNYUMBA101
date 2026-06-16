/**
 * Owner org-signup router — `POST /api/v1/orgs/signup`.
 *
 * Backs the marketing `OwnerSignUpForm` (apps/marketing/src/components/
 * auth/OwnerSignUpForm.tsx). The form posts:
 *
 *   { orgName, ownerFullName, ownerEmail, ownerPassword, country }
 *
 * and expects, on success:
 *
 *   { success: true, tenantId, ownerId,
 *     signupStatus: 'active' | 'pending_sign_in', session? }
 *
 * with the gateway setting the `bossnyumba-session` HttpOnly cookie when
 * `signupStatus === 'active'`. On a duplicate email it expects a 409 with
 * a flat `{ success:false, error:'email_already_registered', message,
 * loginUrl }` envelope (the form maps `error === 'email_already_registered'`
 * onto the email field). On validation failure it expects
 * `{ error, message, issues:[{ path, message }] }`.
 *
 * IMPORTANT — envelope shape: the form parses a FLAT envelope
 * (`json.error` is a string CODE, plus `json.message` / `json.issues`),
 * NOT the gateway's canonical nested `{ error:{ code, message } }`. We
 * therefore hand-shape responses to the form contract here rather than
 * using the `e4xx` helpers.
 *
 * This router is a thin HTTP shell. ALL tenant/owner provisioning lives in
 * the single engine `createOrgSignupService` (composition/org-signup-
 * service.ts) so there is exactly one tenant-creation path. The router is
 * a deps-injected factory (`createOrgsRouter`) matching the sibling
 * routers' composition style so it can be wired at the composition root.
 *
 * Auth: PRE-AUTH / public (like `/auth/*` and `/onboarding/*`). No
 * `authMiddleware` is mounted — a tenant does not exist until this call
 * succeeds. The global `/api/v1/*` middlewares (metrics, tenant-isolation
 * defence-in-depth, service-context, security-events) still apply.
 *
 * Anti-enumeration: a duplicate email NEVER mints a session, NEVER sets a
 * cookie, and NEVER reveals whether the existing account has a live
 * session — it returns a uniform 409 + loginUrl.
 *
 * No `console.log` (Pino only). No `process.env` reads — config is
 * injected. Passwords are never logged.
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { buildSessionCookie } from '../auth/supabase';
import { getSharedPublicAiRateLimit } from '../middleware/public-ai-rate-limit';
import type {
  OrgSignupService,
  OrgSignupSession,
} from '../composition/org-signup-service';

// ---------------------------------------------------------------------------
// Validation — mirrors the form's client-side zod so server + client agree.
// ---------------------------------------------------------------------------

const SignupSchema = z.object({
  orgName: z.string().trim().min(2).max(160),
  ownerFullName: z.string().trim().min(2).max(120),
  ownerEmail: z.string().trim().toLowerCase().email().max(254),
  // Strong-enough password: length is the dominant strength factor and
  // matches the form's `min(8)`. Supabase enforces its own policy too.
  ownerPassword: z.string().min(8).max(200),
  country: z.enum(['TZ', 'KE', 'UG', 'NG']),
});

/** The login destination the form points a duplicate-email visitor at. */
const LOGIN_URL = '/sign-in?from=signup';

/** 7 days — matches `buildSessionCookie`'s default TTL. */
const SESSION_COOKIE_NAME = 'bossnyumba-session';

// ---------------------------------------------------------------------------
// Dependency surface
// ---------------------------------------------------------------------------

export interface OrgsRouterDeps {
  /** The single tenant/owner provisioning engine. */
  readonly service: OrgSignupService;
  /**
   * Force `Secure` on the session cookie. Defaults to undefined so
   * `buildSessionCookie` decides from NODE_ENV (Secure in production).
   * Injected so the composition root / tests stay env-free here.
   */
  readonly cookieSecure?: boolean;
  /** Optional cross-subdomain cookie domain (e.g. `.bossnyumba.com`). */
  readonly cookieDomain?: string;
  readonly logger?: {
    info?(obj: Record<string, unknown>, msg?: string): void;
    warn?(obj: Record<string, unknown>, msg?: string): void;
    error?(obj: Record<string, unknown>, msg?: string): void;
  };
}

// ---------------------------------------------------------------------------
// Cookie helper — reuses the canonical `buildSessionCookie` from the
// Supabase auth module (HttpOnly, Secure-in-prod, SameSite). We encode the
// access+refresh token pair so the cockpit can rehydrate the Supabase
// session from the cookie on its first request.
// ---------------------------------------------------------------------------

function sessionCookieValue(session: OrgSignupSession): string {
  return JSON.stringify({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    token_type: session.token_type,
    expires_in: session.expires_in,
  });
}

// ---------------------------------------------------------------------------
// Router factory
// ---------------------------------------------------------------------------

export function createOrgsRouter(deps: OrgsRouterDeps): Hono {
  const app = new Hono();

  // Anonymous, pre-auth account-creation surface — guard with the per-IP
  // public limiter (same shared bucket as the other /public surfaces, e.g.
  // public-leads.hono.ts) so a single origin cannot mint tenants/Supabase
  // accounts in a flood. The per-tenant token budget cannot apply here: no
  // tenant exists yet.
  const publicAiRateLimit = getSharedPublicAiRateLimit();
  app.use('*', publicAiRateLimit.handler);

  app.post('/signup', zValidator('json', SignupSchema, (result, c) => {
    // Shape validation errors to the FORM contract: a flat `issues` array
    // of `{ path, message }` plus a top-level `error` code + `message`.
    if (!result.success) {
      // @hono/zod-validator intersects the discriminated result with an extra
      // shape, which defeats `success` narrowing; on the failure branch `error`
      // is always a ZodError, so read its issues via the failure shape.
      const { error } = result as {
        readonly error: {
          readonly issues: ReadonlyArray<{
            readonly path: ReadonlyArray<string | number>;
            readonly message: string;
          }>;
        };
      };
      const issues = error.issues.map((i) => ({
        path: String(i.path[0] ?? 'form'),
        message: i.message,
      }));
      return c.json(
        {
          success: false,
          error: 'validation_failed',
          message: issues[0]?.message ?? 'Invalid sign-up details.',
          issues,
        },
        400,
      );
    }
    return undefined;
  }), async (c) => {
    const body = c.req.valid('json');

    let result;
    try {
      result = await deps.service.signup({
        orgName: body.orgName,
        ownerFullName: body.ownerFullName,
        ownerEmail: body.ownerEmail,
        ownerPassword: body.ownerPassword,
        country: body.country,
      });
    } catch (err) {
      deps.logger?.error?.(
        {
          route: 'orgs.signup',
          // Never log the email/password — only a stable error label.
          error: err instanceof Error ? err.message : 'unknown',
        },
        'orgs.signup: provisioning failed',
      );
      return c.json(
        {
          success: false,
          error: 'signup_failed',
          message:
            'We could not create your account right now. Please try again.',
        },
        500,
      );
    }

    // Duplicate email — uniform, anti-enumeration. No session, no cookie,
    // no signal about whether the existing account is live. The form maps
    // `error === 'email_already_registered'` onto the email field.
    if (result.kind === 'duplicate_email') {
      return c.json(
        {
          success: false,
          error: 'email_already_registered',
          message:
            'An account with this email already exists. Please sign in instead.',
          loginUrl: LOGIN_URL,
        },
        409,
      );
    }

    // Created. When the session minted (active model) we do TWO things:
    //  (1) return the Supabase `access_token` in the JSON body — this is
    //      the PRIMARY, topology-independent cross-origin handoff: the
    //      marketing form forwards it to the cockpit in a URL fragment and
    //      the cockpit authenticates via the canonical Supabase-JWT path.
    //  (2) set the HttpOnly `bossnyumba-session` cookie below — a SECONDARY
    //      mechanism for same-origin / shared-parent-domain proxy topologies
    //      (requires `cookieDomain` injection at the composition root). The
    //      body token works even when the cockpit is a fully separate origin.
    const resBody = {
      success: true as const,
      tenantId: result.tenantId,
      ownerId: result.ownerId,
      signupStatus: result.signupStatus,
      session:
        result.signupStatus === 'active' && result.session
          ? { access_token: result.session.access_token }
          : null,
    };

    if (result.signupStatus === 'active' && result.session) {
      // `append:true` so we never clobber a Set-Cookie another middleware
      // may have queued. The value is built by the canonical
      // `buildSessionCookie` helper (HttpOnly, Secure-in-prod, SameSite).
      c.header(
        'Set-Cookie',
        buildSessionCookie({
          name: SESSION_COOKIE_NAME,
          value: sessionCookieValue(result.session),
          maxAgeSeconds: result.session.expires_in,
          sameSite: 'lax',
          ...(deps.cookieSecure !== undefined
            ? { secure: deps.cookieSecure }
            : {}),
          ...(deps.cookieDomain ? { domain: deps.cookieDomain } : {}),
        }),
        { append: true },
      );
    }

    return c.json(resBody, 201);
  });

  return app;
}

export default createOrgsRouter;
