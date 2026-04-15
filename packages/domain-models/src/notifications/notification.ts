/**
 * Notification domain model
 * Multi-channel notification management (email, sms, push, in-app, whatsapp).
 */

import { z } from 'zod';
import type { Brand, TenantId, UserId, EntityMetadata, ISOTimestamp } from '../common/types';
import type { CustomerId } from '../payments/payment-intent';

export type NotificationId = Brand<string, 'NotificationId'>;

export function asNotificationId(id: string): NotificationId {
  return id as NotificationId;
}

// ---------------------------------------------------------------------------
// Enum schemas
// ---------------------------------------------------------------------------

export const NotificationChannelSchema = z.enum([
  'email',
  'sms',
  'push',
  'in_app',
  'whatsapp',
]);
export type NotificationChannel = z.infer<typeof NotificationChannelSchema>;

export const NotificationStatusSchema = z.enum([
  'pending',
  'queued',
  'sending',
  'sent',
  'delivered',
  'read',
  'failed',
  'cancelled',
]);
export type NotificationStatus = z.infer<typeof NotificationStatusSchema>;

export const NotificationPrioritySchema = z.enum(['high', 'normal', 'low']);
export type NotificationPriority = z.infer<typeof NotificationPrioritySchema>;

export const NotificationCategorySchema = z.enum([
  'payment_due',
  'payment_received',
  'payment_overdue',
  'maintenance_update',
  'maintenance_scheduled',
  'maintenance_completed',
  'lease_expiring',
  'lease_renewal',
  'inspection_scheduled',
  'document_ready',
  'announcement',
  'alert',
  'reminder',
]);
export type NotificationCategory = z.infer<typeof NotificationCategorySchema>;

export const NotificationLocaleSchema = z.enum(['en-KE', 'sw-TZ', 'en-US', 'en-GB']);
export type NotificationLocale = z.infer<typeof NotificationLocaleSchema>;

/** Valid status transitions. Closed statuses (delivered/read/cancelled) are terminal-ish. */
const ALLOWED_TRANSITIONS: Record<NotificationStatus, readonly NotificationStatus[]> = {
  pending: ['queued', 'sending', 'sent', 'failed', 'cancelled'],
  queued: ['sending', 'sent', 'failed', 'cancelled'],
  sending: ['sent', 'failed', 'cancelled'],
  sent: ['delivered', 'failed'],
  delivered: ['read', 'failed'],
  read: [],
  failed: ['queued', 'sending'], // allow retry
  cancelled: [],
};

export function canTransition(from: NotificationStatus, to: NotificationStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

// ---------------------------------------------------------------------------
// Entity
// ---------------------------------------------------------------------------

export const NotificationSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  recipientUserId: z.string().nullable(),
  recipientCustomerId: z.string().nullable(),
  channel: NotificationChannelSchema,
  status: NotificationStatusSchema,
  priority: NotificationPrioritySchema,
  category: NotificationCategorySchema,
  locale: NotificationLocaleSchema.default('en-KE'),
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(4000),
  data: z.record(z.string(), z.string()).default({}),
  actionUrl: z.string().url().nullable(),
  scheduledFor: z.string().nullable(),
  sentAt: z.string().nullable(),
  deliveredAt: z.string().nullable(),
  readAt: z.string().nullable(),
  failureReason: z.string().nullable(),
  retryCount: z.number().int().min(0),
  externalId: z.string().nullable(),
  templateId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string(),
  updatedBy: z.string(),
});

/**
 * Notification entity
 */
export interface Notification extends EntityMetadata {
  readonly id: NotificationId;
  readonly tenantId: TenantId;
  readonly recipientUserId: UserId | null;
  readonly recipientCustomerId: CustomerId | null;
  readonly channel: NotificationChannel;
  readonly status: NotificationStatus;
  readonly priority: NotificationPriority;
  readonly category: NotificationCategory;
  readonly locale: NotificationLocale;
  readonly title: string;
  readonly body: string;
  readonly data: Record<string, string>; // Additional payload
  readonly actionUrl: string | null;
  readonly scheduledFor: ISOTimestamp | null;
  readonly sentAt: ISOTimestamp | null;
  readonly deliveredAt: ISOTimestamp | null;
  readonly readAt: ISOTimestamp | null;
  readonly failureReason: string | null;
  readonly retryCount: number;
  readonly externalId: string | null; // Provider's message ID
  readonly templateId: string | null;
}

/** Create a new notification */
export function createNotification(
  id: NotificationId,
  data: {
    tenantId: TenantId;
    recipientUserId?: UserId;
    recipientCustomerId?: CustomerId;
    channel: NotificationChannel;
    priority?: NotificationPriority;
    category: NotificationCategory;
    locale?: NotificationLocale;
    title: string;
    body: string;
    data?: Record<string, string>;
    actionUrl?: string;
    scheduledFor?: ISOTimestamp;
    templateId?: string;
  },
  createdBy: UserId
): Notification {
  const now = new Date().toISOString();
  const status: NotificationStatus = data.scheduledFor ? 'pending' : 'queued';

  return {
    id,
    tenantId: data.tenantId,
    recipientUserId: data.recipientUserId ?? null,
    recipientCustomerId: data.recipientCustomerId ?? null,
    channel: data.channel,
    status,
    priority: data.priority ?? 'normal',
    category: data.category,
    locale: data.locale ?? 'en-KE',
    title: data.title,
    body: data.body,
    data: data.data ?? {},
    actionUrl: data.actionUrl ?? null,
    scheduledFor: data.scheduledFor ?? null,
    sentAt: null,
    deliveredAt: null,
    readAt: null,
    failureReason: null,
    retryCount: 0,
    externalId: null,
    templateId: data.templateId ?? null,
    createdAt: now,
    updatedAt: now,
    createdBy,
    updatedBy: createdBy,
  };
}

