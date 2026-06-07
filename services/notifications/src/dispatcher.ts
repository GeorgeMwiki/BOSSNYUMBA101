/**
 * Notification Dispatcher — SCAFFOLDED 8 + NEW 21
 *
 * The single entry point every caller (event-subscribers, workers, API
 * routes) should go through to actually deliver a notification. Concerns
 * centralized here:
 *
 *   1. Preference re-check at dispatch time (not just at enqueue time —
 *      the user may have toggled opt-out between enqueue and send).
 *   2. Provider selection via the `providerRegistry`.
 *   3. 3-attempt retry with exponential backoff.
 *   4. Dead-letter queue handoff on terminal failure.
 *   5. Emit `NotificationDeliveryFailed` event for downstream alerting.
 *
 * This module is additive — existing `queue/producer.ts` and
 * `services/notification.service.ts` are untouched. New callers should
 * prefer `enqueueNotification` from here; legacy callers keep working.
 */

import { preferencesService } from './preferences/service.js';
import { providerRegistry } from './providers/index.js';
import type {
  NotificationChannel,
  NotificationTemplateId,
  SendResult,
  TenantId,
} from './types/index.js';
import type { INotificationProvider, SendParams } from './providers/provider.interface.js';
import { logger } from './logger.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NotificationPriority = 'emergency' | 'high' | 'normal' | 'low';

export interface EnqueueNotificationInput {
  tenantId: TenantId;
  userId?: string;
  channel: NotificationChannel;
  templateId: NotificationTemplateId;
  /** Pre-rendered recipient address (phone, email, push token, WhatsApp number). */
  recipient: string;
  subject?: string;
  body: string;
  title?: string;
  data?: Record<string, string>;
  priority?: NotificationPriority;
  correlationId?: string;
  idempotencyKey?: string;
  /** Override max retries (default 3). */
  maxAttempts?: number;
  /** Override backoff base in ms (default 1000). */
  backoffBaseMs?: number;
}

export interface DispatchResult {
  accepted: boolean;
  /** Present when `accepted === true`. */
  externalId?: string;
  /**
   * Present when the notification was delivered on a DIFFERENT channel than
   * requested (cross-channel fallback fired). Absent when delivered on the
   * originally requested channel. Lets callers / observability see a fallback.
   */
  deliveredVia?: NotificationChannel;
  /** Present when suppressed by preferences — never a retryable failure. */
  suppressedReason?: 'channel_disabled' | 'template_disabled' | 'quiet_hours';
  /** Present when ALL retries have been exhausted and the send was dead-lettered. */
  deadLettered?: boolean;
  attempts: number;
  lastError?: string;
}

export interface DeadLetterRecord extends EnqueueNotificationInput {
  attempts: number;
  lastError: string;
  deadLetteredAt: Date;
}

export interface DispatcherDeps {
  /** Optional: override the provider registry (for tests). */
  providers?: Record<NotificationChannel, INotificationProvider[]>;
  /** Optional: override the preference gate (for tests). */
  preferences?: typeof preferencesService;
  /** Optional: bus for emitting `NotificationDeliveryFailed`. */
  eventBus?: {
    publish(
      eventType: string,
      payload: Record<string, unknown>,
      metadata?: Record<string, unknown>
    ): Promise<void> | void;
  };
  /** Optional: dead-letter sink. Default is in-memory. */
  deadLetterSink?: {
    push(record: DeadLetterRecord): Promise<void> | void;
  };
  /** Optional: sleep hook (for deterministic tests). */
  sleep?: (ms: number) => Promise<void>;
  /**
   * Round-3 audit H5 — idempotency store. When `input.idempotencyKey`
   * is set, the dispatcher consults this store before dispatching and
   * records the result on completion. Pass `null` to disable.
   */
  idempotencyStore?: DispatchIdempotencyStore | null;
}

