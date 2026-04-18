/**
 * InviteCodeService — generates, redeems, and revokes org-issued codes.
 *
 * Stub — all methods throw NOT_IMPLEMENTED. Real persistence + atomic
 * redeem transaction land in a follow-up phase. See
 * `Docs/analysis/CONFLICT_RESOLUTIONS.md` § "Conflict 2".
 *
 * Redemption is the single chokepoint that creates an OrgMembership +
 * shadow User row + (optionally) a pending lease applicant attachment.
 */

import type {
  ISOTimestamp,
  InviteAttachmentHints,
  InviteCode,
  InviteCodeRecord,
  OrgMembership,
  OrganizationId,
  RoleId,
  TenantIdentityId,
  UserId,
} from '@bossnyumba/domain-models';

export class NotImplementedError extends Error {
  constructor(methodName: string) {
    super(`NOT_IMPLEMENTED: InviteCodeService.${methodName}`);
    this.name = 'NotImplementedError';
  }
}

/** Options accepted when generating a new code. */
export interface GenerateInviteOptions {
  readonly expiresAt?: ISOTimestamp;
  readonly maxRedemptions?: number;
  readonly defaultRoleId: RoleId;
  readonly attachmentHints?: InviteAttachmentHints;
}

/** Outcome of a successful redeem: membership + the originating code row. */
export interface RedeemResult {
  readonly membership: OrgMembership;
  readonly code: InviteCodeRecord;
}

export class InviteCodeService {
  /**
   * Generate a new invite code for the given org. Enforces TTL and
   * max-redemption constraints supplied by the caller.
   */
  async generate(
    orgId: OrganizationId,
    issuedBy: UserId,
    opts: GenerateInviteOptions
  ): Promise<InviteCodeRecord> {
    void orgId;
    void issuedBy;
    void opts;
    throw new NotImplementedError('generate');
  }

  /**
   * Atomically redeem a code for a given TenantIdentity:
   *   1. Validate code (not expired, under max-redemptions, not revoked).
   *   2. Create shadow User row in the org's platform tenant.
   *   3. Create OrgMembership linking the identity to the org.
   *   4. Increment redemptionsUsed.
   *
   * All four steps commit or roll back together.
   */
  async redeem(
    code: InviteCode,
    tenantIdentityId: TenantIdentityId
  ): Promise<RedeemResult> {
    void code;
    void tenantIdentityId;
    throw new NotImplementedError('redeem');
  }

  /**
   * Revoke an outstanding code. Future redeem attempts return
   * INVITE_CODE_REVOKED. Existing redemptions are unaffected.
   */
  async revoke(code: InviteCode): Promise<InviteCodeRecord> {
    void code;
    throw new NotImplementedError('revoke');
  }
}
