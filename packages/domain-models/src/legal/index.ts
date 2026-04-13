/**
 * Legal domain models
 * Exports for cases, timeline events, evidence, notices, and service receipts
 */

export * from './case';
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
  createNotice,
  approveNotice,
  rejectNotice,
  scheduleNotice,
  sendNotice,
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
} from './notice-service-receipt';
