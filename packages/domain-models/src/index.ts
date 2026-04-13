/**
 * BOSSNYUMBA Domain Models
 * Shared domain models for the BOSSNYUMBA platform
 *
 * NOTE: common/types and common/enums define many types/IDs/enums that are
 * also re-defined in domain modules. To avoid duplicate export errors, we
 * selectively re-export only the NON-overlapping symbols from those files,
 * and let the domain modules be the canonical source for the rest.
 */

// ============================================================================
// Common types — selective export (excludes IDs/helpers re-defined in domains)
// ============================================================================
export {
  // Core branded-type utility
  type Brand,

  // IDs that are NOT re-defined by any domain module
  type TenantId,
  type OrganizationId,
  type UserId,
  type RoleId,
  type PolicyId,
  type SessionId,
  type AuditEventId,
  type CustomerId,
  type LeaseId,
  type PaymentIntentId,
  type StatementId,
  type AccountId,
  type LedgerEntryId,
  type InvoiceId,
  type ReceiptId,
  type TransactionId,
  type ArrearsCaseId,
  type OwnerStatementId,
  type MaintenanceRequestId,
  type DispatchEventId,
  type DualSignOffId,
  type TenantPreferenceId,
  type CaseResolutionId,
  type CaseTimelineId,
  type DocumentAccessLogId,
  type MessageTemplateId,
  type MessageInstanceId,
  type DeliveryReceiptId,
  type CommunicationConsentId,
  type EscalationChainId,
  type EscalationChainRunId,

  // ID helper functions NOT re-defined in domains
  asTenantId,
  asOrganizationId,
  asUserId,
  asRoleId,
  asPolicyId,
  asSessionId,
  asAuditEventId,
  asCustomerId,
  asLeaseId,
  asPaymentIntentId,
  asStatementId,
  asAccountId,
  asLedgerEntryId,
  asInvoiceId,
  asReceiptId,
  asTransactionId,
  asArrearsCaseId,
  asOwnerStatementId,
  asMaintenanceRequestId,
  asDispatchEventId,
  asDualSignOffId,
  asTenantPreferenceId,
  asCaseResolutionId,
  asCaseTimelineId,
  asCompletionProofId,
  asDocumentAccessLogId,
  asOcrExtractionId,
  asMessageTemplateId,
  asMessageInstanceId,
  asDeliveryReceiptId,
  asCommunicationConsentId,
  asEscalationChainId,
  asEscalationChainRunId,

  // Utility
  createId,
  ok,
  err,

  // Zod schemas for ledger/statements/payments
  type CurrencyCode,
  CurrencyCodeSchema,
  type PaymentStatus,
  PaymentStatusSchema,
  type AccountType,
  AccountTypeSchema,
  type LedgerEntryType,
  LedgerEntryTypeSchema,
  type StatementPeriodType,
  StatementPeriodTypeSchema,
  type StatementStatus,
  StatementStatusSchema,

  // Shared structural types
  type ISOTimestamp,
  type EntityMetadata,
  type SoftDeletable,
  type TenantScoped,
  type TenantScopedEntity,
  type Result,
  type PaginationParams,
  type PaginatedResult,
} from './common/types';

// ============================================================================
// Common money
// ============================================================================
export * from './common/money';

// ============================================================================
// Common enums — selective export (excludes enums re-defined in domains)
// ============================================================================
export {
  // Schemas (these are NOT re-defined in domain modules)
  TenantStatusSchema,
  SubscriptionTierSchema,
  UserStatusSchema,
  SessionStatusSchema,
  PropertyTypeSchema,
  PropertyStatusSchema,
  UnitTypeSchema,
  UnitStatusSchema,
  LeaseStatusSchema,
  LeaseTypeSchema,
  RentFrequencySchema,
  CustomerStatusSchema,
  IdDocumentTypeSchema,
  PaymentMethodSchema,
  PaymentPlanStatusSchema,
  WorkOrderPrioritySchema,
  WorkOrderStatusSchema,
  WorkOrderCategorySchema,
  WorkOrderSourceSchema,
  VendorStatusSchema,
  AuditEventTypeSchema,
  ActionTypeSchema,
  ActionStatusSchema,
  RiskLevelSchema,
  RiskTypeSchema,

  // Types/enums unique to common/enums (not in any domain module)
  // Each of these has both a const and type export with the same name
  AssetCondition,
  AssetConditionSchema,
  AssetStatus,
  AssetStatusSchema,
  BadgeType,
  BadgeTypeSchema,
  CaseSeverity,
  CaseSeveritySchema,
  CaseStatus,
  CaseStatusSchema,
  CaseType,
  CaseTypeSchema,
  ChannelPreference,
  ChannelPreferenceSchema,
  DeliveryMethod,
  DeliveryMethodSchema,
  DocumentSource,
  DocumentSourceSchema,
  DocumentStatus,
  DocumentStatusSchema,
  DocumentType,
  DocumentTypeSchema,
  EvidenceType,
  EvidenceTypeSchema,
  FraudRiskLevel,
  FraudRiskLevelSchema,
  KycStatus,
  KycStatusSchema,
  LedgerAccountType,
  LedgerAccountTypeSchema,
  NoticeStatus,
  NoticeStatusSchema,
  NoticeType,
  NoticeTypeSchema,
  OccupancyStatus,
  OccupancyStatusSchema,
  OnboardingState,
  OnboardingStateSchema,
  ResolutionType,
  ResolutionTypeSchema,
  SegmentStatus,
  SegmentStatusSchema,
  SegmentType,
  SegmentTypeSchema,
  TerminationReason,
  TerminationReasonSchema,
  TimelineEventType,
  TimelineEventTypeSchema,
  VerificationStatus,
  VerificationStatusSchema,
} from './common/enums';

