/**
 * Legal domain models
 *
 * `case.ts` owns the canonical CaseId. `evidence-attachment.ts`,
 * `notice.ts`, and `notice-service-receipt.ts` re-declare brand types
 * (CaseId / NoticeId) as a convenience for type checking, so we re-export
 * each module's symbols selectively to avoid `TS2308` ambiguity.
 */

export * from './case';
export {
  AttachmentRefSchema,
  TimelineEventSchema,
  type TimelineEvent,
  type TimelineEventData,
  type TimelineEventId,
  type AttachmentRef,
  asTimelineEventId,
  createTimelineEvent,
  createCaseCreatedEvent,
  createStatusChangedEvent,
  createEscalationEvent,
  createSystemEvent,
} from './timeline-event';

export {
  EvidenceAttachmentSchema,
  EvidenceVerificationSchema,
  EvidenceMetadataSchema,
  type EvidenceAttachment,
  type EvidenceAttachmentData,
  type EvidenceAttachmentId,
  type EvidenceVerification,
  type EvidenceMetadata,
  type DocumentUploadId,
  asEvidenceAttachmentId,
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

export {
  NoticeAttachmentSchema,
  NoticeSchema,
  type Notice,
  type NoticeAttachment,
  type NoticeData,
  type NoticeId,
  asNoticeId,
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

export {
  GpsCoordinatesSchema,
  DeliveryProofSchema,
  NoticeServiceReceiptSchema,
  type NoticeServiceReceipt,
  type NoticeServiceReceiptData,
  type NoticeServiceReceiptId,
  type GpsCoordinates,
  type DeliveryProof,
  asNoticeServiceReceiptId,
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
  hasGpsVerification,
} from './notice-service-receipt';
