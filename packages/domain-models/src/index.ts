/**
 * BOSSNYUMBA Domain Models
 * Shared domain models for the BOSSNYUMBA platform
 */

// Common types, utilities, and enums
export * from './common/types';
export * from './common/money';
export * from './common/enums';

// Tenant/Organization — TenantStatus / SubscriptionTier canonical in
// common/enums.
export {
  type BillingCycle,
  type Tenant,
  type TenantConfig,
  type CreateTenantInput,
  type UpdateTenantInput,
  type TenantWithUsage,
  type TenantSettings,
  type TenantFeatures,
  type TenantBranding,
  type NotificationSettings,
  DEFAULT_TENANT_CONFIG,
  isValidTenantSlug,
  createTenant,
} from './tenant/tenant';
export * from './tenant/organization';

// Identity — UserStatus / SessionStatus canonical in common/enums.
export {
  MfaMethod,
  UserType,
  MfaPolicy,
  type MfaMethod as MfaMethodType,
  type UserType as UserTypeType,
  type MfaPolicy as MfaPolicyType,
  type UserProfile,
  type UserSecuritySettings,
  type UserRoleAssignment,
  type User,
  type CreateUserInput,
  type UpdateUserInput,
  type InviteUserInput,
  buildDisplayName,
  canUserLogin,
  normalizeEmail,
  SECURITY_CONSTANTS,
} from './identity/user';
export * from './identity/role';
export {
  type Session,
  type CreateSessionInput,
  type DeviceInfo,
  type GeoLocation,
  AuthMethod,
  SESSION_CONSTANTS,
} from './identity/session';
export * from './identity/policy';

// Audit
// audit-event redeclares AuditEventType (canonical in common/enums).
export {
  AuditCategory,
  AuditSeverity,
  AuditOutcome,
  AUDIT_RETENTION,
  type AuditActor,
  type AuditTarget,
  type AuditChange,
  type AuditEvent,
  type AuditError,
  type CreateAuditEventInput,
  type AuditEventFilters,
  getCategoryForEventType,
  getDefaultSeverityForEventType,
  buildAuditDescription,
} from './audit/audit-event';

// Property management — PropertyId/OwnerId/PropertyStatus/PropertyType
// canonical in common/types & common/enums.
export {
  type Address,
  type Property,
  createProperty,
  calculateOccupancyRate,
  updateUnitCounts,
} from './property/property';
// unit/block redeclare UnitId/UnitStatus/UnitType/BlockId & as*Id helpers
// canonical in common/types & common/enums.
export {
  type Unit,
  createUnit,
  updateUnitStatus,
  recordInspection,
  isInspectionOverdue,
  updateRent,
} from './property/unit';
export {
  type BlockStatus,
  type Block,
  createBlock,
  updateBlockUnitCounts,
  changeBlockStatus,
  generateBlockCode,
  calculateOccupancyRate as calculateBlockOccupancyRate,
} from './property/block';

// Customer management — CustomerStatus / IdDocumentType canonical in
// common/enums.
export {
  type EmergencyContact,
  type CustomerProfile,
  type Customer,
  type CommunicationPreferences,
  createCustomer,
  verifyCustomer,
  updateProfile,
  blacklistCustomer,
  getFullName,
  generateCustomerNumber,
} from './customer/customer';

// Lease management — LeaseStatus / LeaseType / RentFrequency canonical in
// common/enums.
export {
  type LeaseOccupant,
  type Lease,
  createLease,
  activateLease,
  terminateLease,
  isExpiringSoon,
  isExpired as isLeaseExpired,
  calculateLateFee,
  generateLeaseNumber,
  getDaysUntilRentDue,
} from './lease/lease';
export * from './lease/occupancy';

