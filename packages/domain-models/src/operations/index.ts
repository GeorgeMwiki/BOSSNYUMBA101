/**
 * Operations domain models
 * Exports for maintenance requests, dispatch events, completion proofs, dual signoffs, and assets
 */

export * from './maintenance-request';
export * from './dispatch-event';
export * from './completion-proof';
<<<<<<< HEAD
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
=======
// dual-signoff re-exports addTechnicianSignature (already in completion-proof) – exclude it
export {
  type DualSignoffId,
  type CompletionProofId,
  asDualSignoffId,
  DualSignoffStatusSchema,
  type DualSignoffStatus,
  RefusalReasonSchema,
  type RefusalReason,
  SatisfactionLevelSchema,
  type SatisfactionLevel,
  SignatureDetailsSchema,
  type SignatureDetails,
  DualSignoffSchema,
  type DualSignoffData,
  type DualSignoff,
  createDualSignoff,
  addTechnicianSignature as addDualSignoffTechnicianSignature,
  addCustomerSignature,
  recordCustomerRefusal,
  markCustomerUnavailable,
  linkFollowUpWorkOrder,
  isSignoffExpired,
  markExpired,
  canAddCustomerSignature,
>>>>>>> worktree-agent-a793f70a
} from './dual-signoff';
export * from './asset';
