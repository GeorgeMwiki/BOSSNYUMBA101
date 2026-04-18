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
};

const defaultDeadLetterSink: Required<DispatcherDeps>['deadLetterSink'] = {
  push(record) {
    inMemoryDeadLetterQueue.push(record);
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function selectProvider(
  providers: INotificationProvider[] | undefined,
  tenantId: TenantId
): INotificationProvider | undefined {
  if (!providers || providers.length === 0) return undefined;
  return providers.find((p) => p.isConfigured(tenantId)) ?? providers[0];
}

function computeBackoffMs(attempt: number, base: number): number {
  // Attempt 1 -> base, attempt 2 -> 2*base, attempt 3 -> 4*base
  return base * Math.pow(2, Math.max(0, attempt - 1));
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
  const maxAttempts = input.maxAttempts ?? 3;
  const backoffBaseMs = input.backoffBaseMs ?? 1000;

  // ---- 1. Preference re-check ----
  if (input.userId) {
    const gate = prefs.checkAllowed({
      userId: input.userId,
      tenantId: input.tenantId,
      channel: input.channel,
      templateId: input.templateId,
      priority: input.priority,
    });
    if (!gate.allowed) {
      return {
        accepted: false,
        attempts: 0,
        suppressedReason: gate.reason,
      };
    }
  }

  // ---- 2. Provider selection ----
  const provider = selectProvider(providers[input.channel], input.tenantId);
  if (!provider) {
    await handleDeadLetter(
      input,
      1,
      `No provider configured for channel '${input.channel}'`,
      deadLetterSink,
      deps.eventBus
    );
    return {
      accepted: false,
      deadLettered: true,
      attempts: 1,
      lastError: `No provider for channel '${input.channel}'`,
    };
  }

  // ---- 3. Attempt loop with exponential backoff ----
  const sendParams: SendParams = {
    tenantId: input.tenantId,
    to: input.recipient,
    subject: input.subject,
    body: input.body,
    title: input.title,
    data: input.data,
  };

  let lastError = 'unknown error';
  let attempts = 0;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    attempts = attempt;
    try {
      const result: SendResult = await provider.send(sendParams);
      if (result.success) {
        return {
          accepted: true,
          externalId: result.externalId,
          attempts,
        };
      }
      lastError = result.error ?? 'provider returned success=false';
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }

    if (attempt < maxAttempts) {
      await sleep(computeBackoffMs(attempt, backoffBaseMs));
    }
  }

  // ---- 4. DLQ + event emission ----
  await handleDeadLetter(input, attempts, lastError, deadLetterSink, deps.eventBus);

  return {
    accepted: false,
    deadLettered: true,
    attempts,
    lastError,
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
    // DLQ write failure is a hard infra issue — log via console (intentional
    // fallback-of-last-resort since structured logger isn't injected here).
    // eslint-disable-next-line no-console
    console.error('notifications.dispatcher: DLQ sink failed', err);
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
      // eslint-disable-next-line no-console
      console.error('notifications.dispatcher: eventBus.publish failed', err);
    }
  }
}
