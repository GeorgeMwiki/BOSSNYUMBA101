/**
 * Multi-surface session continuity types (R2 #10).
 *
 * A conversation is surface-agnostic — backed by J1's `conversation`
 * entity. Each turn carries metadata describing the surface it
 * arrived from so the MD (Master Dispatcher) can choose appropriate
 * rendering primitives. WhatsApp is the TZ-critical surface; an owner
 * may start on the Web, continue on WhatsApp during the commute, and
 * finish on SMS.
 */

import type { Citation } from '../types.js';

export type SurfaceKind = 'web' | 'mobile' | 'whatsapp' | 'sms' | 'email';

/**
 * What each surface can render. Used by the MD to choose between
 * rich and degraded outputs.
 *
 *   - `richBlocks`     Can render AG-UI inline blocks (Matrix, charts).
 *   - `markdown`       Can render Markdown headings / bold / lists.
 *   - `attachments`    Can attach binary files (images, PDFs).
 *   - `htmlEmail`      Structured HTML email body.
 *   - `interactive`    Can post back replies (Web/Mobile/WhatsApp).
 *   - `maxLengthChars` Hard upper bound for body text.
 */
export interface SurfaceCapabilities {
  readonly richBlocks: boolean;
  readonly markdown: boolean;
  readonly attachments: boolean;
  readonly htmlEmail: boolean;
  readonly interactive: boolean;
  readonly maxLengthChars: number;
}

/**
 * The cross-surface "envelope" the MD emits. The surface adapter
 * marshals this into surface-specific format.
 */
export interface AgentTurn {
  readonly turnId: string;
  readonly conversationId: string;
  readonly tenantId: string;
  readonly principalId: string;
  readonly createdAtIso: string;
  /** Plain-text fallback. ALWAYS present. */
  readonly text: string;
  /** Optional rich blocks (AG-UI parts). Dropped on SMS / plain-text. */
  readonly richParts?: ReadonlyArray<RichPart>;
  /** Optional citations — surface adapters render them inline as
   *  footnotes for SMS/WhatsApp, or as a sidebar on Web. */
  readonly citations?: ReadonlyArray<Citation>;
  /** Optional attachments — images, PDFs. Dropped on SMS. */
  readonly attachments?: ReadonlyArray<TurnAttachment>;
}

export interface RichPart {
  readonly kind: string;
  readonly [key: string]: unknown;
}

export interface TurnAttachment {
  readonly url: string;
  readonly mimeType: string;
  readonly name: string;
}

/** A surface-marshalled rendering — what each adapter actually emits. */
export type SurfaceRendering =
  | WebRendering
  | MobileRendering
  | WhatsAppRendering
  | SmsRendering
  | EmailRendering;

export interface WebRendering {
  readonly surface: 'web';
  readonly text: string;
  readonly richParts: ReadonlyArray<RichPart>;
  readonly citations: ReadonlyArray<Citation>;
  readonly attachments: ReadonlyArray<TurnAttachment>;
}

export interface MobileRendering {
  readonly surface: 'mobile';
  readonly text: string;
  readonly richParts: ReadonlyArray<RichPart>;
  readonly citations: ReadonlyArray<Citation>;
  readonly attachments: ReadonlyArray<TurnAttachment>;
}

export interface WhatsAppRendering {
  readonly surface: 'whatsapp';
  /** WhatsApp-flavoured markdown (single asterisks for bold, etc). */
  readonly body: string;
  readonly imageAttachments: ReadonlyArray<TurnAttachment>;
  /**
   * Cited references appended at the foot of the message, one per
   * line, prefixed with `[<n>]`.
   */
  readonly citationsFootnote: string;
}

export interface SmsRendering {
  readonly surface: 'sms';
  readonly body: string;
  /** Number of SMS "parts" required by the 160-char encoding. */
  readonly parts: number;
}

export interface EmailRendering {
  readonly surface: 'email';
  readonly subject: string;
  readonly htmlBody: string;
  readonly plainBody: string;
  readonly attachments: ReadonlyArray<TurnAttachment>;
}

/**
 * The contract each surface adapter implements.
 *
 *   - `capabilities`  Static — what this surface can render.
 *   - `marshal`       Turn-to-rendering function. Must NEVER mutate.
 */
export interface SurfaceAdapter<R extends SurfaceRendering> {
  readonly kind: SurfaceKind;
  readonly capabilities: SurfaceCapabilities;
  marshal(turn: AgentTurn): R;
}

// ──────────────────────────────────────────────────────────────────────
// Cross-surface conversation store
// ──────────────────────────────────────────────────────────────────────

/**
 * A turn record stored against a conversation. The store is per-tenant
 * (yes, even surface state is tenant-isolated).
 */
export interface ConversationTurn {
  readonly turnId: string;
  readonly conversationId: string;
  readonly tenantId: string;
  readonly principalId: string;
  readonly surface: SurfaceKind;
  readonly createdAtIso: string;
  readonly role: 'user' | 'agent';
  readonly text: string;
}

/**
 * Surfaces an owner has consented to receive proactive notifications
 * from. The MD uses this when picking the highest-priority surface
 * for a proactive recommendation.
 */
export interface SurfaceConsent {
  readonly principalId: string;
  readonly tenantId: string;
  readonly preferences: ReadonlyArray<{
    readonly surface: SurfaceKind;
    readonly priority: number; // lower = higher priority
    readonly enabled: boolean;
  }>;
}
