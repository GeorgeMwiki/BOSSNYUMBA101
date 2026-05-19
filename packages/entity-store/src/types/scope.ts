/**
 * Scope model — distinguishes BOSSNYUMBA-as-software-company entities
 * from owner-tenant entities so the MD can route a chat correctly:
 *
 *   - 'platform' — BOSSNYUMBA's own internal world (internal-staff,
 *     platform-leads, platform-vendors). Only the internal-admin role
 *     can talk to the MD about these. NULL tenantId.
 *
 *   - 'tenant'   — owner-customer's world (their employees, their
 *     properties, their tickets). The owning tenant can read/write;
 *     internal-admin can if they have cross-tenant grant. tenantId
 *     MUST be set.
 *
 * Cross-leak is blocked in BOTH layers:
 *   1. Service-layer `enforceScope()` rejects mismatched ownerType.
 *   2. DB-layer RLS + FORCE ROW LEVEL SECURITY on tenant-scoped rows.
 */

export type ScopeOwnerType = 'platform' | 'tenant';

export interface EntityScope {
  readonly ownerType: ScopeOwnerType;
  /**
   * For tenant scope: the tenant UUID.
   * For platform scope: omitted (or a sentinel constant `PLATFORM_OWNER_ID`).
   */
  readonly ownerId: string;
}

export const PLATFORM_OWNER_ID = '00000000-0000-0000-0000-000000000000';

/** Caller principal — used by enforceScope to gate cross-scope reads. */
export interface CallerPrincipal {
  /** 'internal-admin' has cross-platform read; 'tenant-user' is bounded. */
  readonly role: 'internal-admin' | 'tenant-user' | 'system';
  /**
   * When role === 'tenant-user', this is the tenant they belong to and
   * the only `scope.ownerId` they can read/write.
   */
  readonly tenantId?: string;
  /**
   * When role === 'internal-admin' with a cross-tenant grant, this is
   * the explicit set of tenant ids they can act on. An empty / missing
   * set means platform-only.
   */
  readonly crossTenantGrants?: ReadonlyArray<string>;
}

export class ScopeViolationError extends Error {
  constructor(
    public readonly principal: CallerPrincipal,
    public readonly attemptedScope: EntityScope,
  ) {
    super(
      `scope violation: principal role=${principal.role}` +
        ` tenantId=${principal.tenantId ?? 'n/a'}` +
        ` attempted ownerType=${attemptedScope.ownerType} ownerId=${attemptedScope.ownerId}`,
    );
    this.name = 'ScopeViolationError';
  }
}

/**
 * Throws ScopeViolationError if the caller cannot read/write entities in
 * the given scope. The matrix:
 *
 *   principal             platform scope          tenant scope
 *   ───────────────────── ─────────────────────── ───────────────────────────
 *   internal-admin        ALLOW                   ALLOW iff tenant in
 *                                                 crossTenantGrants
 *   tenant-user           DENY                    ALLOW iff tenantId match
 *   system                ALLOW                   ALLOW
 */
export function enforceScope(
  principal: CallerPrincipal,
  attempted: EntityScope,
): void {
  if (principal.role === 'system') return;

  if (attempted.ownerType === 'platform') {
    if (principal.role === 'internal-admin') return;
    throw new ScopeViolationError(principal, attempted);
  }

  // tenant scope
  if (principal.role === 'internal-admin') {
    const grants = principal.crossTenantGrants ?? [];
    if (grants.includes(attempted.ownerId)) return;
    throw new ScopeViolationError(principal, attempted);
  }

  // tenant-user
  if (principal.tenantId && principal.tenantId === attempted.ownerId) return;
  throw new ScopeViolationError(principal, attempted);
}