// Payments — PaymentMethodType canonical here (payments/payment-method).
// PaymentMethod (the simpler enum) is canonical in common/enums.
export * from './payments/payment-intent';
export {
  PaymentMethodTypeSchema,
  PaymentMethodStatusSchema,
  CardBrandSchema,
  BankAccountKindSchema,
  MpesaDetailsSchema,
  AirtelMoneyDetailsSchema,
  TigoPesaDetailsSchema,
  type PaymentMethodId,
  type PaymentMethodType,
  type PaymentMethodStatus,
  type CardBrand,
  type BankAccountKind,
  type MpesaDetails,
  type AirtelMoneyDetails,
  asPaymentMethodId,
} from './payments/payment-method';

// Financial — invoice/transaction redeclare InvoiceType/TransactionType
// (canonical in common/enums) and PaymentMethodType (canonical in
// payments/payment-method).
export {
  InvoiceStatusSchema,
  InvoiceLineItemSchema,
  InvoiceSchema,
  type InvoiceStatus,
  type InvoiceLineItem,
  type Invoice,
  type InvoiceData,
  createInvoice,
  sendInvoice,
  recordPayment,
  markOverdue,
  voidInvoice,
  isOverdue,
  generateInvoiceNumber,
} from './financial/invoice';

export {
  TransactionStatusSchema,
  TransactionCategorySchema,
  TransactionSchema,
  type TransactionStatus,
  type TransactionCategory,
  type Transaction,
  type TransactionData,
  createTransaction,
  markProcessing as markTransactionProcessing,
  markCompleted as markTransactionCompleted,
} from './financial/transaction';
// receipt re-declares ReceiptStatus / ReceiptStatusSchema canonical in
// common/enums; re-export selectively.
export {
  ReceiptTypeSchema,
  ReceiptDeliveryMethodSchema,
  ReceiptSchema,
  type ReceiptType,
  type ReceiptDeliveryMethod,
  type Receipt,
  type ReceiptData,
  createReceipt,
  issueReceipt,
  sendReceipt,
  voidReceipt,
  generateReceiptNumber,
} from './financial/receipt';

// arrears-case redeclares ArrearsStatus / ArrearsStatusSchema (canonical in
// common/enums) and assignCase / resolveCase (also in legal/case which is
// already aliased). Re-export with arrears-specific aliases.
export {
  ArrearsSeveritySchema,
  ArrearsActionSchema,
  ArrearsCaseSchema,
  type ArrearsSeverity,
  type ArrearsAction,
  type ArrearsCase,
  type ArrearsCaseData,
  createArrearsCase,
  addAction,
  assignCase as assignArrearsCase,
  recordContactAttempt,
  recordPromiseToPay,
  markPromiseBroken,
  resolveCase as resolveArrearsCase,
} from './financial/arrears-case';

// Payment plans — PaymentPlanId / asPaymentPlanId / PaymentPlanStatus
// canonical in common/types & common/enums.
export {
  type Installment,
  type PaymentPlanAgreement,
  createPaymentPlan,
  approvePaymentPlan,
  activatePaymentPlan,
  recordInstallmentPayment,
  markAsDefaulted,
  generatePaymentPlanNumber,
  calculateProgress,
  hasOverdueInstallments,
} from './payment/payment-plan';

// Ledger and accounting
export * from './ledger/account';
export * from './ledger/ledger-entry';

// Statements
export * from './statements/statement';

// Maintenance and work orders — Brand types (WorkOrderId, VendorId,
// VendorScorecardId) and `VendorStatus` enum live canonically in
// common/types & common/enums; we re-export module symbols selectively.
export {
  DEFAULT_SLA_CONFIG,
  type WorkOrderPriority,
  type WorkOrderStatus,
  type WorkOrderCategory,
  type WorkOrderSource,
  type WorkOrderAttachment,
  type WorkOrderTimelineEntry,
  type SLAConfig,
  type SLATracking,
  type WorkOrder,
  createWorkOrder,
  triageWorkOrder,
  assignWorkOrder,
  scheduleWorkOrder,
  startWork as startWorkOrderWork,
  completeWorkOrder,
  verifyCompletion,
  escalateWorkOrder,
  pauseSLA,
  resumeSLA,
  isResponseSLABreached,
  isResolutionSLABreached,
  generateWorkOrderNumber,
} from './maintenance/work-order';

