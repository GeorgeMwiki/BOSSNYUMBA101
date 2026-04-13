/**
 * BOSSNYUMBA Domain Models
 * Shared domain models for the BOSSNYUMBA platform
 *
 * NOTE: Uses selective exports to avoid TS2308 ambiguous re-export errors.
 * common/types.ts and common/enums.ts define IDs and enums that are also
 * independently defined in domain files. We use explicit exports from types/enums
 * and export * from domain files, letting domain definitions take precedence
 * for symbols defined in multiple locations.
 */

// ============================================================================
// Common types - explicit exports to avoid duplicates with domain files
// ============================================================================
export {
  // Utility types
  type Brand,
  type Mutable,
  type ISOTimestamp,
  type EntityMetadata,
  type SoftDeletable,
  type TenantScoped,
  type TenantScopedEntity,
  type PaginatedResult,
  type PaginationParams,
  type Result,
  ok,
  err,
  createId,

  // Branded IDs unique to types.ts
  type TenantId,
  type UserId,
  type AccountId,
  type ArrearsCaseId,
  type AuditEventId,
  type CaseResolutionId,
  type CaseTimelineId,
  type CommunicationConsentId,
  type DeliveryReceiptId,
  type DispatchEventId,
  type DocumentAccessLogId,
  type DualSignOffId,
  type EscalationChainId,
  type EscalationChainRunId,
  type InvoiceId,
  type LeaseId,
  type LedgerEntryId,
  type MaintenanceRequestId,
  type MessageInstanceId,
  type MessageTemplateId,
  type OrganizationId,
  type OwnerStatementId,
  type PaymentIntentId,
  type PolicyId,
  type ReceiptId,
  type RoleId,
  type SessionId,
  type StatementId,
  type TenantPreferenceId,
  type TransactionId,

  // Branded IDs also in domain files (exported here for consumers importing from barrel)
  type CustomerId,
  type PropertyId,
  type OwnerId,
  type UnitId,
  type BlockId,
  type CaseId,
  type NoticeId,
  type EvidenceAttachmentId,
  type DocumentUploadId,
  type OcrExtractionId,
  type AssetId,
  type CompletionProofId,
  type IdentityProfileId,
  type VerificationBadgeId,
  type VendorId,
  type VendorScorecardId,
  type VendorAssignmentId,
  type WorkOrderId,
  type PaymentPlanId,
  type NoticeServiceReceiptId,
  type RiskScoreId,
  type NextBestActionId,
  type InterventionLogId,
  type FrictionFingerprintId,
  type TenantSegmentId,
  type CustomerSegmentMembershipId,

  // Schema consts and enum types
  type AccountType,
  AccountTypeSchema,
  type CurrencyCode,
  CurrencyCodeSchema,
  type PaymentStatus,
  PaymentStatusSchema,
  type LedgerEntryType,
  LedgerEntryTypeSchema,
  type StatementPeriodType,
  StatementPeriodTypeSchema,
  type StatementStatus,
  StatementStatusSchema,

  // ID factory functions unique to types.ts
  asTenantId,
  asUserId,
  asAccountId,
  asArrearsCaseId,
  asAuditEventId,
  asCaseResolutionId,
  asCaseTimelineId,
  asCommunicationConsentId,
  asDeliveryReceiptId,
  asDispatchEventId,
  asDocumentAccessLogId,
  asDualSignOffId,
  asEscalationChainId,
  asEscalationChainRunId,
  asInvoiceId,
  asLeaseId,
  asLedgerEntryId,
  asMaintenanceRequestId,
  asMessageInstanceId,
  asMessageTemplateId,
  asOrganizationId,
  asOwnerStatementId,
  asPaymentIntentId,
  asPolicyId,
  asReceiptId,
  asRoleId,
  asSessionId,
  asStatementId,
  asTenantPreferenceId,
  asTransactionId,

  // ID factory functions also defined in domain files
  asCustomerId,
  asPropertyId,
  asOwnerId,
  asUnitId,
  asBlockId,
  asCaseId,
  asNoticeId,
  asEvidenceAttachmentId,
  asDocumentUploadId,
  asOcrExtractionId,
  asAssetId,
  asCompletionProofId,
  asIdentityProfileId,
  asVerificationBadgeId,
  asVendorId,
  asVendorScorecardId,
  asVendorAssignmentId,
  asWorkOrderId,
  asPaymentPlanId,
  asNoticeServiceReceiptId,
  asRiskScoreId,
  asNextBestActionId,
  asInterventionLogId,
  asFrictionFingerprintId,
  asTenantSegmentId,
  asCustomerSegmentMembershipId,
} from './common/types';

