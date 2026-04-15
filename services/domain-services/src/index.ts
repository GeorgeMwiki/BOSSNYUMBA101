/**
 * @bossnyumba/domain-services
 *
 * Core domain services for the BOSSNYUMBA platform.
 * Implements business logic and data persistence with tenant isolation.
 */

// Common infrastructure
export * from './common/index.js';

// Observability helpers (health, ready, metrics)
export {
  createDomainServicesObservability,
  type DomainServicesHealth,
  type DomainServicesObservability,
  type DomainServicesObservabilityOptions,
} from './observability.js';

// Tenant services - create, update, getPolicyConstitution
export * from './tenant/index.js';

// Identity services
export * from './identity/index.js';

// Property services - CRUD, getOccupancy, getUnits
export * from './property/index.js';

// Customer services - onboard, updateProfile, getTimeline
// Star-export is the authoritative source for Customer-related symbols.
export * from './customer/index.js';

// Lease services - create, renew, terminate, getActive
// NOTE: lease/index re-declares some customer-related symbols (CustomerCreatedEvent,
// CustomerRepository, ConditionRating). We explicitly re-export lease-owned names
// here to avoid ambiguity with customer/index and other modules.
export {
  LeaseServiceError,
  type LeaseServiceErrorCode,
  type LeaseServiceErrorResult,
  type LeaseRepository,
  type CreateCustomerInput,
  type UpdateCustomerInput,
  type CreateLeaseInput,
  type UpdateLeaseInput,
  type RenewalInput,
  type RenewalWindowType,
  type RenewalWindow,
  type ConditionReportItem,
  type ConditionReport,
  type DepositDeductionReason,
  type DepositDeduction,
  type DepositDisposition,
  type LeaseCreatedEvent,
  type LeaseActivatedEvent,
  type LeaseTerminatedEvent,
  type LeaseRenewalWindowEvent,
  type DepositReturnedEvent,
  LeaseService,
} from './lease/index.js';

// Invoice services - generate, send, getOutstanding
// NOTE: invoice/index re-declares symbols shared with other modules. Use explicit
// re-exports for invoice-owned symbols only.
export {
  type Invoice,
  type InvoiceId,
  type InvoiceLineItem,
  type InvoiceStatus,
  type InvoicePaidEvent,
  type InvoiceRepository,
  type RecordPaymentInput,
} from './invoice/index.js';

// Payment services
export * from './payment/index.js';

// Maintenance services - createRequest, dispatch, complete
// NOTE: maintenance/index redeclares Vendor* symbols that also live in vendor/index.
// We let vendor/index be authoritative via its star-export later.
export * from './maintenance/index.js';

// Document services - upload, verify, getEvidencePack
export * from './document/index.js';

// Report services - getDashboard, getStatement, exportPdf
export * from './report/index.js';

// Feedback services
export * from './feedback/index.js';

// Inspection services
export * from './inspections/index.js';

// Scheduling services
export * from './scheduling/index.js';

// Approval workflow services
export * from './approvals/index.js';

// Utilities tracking services
// NOTE: utilities re-declares DateRange which also lives in other modules.
// Keep star export but consumers should import DateRange from the desired module directly.
export * from './utilities/index.js';

// Audit logging services
// NOTE: identity/index also exports an AuditService; we re-export audit/ items
// except AuditService to avoid ambiguity. Consumers can import AuditService
// directly from 'domain-services/audit' if they need the audit-module version.
export type {
  AuditAction,
  AuditEntry,
  AuditChange,
  AuditQuery,
  PaginatedAuditResult,
  AuditStats,
  AuditSearchFilters,
  RetentionPolicy,
  AuditContext,
  AuditServiceOptions,
  AuditRepository,
  AuditedOptions,
  SensitiveDataAccessedEvent,
  BulkExportPerformedEvent,
  SuspiciousActivityDetectedEvent,
  AuditEvent,
} from './audit/index.js';
export {
  MemoryAuditRepository,
  getAuditContext,
  setAuditContext,
  clearAuditContext,
  withAuditContext,
  Audited,
} from './audit/index.js';

// Messaging/Chat services
export * from './messaging/index.js';

// Compliance/Legal services
// NOTE: compliance re-declares DateRange (also in utilities). We re-export
// compliance-owned symbols explicitly.
export type {
  ComplianceType,
  ComplianceStatus,
  ComplianceItem,
  CaseStatus,
  CaseDocument,
  CaseTimelineEntry,
  LegalCase,
  NoticeType,
  NoticeAcknowledgement,
  Notice,
  ComplianceFilters,
  LegalCaseFilters,
  ComplianceReport,
  NoticeTemplateVariables,
  ComplianceDueEvent,
  ComplianceOverdueEvent,
  NoticeServedEvent,
  LegalCaseCreatedEvent,
  LegalCaseClosedEvent,
  LegalCaseStatusChangedEvent,
  CaseEvidenceAddedEvent,
  ComplianceItemStore,
  LegalCaseStore,
  NoticeStore,
  ComplianceServiceErrorCode,
  ComplianceServiceErrorResult,
} from './compliance/index.js';
export {
  NOTICE_TEMPLATES,
  renderNoticeTemplate,
  ComplianceServiceError,
  ComplianceService,
  MemoryComplianceItemStore,
  MemoryLegalCaseStore,
  MemoryNoticeStore,
} from './compliance/index.js';

// Case management services
// NOTE: cases re-declares CaseStatus, NoticeType (also in compliance) and
// CustomerId (also in customer). We explicitly re-export cases-owned symbols.
export type {
  CaseId,
  NoticeId,
  EvidenceId,
  LeaseId as CasesLeaseId,
  PropertyId as CasesPropertyId,
  UnitId,
  InvoiceId as CasesInvoiceId,
  CaseType,
  CaseSeverity,
  NoticeChannel,
  CaseTimelineEvent,
  CaseNotice,
  CaseEvidence,
  PaymentPlan,
  CaseResolution,
  Case,
  CaseServiceErrorCode,
  CaseServiceErrorResult,
  CaseRepository,
  CreateCaseInput,
  UpdateCaseInput,
  AddTimelineEventInput,
  CreateNoticeInput,
  SendNoticeInput,
  AddEvidenceInput,
  ResolveCaseInput,
  CaseCreatedEvent,
  CaseEscalatedEvent,
  CaseResolvedEvent,
  NoticeSentEvent,
} from './cases/index.js';
export {
  asCaseId,
  asNoticeId,
  asEvidenceId,
  CaseServiceError,
  CaseService,
} from './cases/index.js';

// Vendor management services
// NOTE: maintenance/index also exports some Vendor* symbols. We take
// vendor/index as authoritative and explicitly re-export its vendor-owned
// names (omitting ones that also appear in maintenance/index).
export type {
  VendorId,
  VendorCategory,
  VendorScorecard,
  VendorCertification,
  Vendor,
  VendorServiceErrorCode,
  VendorServiceErrorResult,
  AddCertificationInput,
  UpdateMetricsInput,
  VendorCreatedEvent,
  VendorStatusChangedEvent,
  VendorScorecardUpdatedEvent,
} from './vendor/index.js';
export {
  asVendorId,
  VendorServiceError,
  VendorService,
} from './vendor/index.js';
