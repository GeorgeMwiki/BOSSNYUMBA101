/**
 * Real notification {@link TriggerSink} — delivers each fired trigger to
 * the in-app notification inbox via
 * `@bossnyumba/notifications-service` (`createInAppNotificationService`),
 * the same service the api-gateway composition root uses.
 *
 * This is the PRODUCTION sink. It deliberately is NOT the log-only sink:
 * a high-urgency proactive trigger has to reach a real user-facing
 * surface, and the in-app inbox is the always-available channel
 * (WhatsApp / SMS / email fan-out layer above it).
 *
 * Delivery is allowed to THROW on failure — the cron handler's
 * `safeEmit` catches it, leaves the trigger unseen for the next sweep,
 * and raises a staff alert. So this adapter does no internal swallowing.
 */
// Import the in-app service DIRECTLY, not via the package barrel: the barrel
// (@bossnyumba/notifications-service index) eagerly constructs a WhatsAppClient
// at module load that THROWS when WHATSAPP_API_URL is unset — a side-effect this
// worker neither needs (it only writes the in-app inbox) nor configures. Going
// straight to the in-app service module keeps the worker boot-safe.
import {
  createInAppNotificationService,
  type InAppNotificationService,
  type NotificationCategory,
  type NotificationPriority,
} from '@bossnyumba/notifications-service/dist/services/in-app-notification.service.js';
import type { Trigger } from '@bossnyumba/user-context-store';
import type { TriggerSink } from '../types.js';

export interface CreateNotificationSinkArgs {
  /** Override the service for tests. Production omits it. */
  readonly service?: InAppNotificationService;
}

/**
 * Build the production {@link TriggerSink}. Each emit creates one in-app
 * notification row scoped to `(tenantId, userId)`.
 */
export function createNotificationSink(
  args: CreateNotificationSinkArgs = {},
): TriggerSink {
  const service: InAppNotificationService =
    args.service ?? createInAppNotificationService();

  return {
    async emit({ tenantId, userId, role, trigger }): Promise<void> {
      await service.create({
        tenantId,
        userId,
        title: trigger.summary,
        message: trigger.suggestedAction,
        category: categoryFor(trigger),
        priority: priorityFor(trigger.urgency),
        metadata: {
          triggerId: trigger.id,
          kind: trigger.kind,
          role,
          suggestedPromptForChat: trigger.suggestedPromptForChat,
        },
      });
    },
  };
}

/**
 * Map advisor urgency (1..5) onto the notification priority ladder.
 * The worker only fires urgency >= minUrgency (default 4), so in practice
 * this resolves to `high` (4) or `urgent` (5); the lower rungs are kept
 * for completeness if a lower `minUrgency` is configured.
 */
function priorityFor(urgency: Trigger['urgency']): NotificationPriority {
  if (urgency >= 5) return 'urgent';
  if (urgency === 4) return 'high';
  if (urgency === 3) return 'normal';
  return 'low';
}

/**
 * Bucket the trigger into a notification category. Triggers are advisory
 * nudges, so `reminder` is the natural default; the most urgent ones are
 * surfaced as `alert`.
 */
function categoryFor(trigger: Trigger): NotificationCategory {
  return trigger.urgency >= 5 ? 'alert' : 'reminder';
}
