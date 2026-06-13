/**
 * Tests for the reminder → real notification-delivery adapter.
 *
 * Replaces the Wave-15 stub that faked `delivered: true` on every tick. These
 * tests pin the HONESTY CONTRACT: the adapter returns `delivered: true` ONLY
 * when the real dispatcher `accepted` the send, and `delivered: false` with a
 * real `error` on dead-letter, preference suppression, missing address,
 * template failure, or a dispatcher throw — never a fabricated success.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  createReminderNotificationSender,
  resolveRecipientAddress,
  formatExpiryDate,
  buildTemplateData,
  type ReminderDispatchResult,
  type ReminderEnqueueInput,
} from '../reminder-notification-sender';
import type { ExpiringLeaseRow } from '../../workers/lease-expiry-alert-cron';

const silentLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
};

function leaseRow(overrides: Partial<ExpiringLeaseRow> = {}): ExpiringLeaseRow {
  return {
    id: 'lease-1',
    tenantId: 'tenant-1',
    leaseNumber: 'L-001',
    propertyId: 'prop-1',
    unitId: 'unit-1',
    customerId: 'cust-1',
    endDate: new Date('2026-07-13T00:00:00.000Z'),
    rentAmount: 500_000,
    rentCurrency: 'TZS',
    customerEmail: 'tenant@example.com',
    customerPhone: '+255700000001',
    customerFirstName: 'Asha',
    customerLastName: 'Mwangi',
    windowDays: 30,
    ...overrides,
  };
}

const rendered = { subject: 'Lease Expiring Soon', body: 'Your lease will expire on 2026-07-13.', smsBody: 'Lease expires 2026-07-13.' };
const resolveTemplate = () => rendered;

describe('resolveRecipientAddress', () => {
  it('maps each channel to the right lease field', () => {
    const lease = leaseRow();
    expect(resolveRecipientAddress(lease, 'email')).toBe('tenant@example.com');
    expect(resolveRecipientAddress(lease, 'sms')).toBe('+255700000001');
    expect(resolveRecipientAddress(lease, 'whatsapp')).toBe('+255700000001');
    expect(resolveRecipientAddress(lease, 'in_app')).toBe('cust-1');
  });

  it('returns null when the address the channel needs is absent', () => {
    expect(resolveRecipientAddress(leaseRow({ customerEmail: null }), 'email')).toBeNull();
    expect(resolveRecipientAddress(leaseRow({ customerPhone: null }), 'sms')).toBeNull();
    expect(resolveRecipientAddress(leaseRow({ customerPhone: null }), 'whatsapp')).toBeNull();
  });
});

describe('formatExpiryDate / buildTemplateData', () => {
  it('renders an ISO date and carries lease metadata', () => {
    const lease = leaseRow();
    expect(formatExpiryDate(lease.endDate)).toBe('2026-07-13');
    const data = buildTemplateData(lease, 30);
    expect(data.expiryDate).toBe('2026-07-13');
    expect(data.category).toBe('lease');
    expect(data.windowDays).toBe('30');
    expect(data.leaseNumber).toBe('L-001');
  });
});

describe('createReminderNotificationSender — real delivery', () => {
  it('returns delivered:true with the provider message id when the dispatcher accepts', async () => {
    const dispatch = vi.fn(
      async (): Promise<ReminderDispatchResult> => ({ accepted: true, externalId: 'SM123', attempts: 1 }),
    );
    const sender = createReminderNotificationSender({ dispatch, resolveTemplate, logger: silentLogger });

    const out = await sender.send({
      tenantId: 'tenant-1',
      lease: leaseRow(),
      window: 30,
      channel: 'whatsapp',
      idempotencyKey: 'lease-expiry::lease-1::30d',
    });

    expect(out).toEqual({ delivered: true, providerMessageId: 'SM123' });
    const input = dispatch.mock.calls[0]![0] as ReminderEnqueueInput;
    // Tenant-scoped, idempotent, recipient + userId mapped, terse body for whatsapp.
    expect(input.tenantId).toBe('tenant-1');
    expect(input.userId).toBe('cust-1');
    expect(input.channel).toBe('whatsapp');
    expect(input.templateId).toBe('lease_expiring');
    expect(input.recipient).toBe('+255700000001');
    expect(input.idempotencyKey).toBe('lease-expiry::lease-1::30d');
    expect(input.body).toBe(rendered.smsBody);
    expect(input.priority).toBe('high');
  });

  it('uses the full body + subject for email', async () => {
    const dispatch = vi.fn(
      async (): Promise<ReminderDispatchResult> => ({ accepted: true, externalId: 'msg-1', attempts: 1 }),
    );
    const sender = createReminderNotificationSender({ dispatch, resolveTemplate, logger: silentLogger });
    await sender.send({
      tenantId: 'tenant-1',
      lease: leaseRow(),
      window: 7,
      channel: 'email',
      idempotencyKey: 'k',
    });
    const input = dispatch.mock.calls[0]![0] as ReminderEnqueueInput;
    expect(input.recipient).toBe('tenant@example.com');
    expect(input.body).toBe(rendered.body);
    expect(input.subject).toBe(rendered.subject);
  });

  it('reports delivered:true even when accepted via cross-channel fallback', async () => {
    const dispatch = vi.fn(
      async (): Promise<ReminderDispatchResult> => ({
        accepted: true,
        externalId: 'inbox-9',
        deliveredVia: 'in_app',
        attempts: 4,
      }),
    );
    const sender = createReminderNotificationSender({ dispatch, resolveTemplate, logger: silentLogger });
    const out = await sender.send({
      tenantId: 'tenant-1',
      lease: leaseRow(),
      window: 1,
      channel: 'whatsapp',
      idempotencyKey: 'k',
    });
    expect(out).toEqual({ delivered: true, providerMessageId: 'inbox-9' });
  });

  it('returns delivered:true without a message id when the provider gives none', async () => {
    const dispatch = vi.fn(async (): Promise<ReminderDispatchResult> => ({ accepted: true, attempts: 1 }));
    const sender = createReminderNotificationSender({ dispatch, resolveTemplate, logger: silentLogger });
    const out = await sender.send({
      tenantId: 'tenant-1',
      lease: leaseRow(),
      window: 30,
      channel: 'in_app',
      idempotencyKey: 'k',
    });
    expect(out).toEqual({ delivered: true });
  });
});

describe('createReminderNotificationSender — honest failures (NO fake success)', () => {
  it('returns delivered:false with the dispatcher error when dead-lettered', async () => {
    const dispatch = vi.fn(
      async (): Promise<ReminderDispatchResult> => ({
        accepted: false,
        deadLettered: true,
        attempts: 9,
        lastError: 'all channels exhausted (tried=[whatsapp,sms]): Twilio 500',
      }),
    );
    const sender = createReminderNotificationSender({ dispatch, resolveTemplate, logger: silentLogger });
    const out = await sender.send({
      tenantId: 'tenant-1',
      lease: leaseRow(),
      window: 30,
      channel: 'whatsapp',
      idempotencyKey: 'k',
    });
    expect(out.delivered).toBe(false);
    expect(out.error).toContain('all channels exhausted');
    expect(out.providerMessageId).toBeUndefined();
  });

  it('returns delivered:false with a suppressed reason when preferences block', async () => {
    const dispatch = vi.fn(
      async (): Promise<ReminderDispatchResult> => ({
        accepted: false,
        attempts: 0,
        suppressedReason: 'channel_disabled',
      }),
    );
    const sender = createReminderNotificationSender({ dispatch, resolveTemplate, logger: silentLogger });
    const out = await sender.send({
      tenantId: 'tenant-1',
      lease: leaseRow(),
      window: 30,
      channel: 'sms',
      idempotencyKey: 'k',
    });
    expect(out.delivered).toBe(false);
    expect(out.error).toBe('suppressed: channel_disabled');
  });

  it('honest-degrades (delivered:false) when the lease lacks the channel address — no dispatch attempted', async () => {
    const dispatch = vi.fn(async (): Promise<ReminderDispatchResult> => ({ accepted: true, attempts: 1 }));
    const sender = createReminderNotificationSender({ dispatch, resolveTemplate, logger: silentLogger });
    const out = await sender.send({
      tenantId: 'tenant-1',
      lease: leaseRow({ customerEmail: null }),
      window: 30,
      channel: 'email',
      idempotencyKey: 'k',
    });
    expect(out.delivered).toBe(false);
    expect(out.error).toContain('no email address');
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('returns delivered:false when the dispatcher throws (infra fault)', async () => {
    const dispatch = vi.fn(async (): Promise<ReminderDispatchResult> => {
      throw new Error('redis down');
    });
    const sender = createReminderNotificationSender({ dispatch, resolveTemplate, logger: silentLogger });
    const out = await sender.send({
      tenantId: 'tenant-1',
      lease: leaseRow(),
      window: 30,
      channel: 'sms',
      idempotencyKey: 'k',
    });
    expect(out.delivered).toBe(false);
    expect(out.error).toBe('redis down');
  });

  it('returns delivered:false when template rendering throws', async () => {
    const dispatch = vi.fn(async (): Promise<ReminderDispatchResult> => ({ accepted: true, attempts: 1 }));
    const sender = createReminderNotificationSender({
      dispatch,
      resolveTemplate: () => {
        throw new Error('Unknown template');
      },
      logger: silentLogger,
    });
    const out = await sender.send({
      tenantId: 'tenant-1',
      lease: leaseRow(),
      window: 30,
      channel: 'email',
      idempotencyKey: 'k',
    });
    expect(out.delivered).toBe(false);
    expect(out.error).toContain('template render failed');
    expect(dispatch).not.toHaveBeenCalled();
  });
});
