/**
 * Platform observability + authz wiring for @bossnyumba/domain-services.
 *
 * This module boots a shared structured logger from @bossnyumba/observability
 * and re-exports the RBAC engine from @bossnyumba/authz-policy so that all
 * domain services have a single import point for these concerns.
 *
 * NOTE: domain-services is a pure library (no HTTP server). Individual
 * service functions typically receive a caller identity from the upstream
 * api-gateway; when an AuthzUser is available use `authorizeOrThrow` below
 * to gate write paths.
 */

import { Logger as ObsLogger } from '@bossnyumba/observability';
import { rbacEngine, type User as AuthzUser, type Action, type Resource } from '@bossnyumba/authz-policy';

export const domainServicesLogger = new ObsLogger({
  service: {
    name: 'domain-services',
    version: process.env.SERVICE_VERSION || '0.1.0',
    environment: (process.env.NODE_ENV as 'development' | 'staging' | 'production') || 'development',
  },
  level: (process.env.LOG_LEVEL as 'info' | 'debug' | 'warn' | 'error') || 'info',
  pretty: process.env.NODE_ENV !== 'production',
});

domainServicesLogger.info('Observability initialized for domain-services', {
  env: process.env.NODE_ENV || 'development',
});

export { rbacEngine } from '@bossnyumba/authz-policy';
export type { User as AuthzUser, Action as AuthzAction, Resource as AuthzResource } from '@bossnyumba/authz-policy';

/**
 * Gate a domain operation behind an RBAC check. Throws when denied so
 * service code can keep its happy path uncluttered.
 */
export function authorizeOrThrow(
  user: AuthzUser,
  action: Action,
  resource: Resource,
  context?: Record<string, unknown>
): void {
  const decision = rbacEngine.checkPermission(user, action, resource, context);
  if (!decision.allowed) {
    domainServicesLogger.warn('Domain action denied by rbac', {
      userId: user.id,
      action,
      resource,
      reason: decision.reason,
    });
    const err = new Error(decision.reason ?? `Forbidden: cannot ${action} ${resource}`);
    (err as Error & { code?: string }).code = 'FORBIDDEN';
    throw err;
  }
}
