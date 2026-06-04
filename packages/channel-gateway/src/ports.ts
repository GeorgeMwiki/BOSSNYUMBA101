/**
 * Channel gateway — injected ports.
 *
 * Canonicalization and state-sync are pure; everything with a side effect or
 * a secret is a port the host wires at boot. There is NO Supabase / Drizzle /
 * HMAC-secret / HTTP / `process.env` / console import anywhere in this
 * package — the api-gateway composition root supplies real adapters; tests
 * supply in-memory fakes.
 *
 * @module @bossnyumba/channel-gateway/ports
 */

import type {
  ActorTier,
  ChannelKind,
  ConversationState,
  RawSender,
} from './types';

// ----------------------------------------------------------------------------
// Signature verification
// ----------------------------------------------------------------------------

/** What a connector hands the verifier: the raw body + the provider headers. */
export interface SignatureInput {
  readonly channel: ChannelKind;
  /** Exact raw request body bytes/text as received (pre-JSON-parse). */
  readonly rawBody: string;
  /** Lower-cased header map. */
  readonly headers: Readonly<Record<string, string>>;
}

/**
 * Verifies a provider webhook signature. The host injects the real HMAC /
 * token check per provider (Meta `X-Hub-Signature-256`, Africa's Talking
 * HMAC-SHA1, Twilio `X-Twilio-Signature`, etc.) using secrets from its
 * bootstrap config. Returns `true` only on a passing signature.
 *
 * SECURITY: fail-closed. An unknown channel or a missing secret returns
 * `false` so an unsigned event is rejected, never trusted.
 */
export interface SignatureVerifier {
  verify(input: SignatureInput): boolean | Promise<boolean>;
}

// ----------------------------------------------------------------------------
// Sender -> tier resolution
// ----------------------------------------------------------------------------

/**
 * Maps a channel-native sender to a tenant + actor + tier. The host queries
 * the member directory (phone / email / web-subject -> member). NEVER throws:
 * an unresolved sender returns `tier: 'anonymous'` with null scope, so the
 * gateway degrades to a safe public default instead of crashing.
 */
export interface TierResolver {
  resolve(sender: RawSender): Promise<{
    readonly tenantId: string | null;
    readonly actorId: string | null;
    readonly tier: ActorTier;
  }>;
}

// ----------------------------------------------------------------------------
// Cross-channel state store
// ----------------------------------------------------------------------------

/**
 * Persistence for cross-channel conversation state. Backed by Redis/Upstash
 * in production (with a TTL) or an in-memory map in tests. Updates are
 * immutable: `put` overwrites with a fresh object the caller built.
 */
export interface ConversationStore {
  get(conversationId: string): Promise<ConversationState | null>;
  put(state: ConversationState): Promise<void>;
  /** Best-effort delete (e.g. on conversation close). */
  remove(conversationId: string): Promise<void>;
}

// ----------------------------------------------------------------------------
// SSRF-safe remote fetch (read-only attachment data)
// ----------------------------------------------------------------------------

export interface SafeFetchResult {
  readonly ok: boolean;
  readonly status: number;
  readonly bytes?: Uint8Array;
  readonly contentType?: string;
  readonly reason?: string;
}

/**
 * SSRF-guarded fetch for provider-hosted attachment URLs (WhatsApp media,
 * email attachment links, IVR recordings). The host injects a validator that
 * resolves DNS, rejects private ranges / rebind pivots, and bounds size +
 * timeout. This package NEVER calls bare `fetch` on a remote URL.
 */
export interface SafeFetchPort {
  fetch(
    url: string,
    options?: { readonly maxBytes?: number; readonly timeoutMs?: number },
  ): Promise<SafeFetchResult>;
}

// ----------------------------------------------------------------------------
// Audit sink (optional, fire-and-forget)
// ----------------------------------------------------------------------------

/**
 * Optional analytics/audit sink for canonicalize outcomes. Fire-and-forget:
 * the gateway calls it without awaiting on the hot path and swallows any
 * throw, so an audit failure never affects canonicalization. The host wires
 * this to the observability package; tests usually omit it.
 */
export interface ChannelAuditSink {
  log(entry: {
    readonly channel: ChannelKind;
    readonly eventId: string;
    readonly tier: ActorTier;
    readonly outcome: 'accepted' | 'rejected';
    readonly reason?: string;
  }): void;
}

// ----------------------------------------------------------------------------
// Clock
// ----------------------------------------------------------------------------

/** Injectable clock so tests are deterministic. */
export interface Clock {
  now(): Date;
}

/** Default wall-clock implementation. */
export const systemClock: Clock = { now: () => new Date() };