function transition(
  notification: Notification,
  next: NotificationStatus,
  patch: Partial<Notification>,
  updatedBy: UserId
): Notification {
  if (!canTransition(notification.status, next)) {
    throw new Error(
      `Invalid notification status transition: ${notification.status} -> ${next} (id=${notification.id})`
    );
  }
  return {
    ...notification,
    ...patch,
    status: next,
    updatedAt: new Date().toISOString(),
    updatedBy,
  };
}

/** Mark notification as sent */
export function markSent(
  notification: Notification,
  externalId: string | null,
  updatedBy: UserId
): Notification {
  return transition(
    notification,
    'sent',
    { externalId, sentAt: new Date().toISOString() },
    updatedBy
  );
}

/** Mark notification as delivered */
export function markDelivered(notification: Notification, updatedBy: UserId): Notification {
  return transition(
    notification,
    'delivered',
    { deliveredAt: new Date().toISOString() },
    updatedBy
  );
}

/** Mark notification as read */
export function markRead(notification: Notification, updatedBy: UserId): Notification {
  return transition(notification, 'read', { readAt: new Date().toISOString() }, updatedBy);
}

/** Mark notification as failed */
export function markFailed(
  notification: Notification,
  failureReason: string,
  updatedBy: UserId
): Notification {
  return transition(
    notification,
    'failed',
    {
      failureReason,
      retryCount: notification.retryCount + 1,
    },
    updatedBy
  );
}

/** Check if notification should be retried. */
export function shouldRetry(notification: Notification, maxRetries: number = 3): boolean {
  return notification.status === 'failed' && notification.retryCount < maxRetries;
}

/** Template registry. */
export interface NotificationTemplate {
  readonly title: string;
  readonly body: string;
  readonly requiredVariables: readonly string[];
}

export const NOTIFICATION_TEMPLATES: Record<NotificationCategory, NotificationTemplate> = {
  payment_due: {
    title: 'Payment Due Reminder',
    body: 'Your rent payment of {{amount}} is due on {{dueDate}}.',
    requiredVariables: ['amount', 'dueDate'],
  },
  payment_received: {
    title: 'Payment Received',
    body: 'We received your payment of {{amount}}. Thank you!',
    requiredVariables: ['amount'],
  },
  payment_overdue: {
    title: 'Payment Overdue',
    body: 'Your payment of {{amount}} is {{days}} days overdue. Please pay immediately to avoid late fees.',
    requiredVariables: ['amount', 'days'],
  },
  maintenance_update: {
    title: 'Maintenance Update',
    body: 'Your maintenance request #{{workOrderNumber}} has been updated: {{status}}.',
    requiredVariables: ['workOrderNumber', 'status'],
  },
  maintenance_scheduled: {
    title: 'Maintenance Scheduled',
    body: 'Maintenance for your request #{{workOrderNumber}} is scheduled for {{date}} at {{time}}.',
    requiredVariables: ['workOrderNumber', 'date', 'time'],
  },
  maintenance_completed: {
    title: 'Maintenance Completed',
    body: 'Your maintenance request #{{workOrderNumber}} has been completed. Please rate your experience.',
    requiredVariables: ['workOrderNumber'],
  },
  lease_expiring: {
    title: 'Lease Expiring Soon',
    body: 'Your lease will expire on {{expiryDate}}. Please contact us about renewal options.',
    requiredVariables: ['expiryDate'],
  },
  lease_renewal: {
    title: 'Lease Renewal Available',
    body: 'Your lease renewal is ready for review. Please sign by {{deadline}}.',
    requiredVariables: ['deadline'],
  },
  inspection_scheduled: {
    title: 'Inspection Scheduled',
    body: 'A {{type}} inspection has been scheduled for {{date}} at {{time}}.',
    requiredVariables: ['type', 'date', 'time'],
  },
  document_ready: {
    title: 'Document Ready',
    body: 'Your {{documentType}} is ready to view.',
    requiredVariables: ['documentType'],
  },
  announcement: {
    title: '{{title}}',
    body: '{{message}}',
    requiredVariables: ['title', 'message'],
  },
  alert: {
    title: 'Important Alert',
    body: '{{message}}',
    requiredVariables: ['message'],
  },
  reminder: {
    title: 'Reminder',
    body: '{{message}}',
    requiredVariables: ['message'],
  },
};

/** Replace template placeholders with values. Missing vars render as empty strings. */
export function applyTemplate(
  category: NotificationCategory,
  variables: Record<string, string>
): { title: string; body: string } {
  const template = NOTIFICATION_TEMPLATES[category];
  const substitute = (text: string): string =>
    text.replace(/\{\{(\w+)\}\}/g, (_m, key: string) => variables[key] ?? '');
  return {
    title: substitute(template.title),
    body: substitute(template.body),
  };
}
