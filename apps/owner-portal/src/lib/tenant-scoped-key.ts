/**
 * Tenant-scoped React Query key helper.
 *
 * Closes round-3 finding C-3 (CRITICAL): cross-tenant cache pollution.
 * Every cache key in the owner-portal previously omitted the tenant
 * identifier, so a stale entry from tenant A could be served to a
 * just-logged-in user of tenant B until the per-query refetch fires.
 *
 * Convention: ALWAYS make `tenantId` (or `'no-tenant'` for pre-auth
 * queries) the FIRST element of the key. `queryClient.removeQueries`
 * / `invalidateQueries` therefore scope naturally to the active
 * tenant.
 */

/**
 * Sentinel used before the tenant is hydrated. We deliberately do NOT
 * fall back to `'shared'` or `''` — both can collide with a real
 * tenant id and re-introduce the bug.
 */
export const NO_TENANT_SCOPE = 'no-tenant' as const;

/**
 * Prefix a key with the active tenant id (or the no-tenant sentinel).
 *
 * @example
 *   tenantKey(tenant?.id, 'properties')
 *   // ['tenant:abc-123', 'properties']
 */
export function tenantKey(
  tenantId: string | null | undefined,
  ...rest: ReadonlyArray<unknown>
): ReadonlyArray<unknown> {
  const scope = tenantId && tenantId.length > 0
    ? `tenant:${tenantId}`
    : NO_TENANT_SCOPE;
  return [scope, ...rest];
}
