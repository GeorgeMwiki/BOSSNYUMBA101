/**
 * TenantIdentityService — global cross-org identity management.
 *
 * Stub — all methods throw NOT_IMPLEMENTED. Real persistence and OTP
 * integration will land in a follow-up phase. See
 * `Docs/analysis/CONFLICT_RESOLUTIONS.md` § "Conflict 2".
 *
 * This service owns:
 *   - Upsert-by-phone (phone is canonical identity key).
 *   - Phone OTP verification via region-config dialing codes.
 *   - Membership enumeration across all orgs for one identity.
 *   - Merging duplicate identities when backfill detects collisions.
 */

import type {
  OrgMembership,
  TenantIdentity,
  TenantIdentityId,
} from '@bossnyumba/domain-models';

/** Error thrown by every stub method until real implementation lands. */
export class NotImplementedError extends Error {
  constructor(methodName: string) {
    super(`NOT_IMPLEMENTED: TenantIdentityService.${methodName}`);
    this.name = 'NotImplementedError';
  }
}

/** Result of an OTP verification attempt. */
export interface VerifyOtpResult {
  readonly verified: boolean;
  readonly identity: TenantIdentity | null;
}

export class TenantIdentityService {
  /**
   * Create or upsert a TenantIdentity for the given phone + country code.
   * Phone is normalized via `normalizePhoneForCountry(phone, countryCode)`
   * before lookup.
   */
  async createOrUpsertByPhone(
    phone: string,
    countryCode: string
  ): Promise<TenantIdentity> {
    void phone;
    void countryCode;
    throw new NotImplementedError('createOrUpsertByPhone');
  }

  /**
   * Verify an OTP code previously sent to the identity's phone.
   * Returns the identity on success so the caller can mint a session.
   */
  async verifyPhoneOTP(
    identityId: TenantIdentityId,
    code: string
  ): Promise<VerifyOtpResult> {
    void identityId;
    void code;
    throw new NotImplementedError('verifyPhoneOTP');
  }

  /**
   * Return every OrgMembership attached to this identity, regardless of
   * status. Callers filter with `isMembershipActive` as needed.
   */
  async getMemberships(
    identityId: TenantIdentityId
  ): Promise<readonly OrgMembership[]> {
    void identityId;
    throw new NotImplementedError('getMemberships');
  }

  /**
   * Merge duplicate identities surfaced by the phone-backfill migration.
   * All memberships on `duplicateId` are re-parented to `primaryId` and
   * the duplicate is deactivated. Atomic; emits audit event.
   */
  async mergeDuplicates(
    primaryId: TenantIdentityId,
    duplicateId: TenantIdentityId
  ): Promise<TenantIdentity> {
    void primaryId;
    void duplicateId;
    throw new NotImplementedError('mergeDuplicates');
  }
}
