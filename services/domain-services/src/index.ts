/**
 * @bossnyumba/domain-services
 *
 * Core domain services for the BOSSNYUMBA platform.
 * Implements business logic and data persistence with tenant isolation.
 *
 * Note: Explicit re-exports are used below to disambiguate between modules
 * that define overlapping symbols (e.g. CustomerRepository is defined in
 * both lease/ and customer/; InvoiceId in both invoice/ and payment/, etc.).
 * The last-wins "export *" strategy does not work under isolatedModules,
 * so we import wildcard where safe and use explicit named re-exports to
 * prefer the canonical source per symbol.
 */

// Common infrastructure
export * from './common/index.js';

// Tenant services - create, update, getPolicyConstitution
export * from './tenant/index.js';

// Identity services (prefer identity's AuditService; audit/ module has its own)
export * from './identity/index.js';

// Property services - CRUD, getOccupancy, getUnits
export * from './property/index.js';

// Lease services - create, renew, terminate, getActive
// Lease defines CustomerRepository and CustomerCreatedEvent; prefer the
// customer/ versions below by using explicit re-exports from lease/ minus
// the conflicting symbols.
export type {
  LeaseServiceErrorCode,
  LeaseServiceErrorResult,
  LeaseRepository,
  CreateCustomerInput as LeaseCreateCustomerInput,
  UpdateCustomerInput as LeaseUpdateCustomerInput,
  CreateLeaseInput,
  UpdateLeaseInput,
  RenewalInput,
  RenewalWindowType,
  RenewalWindow,
  ConditionReportItem,
  ConditionReport,
  DepositDeductionReason,
  DepositDeduction,
  DepositDisposition,
  LeaseCreatedEvent,
  LeaseActivatedEvent,
  LeaseTerminatedEvent,
  LeaseRenewalWindowEvent,
  DepositReturnedEvent,
} from './lease/index.js';
export { LeaseServiceError, LeaseService } from './lease/index.js';

// Customer services - onboard, updateProfile, getTimeline
export * from './customer/index.js';

// Invoice services - generate, send, getOutstanding
// Invoice defines Invoice, InvoiceId, InvoiceLineItem, InvoiceStatus which
// are also defined under payment/. Prefer invoice/ here and omit from
// payment re-export below.
export * from './invoice/index.js';

// Payment services - use explicit re-exports to avoid conflicts with invoice/
export type {
  PaymentId,
  TransactionId,
  PaymentStatus,
  PaymentMethod,
  Payment,
  TransactionType,
  TransactionCategory,
  Transaction,
  PaymentServiceErrorCode,
  PaymentServiceErrorResult,
  InvoiceLineItemType,
} from './payment/index.js';
export {
  asPaymentId,
  asTransactionId,
  PaymentServiceError,
} from './payment/index.js';

// Maintenance services - createRequest, dispatch, complete
// Maintenance defines Vendor* symbols that conflict with vendor/. Prefer
// vendor/ (canonical) and re-export only non-conflicting from maintenance.
export type {
  VendorSpecialization,
  VendorEntity,
  MaintenanceServiceErrorCode,
  MaintenanceServiceErrorResult,
  WorkOrderRepository,
  CreateWorkOrderInput,
  TriageWorkOrderInput,
  AssignWorkOrderInput,
  ScheduleWorkOrderInput,
  CompleteWorkOrderInput,
  WorkOrderCreatedEvent,
  WorkOrderAssignedEvent,
  WorkOrderCompletedEvent,
  SLABreachedEvent,
} from './maintenance/index.js';
export { MaintenanceServiceError, MaintenanceService } from './maintenance/index.js';

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

// Utilities tracking services - has DateRange that conflicts
export type {
  UtilityType,
  MeterType,
  UtilityResponsibility,
  UtilityBillStatus,
  MeterReading,
  UtilityAccount,
  UtilityBill,
  MeterReadingRecordedEvent,
  UtilityBillCreatedEvent,
  HighConsumptionAlertEvent,
  UtilityEvent,
  UtilityAccountStore,
  MeterReadingStore,
  UtilityBillStore,
  UtilityBillFilters,
  UtilityServiceErrorCode,
  UtilityServiceErrorResult,
} from './utilities/index.js';
export {
  UtilityServiceError,
  DEFAULT_HIGH_CONSUMPTION_THRESHOLD,
} from './utilities/index.js';

// Audit logging services (AuditService already exported via identity/)
export type {
  AuditServiceOptions,
  AuditRepository,
  AuditedOptions,
} from './audit/index.js';
export { MemoryAuditRepository, Audited } from './audit/index.js';

// Messaging/Chat services
export * from './messaging/index.js';

// Compliance/Legal services - defines CaseStatus, NoticeType, DateRange
// (DateRange already conflicts with utilities/). Prefer compliance's
// CaseStatus/NoticeType over cases/ versions below.
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

// Case management services - CaseId, NoticeType conflict with compliance/
// Also CustomerId, InvoiceId conflict with customer/invoice. Use explicit.
export type {
  CaseId,
  NoticeId,
  EvidenceId,
} from './cases/index.js';

// Vendor management services - preferred source for Vendor* types
export * from './vendor/index.js';
