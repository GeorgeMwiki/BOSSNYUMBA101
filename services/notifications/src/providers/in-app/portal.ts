/**
 * In-App / Portal notification provider.
 *
 * The terminal hop of every cross-channel fallback chain. Unlike the
 * email/SMS/WhatsApp/push providers — which depend on an external rail that
 * can be down, rate-limited, or rejecting — this provider persists a row into
 * the in-app inbox the customer / owner / estate portals already read (via
 * `inAppNotificationService`, whose store the portal SSE stream + notifications
 * inbox consume). Because the only failure mode is the inbox store itself
 * failing, it is effectively always-available: the dispatcher only truly
 * dead-letters a notification when even THIS provider throws.
 *
 * Design:
 *   - `isConfigured()` is unconditionally `true`. There are no per-tenant
 *     credentials; the inbox is a first-party store. This is what makes the
 *     in-app channel the dependable last resort.
 *   - `send()` requires a `userId` (the inbox is keyed by user, not by an
 *     external address). The dispatcher always carries `userId` into
 *     `SendParams` for the in-app hop. If it is missing we return a
 *     NON-retryable failure (retrying without a user id can never succeed).
 *   - The provider does NOT re-render templates — the dispatcher passes the
 *     already-rendered `title` + `body`. `data.category` (optional) lets the
 *     caller classify the inbox row; otherwise it defaults to `system`.
 */

import type { TenantId } from '../../types/index.js';
import type { NotificationChannel, SendResult } from '../../types/index.js';
import type { INotificationProvider, SendParams } from '../provider.interface.js';
import {
  inAppNotificationService,
  type InAppNotificationService,
  type NotificationCategory,
  type NotificationPriority as InAppPriority,
} from '../../services/in-app-notification.service.js';

const VALID_CATEGORIES: ReadonlySet<NotificationCategory> = new Set<NotificationCategory>([
  'payment',
  'maintenance',
  'lease',
  'announcement',
  'system',
  'reminder',
  'alert',
  'communication',
]);

const VALID_PRIORITIES: ReadonlySet<InAppPriority> = new Set<InAppPriority>([
  'low',
  'normal',
  'high',
  'urgent',
]);

function resolveCategory(raw: string | undefined): NotificationCategory {
  if (raw && VALID_CATEGORIES.has(raw as NotificationCategory)) {
    return raw as NotificationCategory;
  }
  return 'system';
}

function resolvePriority(raw: string | undefined): InAppPriority {
  if (raw && VALID_PRIORITIES.has(raw as InAppPriority)) {
    return raw as InAppPriority;
  }
  return 'normal';
}

export class InAppProvider implements INotificationProvider {
  readonly channel: NotificationChannel = 'in_app';
  readonly name = 'In-App Inbox';

  private readonly service: InAppNotificationService;

  constructor(service: InAppNotificationService = inAppNotificationService) {
    this.service = service;
  }

  /**
   * Always configured — the in-app inbox is a first-party store with no
   * per-tenant external credentials. This is the property that makes it the
   * dependable terminal of the fallback chain.
   */
  isConfigured(_tenantId: TenantId): boolean {
    return true;
  }

  async send(params: SendParams): Promise<SendResult> {
    const userId = params.userId ?? params.data?.userId;
    if (!userId || userId.trim().length === 0) {
      // No user to address the inbox row to — retrying cannot fix this, so
      // signal a non-retryable failure (`INVALID_RECIPIENT` is in the
      // dispatcher's NON_RETRYABLE set) instead of burning the retry budget.
      const failure: SendResult & { errorCode: string } = {
        success: false,
        error: 'in-app provider requires a userId',
        errorCode: 'INVALID_RECIPIENT',
      };
      return failure;
    }

    try {
      const created = await this.service.create({
        tenantId: params.tenantId,
        userId,
        title: params.title ?? params.subject ?? 'Notification',
        message: params.body,
        category: resolveCategory(params.data?.category),
        priority: resolvePriority(params.data?.priority),
        actionUrl: params.data?.actionUrl,
        actionLabel: params.data?.actionLabel,
      });
      return { success: true, externalId: created.id };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  }
}

/**
 * Default singleton bound to the default `inAppNotificationService`. The
 * provider registry exports this; tests construct `new InAppProvider(stub)`
 * with an injected service.
 */
export const inAppProvider = new InAppProvider();
