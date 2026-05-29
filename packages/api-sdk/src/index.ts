/**
 * @bossnyumba/api-sdk — public entry.
 *
 * Re-exports:
 *   - `createBossnyumbaClient` and friends from `./client`
 *   - The OpenAPI-generated `paths`, `components`, `operations` types
 */

export {
  createBossnyumbaClient,
  ApiSdkError,
  buildUrl,
  parseErrorResponse,
  type BossnyumbaClient,
  type BossnyumbaClientConfig,
  type ApiSdkErrorPayload,
  type HttpMethod,
  type RequestArgs,
  type PathKeys,
} from './client.js';

export type { paths, components, operations, webhooks } from './types.js';

// Per-user Jarvis client — typed POST helpers for the central-
// intelligence sovereign-AI surfaces (one per user type).
export {
  createJarvisClient,
  type JarvisSurface,
  type JarvisSurfaceClient,
  type JarvisTier,
  type JarvisStakes,
  type JarvisSeverity,
  type JarvisApprovalStatus,
  type JarvisAttachment,
  type JarvisThinkRequest,
  type JarvisThinkResponse,
  type JarvisDecision,
  type JarvisBriefing,
  type JarvisBriefingDataPoint,
  type JarvisBriefingRequest,
  type JarvisBriefingResponse,
  type JarvisProposeActionRequest,
  type JarvisApprovalRecord,
  type JarvisApprovalSignature,
  type JarvisSignRequest,
  type JarvisRecordFeedbackRequest,
  type FeedbackSignal,
  type FeedbackCategory,
} from './jarvis-client.js';

// Per-user Jarvis streaming — SSE channel for the same surfaces as
// `createJarvisClient`. Additive to the single-shot `think()` method.
export {
  createJarvisStream,
  parseSseBlock,
  translateEvent,
  type JarvisStreamEvent,
  type JarvisStreamHandle,
  type JarvisStreamPersona,
  type JarvisStreamConfidence,
  type JarvisStreamGateVerdict,
  type JarvisStreamUiPart,
} from './jarvis-stream.js';

// Typed error hierarchy — agents switch on instanceof rather than parse
// HTTP status codes. Wraps the legacy ApiSdkError class.
export {
  BossNyumbaError,
  AuthError,
  ValidationError,
  RateLimitError,
  ServerError,
  NetworkError,
  toBossNyumbaError,
  type BossNyumbaErrorArgs,
} from './errors.js';

// Exponential-backoff retry helper for idempotent requests.
export {
  retry,
  defaultShouldRetry,
  type RetryOptions,
} from './retry.js';

// Universal SSE consumer — Node 20+ / Bun / Deno / browser.
export {
  consumeSse,
  type SseFrame,
  type ConsumeSseOptions,
} from './sse.js';

// 13 typed brain-tool client categories: chat, drafts, estate,
// compliance, opportunities, risks, decisions, entities, reminders,
// share, bulk, undo, scope. Backed by retry + structured errors.
export {
  createBrainTools,
  type BrainToolClients,
  type ChatClient,
  type ChatSendOptions,
  type DraftsClient,
  type EstateClient,
  type ComplianceClient,
  type OpportunitiesClient,
  type RisksClient,
  type DecisionsClient,
  type EntitiesClient,
  type RemindersClient,
  type ShareClient,
  type BulkClient,
  type UndoClient,
  type ScopeClient,
} from './brain-tools.js';
