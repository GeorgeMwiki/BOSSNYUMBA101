/**
 * Signed outbound webhook delivery.
 *
 * Coordinates with the Wave-10 webhook retry/DLQ in `services/webhooks`.
 * This package owns the wire format (HMAC signing, retry schedule) but
 * delegates persistence (pending deliveries, DLQ fanout) via the
 * `WebhookStore` port.
 *
 * Wire format:
 *   POST <subscription.url>
 *   Content-Type: application/json
 *   X-Webhook-Id: <uuid>
 *   X-Webhook-Signature: sha256=<hex hmac of body>
 *   X-Webhook-Timestamp: <ISO>
 *   X-Correlation-Id: <id>
 *   User-Agent: BOSSNYUMBA-Webhook/1.0
 */

import {
  assertUrlSafe,
  buildPinnedDispatcher,
  type AssertUrlSafeResult,
} from '@bossnyumba/enterprise-hardening';
import { hmacSha256Hex } from './agent-auth.js';
import { correlationHeaders } from './correlation-id.js';
import type { WebhookDelivery, WebhookSubscription } from './types.js';

// ============================================================================
// Fetch port (injected for testability)
// ============================================================================

export type FetchLike = (
  url: string,
  init: {
    readonly method: string;
    readonly headers: Record<string, string>;
    readonly body: string;
    readonly signal?: AbortSignal;
  },
) => Promise<{ readonly status: number; readonly ok: boolean }>;

// ============================================================================
// Store port
// ============================================================================

export interface WebhookStore {
  recordPending(delivery: WebhookDelivery): Promise<void>;
  updateDelivery(
    id: string,
    patch: Partial<WebhookDelivery>,
  ): Promise<void>;
  incrementSubscriptionFailure(
    subscriptionId: string,
    newCount: number,
    pause: boolean,
  ): Promise<void>;
  markSubscriptionDelivered(
    subscriptionId: string,
    iso: string,
  ): Promise<void>;
}

// ============================================================================
// Delivery
// ============================================================================

export interface DeliverEventPayload {
  readonly eventType: string;
  readonly eventId: string;
  readonly correlationId: string;
  readonly tenantId: string;
  readonly occurredAt: string;
  readonly data: Readonly<Record<string, unknown>>;
}

export interface DeliverDeps {
  readonly fetch: FetchLike;
  readonly store: WebhookStore;
  readonly now?: () => number;
  readonly retryDelaysMs?: ReadonlyArray<number>;
  readonly maxConsecutiveFailures?: number;
  readonly timeoutMs?: number;
  /**
   * Injectable DNS lookup used by `assertUrlSafe` — tests inject a stub
   * to verify EC2-metadata / RFC1918 hostnames are rejected. Defaults to
   * `node:dns/promises#lookup` (i.e. real resolution).
   */
  readonly dnsLookup?: (
    host: string,
  ) => Promise<ReadonlyArray<{ readonly address: string; readonly family: number }>>;
  /**
   * Resolve the RAW HMAC secret for the subscription (C4 closure).
   *
   * The previous implementation signed with `subscription.secretHash`
   * — incoherent — see C4 audit note + `agent-auth.ts#resolveSecret`.
   *
   * Production wiring: KMS-backed secret manager fetches the raw
   * secret per delivery (cache for the duration of one delivery loop).
   * Test wiring: in-memory map keyed by subscription id.
   *
   * When `resolveSecret` is NOT supplied OR returns null, the delivery
   * refuses to dispatch — silently signing with `secretHash` was the
   * bug.
   */
  readonly resolveSecret?: (subscriptionId: string) => Promise<string | null>;
  /**
   * Dead-letter queue port (H15 closure). When delivery exhausts the
   * retry budget the failed envelope is enqueued for downstream
   * triage. When `dlq` is undefined the delivery just persists the
   * `failed` status (legacy behaviour).
   */
  readonly dlq?: WebhookDLQ;
  /**
   * Optional jitter PRNG — defaults to `Math.random`. Tests override
   * for deterministic backoff.
   */
  readonly random?: () => number;
}

/**
 * Dead-letter queue port (H15). Enqueues envelopes whose retry budget
 * is exhausted. The implementation is responsible for at-least-once
 * persistence to the platform's DLQ (SQS, Inngest, the existing
 * webhooks service DLQ).
 */
export interface WebhookDLQ {
  enqueueFailed(envelope: WebhookDLQEnvelope): Promise<void>;
}

