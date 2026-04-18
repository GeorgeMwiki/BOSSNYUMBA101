/**
 * OrgMembershipService — bridges TenantIdentity ↔ User ↔ Organization.
 *
 * Stub — all methods throw NOT_IMPLEMENTED. Real persistence lands in a
 * follow-up phase. See `Docs/analysis/CONFLICT_RESOLUTIONS.md` § "Conflict 2".
 *
 * Every OrgMembership row has a 1:1 shadow User row in the corresponding
 * platform tenant's user table. This is what keeps data isolation intact
 * while login is federated: RBAC and audit queries continue to resolve
 * through the existing `User` entity, unchanged.
 */

import type {
  InviteCode,
  OrgMembership,
  OrgMembershipId,
  OrganizationId,
  RoleId,
  TenantIdentityId,
} from '@bossnyumba/domain-models';

export class NotImplementedError extends Error {
  constructor(methodName: string) {
    super(`NOT_IMPLEMENTED: OrgMembershipService.${methodName}`);
    this.name = 'NotImplementedError';
  }
}

export class OrgMembershipService {
  /**
   * Create a fresh membership for an identity in an org.
   *   1. Inserts a shadow `User` row in the org's platform tenant.
   *   2. Inserts the OrgMembership row pointing at the shadow User.
   *
   * Caller passes `viaCode` when the membership originated from an
   * invite-code redemption so it can be stamped onto `joinedViaInviteCode`.
   */
  async createMembership(
    identityId: TenantIdentityId,
    orgId: OrganizationId,
    roleId: RoleId,
    viaCode?: InviteCode
  ): Promise<OrgMembership> {
    void identityId;
    void orgId;
    void roleId;
    void viaCode;
    throw new NotImplementedError('createMembership');
  }

  /**
   * Tenant-initiated leave. Flips status → LEFT and deactivates (not
   * deletes) the shadow User. Re-redeeming a code creates a fresh
   * membership row rather than resurrecting this one.
   */
  async leaveMembership(membershipId: OrgMembershipId): Promise<OrgMembership> {
    void membershipId;
    throw new NotImplementedError('leaveMembership');
  }

  /**
   * Admin-initiated block. Flips status → BLOCKED with a reason recorded
   * on the audit trail. Shadow User is deactivated.
   */
  async blockMembership(
    membershipId: OrgMembershipId,
    reason: string
  ): Promise<OrgMembership> {
    void membershipId;
    void reason;
    throw new NotImplementedError('blockMembership');
  }
}
