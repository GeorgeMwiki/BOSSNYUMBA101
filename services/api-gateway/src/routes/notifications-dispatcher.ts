// @ts-nocheck
/**
 * Notifications dispatcher for work-order lifecycle events.
 *
 * This is a thin helper that records the intent to notify the customer /
 * manager / vendor when a work order transitions. In production it forwards
 * to the notifications service (email/SMS/WhatsApp/in-app). Locally it logs
 * to stdout so developers can verify the dispatch path is wired end-to-end.
 *
 * The notifications service is not a direct dependency of the gateway; we
 * intentionally avoid a hard coupling so the gateway can run without it.
 * Instead, if NOTIFICATIONS_SERVICE_URL is configured we POST an envelope;
 * otherwise we log and return. This keeps the HTTP call out of the request
 * path (fire-and-forget).
 */

import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info', name: 'wo-notifier' });

export type WorkOrderEvent =
  | 'work_order.submitted'
  | 'work_order.assigned'
  | 'work_order.scheduled'
  | 'work_order.started'
  | 'work_order.completed'
  | 'work_order.rated'
  | 'work_order.cancelled';

export interface NotifyParams {
  event: WorkOrderEvent;
  tenantId: string;
  workOrderId: string;
  workOrderNumber?: string;
  customerId?: string;
  vendorId?: string;
  managerId?: string;
  title?: string;
  priority?: string;
  status?: string;
  meta?: Record<string, unknown>;
}

const NOTIFICATIONS_SERVICE_URL = process.env.NOTIFICATIONS_SERVICE_URL;

export async function dispatchWorkOrderNotification(params: NotifyParams): Promise<void> {
  logger.info(
    {
      event: params.event,
      tenantId: params.tenantId,
      workOrderId: params.workOrderId,
      workOrderNumber: params.workOrderNumber,
      customerId: params.customerId,
      vendorId: params.vendorId,
      managerId: params.managerId,
    },
    'Dispatching work-order notification'
  );

  if (!NOTIFICATIONS_SERVICE_URL) {
    // Dev / unit tests: dispatch path is logged but no outbound call.
    return;
  }

  // Fire-and-forget: never block the API response on a downstream notification.
  void (async () => {
    try {
      await fetch(`${NOTIFICATIONS_SERVICE_URL.replace(/\/$/, '')}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: params.event,
          tenantId: params.tenantId,
          payload: params,
          emittedAt: new Date().toISOString(),
        }),
      });
    } catch (err) {
      logger.warn({ err, event: params.event }, 'Failed to dispatch work-order notification');
    }
  })();
}