export * from './maintenance/inspection';

export {
  type VendorContact,
  type ServiceArea,
  type VendorRating,
  type Vendor,
  type BankDetails,
  type VendorType,
  createVendor,
  approveVendor,
  updateVendorRating,
  areDocumentsExpiring,
  canHandleCategory,
  generateVendorNumber,
} from './maintenance/vendor';

export {
  type VendorScorecard,
  createVendorScorecard,
  getPerformanceTier,
  formatPeriod,
  getCompletionRate,
  getOnTimeRate,
} from './maintenance/vendor-scorecard';
// vendor-assignment redeclares VendorAssignmentId/asVendorAssignmentId that
// also live in common/types — re-export selectively.
export {
  AvailableHoursSchema,
  VendorAssignmentSchema,
  type AvailableHours,
  type VendorAssignment,
  type VendorAssignmentData,
  createVendorAssignment,
  activateAssignment,
  deactivateAssignment,
} from './maintenance/vendor-assignment';

// Operations (Assets, Maintenance Requests, Dispatch, Completion)
// Goes through ./operations/index.ts which de-duplicates dual-signoff vs
// completion-proof exports.
export * from './operations';

// Legal (Cases, Notices)
// Goes through ./legal/index.ts which de-duplicates Brand types and helper
// names that several legal sub-modules redeclare.
export * from './legal';

// Documents — document-upload re-declares DocumentUploadId / OcrExtractionId
// and as* helpers that also live in common/types. Re-export selectively.
export {
  QualityAssessmentSchema,
  DocumentMetadataSchema,
  DocumentUploadSchema,
  type DocumentUpload,
  type DocumentUploadData,
  type QualityAssessment,
  type DocumentMetadata,
  createDocumentUpload,
  setQualityAssessment,
  markProcessing as markDocumentProcessing,
  linkOcrExtraction,
  verifyDocument,
  rejectDocument as rejectDocumentUpload,
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
export {
  VerificationBadgeSchema,
  type VerificationBadge,
  type VerificationBadgeData,
  createVerificationBadge,
  revokeBadge,
  renewBadge,
  addEvidenceDocument,
  isBadgeActive,
  isBadgeExpired,
  getDaysUntilExpiry,
  isIdentityBadge,
} from './documents/verification-badge';
export * from './documents/fraud-risk-score';

// Intelligence (AI Personalization).
// Intelligence re-exports several asXxxId helpers that are also defined on
// common/types. The common/types versions take precedence; consumers can
// still reach intelligence-specific helpers via `from '@bossnyumba/domain-
// models/intelligence'` once a subpath export is added.
// eslint-disable-next-line @typescript-eslint/no-unused-expressions
export type {
  CustomerPreferences,
  RiskFactor,
  PreferredChannel,
  CommsStyle,
  RiskLevel,
  RiskType,
  ActionType,
  ActionStatus,
  ActionOutcome,
  QuietHours,
  CustomerPreferencesId,
} from './intelligence/index';
export { asCustomerPreferencesId } from './intelligence/index';

// Notifications — `notification.ts` exports `markDelivered` which collides with
// `legal/notice.ts`'s `markDelivered`. Re-export selectively.
export {
  NotificationSchema,
  NotificationChannelSchema,
  NotificationStatusSchema,
  NotificationCategorySchema,
  NotificationLocaleSchema,
  type Notification,
  type NotificationChannel,
  type NotificationStatus,
  type NotificationCategory,
  type NotificationLocale,
  type NotificationId,
  asNotificationId,
  canTransition as canNotificationTransition,
  createNotification,
  markSent,
  markDelivered as markNotificationDelivered,
  markFailed as markNotificationFailed,
  markRead as markNotificationRead,
} from './notifications/notification';