// ============================================================================
// Tenant/Organization
// ============================================================================
export * from './tenant/tenant';
export * from './tenant/organization';

// ============================================================================
// Identity (Users, Roles, Sessions, Policies)
// ============================================================================
export * from './identity/user';
export * from './identity/role';
export * from './identity/session';
export * from './identity/policy';

// ============================================================================
// Audit
// ============================================================================
export * from './audit/audit-event';

// ============================================================================
// Property management
// ============================================================================
export * from './property/property';
export * from './property/unit';
// block.ts: exclude calculateOccupancyRate (already in property.ts)
export {
  type BlockId,
  asBlockId,
  type BlockStatus,
  type Block,
  createBlock,
  updateBlockUnitCounts,
  changeBlockStatus,
  generateBlockCode,
  calculateOccupancyRate as calculateBlockOccupancyRate,
} from './property/block';

// ============================================================================
// Customer management
// ============================================================================
export * from './customer/customer';

// ============================================================================
// Lease management
// ============================================================================
export * from './lease/lease';
export * from './lease/occupancy';

// ============================================================================
// Payments
// ============================================================================
export * from './payments/payment-intent';
export * from './payments/payment-method';

// ============================================================================
// Financial
// ============================================================================
export * from './financial/invoice';
// transaction.ts: exclude PaymentMethodType/Schema (already in payment-method),
// markProcessing/markFailed (generic names, keep transaction's versions as renamed)
export {
  TransactionStatusSchema,
  type TransactionStatus,
  TransactionTypeSchema,
  type TransactionType,
  TransactionCategorySchema,
  type TransactionCategory,
  TransactionSchema,
  type TransactionData,
  type Transaction,
  createTransaction,
  markProcessing as markTransactionProcessing,
  markCompleted,
  markFailed as markTransactionFailed,
  reverseTransaction,
  reconcileTransaction,
  generateTransactionRef,
} from './financial/transaction';
export * from './financial/receipt';
export * from './financial/arrears-case';

// ============================================================================
// Payment plans
// ============================================================================
export * from './payment/payment-plan';

// ============================================================================
// Ledger and accounting
// ============================================================================
export * from './ledger/account';
export * from './ledger/ledger-entry';

// ============================================================================
// Statements
// ============================================================================
export * from './statements/statement';

// ============================================================================
// Maintenance and work orders
// ============================================================================
export * from './maintenance/work-order';
export * from './maintenance/inspection';
// vendor.ts: exclude VendorId, asVendorId (already in work-order.ts)
export {
  type VendorStatus,
  type VendorType,
  type VendorContact,
  type ServiceArea,
  type VendorRating,
  type Vendor,
  type BankDetails,
  createVendor,
  approveVendor,
  updateVendorRating,
  areDocumentsExpiring,
  canHandleCategory,
  generateVendorNumber,
} from './maintenance/vendor';
export * from './maintenance/vendor-scorecard';
export * from './maintenance/vendor-assignment';

