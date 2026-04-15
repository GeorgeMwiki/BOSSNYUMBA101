/**
 * Legal domain models
 *
 * `common/types` is the canonical source for `CaseId`, `NoticeId`,
 * `NoticeServiceReceiptId`, `EvidenceAttachmentId`, `DocumentUploadId`, and
 * their `as*Id` constructors. Sub-modules redeclare those Brand types as a
 * local convenience, but we re-export them ONLY from common/types here so
 * downstream consumers see one canonical name (no TS2308 ambiguity).
 */

// ---- Cases ----------------------------------------------------------------
// Note: assignCase / resolveCase intentionally re-exported under legal-specific
// aliases to disambiguate from the financial/arrears-case versions.
export {
  CaseSchema,
  SlaDetailsSchema,
  type Case,
  type CaseData,
  type SlaDetails,
  createCase,
  getSeverityResponseHours,
  getSeverityResolutionHours,
  assignCase as assignLegalCase,
  resolveCase as resolveLegalCase,
  recordFirstResponse,
  escalateCase,
  updateCaseStatus,
  closeCase,
  recordSatisfaction,
  withdrawCase,
  isSlaBreached,
  generateCaseNumber,
} from './case';

// ---- Timeline events ------------------------------------------------------
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

// ---- Evidence attachments -------------------------------------------------
export {
  EvidenceAttachmentSchema,
  EvidenceVerificationSchema,
  EvidenceMetadataSchema,
  type EvidenceAttachment,
  type EvidenceAttachmentData,
  type EvidenceVerification,
  type EvidenceMetadata,
  createEvidenceAttachment,
  verifyEvidence,
  recordAccess,
  addRelevanceNotes,
  softDeleteEvidence,
  isVerified as isEvidenceVerified,
  getFileExtension as getEvidenceFileExtension,
  isImageEvidence,
  isVideoEvidence,
  isAudioEvidence,
} from './evidence-attachment';

// ---- Notices --------------------------------------------------------------
export {
  NoticeAttachmentSchema,
  NoticeSchema,
  type Notice,
  type NoticeAttachment,
  type NoticeData,
  createNotice,
  approveNotice,
  rejectNotice,
  scheduleNotice,
  sendNotice,
  markDelivered as markNoticeDelivered,
  recordAcknowledgment,
  voidNotice,
  setDocumentUrl,
  isExpired as isNoticeExpired,
  isComplianceDeadlinePassed,
  canBeSent,
  generateNoticeNumber,
} from './notice';

// ---- Notice service receipts ---------------------------------------------
export {
  GpsCoordinatesSchema,
  DeliveryProofSchema,
  NoticeServiceReceiptSchema,
  type NoticeServiceReceipt,
  type NoticeServiceReceiptData,
  type GpsCoordinates,
  type DeliveryProof,
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
