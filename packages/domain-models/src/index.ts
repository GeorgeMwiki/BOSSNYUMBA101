/**
 * BOSSNYUMBA Domain Models
 * Shared domain models for the BOSSNYUMBA platform
 */

// Common — value exports (non-duplicated names only). Domain files own
// the canonical definitions for names like SubscriptionTier, PaymentMethod,
// etc.; we re-export only what lives exclusively in common/*.
export {
  ActionStatusSchema, ActionTypeSchema, AssetCondition, AssetConditionSchema,
  AssetStatus, AssetStatusSchema, AuditEventTypeSchema, BadgeType,
  BadgeTypeSchema, CaseSeverity, CaseSeveritySchema, CaseStatus, CaseStatusSchema,
  CaseType, CaseTypeSchema, ChannelPreference, ChannelPreferenceSchema,
  CurrencyCodeSchema, CustomerStatusSchema, DeliveryMethod, DeliveryMethodSchema,
  DocumentSource, DocumentSourceSchema, DocumentStatus, DocumentStatusSchema,
  DocumentType, DocumentTypeSchema, EvidenceType, EvidenceTypeSchema,
  FraudRiskLevel, FraudRiskLevelSchema, IdDocumentTypeSchema, KycStatus,
  KycStatusSchema, LeaseStatusSchema, LeaseTypeSchema, LedgerAccountType,
  LedgerAccountTypeSchema, NoticeStatus, NoticeStatusSchema, NoticeType,
  NoticeTypeSchema, OccupancyStatus, OccupancyStatusSchema, OnboardingState,
  OnboardingStateSchema, PaymentMethodSchema, PaymentPlanStatusSchema,
  PaymentStatus, PaymentStatusSchema, PropertyStatusSchema, PropertyTypeSchema,
  RentFrequencySchema, ResolutionType, ResolutionTypeSchema, RiskLevelSchema,
  RiskTypeSchema, SegmentStatus, SegmentStatusSchema, SegmentType,
  SegmentTypeSchema, SessionStatusSchema, SubscriptionTierSchema,
  TenantStatusSchema, TerminationReason, TerminationReasonSchema,
  TimelineEventType, TimelineEventTypeSchema, UnitStatusSchema, UnitTypeSchema,
  UserStatusSchema, VendorStatusSchema, VerificationStatus,
  VerificationStatusSchema, WorkOrderCategorySchema, WorkOrderPrioritySchema,
  WorkOrderSourceSchema, WorkOrderStatusSchema,
} from './common/enums';
export type {
  AssetCondition as AssetConditionType, AssetStatus as AssetStatusType,
  BadgeType as BadgeTypeEnum, CaseSeverity as CaseSeverityType,
  CaseStatus as CaseStatusType, CaseType as CaseTypeEnum,
  ChannelPreference as ChannelPreferenceType, DeliveryMethod as DeliveryMethodType,
  DocumentSource as DocumentSourceType, DocumentStatus as DocumentStatusType,
  DocumentType as DocumentTypeEnum, EvidenceType as EvidenceTypeEnum,
  FraudRiskLevel as FraudRiskLevelType, KycStatus as KycStatusType,
  LedgerAccountType as LedgerAccountTypeEnum, NoticeStatus as NoticeStatusType,
  NoticeType as NoticeTypeEnum, OccupancyStatus as OccupancyStatusType,
  OnboardingState as OnboardingStateType, PaymentStatus as PaymentStatusType,
  ResolutionType as ResolutionTypeEnum, SegmentStatus as SegmentStatusType,
  SegmentType as SegmentTypeEnum, TerminationReason as TerminationReasonType,
  TimelineEventType as TimelineEventTypeEnum,
  VerificationStatus as VerificationStatusType,
} from './common/enums';

export {
  AccountTypeSchema, LedgerEntryTypeSchema, StatementPeriodTypeSchema,
  StatementStatusSchema, asAccountId, asArrearsCaseId, asAuditEventId,
  asCaseResolutionId, asCaseTimelineId, asCommunicationConsentId,
  asCompletionProofId, asCustomerId, asDeliveryReceiptId, asDispatchEventId,
  asDocumentAccessLogId, asDualSignOffId, asEscalationChainId,
  asEscalationChainRunId, asInvoiceId, asLeaseId, asLedgerEntryId,
  asMaintenanceRequestId, asMessageInstanceId, asMessageTemplateId,
  asOcrExtractionId, asOrganizationId, asOwnerStatementId, asPaymentIntentId,
  asPolicyId, asReceiptId, asRoleId, asSessionId, asStatementId, asTenantId,
  asTenantPreferenceId, asTransactionId, asUserId, createId, err, ok,
} from './common/types';
export type {
  AccountId, AccountType, ArrearsCaseId, AuditEventId, Brand, CaseResolutionId,
  CaseTimelineId, CommunicationConsentId, CustomerId, DeliveryReceiptId,
  DispatchEventId, DocumentAccessLogId, DualSignOffId, EntityMetadata,
  EscalationChainId, EscalationChainRunId, ISOTimestamp, InvoiceId, LeaseId,
  LedgerEntryId, LedgerEntryType, MaintenanceRequestId, MessageInstanceId,
  MessageTemplateId, OrganizationId, OwnerStatementId, PaginatedResult,
  PaginationParams, PaymentIntentId, PolicyId, ReceiptId, Result, RoleId,
  SessionId, SoftDeletable, StatementId, StatementPeriodType, StatementStatus,
  TenantId, TenantPreferenceId, TenantScoped, TenantScopedEntity, TransactionId,
  UserId,
} from './common/types';

