/**
 * Operations domain models
 * Exports for maintenance requests, dispatch events, completion proofs, dual signoffs, and assets
 */

export * from './maintenance-request';
export * from './dispatch-event';
export * from './completion-proof';
// dual-signoff redeclares CompletionProofId and addTechnicianSignature;
// re-export only signoff-specific symbols to avoid ambiguity.
export {
  DualSignoffSchema,
  DualSignoffStatusSchema,
  RefusalReasonSchema,
  SatisfactionLevelSchema,
  SignatureDetailsSchema,
  type DualSignoff,
  type DualSignoffData,
  type DualSignoffId,
  type DualSignoffStatus,
  type RefusalReason,
  type SatisfactionLevel,
  type SignatureDetails,
  asDualSignoffId,
  createDualSignoff,
} from './dual-signoff';
export * from './asset';