// ---------------------------------------------------------------------------
// In-memory DLQ default
// ---------------------------------------------------------------------------

const inMemoryDeadLetterQueue: DeadLetterRecord[] = [];

export const deadLetterQueueInspector = {
  all(): readonly DeadLetterRecord[] {
    return inMemoryDeadLetterQueue.slice();
  },
  clear(): void {
    inMemoryDeadLetterQueue.length = 0;
  },
  /**
   * Atomically remove and return up to `max` records (FIFO). Used by the
   * DLQ drainer to claim a batch for redelivery. Records the drainer fails
   * to redeliver are re-pushed via `push`.
   */
  drain(max = 50): DeadLetterRecord[] {
    return inMemoryDeadLetterQueue.splice(0, Math.max(0, max));
  },
  /** Re-queue a record (used by the drainer to defer a failed redelivery). */
  push(record: DeadLetterRecord): void {
    inMemoryDeadLetterQueue.push(record);
  },
  size(): number {
    return inMemoryDeadLetterQueue.length;
  },
};

const defaultDeadLetterSink: Required<DispatcherDeps>['deadLetterSink'] = {
  push(record) {
    inMemoryDeadLetterQueue.push(record);
  },
};

/**
 * Drainable dead-letter source contract — the surface the DLQ drainer
 * consumes. The default in-memory implementation is
 * `deadLetterQueueInspector`; multi-replica deployments inject a
 * Redis/Postgres-backed source whose `drain()` is an atomic claim so two
 * replicas never redeliver the same record.
 */
export interface DrainableDeadLetterSource {
  drain(max?: number): Promise<DeadLetterRecord[]> | DeadLetterRecord[];
  push(record: DeadLetterRecord): Promise<void> | void;
  size?(): Promise<number> | number;
}

// Round-3 audit H5 fix — idempotency-key store. Default is in-memory
// (single-pod). Multi-pod deployments must inject a Redis-backed store
// to avoid duplicate dispatch when retries land on different pods.
const DEFAULT_IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

export interface DispatchIdempotencyStore {
  /** Records `key`. Returns the prior result if seen, else null. */
  recordOrLoad(
    key: string,
    result: DispatchResult,
    ttlMs?: number,
  ): Promise<DispatchResult | null> | DispatchResult | null;
}

function createInMemoryIdempotencyStore(): DispatchIdempotencyStore {
  const seen = new Map<string, { result: DispatchResult; expiresAt: number }>();
  function evict(now: number): void {
    for (const [k, v] of seen) {
      if (v.expiresAt <= now) seen.delete(k);
    }
  }
  return {
    recordOrLoad(key, result, ttlMs = DEFAULT_IDEMPOTENCY_TTL_MS) {
      const now = Date.now();
      evict(now);
      const existing = seen.get(key);
      if (existing && existing.expiresAt > now) return existing.result;
      seen.set(key, { result, expiresAt: now + ttlMs });
      return null;
    },
  };
}

const defaultIdempotencyStore = createInMemoryIdempotencyStore();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Round-3 audit H2 fix — refuse to fall back to `providers[0]` when no
 * provider matches the tenant. The previous behaviour silently routed
 * tenant-B's SMS through tenant-A's Twilio account → tenant-A billed
 * for tenant-B's traffic, and the cross-tenant credential leak.
 *
 * "Without-fail" failover fix — the previous implementation used
 * `.find()` and returned ONLY the first configured provider, so if
 * SendGrid was configured but down, the send dead-lettered without ever
 * trying SES or SMTP. We now return EVERY configured provider for the
 * tenant, in registry order, so the attempt loop can fail over through
 * the array (provider[0] → provider[1] → …) before giving up on the
 * channel.
 *
 * Returns an empty array if no provider is configured for the tenant —
 * the caller advances to the next channel in the fallback chain.
 */
