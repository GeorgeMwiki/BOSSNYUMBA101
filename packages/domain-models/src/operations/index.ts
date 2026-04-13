/**
 * Operations domain models
 * Exports for maintenance requests, dispatch events, completion proofs, dual signoffs, and assets
 */

export * from './maintenance-request';
export * from './dispatch-event';
export * from './completion-proof';
// dual-signoff: addTechnicianSignature conflicts with completion-proof
export {
  type DualSignoff,
  type DualSignoffData,
  DualSignoffSchema,
  type DualSignoffId,
  type DualSignoffStatus,
  DualSignoffStatusSchema,
  type RefusalReason,
  RefusalReasonSchema,
  type SatisfactionLevel,
  SatisfactionLevelSchema,
  type SignatureDetails,
  SignatureDetailsSchema,
  asDualSignoffId,
  createDualSignoff,
  addCustomerSignature,
  canAddCustomerSignature,
  isSignoffExpired,
  linkFollowUpWorkOrder,
  markCustomerUnavailable,
  recordCustomerRefusal,
  addTechnicianSignature as addDualSignoffTechSignature,
  markExpired as markDualSignoffExpired,
} from './dual-signoff';
export * from './asset';
