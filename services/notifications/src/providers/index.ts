/**
 * Notification providers - unified exports
 */

export * from './provider.interface.js';
export * from './email/sendgrid.js';
export * from './email/ses.js';
export * from './email/smtp.js';
export * from './sms/africas-talking.js';
export * from './sms/twilio.js';
export * from './push/firebase.js';
export * from './push/expo.js';
export * from './push/token-kind.js';
export * from './whatsapp/twilio.js';
export * from './in-app/portal.js';

import { sendGridProvider } from './email/sendgrid.js';
import { sesProvider } from './email/ses.js';
import { smtpProvider } from './email/smtp.js';
import { africasTalkingSmsProvider } from './sms/africas-talking.js';
import { twilioSmsProvider } from './sms/twilio.js';
import { firebasePushProvider } from './push/firebase.js';
import { expoPushProvider } from './push/expo.js';
import { twilioWhatsAppProvider } from './whatsapp/twilio.js';
import { inAppProvider } from './in-app/portal.js';
import type { NotificationChannel } from '../types/index.js';
import type { INotificationProvider } from './provider.interface.js';

/**
 * Provider registry: channel -> ordered list of providers.
 *
 * The dispatcher iterates each channel's list in order, failing over to the
 * next provider when the current one is unconfigured or its send fails. The
 * `in_app` channel holds the always-available portal inbox provider and is the
 * terminal of every cross-channel fallback chain.
 *
 * The `push` channel holds BOTH push rails: Expo (for `ExponentPushToken[...]`
 * receivers registered by the mobile apps) and Firebase (for raw FCM/APNS
 * tokens). Each rejects the other's token kind with a non-retryable
 * INVALID_RECIPIENT, so the dispatcher's per-channel failover routes every
 * token to the rail that can actually deliver it.
 */
export const providerRegistry: Record<NotificationChannel, INotificationProvider[]> = {
  email: [sendGridProvider, sesProvider, smtpProvider],
  sms: [africasTalkingSmsProvider, twilioSmsProvider],
  push: [expoPushProvider, firebasePushProvider],
  whatsapp: [twilioWhatsAppProvider],
  in_app: [inAppProvider],
};
