/**
 * BOSSNYUMBA Domain Models
 * Shared domain models for the BOSSNYUMBA platform
 */

// Common types and utilities
export * from './common/types';
export * from './common/money';
// NOTE: './common/enums' is intentionally NOT re-exported here.
// It duplicates symbols already exported by domain-specific modules
// (e.g., UserStatus from identity/user.ts, PaymentStatus from common/types.ts,
//  WorkOrderStatus from maintenance/work-order.ts, etc.).
// Import directly from '@bossnyumba/domain-models/common/enums' if needed.

// Region & language
export * from './region/region';

// Tenant/Organization
export * from './tenant/tenant';
export * from './tenant/organization';

// Identity (Users, Roles, Sessions, Policies, Cross-tenant Memberships)
export * from './identity/user';
export * from './identity/role';
export * from './identity/session';
export * from './identity/policy';
export * from './identity/membership';

// Audit
export * from './audit/audit-event';

// Property management
export * from './property/property';
export * from './property/unit';
export * from './property/block';

// Customer management
export * from './customer/customer';

// Lease management
export * from './lease/lease';
export * from './lease/occupancy';

// Payments
// Selectively export from payment-intent to avoid duplicate CustomerId/LeaseId exports
export {
  type PaymentChannel,
  PaymentIntentTypeSchema,
  type PaymentIntentType,
  PaymentIntentSchema,
  type PaymentIntentData,
  type PaymentIntent,
  PaymentIntentAggregate,
  type PaymentIntentEvent,
} from './payments/payment-intent';
export * from './payments/payment-method';

// Financial
export * from './financial/invoice';
export * from './financial/transaction';
export * from './financial/receipt';
export * from './financial/arrears-case';

// Payment plans
export * from './payment/payment-plan';

// Ledger and accounting
export * from './ledger/account';
export * from './ledger/ledger-entry';

// Statements
export * from './statements/statement';

// Maintenance and work orders
export * from './maintenance/work-order';
export * from './maintenance/inspection';
export * from './maintenance/vendor';
export * from './maintenance/vendor-scorecard';
export * from './maintenance/vendor-assignment';

// Operations (Assets, Maintenance Requests, Dispatch, Completion)
export * from './operations/asset';
export * from './operations/maintenance-request';
export * from './operations/dispatch-event';
export * from './operations/completion-proof';
export * from './operations/dual-signoff';

// Legal (Cases, Notices)
export * from './legal/case';
export * from './legal/timeline-event';
export * from './legal/evidence-attachment';
export * from './legal/notice';
export * from './legal/notice-service-receipt';

// Documents
export * from './documents/document-upload';
export * from './documents/verification-badge';
export * from './documents/fraud-risk-score';

// Intelligence (AI Personalization)
export * from './intelligence/index';

// Notifications
export * from './notifications/notification';
