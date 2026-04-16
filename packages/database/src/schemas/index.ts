/**
 * Schema exports for BOSSNYUMBA database
 *
 * Duplicate member conflicts (ledgerEntriesRelations, notices*, auditEvents)
 * are resolved by expose-the-first-export-wins ordering, with
 * export-namespace wrappers around the later conflicting modules so the
 * duplicated names remain reachable under a namespace.
 */

export * from './tenant.schema.js';
export * from './property.schema.js';
export * from './blocks.schema.js';
export * from './customer.schema.js';
export * from './lease.schema.js';
export * from './payment.schema.js';
// payment-plan.schema re-declares paymentPlanStatusEnum (payment.schema
// has a legacy variant). Re-export the tables/relations directly and
// expose the module via `PaymentPlan` namespace for disambiguation.
export {
  paymentPlanAgreements,
  paymentPlanAgreementsRelations,
} from './payment-plan.schema.js';
export * as PaymentPlan from './payment-plan.schema.js';
export * from './maintenance.schema.js';
export * from './inspections.schema.js';
export * from './messaging.schema.js';
export * from './scheduling.schema.js';
export * from './utilities.schema.js';
// compliance.schema re-declares notices/noticeTypeEnum/noticesRelations
// which cases.schema also exports. Re-export everything EXCEPT those
// three names directly; expose the compliance notice variants under a
// `Compliance` namespace so both are reachable without collision.
export {
  complianceItemTypeEnum,
  complianceEntityTypeEnum,
  complianceStatusEnum,
  legalCaseTypeEnum,
  legalCaseStatusEnum,
  complianceItems,
  legalCases,
  complianceItemsRelations,
  legalCasesRelations,
} from './compliance.schema.js';
export * as Compliance from './compliance.schema.js';
export * from './intelligence.schema.js';
// ledger.schema re-declares ledgerEntriesRelations (payment.schema has
// a legacy declaration). Re-export the non-conflicting names directly
// and expose the full module under `Ledger` for access to the
// relations alias if needed.
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
  ledgerEntries,
  statements,
  disbursements,
  paymentIntents,
  accountsRelations,
  statementsRelations,
  disbursementsRelations,
  paymentIntentsRelations,
} from './ledger.schema.js';
export * as Ledger from './ledger.schema.js';
export * from './documents.schema.js';
export * from './occupancy.schema.js';
export * from './cases.schema.js';
export * from './communications.schema.js';

// Audit and Event Infrastructure — tenant.schema already exports a
// parallel `auditEvents` legacy table. Re-export non-conflicting names
// directly and expose this richer module via `AuditEvents` namespace.
export {
  auditCategoryEnum,
  auditOutcomeEnum,
  auditSeverityEnum,
  auditActorTypeEnum,
  auditEventsRelations,
} from './audit-events.schema.js';
export * as AuditEvents from './audit-events.schema.js';
export * from './outbox.schema.js';

// HR / Organization (Brain)
export * from './hr.schema.js';

// Conversation / Thread Store (Brain)
export * from './conversation.schema.js';
