/**
 * Legal domain models
 * Exports for cases, timeline events, evidence, notices, and service receipts
 */

export * from './case';
<<<<<<< HEAD
// Selective re-exports to avoid CaseId conflicts
export {
  type TimelineEvent,
  type TimelineEventData,
  TimelineEventSchema,
  type TimelineEventId,
  type AttachmentRef,
  AttachmentRefSchema,
  asTimelineEventId,
  createTimelineEvent,
  createCaseCreatedEvent,
  createEscalationEvent,
  createStatusChangedEvent,
  createSystemEvent,
} from './timeline-event';
export {
  type EvidenceAttachment,
  type EvidenceAttachmentData,
  EvidenceAttachmentSchema,
  type EvidenceMetadata,
  EvidenceMetadataSchema,
  type EvidenceVerification,
  EvidenceVerificationSchema,
  createEvidenceAttachment,
  verifyEvidence,
  addRelevanceNotes,
  recordAccess,
  softDeleteEvidence,
  isImageEvidence,
  isAudioEvidence,
  isVideoEvidence,
  isVerified as isEvidenceVerified,
  getFileExtension as getEvidenceFileExtension,
} from './evidence-attachment';
export {
  type Notice,
  type NoticeData,
  NoticeSchema,
  type NoticeAttachment,
  NoticeAttachmentSchema,
=======
// timeline-event re-exports CaseId which conflicts with case.ts – exclude it
export {
  type TimelineEventId,
  asTimelineEventId,
  AttachmentRefSchema,
  type AttachmentRef,
  TimelineEventSchema,
  type TimelineEventData,
  type TimelineEvent,
  createTimelineEvent,
  createCaseCreatedEvent,
  createStatusChangedEvent,
  createEscalationEvent,
  createSystemEvent,
} from './timeline-event';
// evidence-attachment re-exports CaseId, DocumentUploadId – exclude them
export {
  type EvidenceAttachmentId,
  asEvidenceAttachmentId,
  EvidenceVerificationSchema,
  type EvidenceVerification,
  EvidenceMetadataSchema,
  type EvidenceMetadata,
  EvidenceAttachmentSchema,
  type EvidenceAttachmentData,
  type EvidenceAttachment,
  createEvidenceAttachment,
  verifyEvidence,
  recordAccess,
  addRelevanceNotes,
  softDeleteEvidence,
  isVerified,
  getFileExtension,
  isImageEvidence,
  isVideoEvidence,
  isAudioEvidence,
} from './evidence-attachment';
// notice re-exports CaseId – exclude it
export {
  type NoticeId,
  asNoticeId,
  NoticeAttachmentSchema,
  type NoticeAttachment,
  NoticeSchema,
  type NoticeData,
  type Notice,
>>>>>>> worktree-agent-a793f70a
  createNotice,
  approveNotice,
  rejectNotice,
  scheduleNotice,
  sendNotice,
<<<<<<< HEAD
  setDocumentUrl,
  voidNotice,
  canBeSent,
  generateNoticeNumber,
  isComplianceDeadlinePassed,
  recordAcknowledgment,
  markDelivered as markNoticeDelivered,
  isExpired as isNoticeExpired,
} from './notice';
// NoticeServiceReceiptId/NoticeId conflict handled by selective export
export {
  type NoticeServiceReceipt,
  type NoticeServiceReceiptData,
  NoticeServiceReceiptSchema,
  type DeliveryProof,
  DeliveryProofSchema,
  type GpsCoordinates,
  GpsCoordinatesSchema,
  createNoticeServiceReceipt,
  recordPhysicalDelivery,
  recordElectronicDelivery,
  recordPostedDelivery,
  recordDeliveryFailure,
  recordReadReceipt,
  setTrackingInfo,
  verifyReceipt,
  hasGpsVerification,
  hasReadConfirmation,
  isSuccessfulDelivery,
=======
  markDelivered,
  recordAcknowledgment,
  voidNotice,
  setDocumentUrl,
  isExpired,
  isComplianceDeadlinePassed,
  canBeSent,
  generateNoticeNumber,
} from './notice';
// notice-service-receipt re-exports NoticeId – exclude it
export {
  type NoticeServiceReceiptId,
  asNoticeServiceReceiptId,
  GpsCoordinatesSchema,
  type GpsCoordinates,
  DeliveryProofSchema,
  type DeliveryProof,
  NoticeServiceReceiptSchema,
  type NoticeServiceReceiptData,
  type NoticeServiceReceipt,
  createNoticeServiceReceipt,
  recordPhysicalDelivery,
  recordElectronicDelivery,
  recordReadReceipt,
  recordPostedDelivery,
  recordDeliveryFailure,
  setTrackingInfo,
  verifyReceipt,
  isSuccessfulDelivery,
  hasReadConfirmation,
>>>>>>> worktree-agent-a793f70a
} from './notice-service-receipt';