export interface WebhookDLQEnvelope {
  readonly deliveryId: string;
  readonly subscriptionId: string;
  readonly eventType: string;
  readonly eventId: string;
  readonly tenantId: string;
  readonly body: string;
  readonly attempts: number;
  readonly lastStatus?: number;
  readonly lastError?: string;
  readonly failedAt: string;
}

const DEFAULT_RETRY_DELAYS_MS: ReadonlyArray<number> = Object.freeze([
  1_000,
  5_000,
  25_000,
]);
const DEFAULT_MAX_FAILURES = 10;
const DEFAULT_TIMEOUT_MS = 10_000;

export async function deliverToSubscription(
  deps: DeliverDeps,
  subscription: WebhookSubscription,
  event: DeliverEventPayload,
): Promise<WebhookDelivery> {
  // SSRF pre-flight — centralised in @bossnyumba/enterprise-hardening so
  // any policy change (e.g. new internal range, new scheme block) lands
  // in one place. Includes the DNS-resolved-IP gate added in A2b-3, so a
  // subscription URL whose A-record points to 169.254.169.254 or
  // 127.0.0.1 is rejected before the fetch fires.
  //
  // H14 closure: capture the first-resolved-IP from assertUrlSafe and
  // attach a pinned dispatcher to the fetch init so undici can NOT
  // re-resolve the host between the SSRF gate and the actual connect.
  // This closes the DNS-rebinding TOCTOU window that survives the
  // single-call gate.
  const pinned: AssertUrlSafeResult = await assertUrlSafe(subscription.url, {
    ...(deps.dnsLookup ? { dnsLookup: deps.dnsLookup } : {}),
  });
  const now = (deps.now ?? Date.now)();
  const retryDelays = deps.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS;
  const maxFailures = deps.maxConsecutiveFailures ?? DEFAULT_MAX_FAILURES;
  const timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const dispatcher = await buildPinnedDispatcher(pinned, timeoutMs);
  const random = deps.random ?? Math.random;

  // C4 closure: refuse to dispatch when the raw secret can't be
  // resolved. The previous implementation signed with
  // `subscription.secretHash` — incoherent (the hash IS the effective
  // secret), and a DB leak gave the attacker the same value the
  // legitimate caller uses. The correct contract is: resolve the raw
  // secret from KMS, sign with that.
  if (!deps.resolveSecret) {
    throw new Error(
      'deliverToSubscription: deps.resolveSecret is required (C4 closure). ' +
        'Wire a KMS-backed resolver — do NOT sign with secretHash.',
    );
  }
  const rawSecret = await deps.resolveSecret(subscription.id);
  if (!rawSecret) {
    throw new Error(
      `deliverToSubscription: failed to resolve raw HMAC secret for subscription ${subscription.id}`,
    );
  }

  const deliveryId = crypto.randomUUID();
  const timestamp = new Date(now).toISOString();

  const bodyObj = {
    id: deliveryId,
    eventType: event.eventType,
    eventId: event.eventId,
    timestamp,
    correlationId: event.correlationId,
    tenantId: event.tenantId,
    occurredAt: event.occurredAt,
    data: event.data,
  };
  const body = JSON.stringify(bodyObj);
  // HIGH-10 (audit .audit/post-pr90-api-mcp-bug-sweep.md): the previous
  // signature was `hmac(secret, body)` only — `X-Webhook-Timestamp` was
  // emitted alongside but NOT in the signed payload. A subscriber that
  // doesn't separately enforce a max-age on `X-Webhook-Timestamp` would
  // accept any captured signed body indefinitely. Sign
  // `${timestamp}.${body}` so the timestamp is bound to the signature;
  // subscribers MUST still verify both signature + timestamp freshness.
  const signedPayload = `${timestamp}.${body}`;
  const signature = await hmacSha256Hex(rawSecret, signedPayload);

  const baseHeaders: Record<string, string> = {
    ...correlationHeaders(event.correlationId),
    'Content-Type': 'application/json',
    'X-Webhook-Id': deliveryId,
    // v2 signature format: timestamp + body, separated by `.`.
    // Document this for subscribers in OPENAPI / webhook docs.
    'X-Webhook-Signature': `sha256=${signature}`,
    'X-Webhook-Signature-Version': 'v2',
    'X-Webhook-Timestamp': timestamp,
    'User-Agent': 'BOSSNYUMBA-Webhook/1.0',
  };

  const initial: WebhookDelivery = Object.freeze({
    id: deliveryId,
    subscriptionId: subscription.id,
    eventType: event.eventType,
    eventId: event.eventId,
    payload: Object.freeze({ ...bodyObj }),
    status: 'pending' as const,
    attempts: 0,
    createdAt: timestamp,
  });
  await deps.store.recordPending(initial);

  let lastStatus: number | undefined;
  let lastError: string | undefined;

  for (let attempt = 0; attempt <= retryDelays.length; attempt++) {
    if (attempt > 0) {
      // H13 closure: jitter the retry delay by ±20% so N pods retrying
      // the same delivery don't synchronise and thunder the consumer.
      const base = retryDelays[attempt - 1] ?? 0;
      const jitterFactor = 1 + (random() - 0.5) * 0.4; // [0.8, 1.2]
      const delay = Math.max(0, Math.round(base * jitterFactor));
      await new Promise((r) => setTimeout(r, delay));
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      // H14: pass the pinned dispatcher via an extra field. `FetchLike`
      // is the public port, but real undici-backed fetches honour
      // `dispatcher`. Tests using a stubbed fetch ignore the field.
      const fetchInit: {
        readonly method: string;
        readonly headers: Record<string, string>;
        readonly body: string;
        readonly signal?: AbortSignal;
        readonly dispatcher?: unknown;
      } = {
        method: 'POST',
        headers: baseHeaders,
        body,
        signal: controller.signal,
        ...(dispatcher ? { dispatcher } : {}),
      };
      const res = await deps.fetch(
        subscription.url,
        fetchInit as Parameters<FetchLike>[1],
      );
      lastStatus = res.status;

      if (res.ok) {
        await deps.store.updateDelivery(deliveryId, {
          status: 'delivered',
          attempts: attempt + 1,
          lastAttemptAt: new Date(Date.now()).toISOString(),
          responseStatus: res.status,
        });
        await deps.store.markSubscriptionDelivered(
          subscription.id,
          new Date(Date.now()).toISOString(),
        );
        if (dispatcher) {
          const d = dispatcher as { close?: () => Promise<void> };
          if (typeof d.close === 'function') {
            d.close().catch(() => {
              /* non-fatal */
            });
          }
        }
        return {
          ...initial,
          status: 'delivered',
          attempts: attempt + 1,
          lastAttemptAt: new Date(Date.now()).toISOString(),
          responseStatus: res.status,
        };
      }
      lastError = `HTTP ${res.status}`;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    } finally {
      clearTimeout(timer);
    }

    const nextStatus = attempt < retryDelays.length ? 'retrying' : 'failed';
    const patch: Record<string, unknown> = {
      status: nextStatus,
      attempts: attempt + 1,
      lastAttemptAt: new Date(Date.now()).toISOString(),
    };
    if (lastStatus !== undefined) patch.responseStatus = lastStatus;
    if (lastError !== undefined) patch.errorMessage = lastError;
    await deps.store.updateDelivery(
      deliveryId,
      patch as Partial<WebhookDelivery>,
    );
  }

  const newFailureCount = subscription.failureCount + 1;
  const shouldPause = newFailureCount >= maxFailures;
  await deps.store.incrementSubscriptionFailure(
    subscription.id,
    newFailureCount,
    shouldPause,
  );

  // H15 closure: route exhausted-retry failures into the DLQ when one
  // is wired. Without this the row is just `failed` and the downstream
  // consumer has no async hook to triage / replay. The DLQ enqueue is
  // best-effort — failures here are logged but never block the return.
  if (deps.dlq) {
    try {
      await deps.dlq.enqueueFailed({
        deliveryId,
        subscriptionId: subscription.id,
        eventType: event.eventType,
        eventId: event.eventId,
        tenantId: event.tenantId,
        body,
        attempts: retryDelays.length + 1,
        ...(lastStatus !== undefined ? { lastStatus } : {}),
        ...(lastError !== undefined ? { lastError } : {}),
        failedAt: new Date(Date.now()).toISOString(),
      });
    } catch {
      // DLQ enqueue failure is logged at the platform-level (the DLQ
      // adapter is expected to emit its own observability signal); we
      // do not block the delivery-loop return.
    }
  }

  // Close the pinned dispatcher if one was created.
  if (dispatcher) {
    const d = dispatcher as { close?: () => Promise<void> };
    if (typeof d.close === 'function') {
      d.close().catch(() => {
        /* non-fatal */
      });
    }
  }

  const failed: WebhookDelivery = Object.freeze({
    ...initial,
    status: 'failed' as const,
    attempts: retryDelays.length + 1,
    lastAttemptAt: new Date(Date.now()).toISOString(),
    ...(lastStatus !== undefined ? { responseStatus: lastStatus } : {}),
    ...(lastError !== undefined ? { errorMessage: lastError } : {}),
  });
  return failed;
}