export * from './common/money';
export * from './common/region-config';

// Per-country jurisdictional rules — new pluggable contract (Phase D).
// Currently TZ + KE. Adding a country is a single-object edit. See file
// header for the rationale on coexistence with region-config.ts.
export {
  getJurisdictionalRules,
  listSupportedJurisdictions,
  type JurisdictionalRules,
  type JurisdictionalIdentityDocType,
  type JurisdictionalTaxAuthority,
  type JurisdictionalLandRegistry,
  type JurisdictionalMobileMoneyProvider,
  type JurisdictionalBankRailProvider,
  type JurisdictionalLeaseRules,
  type JurisdictionalDataProtection,
} from './common/jurisdictional-rules.js';

// Tenant/Organization
export * from './tenant/tenant';
export * from './tenant/organization';
export * from './tenant/kenya-identifiers';

// Identity (Users, Roles, Sessions, Policies)
export * from './identity/user';
export * from './identity/role';
export * from './identity/session';
export * from './identity/policy';
export * from './identity/tenant-identity';
export * from './identity/authority-level';

// Audit
export * from './audit/audit-event';

// Geo — per-org elastic geo-hierarchy (NOT the country registry).
export * from './geo';

// Property management — property.ts and block.ts each declare their own
// calculateOccupancyRate. Expose block under a namespace.
export * from './property/property';
export * from './property/unit';
export * as Block from './property/block';

// Customer management
export * from './customer/customer';

// Lease management
export * as Lease from './lease/lease';
// occupancy re-exposed under a namespace so its helpers don't collide.
export * as Occupancy from './lease/occupancy';

// Payments
export * from './payments/payment-intent';
// payment-method defines local PaymentMethodType that shadows common/enums;
// expose it under a namespace instead.
export * as PaymentMethod from './payments/payment-method';

// Financial — each module exports its own mark*/assign*/resolve* helpers
// with the same names. Namespace them.
//
// NOTE: `Invoice` is intentionally NOT namespace-aliased here — flat
// re-exports below cover both the function helpers AND the type surface
// so downstream services can `import { Invoice, createInvoice } from
// '@bossnyumba/domain-models'`. TS forbids a value-namespace + interface
// double-bind under the same identifier, and the flat surface is the
// canonical one (post-round3 cascade-3 fix wave).
export * as Transaction from './financial/transaction';
export * as Receipt from './financial/receipt';
export * as ArrearsCase from './financial/arrears-case';

// Flat re-exports of invoice helper functions for consumers that import
// them by name from the top-level barrel (e.g. domain-services/invoice).
// The `Invoice` namespace alias above stays for back-compat — but TS
// disallows a value+namespace+type triple-bind under the same name, so
// the interface is re-exported as `Invoice` here (shadowing the namespace
// for value position; type position still picks up the interface).
//
// Both the function helpers AND the type surface are emitted flat so
// downstream services (`domain-services/invoice`, api-gateway routes)
// can import them by name without resolving through `Invoice.<member>`.
export {
  createInvoice,
  sendInvoice,
  recordPayment,
  markOverdue,
  voidInvoice,
  generateInvoiceNumber,
  isOverdue,
} from './financial/invoice';
export type {
  Invoice,
  InvoiceData,
  InvoiceStatus,
  InvoiceType,
  InvoiceLineItem,
} from './financial/invoice';

// Payment plans
export * from './payment/payment-plan';

// Ledger and accounting
export * from './ledger/account';
export * from './ledger/ledger-entry';

// Statements
export * from './statements/statement';

// Maintenance and work orders — work-order.ts re-exports VendorId from
// vendor.ts so a bare `export *` would collide. The pattern below mirrors
// the Invoice fix: flat-export the type surface (interface + status
// enums) AND the function helpers under explicit names; skip VendorId
// here because vendor.ts is the source of truth for it.
export type {
  WorkOrder,
  WorkOrderId,
  WorkOrderPriority,
  WorkOrderStatus,
  WorkOrderCategory,
  WorkOrderSource,
  WorkOrderAttachment,
  WorkOrderTimelineEntry,
  SLAConfig,
  SLATracking,
} from './maintenance/work-order';
export {
  asWorkOrderId,
  DEFAULT_SLA_CONFIG,
  createWorkOrder,
  triageWorkOrder,
  assignWorkOrder,
  scheduleWorkOrder,
  startWork,
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
export * from './maintenance/vendor';
export * from './maintenance/vendor-scorecard';
export * from './maintenance/vendor-assignment';

// Operations
export * from './operations/asset';
export * from './operations/maintenance-request';
export * from './operations/dispatch-event';
export * as CompletionProof from './operations/completion-proof';
export * as DualSignoff from './operations/dual-signoff';

// Legal — case/notice/evidence-attachment share helper names; namespace them.
export * as Case from './legal/case';
export * from './legal/timeline-event';
export * as EvidenceAttachment from './legal/evidence-attachment';
export * as Notice from './legal/notice';
export * from './legal/notice-service-receipt';

// Documents
export * from './documents/document-upload';
export * from './documents/verification-badge';
export * from './documents/fraud-risk-score';

// Intelligence (AI Personalization)
export * from './intelligence/index';

// Notifications
export * from './notifications/notification';
