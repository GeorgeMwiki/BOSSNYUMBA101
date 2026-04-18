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
export * from './inspections-extensions.schema.js';
export * from './conditional-survey.schema.js';
export * from './asset-components.schema.js';
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

// Marketplace bundle (Negotiation / Marketplace / Waitlist)
export * from './negotiation.schema.js';
export * from './marketplace.schema.js';
export * from './waitlist.schema.js';

// Approval Policies (per-tenant overrides; defaults in domain-services)
export * from './approval-policy.schema.js';

// Payments bundle
// GePG — Tanzania Government e-Payment Gateway (NEW 3)
export * from './gepg.schema.js';
// Arrears Ledger (NEW 4) — arrearsCases already exported from payment.schema,
// so we expose the richer module under `ArrearsLedger` namespace.
export * as ArrearsLedger from './arrears-cases.schema.js';
// Gamification (NEW 9)
export * from './gamification.schema.js';

// Documents bundle — render jobs, letter requests, scan bundles, doc-chat
export * from './document-render-jobs.schema.js';
export * from './letter-requests.schema.js';
export * from './scan-bundles.schema.js';
export * from './document-embeddings.schema.js';
export * from './doc-chat-sessions.schema.js';
export * from './doc-chat-messages.schema.js';
export * from './migration-runs.schema.js';

// Per-org geo-hierarchy (Districts/Regions/Stations etc., org-defined)
export * from './geo.schema.js';

// Lease + Risk + Compliance bundle (additive)
export * from './tenant-finance.schema.js';
export * from './intelligence-history.schema.js';
export * from './tenant-risk-reports.schema.js';
export * from './compliance-exports.schema.js';

// Reports bundle (additive): Interactive Reports (NEW 17) + Station Master Coverage (NEW 18)
export * from './interactive-reports.schema.js';
export * from './station-master-coverage.schema.js';

// Identity bundle — Cross-Org Tenant Identity + Multi-Org (Conflict 2)
export * from './identity.schema.js';
