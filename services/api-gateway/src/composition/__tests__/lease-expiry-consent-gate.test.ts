/**
 * Tests for the lease-expiry automated-reminder consent gate (#24 wiring).
 *
 * Asserts the gate ALLOWS only when BOTH the per-tenant automated-reminders
 * switch AND the per-recipient preferences allow, DENIES (not faults) on a
 * reachable opt-out, and FAILS CLOSED only when an upstream genuinely throws.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  createLeaseExpiryConsentGate,
  type ConsentGateDbLike,
  type ConsentPreferencesGate,
} from '../lease-expiry-consent-gate';

const silentLogger = { warn: () => {} };

/** db.execute resolves the given result (rows-wrapper or bare array). */
function dbReturning(result: unknown): ConsentGateDbLike {
  return { execute: async () => result };
}
/** db.execute throws — genuine unavailability. */
const throwingDb: ConsentGateDbLike = {
  execute: async () => {
    throw new Error('connection refused');
  },
};

function prefsAllowing(): ConsentPreferencesGate {
  return { checkAllowed: async () => ({ allowed: true }) };
}

const args = { tenantId: 'tnt_1', customerId: 'cust_1', channel: 'email' as const };

describe('createLeaseExpiryConsentGate', () => {
  it('ALLOWS when the tenant opted in AND per-recipient prefs allow', async () => {
    const gate = createLeaseExpiryConsentGate({
      db: dbReturning({ rows: [{ settings: { automatedRemindersEnabled: true } }] }),
      prefs: prefsAllowing(),
      logger: silentLogger,
    });
    expect(await gate.isAutomatedReminderAllowed(args)).toEqual({ allowed: true });
  });

  it('DENIES tenant_reminders_disabled when the tenant has not opted in (default off/gated)', async () => {
    const checkAllowed = vi.fn(async () => ({ allowed: true }));
    const gate = createLeaseExpiryConsentGate({
      db: dbReturning({ rows: [{ settings: {} }] }),
      prefs: { checkAllowed },
      logger: silentLogger,
    });
    expect(await gate.isAutomatedReminderAllowed(args)).toEqual({
      allowed: false,
      reason: 'tenant_reminders_disabled',
    });
    // Short-circuits BEFORE consulting per-recipient prefs.
    expect(checkAllowed).not.toHaveBeenCalled();
  });

  it('DENIES tenant_reminders_disabled when explicitly disabled (=== false)', async () => {
    const gate = createLeaseExpiryConsentGate({
      db: dbReturning({ rows: [{ settings: { automatedRemindersEnabled: false } }] }),
      prefs: prefsAllowing(),
      logger: silentLogger,
    });
    expect((await gate.isAutomatedReminderAllowed(args)).reason).toBe('tenant_reminders_disabled');
  });

  it('DENIES tenant_not_found when the tenant row is missing', async () => {
    const gate = createLeaseExpiryConsentGate({
      db: dbReturning({ rows: [] }),
      prefs: prefsAllowing(),
      logger: silentLogger,
    });
    expect((await gate.isAutomatedReminderAllowed(args)).reason).toBe('tenant_not_found');
  });

  it('passes through the per-recipient prefs decision (opt-out respected)', async () => {
    const gate = createLeaseExpiryConsentGate({
      db: dbReturning({ rows: [{ settings: { automatedRemindersEnabled: true } }] }),
      prefs: { checkAllowed: async () => ({ allowed: false, reason: 'channel_disabled' }) },
      logger: silentLogger,
    });
    expect(await gate.isAutomatedReminderAllowed({ ...args, channel: 'whatsapp' })).toEqual({
      allowed: false,
      reason: 'channel_disabled',
    });
  });

  it('consults prefs with templateId=lease_expiring + the cron-selected channel', async () => {
    const checkAllowed = vi.fn(async () => ({ allowed: true }));
    const gate = createLeaseExpiryConsentGate({
      db: dbReturning({ rows: [{ settings: { automatedRemindersEnabled: true } }] }),
      prefs: { checkAllowed },
      logger: silentLogger,
    });
    await gate.isAutomatedReminderAllowed({ tenantId: 't9', customerId: 'c9', channel: 'sms' });
    expect(checkAllowed).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'c9', tenantId: 't9', channel: 'sms', templateId: 'lease_expiring' }),
    );
  });

  it('FAILS CLOSED (tenant_settings_unavailable) when the switch lookup throws', async () => {
    const gate = createLeaseExpiryConsentGate({
      db: throwingDb,
      prefs: prefsAllowing(),
      logger: silentLogger,
    });
    expect(await gate.isAutomatedReminderAllowed(args)).toEqual({
      allowed: false,
      reason: 'tenant_settings_unavailable',
    });
  });

  it('FAILS CLOSED (prefs_unavailable) when prefs.checkAllowed throws', async () => {
    const gate = createLeaseExpiryConsentGate({
      db: dbReturning({ rows: [{ settings: { automatedRemindersEnabled: true } }] }),
      prefs: {
        checkAllowed: async () => {
          throw new Error('redis unreachable');
        },
      },
      logger: silentLogger,
    });
    expect(await gate.isAutomatedReminderAllowed(args)).toEqual({
      allowed: false,
      reason: 'prefs_unavailable',
    });
  });

  it('normalises a bare-array db result shape (not just { rows })', async () => {
    const gate = createLeaseExpiryConsentGate({
      db: dbReturning([{ settings: { automatedRemindersEnabled: true } }]),
      prefs: prefsAllowing(),
      logger: silentLogger,
    });
    expect((await gate.isAutomatedReminderAllowed(args)).allowed).toBe(true);
  });
});
