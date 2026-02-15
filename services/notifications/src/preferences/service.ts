/**
 * User notification preferences service
 */

import type { NotificationChannel, NotificationTemplateId } from '../types/index.js';
import type {
  NotificationPreferences,
  ChannelPreferences,
  TemplatePreferences,
  UpdatePreferencesInput,
} from './types.js';

const preferencesStore = new Map<string, NotificationPreferences>();

function prefKey(userId: string, tenantId: string): string {
  return `${tenantId}:${userId}`;
}

const DEFAULT_CHANNELS: ChannelPreferences = {
  email: true,
  sms: true,
  push: true,
  whatsapp: false,
};

const DEFAULT_TEMPLATES: TemplatePreferences = {
  rent_due: true,
  rent_overdue: true,
  payment_received: true,
  maintenance_update: true,
  lease_expiring: true,
  welcome: true,
};

export const preferencesService = {
  /**
   * Get user notification preferences
   */
  getUserPreferences(userId: string, tenantId: string): NotificationPreferences {
    const key = prefKey(userId, tenantId);
    const existing = preferencesStore.get(key);
    if (existing) return existing;

    const defaults: NotificationPreferences = {
      userId,
      tenantId,
      channels: { ...DEFAULT_CHANNELS },
      templates: { ...DEFAULT_TEMPLATES },
      updatedAt: new Date(),
    };
    preferencesStore.set(key, defaults);
    return defaults;
  },

  /**
   * Update user notification preferences
   */
  updatePreferences(
    userId: string,
    tenantId: string,
    prefs: UpdatePreferencesInput
  ): NotificationPreferences {
    const key = prefKey(userId, tenantId);
    const existing = this.getUserPreferences(userId, tenantId);

    const updated: NotificationPreferences = {
      ...existing,
      channels: prefs.channels ? { ...existing.channels, ...prefs.channels } : existing.channels,
      templates: prefs.templates ? { ...existing.templates, ...prefs.templates } : existing.templates,
      quietHoursStart: prefs.quietHoursStart ?? existing.quietHoursStart,
      quietHoursEnd: prefs.quietHoursEnd ?? existing.quietHoursEnd,
      updatedAt: new Date(),
    };
    preferencesStore.set(key, updated);
    return updated;
  },

  /**
   * Check if user opted in for a channel
   */
  isChannelEnabled(userId: string, tenantId: string, channel: NotificationChannel): boolean {
    const prefs = this.getUserPreferences(userId, tenantId);
    const channelKey = channel as keyof ChannelPreferences;
    return prefs.channels[channelKey] ?? DEFAULT_CHANNELS[channelKey] ?? false;
  },

  /**
   * Check if user opted in for a template type
   */
  isTemplateEnabled(
    userId: string,
    tenantId: string,
    templateId: NotificationTemplateId
  ): boolean {
    const prefs = this.getUserPreferences(userId, tenantId);
    const t = prefs.templates as Record<string, boolean | undefined>;
    const d = DEFAULT_TEMPLATES as Record<string, boolean>;
    return t[templateId] ?? d[templateId] ?? true;
  },

  /**
   * Check if current time is within quiet hours
   */
  isQuietHours(userId: string, tenantId: string): boolean {
    const prefs = this.getUserPreferences(userId, tenantId);
    if (!prefs.quietHoursStart || !prefs.quietHoursEnd) return false;

    const now = new Date();
    const startParts = prefs.quietHoursStart.split(':').map(Number);
    const endParts = prefs.quietHoursEnd.split(':').map(Number);
    const startH = startParts[0] ?? 0;
    const startM = startParts[1] ?? 0;
    const endH = endParts[0] ?? 0;
    const endM = endParts[1] ?? 0;

    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    if (startMinutes <= endMinutes) {
      return nowMinutes >= startMinutes && nowMinutes < endMinutes;
    }
    return nowMinutes >= startMinutes || nowMinutes < endMinutes;
  },
};
