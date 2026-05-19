/**
 * Phase J8 — shared types for the streaming-client package.
 *
 * Why a single types file?
 * The SSE transport, the state reducer, the offline cache and the
 * network policy all converse in the same vocabulary. Putting the
 * contracts here keeps each module under the 250-line cap while making
 * the wire-level shape explicit for downstream portal adopters.
 */

// ─────────────────────────────────────────────────────────────────────
// Streaming chat events
// ─────────────────────────────────────────────────────────────────────

/**
 * Discriminated union over the events a transport can yield. We re-use
 * the AG-UI vocabulary loosely (RUN_*, TEXT_MESSAGE_*, TOOL_CALL_*)
 * but DO NOT take a hard dep on `@bossnyumba/central-intelligence` from
 * the client-side bundle — the client should boot even if the kernel
 * package is mid-deploy.
 */
export type ChatStreamEvent =
  | { type: 'RUN_STARTED'; threadId: string; runId: string; timestamp: number }
  | { type: 'TEXT_MESSAGE_START'; messageId: string; runId: string; role: 'assistant' | 'system' }
  | { type: 'TEXT_MESSAGE_CONTENT'; messageId: string; delta: string }
  | { type: 'TEXT_MESSAGE_END'; messageId: string }
  | { type: 'TOOL_CALL_START'; toolCallId: string; runId: string; name: string }
  | { type: 'TOOL_CALL_ARGS'; toolCallId: string; delta: string }
  | { type: 'TOOL_CALL_END'; toolCallId: string; result?: unknown }
  | { type: 'AG_UI_PART'; partId: string; runId: string; component: string; props: Record<string, unknown> }
  | { type: 'PROACTIVE_RECOMMENDATION'; runId: string; recommendation: ProactiveRecommendation }
  | { type: 'STATE_DELTA'; runId: string; patch: Record<string, unknown> }
  | { type: 'RUN_FINISHED'; runId: string; reason: 'completed' | 'cancelled' }
  | { type: 'RUN_ERROR'; runId: string; error: string };

export interface ProactiveRecommendation {
  /** Stable id so re-renders + IndexedDB inserts are idempotent. */
  id: string;
  /**
   * Which J3 tab this recommendation belongs to — drives the
   * service-worker click-handler routing. Examples: 'lease-renewals',
   * 'rent-collection', 'maintenance', 'arrears'.
   */
  tabId: string;
  /** Short human-readable headline rendered into the push notification. */
  title: string;
  /** Longer body (kept under 200 chars for OS-notification truncation). */
  body: string;
  /** Optional pre-rendered AG-UI card so the tab opens instantly. */
  card?: { component: string; props: Record<string, unknown> };
  /** Severity drives notification urgency on Android. */
  severity?: 'info' | 'warning' | 'critical';
}

// ─────────────────────────────────────────────────────────────────────
// Transport interface
// ─────────────────────────────────────────────────────────────────────

export interface TransportConnectOptions {
  /** Tenant the user is operating in — every event is tenant-scoped. */
  tenantId: string;
  /** Auth token to send in the Authorization header (SSE) or query (WS). */
  authToken: string;
  /** Chat thread id we want to subscribe to. */
  threadId: string;
  /** Optional message to seed the run with. If omitted, transport opens an empty subscription. */
  message?: string;
  /** Optional presence packet — what tab/row the user is looking at. */
  presence?: Record<string, unknown>;
  /**
   * Resume-from offset. SSE = Last-Event-Id, WS = `?resumeFrom=`. The
   * server is expected to replay events with id > resumeFrom.
   */
  resumeFrom?: string;
  /** Mobile-network-class tuning. Set by `MobileNetworkPolicy` when known. */
  batchHintMs?: number;
}

export type TransportState =
  | { kind: 'idle' }
  | { kind: 'connecting' }
  | { kind: 'open'; openedAt: number }
  | { kind: 'closed'; reason: string; at: number }
  | { kind: 'error'; error: string; at: number };

export interface TransportEventListener {
  (event: ChatStreamEvent): void;
}

export interface TransportStateListener {
  (state: TransportState): void;
}