// ============================================================================
// Operations (Assets, Maintenance Requests, Dispatch, Completion)
// ============================================================================
export * from './operations/asset';
export * from './operations/maintenance-request';
// dispatch-event.ts: exclude startWork (already in work-order)
export {
  DispatchStatusSchema as DispatchEventStatusSchema,
  type DispatchStatus as DispatchEventStatus,
  DispatchTypeSchema,
  type DispatchType,
  LocationUpdateSchema,
  type LocationUpdate,
  DispatchEventSchema,
  type DispatchEventData,
  type DispatchEvent,
  createDispatchEvent,
  dispatchTechnician,
  markEnRoute,
  recordArrival,
  startWork as startDispatchWork,
  completeDispatch,
  addLocationUpdate,
  cancelDispatch,
  rescheduleDispatch,
  markNoShow,
} from './operations/dispatch-event';
// completion-proof.ts: has its own addTechnicianSignature
export {
  CompletionProofStatusSchema,
  type CompletionProofStatus,
  ProofTypeSchema,
  type ProofType,
  ProofItemSchema,
  type ProofItem,
  MaterialUsedSchema,
  type MaterialUsed,
  CompletionProofSchema,
  type CompletionProofData,
  type CompletionProof,
  createCompletionProof,
  addProofItem,
  addMaterial,
  addTechnicianSignature as addCompletionProofTechnicianSignature,
  approveProof,
  rejectProof,
  requestMoreInfo,
  resubmitProof,
} from './operations/completion-proof';
// dual-signoff.ts: exclude addTechnicianSignature, markExpired (conflicts)
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
  markExpired as markDualSignoffExpired,
  canAddCustomerSignature,
} from './operations/dual-signoff';

// ============================================================================
// Legal (Cases, Notices)
// ============================================================================
// legal/case.ts: rename assignCase, resolveCase (conflicts with arrears-case)
export {
  type CaseId,
  asCaseId,
  SlaDetailsSchema,
  type SlaDetails,
  CaseSchema,
  type CaseData,
  type Case,
  createCase,
  getSeverityResponseHours,
  getSeverityResolutionHours,
  assignCase as assignLegalCase,
  recordFirstResponse,
  escalateCase,
  updateCaseStatus,
  resolveCase as resolveLegalCase,
  closeCase,
  recordSatisfaction,
  withdrawCase,
  isSlaBreached,
  generateCaseNumber,
} from './legal/case';
// timeline-event.ts: exclude CaseId (already in case.ts)
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
} from './legal/timeline-event';
// evidence-attachment.ts: exclude isVerified, getFileExtension (conflicts)
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
  isVerified as isEvidenceVerified,
  getFileExtension as getEvidenceFileExtension,
  isImageEvidence,
  isVideoEvidence,
  isAudioEvidence,
} from './legal/evidence-attachment';
// notice.ts: exclude CaseId, isExpired, markDelivered (conflicts)
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
  markDelivered as markNoticeDelivered,
  recordAcknowledgment,
  voidNotice,
  setDocumentUrl,
  isExpired as isNoticeExpired,
  isComplianceDeadlinePassed,
  canBeSent,
  generateNoticeNumber,
} from './legal/notice';
// notice-service-receipt.ts: exclude NoticeId (already in notice.ts)
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
} from './legal/notice-service-receipt';

// ============================================================================
// Documents
// ============================================================================
// document-upload.ts: exclude markProcessing, markExpired, isExpired,
// isVerified, getFileExtension (conflicts with financial/legal modules)
export {
  type DocumentUploadId,
  type OcrExtractionId,
  asDocumentUploadId,
  QualityAssessmentSchema,
  type QualityAssessment,
  DocumentMetadataSchema,
  type DocumentMetadata,
  DocumentUploadSchema,
  type DocumentUploadData,
  type DocumentUpload,
  createDocumentUpload,
  setQualityAssessment,
  markProcessing as markDocumentProcessing,
  linkOcrExtraction,
  verifyDocument,
  rejectDocument,
  markExpired as markDocumentExpired,
  createNewVersion,
  archiveDocument,
  addTag,
  isExpired as isDocumentExpired,
  isVerified as isDocumentVerified,
  isImage,
  isPdf,
  getFileExtension as getDocumentFileExtension,
} from './documents/document-upload';
export * from './documents/verification-badge';
export * from './documents/fraud-risk-score';

// ============================================================================
// Intelligence (AI Personalization)
// ============================================================================
export * from './intelligence/index';

// ============================================================================
// Notifications
// ============================================================================
// notification.ts: exclude markDelivered, markFailed (conflicts)
export {
  type NotificationId,
  asNotificationId,
  type NotificationChannel,
  type NotificationStatus,
  type NotificationPriority,
  type NotificationCategory,
  type Notification,
  createNotification,
  markSent,
  markDelivered as markNotificationDelivered,
  markRead,
  markFailed as markNotificationFailed,
  shouldRetry,
  NOTIFICATION_TEMPLATES,
  applyTemplate,
} from './notifications/notification';
