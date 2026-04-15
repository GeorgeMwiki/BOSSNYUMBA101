/**
 * Schema exports for BOSSNYUMBA database
 *
 * Several modules intentionally overlap on table names (compliance/cases for
 * notices, ledger/payment for ledger entries, tenant/audit-events for
 * auditEvents, payment/payment-plan for payment-plan enums). The canonical
 * module is chosen via explicit re-exports below to avoid ambiguous
 * re-exports when star-importing the barrel.
 *
 * Backwards compatibility: previously star-exported names are preserved from
 * their canonical module.
 */

export * from './tenant.schema.js';
export * from './property.schema.js';
export * from './blocks.schema.js';
export * from './customer.schema.js';
export * from './lease.schema.js';
export * from './payment.schema.js';

// payment-plan: avoid paymentPlanStatusEnum which is already exported from
// payment.schema. Expose only the agreements table and its relations.
export {
  paymentPlanAgreements,
  paymentPlanAgreementsRelations,
} from './payment-plan.schema.js';

export * from './maintenance.schema.js';
export * from './inspections.schema.js';
export * from './messaging.schema.js';
export * from './scheduling.schema.js';
export * from './utilities.schema.js';

// compliance: keep the module, but notices/noticeTypeEnum are owned by cases
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

export * from './intelligence.schema.js';

// ledger: expose accounts/statements/disbursements/paymentIntents. The
// ledgerEntries table and its relations are canonical in payment.schema.
export {
  accounts,
  ledgerEntries as ledgerEntriesLegacy,
  statements,
  disbursements,
  paymentIntents,
  accountTypeEnum as ledgerAccountTypeEnumLegacy,
  accountStatusEnum,
  ledgerEntryTypeEnum as ledgerEntryTypeEnumLegacy,
  entryDirectionEnum,
  statementTypeEnum,
  statementStatusEnum,
  statementPeriodTypeEnum,
  disbursementStatusEnum,
  accountsRelations,
  statementsRelations,
  disbursementsRelations,
  paymentIntentsRelations,
} from './ledger.schema.js';

export * from './documents.schema.js';
export * from './occupancy.schema.js';
export * from './cases.schema.js';
export * from './communications.schema.js';

// audit-events: canonical table. tenant.schema's legacy auditEvents is
// preserved via star-export above. Expose the new table under an alias.
export {
  auditEvents as auditEventsV2,
  auditEventsRelations,
} from './audit-events.schema.js';
export * from './outbox.schema.js';