/**
 * Common interface every transport implements. Consumers depend on this,
 * NEVER on the concrete `SseChatStream` / `WebSocketChatStream`. That's
 * how we keep the offline-degrade story honest: the cache layer can swap
 * transport when `MobileNetworkPolicy` flips connection class.
 */
export interface ChatTransport {
  connect(opts: TransportConnectOptions): Promise<void>;
  disconnect(reason?: string): void;
  onEvent(listener: TransportEventListener): () => void;
  onState(listener: TransportStateListener): () => void;
  getState(): TransportState;
}

// ─────────────────────────────────────────────────────────────────────
// Optimistic chat-message store
// ─────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  /** Token-accumulated content (assistant) or full text (user). */
  content: string;
  /** `pending` until terminal event arrives. */
  status: 'pending' | 'complete' | 'errored';
  /** When the FIRST token arrived. Used by mobile-bench for FTL. */
  firstTokenAt: number | null;
  /** When the LAST token arrived. Used for FRL. */
  lastTokenAt: number | null;
  /** AG-UI generative parts attached to this message. */
  parts: Array<{ id: string; component: string; props: Record<string, unknown> }>;
  /** Tool calls that fired during this message. */
  toolCalls: Array<{ id: string; name: string; args: string; result?: unknown }>;
}

export interface OptimisticChatState {
  threadId: string | null;
  runId: string | null;
  messages: ChatMessage[];
  recommendations: ProactiveRecommendation[];
  /** Surfacing a top-level error makes the offline banner trivial. */
  lastError: string | null;
}

// ─────────────────────────────────────────────────────────────────────
// Offline cache
// ─────────────────────────────────────────────────────────────────────

export interface CachedEntity<T = unknown> {
  /** Composite key — see `cacheKey()`. Tenant-scoped, never plain id. */
  key: string;
  tenantId: string;
  tabId: string;
  entityId: string;
  data: T;
  /** Monotonic version (server `Last-Modified` or `etag` numeric). */
  version: number;
  cachedAt: number;
}

export interface OfflineCacheAdapter {
  put<T>(entity: CachedEntity<T>): Promise<void>;
  get<T>(key: string): Promise<CachedEntity<T> | null>;
  /** Tab-scoped page; returns latest-cached `limit` entities for the tab. */
  list<T>(tenantId: string, tabId: string, limit: number): Promise<Array<CachedEntity<T>>>;
  /** Bulk-write — used by the diff-sync reconciler. */
  putBatch<T>(entities: Array<CachedEntity<T>>): Promise<void>;
  /** Drops every entity for a tenant — log-out + tenant-switch hook. */
  evictTenant(tenantId: string): Promise<void>;
  /** Returns the highest `version` we have for (tenantId,tabId) — diff anchor. */
  highWatermark(tenantId: string, tabId: string): Promise<number>;
}

// ─────────────────────────────────────────────────────────────────────
// Mobile network policy
// ─────────────────────────────────────────────────────────────────────

export type NetworkClass = 'wifi' | '4g' | '3g' | '2g' | 'slow-2g' | 'offline';

export interface MobileNetworkSnapshot {
  /** Coarse class — drives token-batch + pagination size. */
  class: NetworkClass;
  /** Round-trip-time hint in ms (from NetInfo.rtt). */
  rttMs: number | null;
  /** Downlink hint in Mbps. */
  downlinkMbps: number | null;
  /** User opted-into reduced-data mode (Save-Data header equivalent). */
  saveData: boolean;
  /** True if `navigator.onLine === false`. */
  offline: boolean;
}

export interface MobileNetworkTuning {
  /** Token-stream flush interval applied by `OptimisticStateReducer`. */
  tokenBatchMs: number;
  /** Entity-pagination page size used by tab loaders. */
  entityPageSize: number;
  /**
   * Streaming-buffer hint that the SSE transport forwards to the server
   * in the request body (`batchHintMs`). Slower networks accumulate
   * more before the server emits each frame — saves battery + paint.
   */
  streamBufferMs: number;
  /** When offline: which behaviour do we adopt? */
  offlineDegrade: 'cache-only' | 'show-banner' | 'queue-writes';
}
