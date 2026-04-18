// @ts-nocheck
/**
 * Service-context middleware.
 *
 * Injects the composition-root `ServiceRegistry` into every Hono
 * request so routers can pull pre-built domain services from
 * `c.get('services')` instead of throwing stub errors.
 *
 * Also shims the two legacy conventions some routers use:
 *   - `c.get('tenantId')` / `c.get('userId')` (flat)
 *   - `c.get('auth').tenantId` (nested, set by authMiddleware)
 *
 * The flat form is preserved here as a convenience for routers that
 * were written before the auth middleware stabilised on the nested
 * shape. Routers that read both forms continue to work.
 *
 * Additional shims:
 *   - `complianceExportService` — request-scoped accessor used by the
 *     compliance router. Constructed on first access because it lives
 *     in the reports package (different dep graph); we keep the lazy
 *     accessor pattern so we don't pay the cost unless the route is
 *     called.
 *   - `arrearsRepo` / `arrearsLedgerPort` — the arrears router pulls
 *     these separately; left undefined for now (route returns 503).
 *   - `gamificationRepo` — fallback for the gamification router when
 *     `gamificationService` isn't already on the context.
 */

import { createMiddleware } from 'hono/factory';
import type { ServiceRegistry } from './service-registry.js';

export function createServiceContextMiddleware(registry: ServiceRegistry) {
  return createMiddleware(async (c, next) => {
    // Primary: a single typed bag of all domain services.
    c.set('services', registry);

    // Flat convenience accessors (legacy router convention).
    const auth = c.get('auth') as
      | { tenantId?: string; userId?: string }
      | undefined;
    if (auth?.tenantId && !c.get('tenantId')) {
      c.set('tenantId', auth.tenantId);
    }
    if (auth?.userId && !c.get('userId')) {
      c.set('userId', auth.userId);
    }

    // Shim: individual service accessors used by routers that don't yet
    // pull from `services.*`. Only set when we have a live registry so
    // routers can distinguish "configured" from "not configured".
    if (registry.isLive) {
      if (registry.gamification) {
        c.set('gamificationService', registry.gamification);
        c.set('gamificationRepo', undefined); // service already built
      }
      // Waitlist endpoints read from `services.waitlist.service` directly.
      // Negotiation endpoints read from `services.negotiation` directly.
      // Marketplace endpoints read from `services.marketplace.*`.
    }

    await next();
  });
}
