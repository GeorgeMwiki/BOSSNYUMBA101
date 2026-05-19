/**
 * Tenant-scoped React Query key helper for estate-manager-app.
 *
 * Closes round-3 finding C-3 (CRITICAL) + H-8 (HIGH): the estate
 * manager app supports tenant switching via
 * `AuthProvider.setActiveTenant`. Before this fix, query keys did not
 * include the tenant id, so a property manager who flipped the tenant
 * picker would briefly see the previous tenant's cached data until
 * each query refetched.
 *
 * Convention: ALWAYS make `tenantId` (or `'no-tenant'` for pre-auth
 * queries) the FIRST element of the key. The AuthProvider now also
 * calls `queryClient.removeQueries()` on every tenant switch (see
 * `AuthProvider.setActiveTenant`).
 */

export const NO_TENANT_SCOPE = 'no-tenant' as const;

export function tenantKey(
  tenantId: string | null | undefined,
  ...rest: ReadonlyArray<unknown>
): ReadonlyArray<unknown> {
  const scope = tenantId && tenantId.length > 0
    ? `tenant:${tenantId}`
    : NO_TENANT_SCOPE;
  return [scope, ...rest];
}

/**
 * Convenience React hook — reads the active tenant id from
 * AuthProvider and returns the prefix tuple. Pages call this once
 * per render and spread the result into their own query keys.
 *
 *   const scope = useTenantQueryScope();
 *   useQuery({ queryKey: [...scope, 'customer', id], ... });
 */
// Note: importing useAuth here would create a cycle (AuthProvider →
// hooks → AuthProvider). Page files should import useAuth + tenantKey
// directly. See `apps/estate-manager-app/src/app/customers/page.tsx`
// for the canonical pattern.
