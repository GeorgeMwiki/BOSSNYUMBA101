/**
 * Privacy-router — composition root (default-OFF feature flag).
 *
 * The router ships behind a flag that is OFF unless explicitly enabled. This
 * package stays ENV-FREE: it never reads `process.env`. The caller (the
 * api-gateway composition root) reads the flag
 * `BOSSNYUMBA_FEATURE_PRIVACY_ROUTER` and passes the resolved boolean as
 * `deps.enabled`. When the flag is off, {@link wirePrivacyRouter} returns
 * `null` and the gateway simply never mounts privacy-aware routing (callers
 * fall back to their existing provider selection).
 *
 * The returned {@link PrivacyRouterFacade} is a thin, dependency-bound facade
 * over {@link createPrivacyRouter}: the host calls `facade.handle(request)`
 * without re-threading ports each time.
 *
 * @module @bossnyumba/privacy-router/wire
 */

import {
  createPrivacyRouter,
  type PrivacyRouterDeps,
} from './router';
import {
  privacyRoutingRequestSchema,
  type PrivacyRoutingRequest,
  type PrivacyRoutingResult,
} from './types';

/** The canonical feature-flag name. READ BY THE CALLER, never by this package. */
export const PRIVACY_ROUTER_FLAG = 'BOSSNYUMBA_FEATURE_PRIVACY_ROUTER' as const;

/**
 * Dependencies for {@link wirePrivacyRouter}. Extends the router deps with a
 * single `enabled` boolean that the caller derives from the feature flag.
 */
export interface WirePrivacyRouterDeps extends PrivacyRouterDeps {
  /**
   * Resolved value of `BOSSNYUMBA_FEATURE_PRIVACY_ROUTER`. The composition root
   * computes `flagValue === 'on'` and passes the boolean here; this package
   * never touches the environment itself.
   */
  readonly enabled: boolean;
}

/** Dependency-bound privacy-router facade returned by {@link wirePrivacyRouter}. */
export interface PrivacyRouterFacade {
  /**
   * Route one inbound request. The request is validated at the boundary with
   * zod; a malformed payload yields a fail-CLOSED `DENIED` result rather than
   * throwing into the caller — the safest outcome for a privacy router.
   */
  handle(request: PrivacyRoutingRequest): Promise<PrivacyRoutingResult>;
}

/**
 * Wire the privacy router behind its feature flag.
 *
 * Returns a bound {@link PrivacyRouterFacade} when `deps.enabled` is true, or
 * `null` when the flag is off (default). Returning `null` is the single,
 * explicit signal the caller uses to skip privacy-aware routing entirely.
 */
export function wirePrivacyRouter(
  deps: WirePrivacyRouterDeps,
): PrivacyRouterFacade | null {
  if (!deps.enabled) return null;

  // Bind the ports once. `enabled` is the only field the router does not
  // consume; forward the typed deps so optional properties keep their exact
  // shape under exactOptionalPropertyTypes.
  const routerDeps: PrivacyRouterDeps = {
    pii: deps.pii,
    localHealth: deps.localHealth,
    ...(deps.fieldClassifier ? { fieldClassifier: deps.fieldClassifier } : {}),
    ...(deps.policy ? { policy: deps.policy } : {}),
    ...(deps.auditStore ? { auditStore: deps.auditStore } : {}),
    ...(deps.auditSink ? { auditSink: deps.auditSink } : {}),
    ...(deps.clock ? { clock: deps.clock } : {}),
  };
  const router = createPrivacyRouter(routerDeps);

  return {
    handle: async (
      request: PrivacyRoutingRequest,
    ): Promise<PrivacyRoutingResult> => {
      const parsed = privacyRoutingRequestSchema.safeParse(request);
      if (!parsed.success) {
        // Fail closed: a malformed request is denied, never leaked to cloud.
        return {
          endpoint: 'DENIED',
          piiStripped: false,
          strippedFields: [],
          classification: 'RESTRICTED',
          reason:
            'Malformed routing request rejected at the privacy boundary. ' +
            'Denied (fail-closed) — no provider was contacted.',
          timestamp: new Date(0).toISOString(),
        };
      }
      // `request` is already typed PrivacyRoutingRequest; the zod parse above
      // is the boundary guard. Forward the original value to preserve the
      // exact optional-property shape (exactOptionalPropertyTypes).
      return router.route(request);
    },
  };
}
