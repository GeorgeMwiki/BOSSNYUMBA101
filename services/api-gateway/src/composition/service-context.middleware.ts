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
      // Wave-5 services wired from the composition root. Each router
      // reads its service via `c.get(<key>)`. If the registry is in
      // degraded mode (DATABASE_URL unset), the key is absent and the
      // router's fallback path returns 503 with a clear reason.
      if (registry.renewal) {
        c.set('renewalService', registry.renewal);
      }
      if (registry.financialProfile) {
        c.set('financialProfileService', registry.financialProfile);
      }
      if (registry.riskReport) {
        c.set('riskReportService', registry.riskReport);
      }
      if (registry.stationMasterRouter) {
        c.set('stationMasterRouter', registry.stationMasterRouter);
      }
      if (registry.stationMasterCoverageRepo) {
        c.set(
          'stationMasterCoverageRepo',
          registry.stationMasterCoverageRepo
        );
      }
      if (registry.occupancyTimeline) {
        c.set('occupancyTimelineService', registry.occupancyTimeline);
      }
      // Waitlist endpoints read from `services.waitlist.service` directly.
      // Negotiation endpoints read from `services.negotiation` directly.
      // Marketplace endpoints read from `services.marketplace.*`.

      // Arrears router pulls these four keys directly via `c.get(...)`.
      // The composition root builds real Postgres-backed instances so
      // the projection endpoint stops returning LOADER_MISSING.
      if (registry.arrears?.service) {
        c.set('arrearsService', registry.arrears.service);
      }
      if (registry.arrears?.repo) {
        c.set('arrearsRepo', registry.arrears.repo);
      }
      if (registry.arrears?.ledgerPort) {
        c.set('arrearsLedgerPort', registry.arrears.ledgerPort);
      }
      if (registry.arrears?.entryLoader) {
        c.set('arrearsEntryLoader', registry.arrears.entryLoader);
      }
    }

    await next();
  });
}
