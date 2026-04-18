/**
 * Preferences service — checkAllowed tests (SCAFFOLDED 8 + NEW 21)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { preferencesService } from '../preferences/service.js';

describe('preferencesService.checkAllowed', () => {
  const tenantId = 'tenant-1';
  const userId = 'user-1';

  beforeEach(() => {
    // Reset defaults by overwriting with the defaults explicitly
    preferencesService.upsertPreferences(userId, tenantId, {
      channels: { email: true, sms: true, push: true, whatsapp: true },
      templates: {
        rent_due: true,
        rent_overdue: true,
        payment_received: true,
        maintenance_update: true,
        lease_expiring: true,
        welcome: true,
      },
      quietHoursStart: undefined,
      quietHoursEnd: undefined,
    });
  });

  it('returns allowed:true when channel and template are enabled and no quiet hours', () => {
    const result = preferencesService.checkAllowed({
      userId,
      tenantId,
      channel: 'sms',
      templateId: 'rent_due',
    });
    expect(result.allowed).toBe(true);
  });

  it('returns channel_disabled when the channel is opted out', () => {
    preferencesService.upsertPreferences(userId, tenantId, {
      channels: { sms: false },
    });
    const result = preferencesService.checkAllowed({
      userId,
      tenantId,
      channel: 'sms',
      templateId: 'rent_due',
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('channel_disabled');
  });

  it('returns template_disabled when the template is opted out', () => {
    preferencesService.upsertPreferences(userId, tenantId, {
      templates: { rent_due: false },
    });
    const result = preferencesService.checkAllowed({
      userId,
      tenantId,
      channel: 'sms',
      templateId: 'rent_due',
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('template_disabled');
  });

  it('returns quiet_hours for normal priority during quiet hours', () => {
    preferencesService.upsertPreferences(userId, tenantId, {
      quietHoursStart: '22:00',
      quietHoursEnd: '06:00',
    });
    // 01:00 — inside quiet hours window
    const now = new Date();
    now.setHours(1, 0, 0, 0);
    const result = preferencesService.checkAllowed({
      userId,
      tenantId,
      channel: 'sms',
      templateId: 'rent_due',
      priority: 'normal',
      now,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('quiet_hours');
  });

  it('bypasses quiet hours for emergency priority', () => {
    preferencesService.upsertPreferences(userId, tenantId, {
      quietHoursStart: '22:00',
      quietHoursEnd: '06:00',
    });
    const now = new Date();
    now.setHours(1, 0, 0, 0);
    const result = preferencesService.checkAllowed({
      userId,
      tenantId,
      channel: 'sms',
      templateId: 'rent_due',
      priority: 'emergency',
      now,
    });
    expect(result.allowed).toBe(true);
  });

  it('still blocks emergency when channel is opted out', () => {
    preferencesService.upsertPreferences(userId, tenantId, {
      channels: { sms: false },
    });
    const result = preferencesService.checkAllowed({
      userId,
      tenantId,
      channel: 'sms',
      templateId: 'rent_due',
      priority: 'emergency',
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('channel_disabled');
  });
});