export * from './common/money';

// ============================================================================
// Enums - only unique symbols not in types.ts or domain files
// ============================================================================
export {
  ActionStatusSchema, ActionTypeSchema,
  AssetCondition, AssetConditionSchema, AssetStatus, AssetStatusSchema,
  AuditEventTypeSchema,
  BadgeType, BadgeTypeSchema,
  CaseSeverity, CaseSeveritySchema, CaseStatus, CaseStatusSchema, CaseType, CaseTypeSchema,
  ChannelPreference, ChannelPreferenceSchema,
  CustomerStatusSchema,
  DeliveryMethod, DeliveryMethodSchema,
  DocumentSource, DocumentSourceSchema, DocumentStatus, DocumentStatusSchema, DocumentTypeSchema,
  EvidenceType, EvidenceTypeSchema,
  FraudRiskLevel, FraudRiskLevelSchema,
  IdDocumentTypeSchema,
  KycStatus, KycStatusSchema,
  LeaseStatusSchema, LeaseTypeSchema,
  LedgerAccountType, LedgerAccountTypeSchema,
  NoticeStatus, NoticeStatusSchema, NoticeType, NoticeTypeSchema,
  OccupancyStatusSchema,
  OnboardingState, OnboardingStateSchema,
  PaymentMethodSchema,
  PaymentPlanStatusSchema,
  PropertyStatusSchema, PropertyTypeSchema,
  RentFrequencySchema,
  ResolutionType, ResolutionTypeSchema,
  RiskLevelSchema, RiskTypeSchema,
  SegmentStatus, SegmentStatusSchema, SegmentType, SegmentTypeSchema,
  SessionStatusSchema,
  SubscriptionTierSchema,
  TenantStatusSchema,
  TerminationReason, TerminationReasonSchema,
  TimelineEventType, TimelineEventTypeSchema,
  UnitStatusSchema, UnitTypeSchema,
  UserStatusSchema,
  VendorStatusSchema,
  VerificationStatus, VerificationStatusSchema,
  WorkOrderCategorySchema, WorkOrderPrioritySchema, WorkOrderSourceSchema, WorkOrderStatusSchema,
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
// block.ts: BlockId/asBlockId conflict with types, calculateOccupancyRate with property
export {
  type Block,
  type BlockStatus,
  createBlock,
  generateBlockCode,
  updateBlockUnitCounts,
  changeBlockStatus,
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
// transaction.ts: markFailed/markProcessing conflict with payment-intent,
// PaymentMethodType conflicts with payment-method
export {
  type Transaction,
  type TransactionData,
  TransactionSchema,
  type TransactionCategory,
  TransactionCategorySchema,
  type TransactionStatus,
  TransactionStatusSchema,
  createTransaction,
  generateTransactionRef,
  markProcessing as markTransactionProcessing,
  markCompleted as markTransactionCompleted,
  markFailed as markTransactionFailed,
  reconcileTransaction,
  reverseTransaction,
} from './financial/transaction';
export * from './financial/receipt';
// arrears-case.ts: assignCase/resolveCase/ArrearsStatus conflict with legal/case and common
export {
  type ArrearsCase,
  type ArrearsCaseData,
  ArrearsCaseSchema,
  type ArrearsSeverity,
  ArrearsSeveritySchema,
  type ArrearsAction,
  ArrearsActionSchema,
  createArrearsCase,
  escalateToLegal,
  addAction as addArrearsAction,
  recordContactAttempt,
  recordPromiseToPay,
  markPromiseBroken,
  calculateSeverity,
  writeOffCase,
  assignCase as assignArrearsCase,
  resolveCase as resolveArrearsCase,
} from './financial/arrears-case';

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
// vendor.ts: VendorId/asVendorId conflict with work-order.ts
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
// Operations
// ============================================================================
export * from './operations/asset';
export * from './operations/maintenance-request';
// dispatch-event.ts: startWork conflicts with maintenance/work-order, DispatchStatus with enums
export {
  type DispatchEvent,
  type DispatchEventData,
  DispatchEventSchema,
  type DispatchType,
  DispatchTypeSchema,
  type LocationUpdate,
  LocationUpdateSchema,
  createDispatchEvent,
  dispatchTechnician,
  addLocationUpdate,
  cancelDispatch,
  completeDispatch,
  markEnRoute,
  markNoShow,
  recordArrival,
  rescheduleDispatch,
  startWork as startDispatchWork,
} from './operations/dispatch-event';
export * from './operations/completion-proof';
// dual-signoff.ts: addTechnicianSignature conflicts with completion-proof, markExpired with lease
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
} from './operations/dual-signoff';

// ============================================================================
// Legal
// ============================================================================
export * from './legal/case';
// timeline-event.ts: CaseId conflicts with types/case
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
} from './legal/timeline-event';
// evidence-attachment.ts: CaseId, DocumentUploadId, EvidenceAttachmentId, getFileExtension, isVerified
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
} from './legal/evidence-attachment';
// notice.ts: CaseId, NoticeId, markDelivered, isExpired conflicts
export {
  type Notice,
  type NoticeData,
  NoticeSchema,
  type NoticeAttachment,
  NoticeAttachmentSchema,
  createNotice,
  approveNotice,
  rejectNotice,
  scheduleNotice,
  sendNotice,
  setDocumentUrl,
  voidNotice,
  canBeSent,
  generateNoticeNumber,
  isComplianceDeadlinePassed,
  recordAcknowledgment,
  markDelivered as markNoticeDelivered,
  isExpired as isNoticeExpired,
} from './legal/notice';
// notice-service-receipt.ts: NoticeId, NoticeServiceReceiptId conflicts
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
} from './legal/notice-service-receipt';

// ============================================================================
// Documents
// ============================================================================
// document-upload.ts: getFileExtension, isExpired, isVerified, markExpired, markProcessing, DocumentUploadId, OcrExtractionId
export {
  type DocumentUpload,
  type DocumentUploadData,
  DocumentUploadSchema,
  type DocumentMetadata,
  DocumentMetadataSchema,
  type QualityAssessment,
  QualityAssessmentSchema,
  createDocumentUpload,
  verifyDocument,
  rejectDocument as rejectDocumentUpload,
  addTag as addDocumentTag,
  archiveDocument,
  createNewVersion,
  linkOcrExtraction,
  setQualityAssessment,
  isImage,
  isPdf,
  getFileExtension as getDocumentFileExtension,
  isExpired as isDocumentExpired,
  isVerified as isDocumentVerified,
  markExpired as markDocumentExpired,
  markProcessing as markDocumentProcessing,
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
export * from './notifications/notification';

// ============================================================================
// Jurisdiction (global-first, config-driven, NOT hardcoded)
// ============================================================================
export * from './jurisdiction/jurisdiction';
export { loadSeedJurisdictions, TANZANIA, KENYA, NIGERIA, SOUTH_AFRICA } from './jurisdiction/seeds';
