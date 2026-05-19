/**
 * Principal — the actor making a render request.
 *
 * Structurally compatible with K-F's `agent-surface` Principal. We
 * duplicate the type here for the same reason we duplicate AgUiUiPart:
 * the tab-views package must run in environments that do not (yet)
 * have K-F installed. When K-F's `agent-surface` lands in main, an
 * adapter in `consumers/` can re-export this type from there.
 *
 * Permission semantics (mirrored from K-F):
 *
 *   - `internal-admin` Internal BOSSNYUMBA staff. Default scope is
 *                       their assigned tenantId but may opt-in to
 *                       cross-tenant via `allowCrossTenant: true` on
 *                       the render request. Every cross-tenant render
 *                       MUST be audited.
 *
 *   - `owner-customer` External owner/manager on a single tenant.
 *                       STRICTLY isolated to `principal.tenantId`.
 *                       The render-tool MUST refuse `allowCrossTenant`
 *                       for this principal kind.
 */

export type PrincipalKind = 'internal-admin' | 'owner-customer';

export interface Principal {
  readonly principalId: string;
  readonly kind: PrincipalKind;
  readonly tenantId: string;
  /**
   * Optional roles for predicate-driven view gating (e.g. only the
   * `finance_admin` role sees the recommendation-approval column).
   */
  readonly roles?: readonly string[];
}

/**
 * Build a principal for an internal-admin viewer. Convenience helper
 * for tests + the rare runtime call-site.
 */
export function internalAdmin(args: {
  principalId: string;
  tenantId: string;
  roles?: readonly string[];
}): Principal {
  return {
    principalId: args.principalId,
    kind: 'internal-admin',
    tenantId: args.tenantId,
    ...(args.roles !== undefined ? { roles: args.roles } : {}),
  };
}

/**
 * Build a principal for an owner-customer viewer. Same role-aware
 * shape as `internalAdmin`.
 */
export function ownerCustomer(args: {
  principalId: string;
  tenantId: string;
  roles?: readonly string[];
}): Principal {
  return {
    principalId: args.principalId,
    kind: 'owner-customer',
    tenantId: args.tenantId,
    ...(args.roles !== undefined ? { roles: args.roles } : {}),
  };
}
