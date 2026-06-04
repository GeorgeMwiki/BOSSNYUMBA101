/**
 * Channel gateway — canonical inbound types.
 *
 * BossNyumba meets owners, portfolio managers, leasing agents, and tenants
 * (renters) on whatever channel they have: a feature-phone USSD code, an SMS,
 * a WhatsApp voice note, an IVR call, an email, or the web app. Today each
 * connector is a silo. This package canonicalizes all six into ONE
 * {@link ChannelEvent} so the brain layer (Mr. Mwikila) sees a single
 * normalized surface, then keeps conversation state in sync as a person hops
 * channels (start on WhatsApp, finish on the web).
 *
 * Every type is readonly. There is NO direct SDK/HTTP/DB import here:
 * signature verification, state persistence, and tier resolution are injected
 * ports (see ports.ts). Boundary inputs are validated with zod.
 *
 * @module @bossnyumba/channel-gateway/types
 */

import { z } from 'zod';

// ----------------------------------------------------------------------------
// Channel + tier
// ----------------------------------------------------------------------------

/** The six inbound channels BossNyumba canonicalizes. */
export type ChannelKind =
  | 'whatsapp'
  | 'sms'
  | 'ussd'
  | 'voice'
  | 'email'
  | 'web';

/**
 * Resolved actor tier. Mirrors BossNyumba's role-gated model
 * (owner / manager / agent / tenant). `anonymous` is an unresolved sender — it
 * still produces a canonical event (so the brain can answer public questions)
 * but carries no tenant scope.
 *
 * Note: `tenant` here is the property-renter role (the person renting a unit),
 * not the multi-tenancy organisation boundary.
 */
export type ActorTier =
  | 'owner'
  | 'manager'
  | 'agent'
  | 'tenant'
  | 'anonymous';

// ----------------------------------------------------------------------------
// Sender identity
// ----------------------------------------------------------------------------

/** Channel-native sender address, before resolution. */
export interface RawSender {
  /** E.164 phone for whatsapp/sms/ussd/voice. */
  readonly phone?: string;
  /** Email address for the email channel. */
  readonly email?: string;
  /** Opaque web user id / session subject for the web channel. */
  readonly webUserId?: string;
}

/** Resolved sender after the tier-mapping port runs. */
export interface ResolvedSender {
  readonly raw: RawSender;
  readonly tenantId: string | null;
  readonly actorId: string | null;
  readonly tier: ActorTier;
}

// ----------------------------------------------------------------------------
// Attachments + content
// ----------------------------------------------------------------------------

export type AttachmentKind = 'image' | 'document' | 'audio' | 'video';

export interface ChannelAttachment {
  readonly kind: AttachmentKind;
  /**
   * Provider-hosted URL. Treat as UNTRUSTED — any fetch MUST go through the
   * injected SSRF-safe fetch port, never a bare fetch.
   */
  readonly url: string;
  readonly mimeType?: string;
  readonly filename?: string;
  readonly sizeBytes?: number;
}

// ----------------------------------------------------------------------------
// Canonical event
// ----------------------------------------------------------------------------

/**
 * The unified inbound event. Every connector maps its native webhook payload
 * to this shape via the per-channel canonicalizers.
 */
export interface ChannelEvent {
  /** Stable id for idempotency (provider message id where available). */
  readonly eventId: string;
  readonly channel: ChannelKind;
  readonly sender: ResolvedSender;
  /** Plain-text content (HTML stripped, transcript for voice). May be empty. */
  readonly text: string;
  readonly attachments: readonly ChannelAttachment[];
  /** ISO 8601 receipt timestamp. */
  readonly receivedAt: string;
  /**
   * Provider-specific raw metadata, frozen. Lets downstream code reach
   * channel-native fields (WhatsApp message id, email thread id, USSD service
   * code) without widening the canonical surface.
   */
  readonly metadata: Readonly<Record<string, unknown>>;
  /** True iff the provider signature verified. Never trust an unsigned event. */
  readonly signatureVerified: boolean;
}

/** Outcome of `canonicalize`: either a verified event or a rejection. */
export type CanonicalizeResult =
  | { readonly ok: true; readonly event: ChannelEvent }
  | {
      readonly ok: false;
      readonly reason: CanonicalizeRejection;
      readonly detail: string;
    };

export type CanonicalizeRejection =
  | 'signature_invalid'
  | 'unsupported_payload'
  | 'malformed';

// ----------------------------------------------------------------------------
// Cross-channel conversation state
// ----------------------------------------------------------------------------

/** Per-channel session window tracking (e.g. WhatsApp 24h). */
export interface ChannelSession {
  readonly channel: ChannelKind;
  readonly identifier: string;
  readonly firstContactAt: string;
  readonly lastContactAt: string;
  readonly messageCount: number;
  /** Window expiry for channels that have one (WhatsApp). ISO 8601. */
  readonly windowExpiresAt?: string;
}

export interface ConversationTurn {
  readonly id: string;
  readonly role: 'user' | 'assistant';
  readonly channel: ChannelKind;
  readonly text: string;
  readonly at: string;
}

/**
 * Cross-channel conversation state keyed by a stable conversation id (the host
 * derives it from tenant + actor, or from a thread). Immutable — updates
 * return fresh objects.
 */
export interface ConversationState {
  readonly conversationId: string;
  readonly tenantId: string | null;
  readonly actorId: string | null;
  readonly lastChannel: ChannelKind;
  readonly lastActivityAt: string;
  readonly turns: readonly ConversationTurn[];
  readonly channelSessions: readonly ChannelSession[];
}

export interface HandoffResult {
  readonly state: ConversationState;
  readonly fromChannel: ChannelKind;
  readonly toChannel: ChannelKind;
}

// ----------------------------------------------------------------------------
// Runtime validation (zod) — boundary guards
// ----------------------------------------------------------------------------

/** The canonical channel kinds, as a zod enum for boundary validation. */
export const channelKindSchema = z.enum([
  'whatsapp',
  'sms',
  'ussd',
  'voice',
  'email',
  'web',
]);

/**
 * Validates an inbound canonicalize request at the package boundary. The
 * `payload` stays `unknown` (it crosses the untrusted webhook seam and each
 * canonicalizer reads it defensively); we only assert the envelope shape.
 */
export const canonicalizeInputSchema = z.object({
  channel: channelKindSchema,
  rawBody: z.string(),
  headers: z.record(z.string(), z.string()),
  payload: z.unknown(),
});

/**
 * Validates a numeric meter reading captured over the voice IVR. Mirrors the
 * USSD engine's meter-reading guard: a finite, positive unit count.
 */
export const meterReadingUnitsSchema = z.number().finite().positive();

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

/** WhatsApp customer-care free-message window: 24 hours. */
export const WHATSAPP_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Default cap on retained conversation turns (keeps state bounded). */
export const DEFAULT_MAX_TURNS = 50;
