/**
 * Schema exports for BOSSNYUMBA database
 *
 * NOTE: Some schemas define overlapping enums/tables. We order exports
 * so the canonical source comes first, and later files that re-define
 * the same symbols are exported selectively.
 */

// Core schemas (canonical sources)
export * from './tenant.schema.js';
export * from './property.schema.js';
export * from './blocks.schema.js';
export * from './customer.schema.js';
export * from './lease.schema.js';

// Payment schemas - payment-plan.schema first (canonical for paymentPlanStatusEnum)
export * from './payment-plan.schema.js';
// payment.schema: paymentPlanStatusEnum already exported from payment-plan.schema
export {
  invoiceStatusEnum,
  invoiceTypeEnum,
  paymentStatusEnum,
  paymentMethodEnum,
  transactionTypeEnum,
  invoices,
  payments,
  transactions,
  invoicesRelations,
  paymentsRelations,
  transactionsRelations,
  receiptStatusEnum,
  arrearsStatusEnum,
  ownerStatementStatusEnum,
  ledgerAccountTypeEnum,
  receipts,
  paymentPlans,
  arrearsCases,
  ownerStatements,
  ledgerEntries,
  receiptsRelations,
  paymentPlansRelations,
  arrearsCasesRelations,
  ownerStatementsRelations,
  ledgerEntriesRelations,
} from './payment.schema.js';

export * from './maintenance.schema.js';
export * from './inspections.schema.js';
export * from './messaging.schema.js';
export * from './scheduling.schema.js';
export * from './utilities.schema.js';

// compliance.schema - canonical for notices, noticeTypeEnum
export * from './compliance.schema.js';
export * from './intelligence.schema.js';

// ledger.schema: ledgerEntries/ledgerEntriesRelations already from payment.schema
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

// cases.schema: noticeTypeEnum/notices/noticesRelations already from compliance.schema
export {
  caseTypeEnum,
  caseSeverityEnum,
  caseStatusEnum,
  timelineEventTypeEnum,
  resolutionTypeEnum,
  evidenceTypeEnum,
  cases,
  caseTimelines,
  evidenceAttachments,
  caseResolutions,
  casesRelations,
  caseTimelinesRelations,
  evidenceAttachmentsRelations,
  caseResolutionsRelations,
  noticeServiceReceipts,
} from './cases.schema.js';

export * from './communications.schema.js';

// audit-events.schema: auditEvents already from tenant.schema
export {
  auditCategoryEnum,
  auditOutcomeEnum,
  auditSeverityEnum,
  auditActorTypeEnum,
  auditEventsRelations,
} from './audit-events.schema.js';
export type { AuditEventRecord, NewAuditEventRecord } from './audit-events.schema.js';

export * from './outbox.schema.js';

// Cross-tenant memberships
export * from './cross-tenant-memberships.schema.js';

// Jurisdiction configuration (global-first, database-driven)
export * from './jurisdiction-config.schema.js';

// Subprocessor registry (DPA gates, kill-switches)
export * from './subprocessors.schema.js';

// Refresh tokens (rotation + compromise detection)
export * from './refresh-tokens.schema.js';
