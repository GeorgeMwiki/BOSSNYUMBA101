// M-Pesa STK Push
export {
  MpesaStkPush,
  mpesaStkPush,
  type MpesaConfig,
  type StkPushRequest,
  type StkPushResponse,
  type StkQueryRequest,
  type StkQueryResponse,
} from './mpesa/stk-push';

// M-Pesa Callback Handler
export {
  MpesaCallbackHandler,
  mpesaCallbackHandler,
  type StkCallbackBody,
  type StkCallbackMetadataItem,
  type ParsedStkCallback,
  type C2BConfirmation,
  type ParsedC2BPayment,
  type PaymentEventType,
} from './mpesa/callback';

// Payment Reconciliation
export {
  PaymentMatcher,
  paymentMatcher,
  type Payment,
  type Invoice,
  type MatchResult,
  type ReconciliationSummary,
  type MatcherConfig,
} from './reconciliation/matcher';

// Payment/Invoice reconciliation (statements/ledger-driven)
export {
  reconcile as reconcilePaymentsInvoices,
  type ReconciliationInput,
  type ReconciliationResult as InvoiceReconciliationResult,
} from './reconciliation/reconciler';
export {
  generateReconciliationReport,
  type ReconciliationReport,
} from './reconciliation/report';

// Daraja providers (full stack)
export * as MpesaDaraja from './providers/mpesa';
export * as AirtelMoney from './providers/airtel-money';
export * as TigoPesa from './providers/tigopesa';

// Common utilities
export * from './common/errors';
export * from './common/types';
export * from './common/retry';
export * from './common/idempotency';
export * from './common/metrics';
