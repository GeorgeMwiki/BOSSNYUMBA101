/**
 * Dispatcher — retry + DLQ + preference gate (SCAFFOLDED 8 + NEW 21)
 * + provider failover within a channel + cross-channel fallback to in-app
 * ("without-fail" delivery work).
 */

import { describe, it, expect } from 'vitest';
import { enqueueNotification, type DispatcherDeps } from '../dispatcher.js';
import type { INotificationProvider } from '../providers/provider.interface.js';
import type { NotificationChannel, SendResult, TenantId } from '../types/index.js';

function buildMockProvider(
  channel: NotificationChannel,
  sequence: Array<SendResult | Error>,
  name = `mock-${channel}`,
): INotificationProvider {
  let idx = 0;
  return {
    channel,
    name,
    isConfigured: () => true,
    async send(): Promise<SendResult> {
      const next = sequence[Math.min(idx++, sequence.length - 1)];
      if (next === undefined) throw new Error('mock sequence exhausted');
      if (next instanceof Error) throw next;
      return next;
    },
  };
}

/** Always-allow preferences stub. */
const allowAll = {
  checkAllowed: () => ({ allowed: true }),
} as unknown as DispatcherDeps['preferences'];

/** Empty registry helper — every channel present (the type requires it). */
function emptyProviders(): Record<NotificationChannel, INotificationProvider[]> {
  return { sms: [], email: [], push: [], whatsapp: [], in_app: [] };
}

const input = {
  tenantId: 'tenant-1' as TenantId,
  userId: 'user-a',
  channel: 'sms' as const,
  templateId: 'rent_due' as const,
  recipient: '+254700000000',
  body: 'Hello',
};

