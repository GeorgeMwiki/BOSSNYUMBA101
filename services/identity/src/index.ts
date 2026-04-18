/**
 * @bossnyumba/identity — stub services for Conflict 2
 * (Universal Tenant Identity + Multi-Org).
 *
 * All methods throw NOT_IMPLEMENTED until the persistence layer lands.
 * See `Docs/analysis/CONFLICT_RESOLUTIONS.md` § "Conflict 2".
 */

export {
  TenantIdentityService,
  NotImplementedError as TenantIdentityNotImplementedError,
} from './tenant-identity.service.js';
export type { VerifyOtpResult } from './tenant-identity.service.js';

export {
  InviteCodeService,
  NotImplementedError as InviteCodeNotImplementedError,
} from './invite-code.service.js';
export type {
  GenerateInviteOptions,
  RedeemResult,
} from './invite-code.service.js';

export {
  OrgMembershipService,
  NotImplementedError as OrgMembershipNotImplementedError,
} from './org-membership.service.js';