function selectConfiguredProviders(
  providers: INotificationProvider[] | undefined,
  tenantId: TenantId
): INotificationProvider[] {
  if (!providers || providers.length === 0) return [];
  return providers.filter((p) => p.isConfigured(tenantId));
}

/**
 * Round-3 audit H4 fix — exponential backoff WITH ±25% jitter so a
 * provider outage doesn't produce a thundering herd of retries at
 * fixed intervals.
 */
function computeBackoffMs(attempt: number, base: number): number {
  const exp = base * Math.pow(2, Math.max(0, attempt - 1));
  const jitter = exp * 0.25 * (Math.random() * 2 - 1); // ±25%
  return Math.max(0, Math.round(exp + jitter));
}

/**
 * Round-3 audit H3 fix — classify provider errors so we don't retry
 * non-retryable ones (e.g. Twilio's "InvalidPhoneNumber" 400). Errors
 * that carry a `code`/`status` matching the non-retryable list are
 * not retried; everything else falls through to the existing retry
 * loop.
 */
const NON_RETRYABLE_ERROR_CODES: ReadonlySet<string> = new Set([
  // Twilio
  '21211', // Invalid 'To' Phone Number
  '21212', // Invalid 'From' Phone Number
  '21214', // 'To' phone number cannot be reached
  '21610', // Recipient unsubscribed
  '21617', // Concatenated message body exceeds the 1600 character limit
  // Africa's Talking
  'InvalidPhoneNumber',
  'InvalidRecipient',
  // Generic
  'INVALID_RECIPIENT',
  'OPTED_OUT',
  'BLOCKED',
]);

