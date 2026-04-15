/**
 * BOSSNYUMBA Domain Models
 * Shared domain models for the BOSSNYUMBA platform
 */

// Common types, utilities, and enums
export * from './common/types';
export * from './common/money';
export * from './common/enums';

// Tenant/Organization
export * from './tenant/tenant';
export * from './tenant/organization';

// Identity (Users, Roles, Sessions, Policies)
export * from './identity/user';
export * from './identity/role';
export * from './identity/session';
export * from './identity/policy';

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
export * from './payments/payment-intent';
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

// Documents — verification-badge re-declares VerificationBadgeId / IdentityProfileId
// and as* helpers that also live in common/types. Re-export selectively.
export * from './documents/document-upload';
export {
  VerificationBadgeSchema,
  type VerificationBadge,
  type VerificationBadgeData,
  createVerificationBadge,
  revokeBadge,
  renewBadge,
  addEvidenceDocument,
  isBadgeActive,
  isBadgeExpired,
  getDaysUntilExpiry,
  isIdentityBadge,
} from './documents/verification-badge';
export * from './documents/fraud-risk-score';

// Intelligence (AI Personalization).
// Intelligence re-exports several asXxxId helpers that are also defined on
// common/types. The common/types versions take precedence; consumers can
// still reach intelligence-specific helpers via `from '@bossnyumba/domain-
// models/intelligence'` once a subpath export is added.
// eslint-disable-next-line @typescript-eslint/no-unused-expressions
export type {
  CustomerPreferences,
  RiskFactor,
  PreferredChannel,
  CommsStyle,
  RiskLevel,
  RiskType,
  ActionType,
  ActionStatus,
  ActionOutcome,
  QuietHours,
  CustomerPreferencesId,
} from './intelligence/index';
export { asCustomerPreferencesId } from './intelligence/index';

// Notifications — `notification.ts` exports `markDelivered` which collides with
// `legal/notice.ts`'s `markDelivered`. Re-export selectively.
export {
  NotificationSchema,
  NotificationChannelSchema,
  NotificationStatusSchema,
  NotificationCategorySchema,
  NotificationLocaleSchema,
  type Notification,
  type NotificationChannel,
  type NotificationStatus,
  type NotificationCategory,
  type NotificationLocale,
  type NotificationId,
  asNotificationId,
  canTransition as canNotificationTransition,
  createNotification,
  markSent,
  markDelivered as markNotificationDelivered,
  markFailed as markNotificationFailed,
  markRead as markNotificationRead,
} from './notifications/notification';
