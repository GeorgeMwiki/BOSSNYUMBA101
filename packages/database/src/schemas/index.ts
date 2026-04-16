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
// already exports one); expose this module via a namespace.
export * as PaymentPlan from './payment-plan.schema.js';
export * from './maintenance.schema.js';
export * from './inspections.schema.js';
export * from './messaging.schema.js';
export * from './scheduling.schema.js';
export * from './utilities.schema.js';
// compliance.schema re-declares notices* and noticeTypeEnum which also
// appear later in cases.schema; expose the compliance variants via a
// namespace to avoid the duplicate-export error.
export * as Compliance from './compliance.schema.js';
export * from './intelligence.schema.js';
// ledger.schema re-declares ledgerEntriesRelations (payment.schema already
// defines it); namespace the ledger module.
export * as Ledger from './ledger.schema.js';
export * from './documents.schema.js';
export * from './occupancy.schema.js';
export * from './cases.schema.js';
export * from './communications.schema.js';

// Audit and Event Infrastructure — tenant.schema already exports a
// parallel `auditEvents`; expose this module via a namespace.
export * as AuditEvents from './audit-events.schema.js';
export * from './outbox.schema.js';

// HR / Organization (Brain)
export * from './hr.schema.js';

// Conversation / Thread Store (Brain)
export * from './conversation.schema.js';
