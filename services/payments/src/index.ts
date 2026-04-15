// Bootstrap must be imported first so that any consumer of this package
// gets the M-Pesa support stores auto-wired from `MPESA_STORE_BACKEND`.
import './bootstrap';

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

// Store wiring (factories + setters). Consumers may override the
// auto-bootstrapped stores for tests or custom deployments.
export {
  bootstrapPaymentsStores,
  shutdownPaymentsStores,
} from './bootstrap';
export {
  createStores,
  type PaymentStores,
  type StoreBackend,
  type CreateStoresOptions,
} from './common/store-factory';
export {
  setStkIdempotencyStore,
  getStkIdempotencyStore,
  setCallbackReplayStore,
  getCallbackReplayStore,
  setStkRateLimiter,
  getStkRateLimiter,
  type StkIdempotencyStore,
  type CallbackReplayStore,
  type StkRateLimiter,
} from './common/stores';
export {
  RedisStkIdempotencyStore,
  RedisCallbackReplayStore,
  RedisStkRateLimiter,
  type RedisLike,
  type RedisStoreOptions,
} from './common/redis-store';
