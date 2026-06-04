/**
 * Channel gateway — inbound canonicalization.
 *
 * `createChannelGateway` wires the signature verifier + tier resolver to the
 * per-channel canonicalizers and exposes a single `canonicalize` entry point
 * the connector routes use. The result is a verified, tier-resolved
 * {@link ChannelEvent} or a typed rejection.
 *
 * Order of operations (security-first):
 *   1. Verify the provider signature on the RAW body. Fail -> reject. We do
 *      this BEFORE parsing so a forged payload never reaches the brain.
 *   2. Canonicalize the parsed payload to a draft.
 *   3. Resolve the sender to a tenant + actor + tier (fail-soft anonymous).
 *   4. Emit the frozen ChannelEvent.
 *
 * @module @bossnyumba/channel-gateway/gateway
 */

import type {
  CanonicalizeRejection,
  CanonicalizeResult,
  ChannelEvent,
  ChannelKind,
} from './types';
import { canonicalizeByChannel } from './canonicalizers';
import {
  systemClock,
  type ChannelAuditSink,
  type Clock,
  type SignatureVerifier,
  type TierResolver,
} from './ports';

export interface ChannelGatewayDeps {
  readonly signature: SignatureVerifier;
  readonly tier: TierResolver;
  readonly clock?: Clock;
  /** Optional fire-and-forget audit sink; never awaited on the hot path. */
  readonly audit?: ChannelAuditSink;
}

export interface CanonicalizeInput {
  readonly channel: ChannelKind;
  /** Raw request body exactly as received (for signature verification). */
  readonly rawBody: string;
  /** Lower-cased provider headers. */
  readonly headers: Readonly<Record<string, string>>;
  /** Parsed payload object the connector extracted from `rawBody`. */
  readonly payload: unknown;
}

export interface ChannelGateway {
  canonicalize(input: CanonicalizeInput): Promise<CanonicalizeResult>;
}

export function createChannelGateway(
  deps: ChannelGatewayDeps,
): ChannelGateway {
  const clock = deps.clock ?? systemClock;

  /** Fire-and-forget audit; a sink throw must never affect the result. */
  const audit = (
    channel: ChannelKind,
    eventId: string,
    tier: ChannelEvent['sender']['tier'],
    outcome: 'accepted' | 'rejected',
    reason?: string,
  ): void => {
    if (!deps.audit) return;
    try {
      deps.audit.log({
        channel,
        eventId,
        tier,
        outcome,
        ...(reason ? { reason } : {}),
      });
    } catch {
      // Swallow — auditing is best-effort and off the critical path.
    }
  };

  const reject = (
    channel: ChannelKind,
    reason: CanonicalizeRejection,
    detail: string,
  ): CanonicalizeResult => {
    audit(channel, '', 'anonymous', 'rejected', reason);
    return { ok: false, reason, detail };
  };

  const canonicalize = async (
    input: CanonicalizeInput,
  ): Promise<CanonicalizeResult> => {
    // 1. Signature first, on the raw body. Fail-closed.
    let verified = false;
    try {
      verified = await deps.signature.verify({
        channel: input.channel,
        rawBody: input.rawBody,
        headers: input.headers,
      });
    } catch {
      verified = false;
    }
    if (!verified) {
      return reject(
        input.channel,
        'signature_invalid',
        `signature verification failed for ${input.channel}`,
      );
    }

    // 2. Canonicalize the parsed payload.
    const draft = canonicalizeByChannel(input.channel, input.payload);
    if (!draft) {
      return reject(
        input.channel,
        'unsupported_payload',
        `no canonicalizer for channel ${input.channel}`,
      );
    }

    // A draft with neither text nor attachments nor a resolvable sender is
    // not actionable — most often a delivery-receipt / status webhook.
    const hasSenderKey =
      Boolean(draft.rawSender.phone) ||
      Boolean(draft.rawSender.email) ||
      Boolean(draft.rawSender.webUserId);
    if (
      !hasSenderKey &&
      draft.text.length === 0 &&
      draft.attachments.length === 0
    ) {
      return reject(
        input.channel,
        'malformed',
        `empty/non-message payload on ${input.channel}`,
      );
    }

    // 3. Resolve sender -> tier (fail-soft anonymous).
    let resolved: Awaited<ReturnType<TierResolver['resolve']>>;
    try {
      resolved = await deps.tier.resolve(draft.rawSender);
    } catch {
      resolved = { tenantId: null, actorId: null, tier: 'anonymous' };
    }

    // 4. Emit the frozen canonical event.
    const event: ChannelEvent = Object.freeze({
      eventId: draft.eventId,
      channel: input.channel,
      sender: Object.freeze({
        raw: draft.rawSender,
        tenantId: resolved.tenantId,
        actorId: resolved.actorId,
        tier: resolved.tier,
      }),
      text: draft.text,
      attachments: Object.freeze([...draft.attachments]),
      receivedAt: clock.now().toISOString(),
      metadata: draft.metadata,
      signatureVerified: true,
    });

    audit(input.channel, event.eventId, resolved.tier, 'accepted');
    return { ok: true, event };
  };

  return { canonicalize };
}
