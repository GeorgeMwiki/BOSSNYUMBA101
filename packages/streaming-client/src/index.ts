/**
 * @bossnyumba/streaming-client — Phase J8 public surface.
 *
 * Vision (user-explicit): "the platform is going to be so heavy, and we
 * want it to work on mobile, like the intelligence, the brain, and
 * everything, even if it works locally". Heavy intelligence runs
 * server-side; the phone receives optimistic streams. This package is
 * the client-side counterpart of that vision.
 *
 * Narrowed scope for the first PR (anti-stall):
 *   1. SSE transport (WebSocket transport deferred)
 *   2. Optimistic state reducer (Redux-style, token-by-token)
 *   3. Offline cache backed by `idb-keyval`
 *   4. Mobile network policy (Network Information API)
 *
 * Deferred to follow-up PRs: WebSocket transport, service-worker push,
 * mobile-bench harness, and the chat-stream router endpoint.
 */

export * from './types.js';

// Transports.
export { SseChatStream, type SseChatStreamDeps } from './transports/sse-chat-stream.js';
export {
  drainSseFrames,
  parseSseFrame,
  tryParseChatStreamEvent,
  type ParsedFrame,
} from './transports/sse-parser.js';

// State.
export {
  OptimisticStateReducer,
  type OptimisticStateReducerDeps,
} from './state/optimistic-reducer.js';
export { applyEvent, EMPTY_STATE } from './state/apply-event.js';

// Offline.
export {
  IndexedDbOfflineCache,
  type IndexedDBCacheDeps,
} from './offline/indexed-db-cache.js';
export { cacheKey, tenantPrefix, tabPrefix, parseCacheKey } from './offline/cache-key.js';

// Network policy.
export {
  MobileNetworkPolicy,
  type MobileNetworkPolicyDeps,
  classifyNetwork,
  NETWORK_TUNING,
} from './network/mobile-network-policy.js';
