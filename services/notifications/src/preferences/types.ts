/**
 * User notification preference types
 */

import type { NotificationChannel, NotificationTemplateId } from '../types/index.js';

export interface ChannelPreferences {
  email?: boolean;
  sms?: boolean;
  push?: boolean;
  whatsapp?: boolean;
  /**
   * In-app inbox channel. Defaults ON and is the terminal fallback the
   * dispatcher uses so a notification always lands somewhere the user can
   * see it. A user MAY still toggle it off, but the dispatcher's
   * fallback chain treats it as the last resort.
   */
  in_app?: boolean;
}

export type TemplatePreferences = Partial<Record<NotificationTemplateId, boolean>>;

export interface NotificationPreferences {
  userId: string;
  tenantId: string;
  channels: ChannelPreferences;
  templates: TemplatePreferences;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  updatedAt: Date;
}

export interface UpdatePreferencesInput {
  channels?: Partial<ChannelPreferences>;
  templates?: Partial<TemplatePreferences>;
  quietHoursStart?: string;
  quietHoursEnd?: string;
}
