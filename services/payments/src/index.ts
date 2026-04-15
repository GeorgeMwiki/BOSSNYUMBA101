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

// M-Pesa STK Push (hardened)
export {
  initiateStkPush,
  setStkIdempotencyStore,
  getStkIdempotencyStore,
  setStkRateLimiter,
  getStkRateLimiter,
  RateLimitExceededError,
  type StkPushParams,
  type StkPushResult,
} from './providers/mpesa/stk-push';

// M-Pesa Callback Handler (hardened)
export {
  parseStkCallback,
  parseB2CCallback,
  verifyMpesaCallbackSignature,
  assertStkCallbackNotReplayed,
  setCallbackReplayStore,
  getCallbackReplayStore,
  InvalidSignatureError,
  DuplicateCallbackError,
  type StkCallbackResult,
  type B2CCallbackResultParsed,
} from './providers/mpesa/callback-handler';

// M-Pesa Auth
export {
  getAccessToken,
} from './providers/mpesa/auth';

// M-Pesa Types
export type {
  MpesaConfig,
  StkPushRequest,
  StkPushResponse,
  StkCallbackBody,
} from './providers/mpesa/types';

// M-Pesa B2C
export {
  initiateB2C,
  type B2CParams,
  type B2CResult,
} from './providers/mpesa/b2c';

// M-Pesa Query
export {
  queryTransaction,
} from './providers/mpesa/query';

// Common: store interfaces (for Redis adapter wiring)
export type { IdempotencyStore } from './common/idempotency';
export type { ReplayStore } from './common/replay-store';
export type { RateLimiter } from './common/rate-limit';

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
