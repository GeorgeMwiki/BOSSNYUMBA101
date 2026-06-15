/**
 * Composition root for the parcel-service pod.
 *
 * This is the file the process entrypoint (`index.ts main()`) calls to
 * assemble a PRODUCTION-wired app. The standalone pod ships its OWN
 * deployment (`infra/k8s/parcel-service`) — it is NOT mounted inside the
 * api-gateway — so this composition root is the only place a real
 * `TenantResolver` can be wired before boot.
 *
 * Why this exists (R2 mode-c finding):
 *
 *   `index.ts buildApp()` throws in production when no `tenantResolver`
 *   is wired AND `allowHeaderFallback` is not explicitly true (the
 *   tenant-spoof guard added in the 2026-05-24 bug-sweep). But `main()`
 *   previously called the bare `buildApp()` with no deps, so the prod
 *   pod hit that guard on every boot and crash-looped — never serving a
 *   request, never emitting an actionable reason an operator could fix.
 *
 *   This module closes the gap: it constructs a real JWT `TenantResolver`
 *   from the verified Supabase access token (the SAME token format the
 *   sibling field-capture-service authenticates — HS256 over
 *   `SUPABASE_JWT_SECRET`, tenant id from `app_metadata.tenant_id`) and
 *   passes it to `buildApp({ tenantResolver })` so the pod boots with a
 *   non-spoofable surface.
 *
 * PRODUCTION FAIL-FAST: when `NODE_ENV=production` and no JWT secret is
 * configured, a real `TenantResolver` genuinely cannot exist (there is
 * nothing to verify the token against). Rather than crash-looping on the
 * downstream guard with an opaque message — or, worse, booting with the
 * header-trust fallback (tenant spoofing) — this THROWS a clear,
 * actionable error naming the missing secret. The operator fixes the
 * env; the pod then boots correctly.
 */

import { jwtVerify } from 'jose';
import { buildApp } from '../index.js';
import type { FastifyInstance } from 'fastify';
import type { TenantResolver } from '../routes/parcels.js';
import { logger } from '../logger.js';

/** Env keys the JWT resolver reads, in precedence order. */
const JWT_SECRET_ENV_KEYS = ['SUPABASE_JWT_SECRET', 'JWT_SECRET'] as const;

export interface BuildProductionAppOptions {
  /**
   * Inject a pre-built resolver (tests). Production derives a JWT
   * resolver from the environment.
   */
  readonly tenantResolver?: TenantResolver;
  /**
   * Override the production gate (tests). When omitted it is derived
   * from `NODE_ENV === 'production'`.
   */
  readonly isProduction?: boolean;
  /**
   * Override the raw JWT secret (tests). When omitted it is read from
   * `SUPABASE_JWT_SECRET` / `JWT_SECRET`.
   */
  readonly jwtSecret?: string;
}

function readJwtSecret(override?: string): string | null {
  const raw = override ?? JWT_SECRET_ENV_KEYS.map((k) => process.env[k]).find(
    (v): v is string => typeof v === 'string' && v.length > 0,
  );
  // A too-short secret is treated as unconfigured — `jose` would accept
  // it but it provides no real protection, so we refuse it loudly via
  // the same fail-fast path rather than booting a weak surface.
  if (!raw || raw.length < 10) return null;
  return raw;
}

function bearerFromRequest(request: unknown): string | null {
  const headers = (request as { headers?: Record<string, unknown> } | undefined)
    ?.headers;
  const authorization = headers?.['authorization'];
  if (typeof authorization !== 'string') return null;
  const m = authorization.match(/^Bearer\s+(.+)$/i);
  return m ? (m[1] ?? '').trim() || null : null;
}

function tenantIdFromClaims(payload: Record<string, unknown>): string | null {
  // Tenant id comes ONLY from server-controlled, signature-checked claims:
  // `app_metadata.tenant_id` (Supabase service-role-stamped) or the top-level
  // `tenantId` claim. `user_metadata` is client-writable via
  // `supabase.auth.updateUser` — even inside a verified token its contents are
  // attacker-controlled — so it is NEVER a tenant source. Trusting it would let
  // a half-provisioned account (one with no `app_metadata.tenant_id`) self-select
  // a tenant. (RBAC canon: tenant from the trusted resolver only.)
  const app = payload['app_metadata'] as Record<string, unknown> | undefined;
  const fromApp = app?.['tenant_id'];
  if (typeof fromApp === 'string' && fromApp.length > 0) return fromApp;
  const fromTop = payload['tenantId'];
  if (typeof fromTop === 'string' && fromTop.length > 0) return fromTop;
  return null;
}

/**
 * Build a `TenantResolver` that verifies the inbound Bearer token (HS256
 * over the shared Supabase JWT secret) and returns the tenant id from
 * the verified claims. Never trusts a client-supplied tenant id — the
 * value comes only from a signature-checked token.
 *
 * Returns `null` (→ 401 at the route) on any failure: missing token,
 * bad signature, or absent tenant claim. A misbehaving token MUST NOT
 * degrade to header trust.
 */
export function createJwtTenantResolver(secret: string): TenantResolver {
  const key = new TextEncoder().encode(secret);
  return {
    async resolve(request: unknown): Promise<string | null> {
      const token = bearerFromRequest(request);
      if (!token) return null;
      try {
        const { payload } = await jwtVerify(token, key, {
          algorithms: ['HS256'],
        });
        return tenantIdFromClaims(payload as Record<string, unknown>);
      } catch {
        return null;
      }
    },
  };
}

/**
 * Assemble the production app with a real JWT `TenantResolver`.
 *
 * THROWS with an actionable message when production is required but no
 * JWT secret is configured — a real resolver cannot exist without one,
 * and booting the header-trust fallback would expose a tenant-spoofable
 * surface. Fail-fast beats both a silent spoof and an opaque crash-loop.
 */
export async function buildProductionApp(
  options: BuildProductionAppOptions = {},
): Promise<FastifyInstance> {
  const isProd = options.isProduction ?? process.env.NODE_ENV === 'production';

  const resolver =
    options.tenantResolver ??
    (() => {
      const secret = readJwtSecret(options.jwtSecret);
      if (!secret) {
        if (isProd) {
          throw new Error(
            'parcel-service: refusing to start in production without a JWT ' +
              'secret — set SUPABASE_JWT_SECRET (or JWT_SECRET, min 10 chars) ' +
              'so the tenant resolver can verify inbound access tokens. ' +
              'Without it a real TenantResolver cannot exist and the only ' +
              'alternative (X-Tenant-Id header trust) is tenant-spoofable.',
          );
        }
        return undefined;
      }
      return createJwtTenantResolver(secret);
    })();

  if (resolver) {
    logger.info('[parcel-service] composition: JWT tenant resolver wired');
    return buildApp({ tenantResolver: resolver });
  }

  // Dev/test only (isProd === false): no resolver and no secret. Boot
  // with the explicit header fallback so local stacks work without a
  // JWT secret. Production never reaches here — it threw above.
  logger.warn(
    '[parcel-service] composition: no JWT secret — DEV header fallback ' +
      '(X-Tenant-Id). NEVER use this in production.',
  );
  return buildApp({ allowHeaderFallback: true });
}
