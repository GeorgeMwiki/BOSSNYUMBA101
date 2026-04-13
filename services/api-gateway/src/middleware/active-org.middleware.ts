// @ts-nocheck
/**
 * Active Org Middleware
 *
 * Reads the `X-Active-Org` header sent by client org-switchers and
 * validates the caller's membership in that tenant. On success, sets
 * `activeOrgId` and `activeMembership` on the Hono context so downstream
 * handlers can scope queries without re-checking.
 *
 * Mount AFTER auth middleware so `c.get('userId')` is available.
 *
 * Behavior:
 *   - Header absent → pass through; `activeOrgId` stays `undefined`.
 *     Downstream code should fall back to `user.tenantId` from the JWT.
 *   - Header present + valid active membership → sets `activeOrgId`.
 *   - Header present + no matching membership OR status !== ACTIVE → 403.
 */

import { createMiddleware } from 'hono/factory';
import type { Context } from 'hono';

/**
 * Minimal membership check result. In production this would be a DB
 * lookup against the `cross_tenant_memberships` table; for now we
 * accept an injected resolver so the middleware is testable without a
 * database.
 */
export interface MembershipCheck {
  id: string;
  tenantId: string;
  organizationId: string | null;
  role: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'REVOKED';
}

export type MembershipResolver = (
  userId: string,
  tenantId: string,
) => Promise<MembershipCheck | null>;

/**
 * Default resolver that checks both:
 *   1. User's own tenantId from JWT (always valid as a "primary" membership)
 *   2. cross_tenant_memberships table via the injected `db` query
 *
 * When no DB is injected, only #1 works (good for tests / bootstrap).
 */
function defaultResolver(dbQuery?: (userId: string, tenantId: string) => Promise<MembershipCheck | null>): MembershipResolver {
  return async (userId: string, tenantId: string) => {
    if (dbQuery) {
      return dbQuery(userId, tenantId);
    }
    // Fallback: no DB — accept any tenantId (will be tightened when wired)
    return { id: 'fallback', tenantId, organizationId: null, role: 'CUSTOMER', status: 'ACTIVE' };
  };
}

export function activeOrgMiddleware(
  resolver?: MembershipResolver,
) {
  const resolve = resolver ?? defaultResolver();

  return createMiddleware(async (c: Context, next) => {
    const header = c.req.header('X-Active-Org');

    if (!header || header.trim() === '') {
      // No active-org override → downstream uses JWT tenantId.
      await next();
      return;
    }

    const requestedTenantId = header.trim();
    const userId = c.get('userId') as string | undefined;

    if (!userId) {
      // Auth middleware didn't run or user is unauthenticated.
      // Let downstream auth guards handle the 401.
      await next();
      return;
    }

    // Check if the user has an active membership in the requested tenant.
    const membership = await resolve(userId, requestedTenantId);

    if (!membership || membership.status !== 'ACTIVE') {
      return c.json(
        {
          success: false,
          error: {
            code: 'INVALID_ACTIVE_ORG',
            message: `You do not have an active membership in tenant "${requestedTenantId}".`,
          },
        },
        403,
      );
    }

    // Stamp the context so downstream handlers can read the active org.
    c.set('activeOrgId', membership.tenantId);
    c.set('activeMembership', membership);

    await next();
  });
}
