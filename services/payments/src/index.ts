/**
 * @bossnyumba/payments
 *
 * Public API for the payments service. All M-Pesa functionality is
 * served by the hardened providers at ./providers/mpesa/ (Week 0
 * security hardening: idempotency, HMAC verification, replay
 * protection, rate limiting, MSISDN redaction, secret rotation).
 *
 * The legacy ./mpesa/ directory was removed — it contained an
 * un-hardened duplicate that was a launch blocker.
 */

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
