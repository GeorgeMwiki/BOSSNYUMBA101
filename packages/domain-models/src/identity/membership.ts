/**
 * Cross-Tenant Membership Model
 *
 * BOSSNYUMBA distinguishes two membership models:
 *
 * 1. **Single-tenant users** (OWNER, INTERNAL_ADMIN, SERVICE_ACCOUNT):
 *    These users belong to exactly one tenant (property-management
 *    company) for their entire lifetime. The existing `User.tenantId`
 *    field captures this. Their access is scoped to one tenant.
 *
 * 2. **Cross-tenant users** (CUSTOMER, MANAGER):
 *    A *resident* (CUSTOMER) may rent from multiple landlords — i.e.
 *    multiple tenants in the SaaS sense — using a SINGLE login. A
 *    *technician / estate manager* (MANAGER) may serve multiple
 *    landlords for the same reason. These users have one identity
 *    (one row in the `users` table, kept under their `primary tenant`)
 *    plus N additional `CrossTenantMembership` records linking the
 *    same email + user identity to other tenants.
 *
 * The auth flow on login MUST resolve all cross-tenant memberships for
 * the authenticating user and expose them to the client via the
 * `memberships` array on the auth context. The client then picks an
 * "active" membership (persisted in localStorage / secure storage) and
 * the API client sends `X-Active-Org` (or `X-Active-Tenant`) on every
 * subsequent request so the server scopes its queries.
 *
 * Owner-portal and admin-portal logins should NEVER instantiate cross-
 * tenant memberships — those surfaces are single-tenant only.
 */

import type {
  TenantId,
  OrganizationId,
  UserId,
  RoleId,
  ISOTimestamp,
} from '../common/types.js';

/**
 * Status of a cross-tenant membership. Suspended/revoked memberships
 * MUST NOT be returned by the auth flow's membership resolution.
 */
export const MembershipStatus = {
  /** Membership is currently active and selectable. */
  ACTIVE: 'ACTIVE',
  /** Tenant or membership is paused; user temporarily cannot switch into it. */
  SUSPENDED: 'SUSPENDED',
  /** Membership has been permanently revoked. */
  REVOKED: 'REVOKED',
} as const;

export type MembershipStatus = (typeof MembershipStatus)[keyof typeof MembershipStatus];

/**
 * A single cross-tenant membership record. Each row links one user
 * identity to one tenant the user does NOT primarily belong to.
 *
 * Identity matching is by `userId` (FK to the user record in the
 * primary tenant), NOT by email — emails can change but the canonical
 * user identity is stable.
 */
export interface CrossTenantMembership {
  /** Stable id for this membership row. */
  readonly id: string;
  /** The user identity this membership belongs to. */
  readonly userId: UserId;
  /** The tenant (landlord / property-management company) the user is a member of. */
  readonly tenantId: TenantId;
  /**
   * Optional pin to a specific organization within the tenant. If
   * absent, the membership grants access to the tenant's default org.
   */
  readonly organizationId: OrganizationId | null;
  /**
   * Role within this membership's tenant. A user may be a CUSTOMER in
   * one tenant and a MANAGER in another — the `role` here governs
   * what they can do AFTER they switch into this membership.
   */
  readonly role: RoleId;
  /** Membership lifecycle. */
  readonly status: MembershipStatus;
  /** When the membership was created. */
  readonly joinedAt: ISOTimestamp;
  /** Last time the user switched into this membership. */
  readonly lastActivatedAt: ISOTimestamp | null;
  /** Optional human-readable label shown in the org switcher. */
  readonly displayLabel: string | null;
}

/**
 * Convenience shape returned by the auth flow. Bundles the user's
 * primary tenant membership together with any cross-tenant memberships
 * so the client can populate the org-switcher in a single payload.
 *
 * The `primary` entry is always present (it mirrors `User.tenantId`)
 * and is always treated as ACTIVE.
 */
export interface MembershipBundle {
  readonly userId: UserId;
  readonly primary: {
    readonly tenantId: TenantId;
    readonly organizationId: OrganizationId | null;
    readonly role: RoleId;
    readonly displayLabel: string | null;
  };
  readonly cross: readonly CrossTenantMembership[];
}

/**
 * Returns the total number of selectable memberships in a bundle
 * (primary + active cross-tenant). Useful for deciding whether to
 * render the org switcher at all.
 */
export function countActiveMemberships(bundle: MembershipBundle): number {
  return 1 + bundle.cross.filter((m) => m.status === MembershipStatus.ACTIVE).length;
}

/**
 * Returns true if the user has any cross-tenant memberships at all,
 * regardless of their status. Used to gate whether to enable the
 * `X-Active-Org` header on requests.
 */
export function hasCrossTenantMemberships(bundle: MembershipBundle): boolean {
  return bundle.cross.length > 0;
}