describe('enqueueNotification', () => {
  it('returns accepted on first successful provider call', async () => {
    const provider = buildMockProvider('sms', [
      { success: true, externalId: 'ext-1' },
    ]);
    const result = await enqueueNotification(input, {
      providers: { ...emptyProviders(), sms: [provider] },
      preferences: allowAll,
      sleep: async () => undefined,
    });
    expect(result.accepted).toBe(true);
    expect(result.externalId).toBe('ext-1');
    expect(result.attempts).toBe(1);
    expect(result.deliveredVia).toBeUndefined();
  });

  it('retries on failure with exponential backoff and eventually succeeds', async () => {
    const provider = buildMockProvider('sms', [
      { success: false, error: 'transient' },
      { success: false, error: 'transient' },
      { success: true, externalId: 'ext-2' },
    ]);
    const sleeps: number[] = [];
    const result = await enqueueNotification(input, {
      providers: { ...emptyProviders(), sms: [provider] },
      preferences: allowAll,
      sleep: async (ms) => {
        sleeps.push(ms);
      },
    });
    expect(result.accepted).toBe(true);
    expect(result.attempts).toBe(3);
    // Round-3 audit H4 — exponential backoff WITH ±25% jitter, so
    // the sleeps fall inside [750, 1250] and [1500, 2500].
    expect(sleeps).toHaveLength(2);
    expect(sleeps[0]).toBeGreaterThanOrEqual(750);
    expect(sleeps[0]).toBeLessThanOrEqual(1250);
    expect(sleeps[1]).toBeGreaterThanOrEqual(1500);
    expect(sleeps[1]).toBeLessThanOrEqual(2500);
  });

  it('dead-letters after 3 failed attempts and emits event (no terminal in-app configured)', async () => {
    const provider = buildMockProvider('sms', [
      { success: false, error: 'fail1' },
      { success: false, error: 'fail2' },
      { success: false, error: 'fail3' },
    ]);
    const dlq: unknown[] = [];
    const events: Array<{ type: string; payload: unknown }> = [];
    const result = await enqueueNotification(input, {
      // in_app intentionally empty: proves the genuine dead-letter path
      // when even the terminal channel has no provider.
      providers: { ...emptyProviders(), sms: [provider] },
      preferences: allowAll,
      sleep: async () => undefined,
      deadLetterSink: { push: (r) => { dlq.push(r); } },
      eventBus: {
        publish: async (type, payload) => {
          events.push({ type, payload });
        },
      },
    });
    expect(result.accepted).toBe(false);
    expect(result.deadLettered).toBe(true);
    expect(result.attempts).toBe(3);
    expect(dlq.length).toBe(1);
    expect(events[0]?.type).toBe('NotificationDeliveryFailed');
  });

  it('respects preference gate — returns channel_disabled without touching provider', async () => {
    let called = false;
    const provider: INotificationProvider = {
      channel: 'sms',
      name: 'mock',
      isConfigured: () => true,
      async send() {
        called = true;
        return { success: true };
      },
    };
    const result = await enqueueNotification(input, {
      providers: { ...emptyProviders(), sms: [provider] },
      preferences: {
        checkAllowed: () => ({ allowed: false, reason: 'channel_disabled' }),
      } as unknown as DispatcherDeps['preferences'],
    });
    expect(result.accepted).toBe(false);
    expect(result.suppressedReason).toBe('channel_disabled');
    expect(called).toBe(false);
  });

  it('dead-letters when no provider configured on requested or any fallback channel', async () => {
    const dlq: unknown[] = [];
    const result = await enqueueNotification(input, {
      providers: emptyProviders(),
      preferences: allowAll,
      deadLetterSink: { push: (r) => { dlq.push(r); } },
    });
    expect(result.accepted).toBe(false);
    expect(result.deadLettered).toBe(true);
    expect(dlq.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Provider failover WITHIN a channel
// ---------------------------------------------------------------------------

describe('enqueueNotification — provider failover within a channel', () => {
  it('fails over to the second provider when the first is exhausted', async () => {
    const primary = buildMockProvider(
      'email',
      [
        { success: false, error: 'sendgrid down' },
        { success: false, error: 'sendgrid down' },
        { success: false, error: 'sendgrid down' },
      ],
      'sendgrid',
    );
    let secondaryCalled = false;
    const secondary: INotificationProvider = {
      channel: 'email',
      name: 'ses',
      isConfigured: () => true,
      async send() {
        secondaryCalled = true;
        return { success: true, externalId: 'ses-1' };
      },
    };
    const result = await enqueueNotification(
      { ...input, channel: 'email' },
      {
        providers: { ...emptyProviders(), email: [primary, secondary] },
        preferences: allowAll,
        sleep: async () => undefined,
      },
    );
    expect(result.accepted).toBe(true);
    expect(result.externalId).toBe('ses-1');
    expect(secondaryCalled).toBe(true);
    // Same channel — no cross-channel fallback flag.
    expect(result.deliveredVia).toBeUndefined();
    // 3 attempts on primary + 1 on secondary.
    expect(result.attempts).toBe(4);
  });

  it('skips a non-configured provider and uses the next configured one', async () => {
    const unconfigured: INotificationProvider = {
      channel: 'email',
      name: 'sendgrid',
      isConfigured: () => false,
      async send() {
        throw new Error('should not be called — not configured');
      },
    };
    const configured = buildMockProvider(
      'email',
      [{ success: true, externalId: 'smtp-1' }],
      'smtp',
    );
    const result = await enqueueNotification(
      { ...input, channel: 'email' },
      {
        providers: { ...emptyProviders(), email: [unconfigured, configured] },
        preferences: allowAll,
        sleep: async () => undefined,
      },
    );
    expect(result.accepted).toBe(true);
    expect(result.externalId).toBe('smtp-1');
    expect(result.attempts).toBe(1);
  });

  it('fails over to the next provider WITHOUT burning retries on a non-retryable error', async () => {
    let primaryCalls = 0;
    const primary: INotificationProvider = {
      channel: 'sms',
      name: 'twilio',
      isConfigured: () => true,
      async send() {
        primaryCalls += 1;
        const err = Object.assign(new Error('Invalid To number'), {
          code: '21211',
        });
        throw err;
      },
    };
    const secondary = buildMockProvider(
      'sms',
      [{ success: true, externalId: 'at-1' }],
      'africastalking',
    );
    const result = await enqueueNotification(input, {
      providers: { ...emptyProviders(), sms: [primary, secondary] },
      preferences: allowAll,
      sleep: async () => undefined,
    });
    expect(result.accepted).toBe(true);
    expect(result.externalId).toBe('at-1');
    // Non-retryable → primary called exactly once, then failover.
    expect(primaryCalls).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Cross-channel fallback (the core "without-fail" ask)
// ---------------------------------------------------------------------------

describe('enqueueNotification — cross-channel fallback', () => {
  it('emergency: falls back across channels and lands on in-app when all rails fail', async () => {
    const captured: Array<{ tenantId: string; userId?: string; body: string }> = [];
    const failing = (name: string): INotificationProvider => ({
      channel: name as NotificationChannel,
      name,
      isConfigured: () => true,
      async send() {
        return { success: false, error: `${name} down` };
      },
    });
    const inApp: INotificationProvider = {
      channel: 'in_app',
      name: 'in-app',
      isConfigured: () => true,
      async send(params) {
        captured.push({
          tenantId: String(params.tenantId),
          userId: params.userId,
          body: params.body,
        });
        return { success: true, externalId: 'inapp-1' };
      },
    };
    const result = await enqueueNotification(
      { ...input, channel: 'whatsapp', priority: 'emergency' },
      {
        providers: {
          sms: [failing('sms')],
          email: [failing('email')],
          push: [failing('push')],
          whatsapp: [failing('whatsapp')],
          in_app: [inApp],
        },
        preferences: allowAll,
        sleep: async () => undefined,
      },
    );
    expect(result.accepted).toBe(true);
    expect(result.externalId).toBe('inapp-1');
    expect(result.deliveredVia).toBe('in_app');
    // The in-app provider received the user id so it can address the inbox.
    expect(captured).toHaveLength(1);
    expect(captured[0]?.userId).toBe('user-a');
    expect(captured[0]?.body).toBe('Hello');
  });

  it('normal priority: requested channel fails, settles directly in in-app (no paid-channel fan-out)', async () => {
    let smsCalls = 0;
    let emailCalls = 0;
    const sms: INotificationProvider = {
      channel: 'sms',
      name: 'sms',
      isConfigured: () => true,
      async send() {
        smsCalls += 1;
        return { success: false, error: 'sms down' };
      },
    };
    const email: INotificationProvider = {
      channel: 'email',
      name: 'email',
      isConfigured: () => true,
      async send() {
        emailCalls += 1;
        return { success: true, externalId: 'email-1' };
      },
    };
    const inApp = buildMockProvider('in_app', [
      { success: true, externalId: 'inapp-2' },
    ]);
    const result = await enqueueNotification(
      { ...input, channel: 'sms', priority: 'normal' },
      {
        providers: {
          ...emptyProviders(),
          sms: [sms],
          email: [email],
          in_app: [inApp],
        },
        preferences: allowAll,
        sleep: async () => undefined,
      },
    );
    expect(result.accepted).toBe(true);
    expect(result.deliveredVia).toBe('in_app');
    expect(smsCalls).toBeGreaterThan(0);
    // normal-priority chain is [sms, in_app] — email must NOT be touched.
    expect(emailCalls).toBe(0);
  });

  it('skips a fallback channel the user disabled, then reaches in-app', async () => {
    const sms = buildMockProvider('sms', [{ success: false, error: 'sms down' }]);
    let emailCalled = false;
    const email: INotificationProvider = {
      channel: 'email',
      name: 'email',
      isConfigured: () => true,
      async send() {
        emailCalled = true;
        return { success: true, externalId: 'email-x' };
      },
    };
    const inApp = buildMockProvider('in_app', [
      { success: true, externalId: 'inapp-3' },
    ]);
    const result = await enqueueNotification(
      { ...input, channel: 'whatsapp', priority: 'high' },
      {
        providers: {
          ...emptyProviders(),
          sms: [sms],
          email: [email],
          whatsapp: [
            buildMockProvider('whatsapp', [{ success: false, error: 'wa down' }]),
          ],
          in_app: [inApp],
        },
        // Disable email + sms on the fallback re-check; allow others.
        preferences: {
          checkAllowed: (args: { channel: NotificationChannel }) =>
            args.channel === 'email' || args.channel === 'sms'
              ? { allowed: false, reason: 'channel_disabled' }
              : { allowed: true },
        } as unknown as DispatcherDeps['preferences'],
        sleep: async () => undefined,
      },
    );
    expect(result.accepted).toBe(true);
    expect(result.deliveredVia).toBe('in_app');
    expect(emailCalled).toBe(false);
  });

  it('only dead-letters when even in-app persistence fails', async () => {
    const dlq: unknown[] = [];
    const failing = (name: string): INotificationProvider => ({
      channel: name as NotificationChannel,
      name,
      isConfigured: () => true,
      async send() {
        return { success: false, error: `${name} down` };
      },
    });
    const result = await enqueueNotification(
      { ...input, channel: 'whatsapp', priority: 'emergency' },
      {
        providers: {
          sms: [failing('sms')],
          email: [failing('email')],
          push: [failing('push')],
          whatsapp: [failing('whatsapp')],
          in_app: [failing('in_app')],
        },
        preferences: allowAll,
        sleep: async () => undefined,
        deadLetterSink: { push: (r) => { dlq.push(r); } },
      },
    );
    expect(result.accepted).toBe(false);
    expect(result.deadLettered).toBe(true);
    expect(dlq.length).toBe(1);
    // Error summary names the channels we tried, including in_app.
    expect(String(result.lastError)).toContain('in_app');
  });
});