function isNonRetryable(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: unknown; status?: unknown; statusCode?: unknown };
  if (typeof e.code === 'string' && NON_RETRYABLE_ERROR_CODES.has(e.code)) return true;
  if (typeof e.code === 'number' && NON_RETRYABLE_ERROR_CODES.has(String(e.code))) return true;
  if (typeof e.status === 'number' && e.status >= 400 && e.status < 500 && e.status !== 408 && e.status !== 429) {
    return true;
  }
  if (typeof e.statusCode === 'number' && e.statusCode >= 400 && e.statusCode < 500 && e.statusCode !== 408 && e.statusCode !== 429) {
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Cross-channel fallback chains
// ---------------------------------------------------------------------------

/**
 * Per-priority cross-channel fallback order. When EVERY configured provider
 * of a channel is exhausted, the dispatcher advances to the next channel in
 * the chain so the notification still reaches the user on a different rail.
 *
 * Every chain ends in `in_app` — the portal inbox provider that is always
 * configured and only fails if the inbox store itself is down. That is the
 * "without-fail" guarantee: a notification only truly dead-letters when even
 * the in-app persistence fails.
 *
 * The chain is keyed by priority because urgency changes the right trade-off:
 *   - `emergency` (e.g. OTP, safety incident) fans across the loudest rails
 *     first (WhatsApp → SMS → email) before the inbox.
 *   - `high` mirrors emergency but without push noise.
 *   - `normal` / `low` keep cost down: try the requested rail, then settle in
 *     the inbox rather than spending on multiple paid channels.
 *
 * The REQUESTED channel is always attempted first (prepended at runtime);
 * these arrays describe the *fallback* order after it.
 */
const FALLBACK_CHAINS: Record<NotificationPriority, readonly NotificationChannel[]> = {
  emergency: ['whatsapp', 'sms', 'email', 'push', 'in_app'],
  high: ['whatsapp', 'sms', 'email', 'in_app'],
  normal: ['in_app'],
  low: ['in_app'],
};

/**
 * Build the ordered channel chain for a dispatch: the requested channel
 * first, then the priority's fallback channels (de-duplicated, requested
 * channel removed from the tail), guaranteeing `in_app` is present as the
 * terminal hop.
 */
function buildChannelChain(
  requested: NotificationChannel,
  priority: NotificationPriority
): NotificationChannel[] {
  const fallback = FALLBACK_CHAINS[priority] ?? FALLBACK_CHAINS.normal;
  const ordered: NotificationChannel[] = [requested];
  for (const ch of fallback) {
    if (!ordered.includes(ch)) ordered.push(ch);
  }
  // Hard guarantee: in_app is always the terminal even if a future chain
  // edit forgets it.
  if (!ordered.includes('in_app')) ordered.push('in_app');
  return ordered;
}

interface ChannelAttemptOutcome {
  accepted: boolean;
  externalId?: string;
  attempts: number;
  lastError: string;
  /** True when the failure is non-retryable AND no further provider helped. */
  nonRetryable: boolean;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function enqueueNotification(
  input: EnqueueNotificationInput,
  deps: DispatcherDeps = {}
): Promise<DispatchResult> {
  const providers = deps.providers ?? providerRegistry;
  const prefs = deps.preferences ?? preferencesService;
  const sleep = deps.sleep ?? defaultSleep;
  const deadLetterSink = deps.deadLetterSink ?? defaultDeadLetterSink;
  const idempotencyStore =
    deps.idempotencyStore === undefined
      ? defaultIdempotencyStore
      : deps.idempotencyStore;
  const maxAttempts = input.maxAttempts ?? 3;
  const backoffBaseMs = input.backoffBaseMs ?? 1000;

  // ---- 0. Idempotency check (H5) ----
  // Round-3 audit H5 fix — the dispatcher accepted `idempotencyKey`
  // in its input schema but NEVER consulted it. We now scope the key
  // by tenant so two tenants supplying the same key don't collide.
  const idempotencyScopedKey = input.idempotencyKey
    ? `${input.tenantId}:${input.channel}:${input.idempotencyKey}`
    : null;
  if (idempotencyScopedKey && idempotencyStore) {
    const placeholder: DispatchResult = {
      accepted: false,
      attempts: 0,
      lastError: '__inflight__',
    };
    const prior = await Promise.resolve(
      idempotencyStore.recordOrLoad(idempotencyScopedKey, placeholder)
    );
    if (prior && prior.lastError !== '__inflight__') {
      return prior;
    }
  }

  // ---- 1. Preference re-check ----
  // Round-3 audit H1 — anonymous notifications (no userId) bypass
  // the preference check. For tenant-wide system announcements that
  // is intentional; for per-user notifications the caller MUST pass
  // `userId` or the user's opt-outs will be ignored. This is now
  // surfaced via a warning so misuse is observable in logs.
  if (!input.userId && input.templateId && !input.idempotencyKey?.startsWith('announcement:')) {
    logger.warn(`[dispatcher] enqueueNotification called without userId for templateId=${String(input.templateId)} — ` +
        `preference checks SKIPPED. If this is a per-user notification, ALWAYS pass userId.`);
  }
  if (input.userId) {
    // Round-3 audit H6 — `checkAllowed` is now async because the
    // backing preferences store may be Redis. Await the gate before
    // any provider dispatch.
    const gate = await prefs.checkAllowed({
      userId: input.userId,
      tenantId: input.tenantId,
      channel: input.channel,
      templateId: input.templateId,
      priority: input.priority,
    });
    if (!gate.allowed) {
      const result: DispatchResult = {
        accepted: false,
        attempts: 0,
        suppressedReason: gate.reason,
      };
      if (idempotencyScopedKey && idempotencyStore) {
        await Promise.resolve(
          idempotencyStore.recordOrLoad(idempotencyScopedKey, result)
        );
      }
      return result;
    }
  }

  // ---- 2. Build the cross-channel chain ----
  // The requested channel first, then the priority's fallback channels,
  // terminating in `in_app`. We walk the chain and only dead-letter after
  // EVERY channel (including the always-available in-app inbox) is exhausted.
  const priority = input.priority ?? 'normal';
  const chain = buildChannelChain(input.channel, priority);

  let totalAttempts = 0;
  let lastError = 'unknown error';
  let lastNonRetryable = false;
  const triedChannels: NotificationChannel[] = [];
  const skippedDisabled: NotificationChannel[] = [];

  for (let ci = 0; ci < chain.length; ci++) {
    const channel = chain[ci]!;
    const isRequested = ci === 0;

    // ---- 2a. Per-channel preference gate ----
    // The requested channel was already gated in step 1 (its suppression is
    // a terminal `suppressedReason`, not a fallback trigger). For FALLBACK
    // channels we re-check: a user who disabled SMS should not receive the
    // fallback over SMS — we skip to the next channel instead. The in-app
    // terminal defaults ON, so a user who has not opted out still gets it.
    if (!isRequested && input.userId) {
      const gate = await prefs.checkAllowed({
        userId: input.userId,
        tenantId: input.tenantId,
        channel,
        templateId: input.templateId,
        priority,
      });
      if (!gate.allowed) {
        skippedDisabled.push(channel);
        continue;
      }
    }

    // ---- 2b. Select ALL configured providers for the channel (failover) ----
    const channelProviders = selectConfiguredProviders(
      providers[channel],
      input.tenantId
    );
    if (channelProviders.length === 0) {
      // No provider on this channel for this tenant — advance the chain.
      // (Round-3 audit H2: we never borrow another tenant's provider.)
      lastError = `no configured provider on channel '${channel}'`;
      continue;
    }

    triedChannels.push(channel);

    const outcome = await attemptChannel({
      input,
      channel,
      providers: channelProviders,
      maxAttempts,
      backoffBaseMs,
      sleep,
    });
    totalAttempts += outcome.attempts;

    if (outcome.accepted) {
      const success: DispatchResult = {
        accepted: true,
        externalId: outcome.externalId,
        attempts: totalAttempts,
        // Surface the delivered channel when it differs from requested so
        // callers/observability can see a fallback happened.
        ...(channel !== input.channel ? { deliveredVia: channel } : {}),
      };
      if (idempotencyScopedKey && idempotencyStore) {
        await Promise.resolve(
          idempotencyStore.recordOrLoad(idempotencyScopedKey, success)
        );
      }
      return success;
    }

    lastError = outcome.lastError;
    lastNonRetryable = outcome.nonRetryable;
    // Channel exhausted (all providers failed / non-retryable) — fall
    // through to the next channel in the chain.
  }

  // ---- 3. DLQ + event emission ----
  // Reached only when EVERY channel in the chain — including the in-app
  // terminal — failed or was unavailable. This is the genuine
  // "could not be delivered anywhere" case.
  const triedSummary =
    triedChannels.length > 0
      ? `tried=[${triedChannels.join(',')}]`
      : 'tried=[none configured]';
  const skippedSummary =
    skippedDisabled.length > 0
      ? ` skippedDisabled=[${skippedDisabled.join(',')}]`
      : '';
  const finalError = `all channels exhausted (${triedSummary}${skippedSummary}): ${
    lastNonRetryable ? `non-retryable: ${lastError}` : lastError
  }`;

  await handleDeadLetter(
    input,
    totalAttempts || 1,
    finalError,
    deadLetterSink,
    deps.eventBus
  );

  const failure: DispatchResult = {
    accepted: false,
    deadLettered: true,
    attempts: totalAttempts || 1,
    lastError: finalError,
  };
  if (idempotencyScopedKey && idempotencyStore) {
    await Promise.resolve(
      idempotencyStore.recordOrLoad(idempotencyScopedKey, failure)
    );
  }
  return failure;
}

/**
 * Attempt delivery on a SINGLE channel: iterate the channel's configured
 * providers in order (failover), and for each provider run the
 * retry-with-backoff loop. Returns as soon as any provider+attempt succeeds.
 *
 * Failover semantics:
 *   - A provider that throws / returns success=false is retried up to
 *     `maxAttempts` with exponential backoff + jitter.
 *   - A NON-retryable error (e.g. invalid recipient) does not burn the retry
 *     budget for that provider — we move straight to the next provider.
 *   - When all providers are exhausted, the channel has failed; the caller
 *     advances to the next channel in the cross-channel chain.
 */
async function attemptChannel(args: {
  input: EnqueueNotificationInput;
  channel: NotificationChannel;
  providers: readonly INotificationProvider[];
  maxAttempts: number;
  backoffBaseMs: number;
  sleep: (ms: number) => Promise<void>;
}): Promise<ChannelAttemptOutcome> {
  const { input, channel, providers, maxAttempts, backoffBaseMs, sleep } = args;

  const sendParams: SendParams = {
    tenantId: input.tenantId,
    to: input.recipient,
    subject: input.subject,
    body: input.body,
    title: input.title,
    data: input.data,
    // Carry the user id so the in-app terminal can address its inbox row
    // even when `to` is an external address (phone/email/token).
    userId: input.userId,
  };

  let attempts = 0;
  let lastError = 'unknown error';
  let nonRetryable = false;

  for (let pi = 0; pi < providers.length; pi++) {
    const provider = providers[pi]!;
    let providerNonRetryable = false;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      attempts += 1;
      try {
        const result: SendResult = await provider.send(sendParams);
        if (result.success) {
          return {
            accepted: true,
            externalId: result.externalId,
            attempts,
            lastError: '',
            nonRetryable: false,
          };
        }
        lastError = `[${channel}:${provider.name}] ${result.error ?? 'provider returned success=false'}`;
        const sr = result as SendResult & { errorCode?: string | number };
        if (sr.errorCode !== undefined && isNonRetryable({ code: sr.errorCode })) {
          providerNonRetryable = true;
          break;
        }
      } catch (err) {
        lastError = `[${channel}:${provider.name}] ${
          err instanceof Error ? err.message : String(err)
        }`;
        // Round-3 audit H3 — bail out of THIS provider's retry loop on a
        // non-retryable error, then fail over to the next provider.
        if (isNonRetryable(err)) {
          providerNonRetryable = true;
          break;
        }
      }

      // Backoff before the next attempt of the SAME provider only.
      if (attempt < maxAttempts) {
        await sleep(computeBackoffMs(attempt, backoffBaseMs));
      }
    }

    // This provider is exhausted. Remember whether its last failure was
    // non-retryable; if a LATER provider also fails we keep the most recent
    // signal. Fall over to the next provider in the array.
    nonRetryable = providerNonRetryable;
  }

  return {
    accepted: false,
    attempts,
    lastError,
    nonRetryable,
  };
}

async function handleDeadLetter(
  input: EnqueueNotificationInput,
  attempts: number,
  lastError: string,
  sink: Required<DispatcherDeps>['deadLetterSink'],
  eventBus?: DispatcherDeps['eventBus']
): Promise<void> {
  const record: DeadLetterRecord = {
    ...input,
    attempts,
    lastError,
    deadLetteredAt: new Date(),
  };
  try {
    await sink.push(record);
  } catch (err) {
    // DLQ write failure is a hard infra issue — surface it via the structured
    // (PII-scrubbing) logger so it is observable without leaking recipient data.
    logger.error('notifications.dispatcher: DLQ sink failed', { error: err });
  }

  if (eventBus) {
    try {
      await eventBus.publish(
        'NotificationDeliveryFailed',
        {
          tenantId: input.tenantId,
          userId: input.userId,
          channel: input.channel,
          templateId: input.templateId,
          recipient: input.recipient,
          attempts,
          lastError,
        },
        {
          tenantId: input.tenantId,
          correlationId: input.correlationId,
        }
      );
    } catch (err) {
      logger.error('notifications.dispatcher: eventBus.publish failed', { error: err });
    }
  }
}
