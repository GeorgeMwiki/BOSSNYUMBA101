/**
 * Org-scoped React Query key helper (customer-app).
 *
 * Closes round-3 finding C-3 (CRITICAL): cross-org cache pollution. In
 * the customer app the active scope is the organization the user is
 * currently viewing (`user.activeOrgId`). Logout already clears the
 * cache, but `setActiveOrg` (multi-org users) needs every key to be
 * prefixed with the org id so that a switch from org A to org B never
 * serves an A-cached entry to a now-B-scoped page.
 *
 * Convention: ALWAYS make the org scope the FIRST element of the key.
 */

export const NO_ORG_SCOPE = 'no-org' as const;

export function orgKey(
  orgId: string | null | undefined,
  ...rest: ReadonlyArray<unknown>
): ReadonlyArray<unknown> {
  const scope = orgId && orgId.length > 0
    ? `org:${orgId}`
    : NO_ORG_SCOPE;
  return [scope, ...rest];
}
