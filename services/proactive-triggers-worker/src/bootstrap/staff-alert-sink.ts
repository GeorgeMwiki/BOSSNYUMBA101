/**
 * Real {@link StaffAlertSink} — raises an operator-facing in-app alert
 * when the sweep DROPS triggers (emit failed) for a tenant.
 *
 * The alert carries counts + trigger ids ONLY — no recipient PII, no
 * trigger payloads — mirroring `ReminderStaffAlertSink` in
 * `@bossnyumba/notifications-service`. It is delivered to the tenant's
 * owner accounts (the operators) as a `system` / `urgent` notification
 * so a human notices that high-urgency advice never reached its user.
 *
 * Owner resolution is injected (`resolveOperators`) so the bootstrap can
 * point it at the same Drizzle directory it already built — no second
 * query path, no schema coupling here.
 *
 * Best-effort by contract: the cron handler wraps `raise` in its own
 * try/catch, but we also no-op gracefully when there are no operators to
 * notify rather than throwing.
 */
// Import the in-app service DIRECTLY, not via the package barrel: the barrel
// eagerly constructs a WhatsAppClient at module load that THROWS when
// WHATSAPP_API_URL is unset — a side-effect this worker neither needs nor sets.
import {
  createInAppNotificationService,
  type InAppNotificationService,
} from '@bossnyumba/notifications-service/dist/services/in-app-notification.service.js';
import type { StaffAlertSink, WorkerLogger } from '../types.js';

export interface CreateStaffAlertSinkArgs {
  /**
   * Resolve the operator user-ids who should receive the alert for a
   * tenant. Bootstrap wires this to the active OWNER accounts.
   */
  readonly resolveOperators: (
    tenantId: string,
  ) => Promise<ReadonlyArray<string>>;
  /** Override the service for tests. Production omits it. */
  readonly service?: InAppNotificationService;
  readonly logger?: WorkerLogger;
}

/**
 * Build the production {@link StaffAlertSink}.
 */
export function createStaffAlertSink(
  args: CreateStaffAlertSinkArgs,
): StaffAlertSink {
  const service: InAppNotificationService =
    args.service ?? createInAppNotificationService();

  return {
    async raise({ tenantId, droppedCount, triggerIds }): Promise<void> {
      const operators = await args.resolveOperators(tenantId);
      if (operators.length === 0) {
        args.logger?.warn?.(
          { tenantId, droppedCount },
          'proactive-triggers-worker: no operators to receive dropped-trigger alert',
        );
        return;
      }
      const title = 'Proactive triggers failed to deliver';
      const message =
        `${droppedCount} high-urgency trigger(s) could not be delivered ` +
        `this sweep and will be retried. Trigger ids: ${triggerIds.join(', ')}.`;
      for (const userId of operators) {
        await service.create({
          tenantId,
          userId,
          title,
          message,
          category: 'system',
          priority: 'urgent',
          metadata: { droppedCount, triggerIds },
        });
      }
    },
  };
}
