/**
 * Schema exports for BOSSNYUMBA database
 */

export * from './tenant.schema.js';
export * from './property.schema.js';
export * from './blocks.schema.js';
export * from './customer.schema.js';
export * from './lease.schema.js';
export * from './payment.schema.js';
// payment-plan.schema shadows some payment.schema exports (paymentPlanStatusEnum).
// Selectively re-export to avoid ambiguity.
export {
  paymentPlanAgreements,
  paymentPlanAgreementsRelations,
} from './payment-plan.schema.js';
export * from './maintenance.schema.js';
export * from './inspections.schema.js';
export * from './messaging.schema.js';
export * from './scheduling.schema.js';
export * from './utilities.schema.js';
export * from './compliance.schema.js';
export * from './intelligence.schema.js';
// ledger.schema shadows payment.schema's ledgerEntries / ledgerEntriesRelations.
// Selectively re-export non-conflicting members.
export {
  accountTypeEnum,
  accountStatusEnum,
  ledgerEntryTypeEnum,
  entryDirectionEnum,
  statementTypeEnum,
  statementStatusEnum,
  statementPeriodTypeEnum,
  disbursementStatusEnum,
  accounts,
  statements,
  disbursements,
  paymentIntents,
  accountsRelations,
  statementsRelations,
  disbursementsRelations,
  paymentIntentsRelations,
} from './ledger.schema.js';
export * from './documents.schema.js';
export * from './occupancy.schema.js';
// cases.schema shadows compliance.schema's notices / noticeTypeEnum / noticesRelations.
// Selectively re-export only case-specific members.
export {
  caseTypeEnum,
  caseSeverityEnum,
  caseStatusEnum,
  timelineEventTypeEnum,
  resolutionTypeEnum,
  evidenceTypeEnum,
  noticeStatusEnum,
  deliveryMethodEnum,
  cases,
  caseTimelines,
  evidenceAttachments,
  caseResolutions,
  noticeServiceReceipts,
  casesRelations,
  caseTimelinesRelations,
  evidenceAttachmentsRelations,
  caseResolutionsRelations,
  noticeServiceReceiptsRelations,
} from './cases.schema.js';
export * from './communications.schema.js';

// Audit and Event Infrastructure
// audit-events.schema shadows tenant.schema's auditEvents.
// Selectively re-export non-conflicting audit members.
export {
  auditCategoryEnum,
  auditOutcomeEnum,
  auditSeverityEnum,
  auditActorTypeEnum,
  auditEventsRelations,
} from './audit-events.schema.js';
export * from './outbox.schema.js';
