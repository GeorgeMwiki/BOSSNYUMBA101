/**
 * @bossnyumba/agent-platform — public API.
 */

// Types
export type {
  RegisteredAgent,
  AgentStatus,
  AgentScope,
  AgentAuthSuccess,
  AgentAuthError,
  AgentAuthResult,
  AgentErrorResponse,
  IdempotencyRecord,
  WebhookSubscription,
  WebhookSubscriptionStatus,
  WebhookDelivery,
  WebhookDeliveryStatus,
  AgentCard,
  AgentCardProvider,
  AgentCapability,
  AgentCardAuth,
  ToolSummary,
  ResourceSummary,
  AgentCardRateLimit,
} from './types.js';

export { ALL_AGENT_SCOPES, SUBSCRIBABLE_EVENTS } from './types.js';

// Error codes
export {
  createAgentError,
  getErrorHttpStatus,
  isRetryableError,
  type AgentErrorCode,
} from './error-codes.js';

// Correlation
export {
  getCorrelationId,
  correlationHeaders,
  forwardHeaders,
  type HeadersLike,
} from './correlation-id.js';

// Auth
export {
  verifyAgentRequest,
  buildCanonicalString,
  signRequest,
  generateAgentApiKey,
  generateAgentHmacSecret,
  hashApiKey,
  hmacSha256Hex,
  sha256Hex,
  timingSafeEqual,
  createInMemoryReplayLedger,
  type AgentAuthRequest,
  type AgentAuthDeps,
  type AgentRegistry,
  type ReplayLedger,
} from './agent-auth.js';

// Idempotency
export {
  checkIdempotency,
  claimIdempotency,
  cacheIdempotencyResponse,
  createInMemoryIdempotencyStore,
  type IdempotencyStore,
  type IdempotencyCheck,
} from './idempotency.js';

// Webhook delivery
export {
  deliverToSubscription,
  type DeliverDeps,
  type DeliverEventPayload,
  type FetchLike,
  type WebhookStore,
  type WebhookDLQ,
  type WebhookDLQEnvelope,
} from './webhook-delivery.js';

// Agent card
export { generateAgentCard, type AgentCardDeps } from './agent-card.js';
