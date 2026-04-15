/**
 * Observability helpers for the Notifications service.
 *
 * The package is embedded in a handful of hosts (webhook worker, queue
 * consumer, HTTP admin). Each host needs identical /health, /ready,
 * /metrics contracts so that K8s probes and Prometheus scrapers work
 * uniformly. This module provides a framework-agnostic helper for
 * producing those payloads.
 */

export interface NotificationsHealth {
  status: 'ok' | 'degraded';
  service: 'notifications';
  uptimeSeconds: number;
  providers: {
    email: boolean;
    sms: boolean;
    whatsapp: boolean;
    push: boolean;
  };
}

export interface NotificationsObservability {
  health(): NotificationsHealth;
  ready(): NotificationsHealth;
  metrics(): string;
  recordSend(channel: keyof NotificationsHealth['providers'], success: boolean): void;
  recordDeliveryUpdate(status: 'delivered' | 'read' | 'failed'): void;
}

export interface NotificationsObservabilityOptions {
  providers: NotificationsHealth['providers'];
}

export function createNotificationsObservability(
  options: NotificationsObservabilityOptions,
): NotificationsObservability {
  const startedAt = Date.now();
  const counters = {
    sendOk: { email: 0, sms: 0, whatsapp: 0, push: 0 },
    sendFail: { email: 0, sms: 0, whatsapp: 0, push: 0 },
    delivery: { delivered: 0, read: 0, failed: 0 },
  };

  const base = (): NotificationsHealth => ({
    status: 'ok',
    service: 'notifications',
    uptimeSeconds: (Date.now() - startedAt) / 1000,
    providers: { ...options.providers },
  });

  return {
    health: () => base(),
    ready: () => {
      const h = base();
      const anyProvider =
        h.providers.email || h.providers.sms || h.providers.whatsapp || h.providers.push;
      return anyProvider ? h : { ...h, status: 'degraded' };
    },
    metrics() {
      const uptime = (Date.now() - startedAt) / 1000;
      const sendLines: string[] = [
        '# HELP notifications_send_total Notifications dispatched, labelled by channel and outcome',
        '# TYPE notifications_send_total counter',
      ];
      for (const channel of ['email', 'sms', 'whatsapp', 'push'] as const) {
        sendLines.push(
          `notifications_send_total{channel="${channel}",outcome="ok"} ${counters.sendOk[channel]}`,
        );
        sendLines.push(
          `notifications_send_total{channel="${channel}",outcome="error"} ${counters.sendFail[channel]}`,
        );
      }
      return [
        '# HELP notifications_uptime_seconds Process uptime in seconds',
        '# TYPE notifications_uptime_seconds gauge',
        `notifications_uptime_seconds ${uptime.toFixed(3)}`,
        ...sendLines,
        '# HELP notifications_delivery_total Delivery status webhooks received',
        '# TYPE notifications_delivery_total counter',
        `notifications_delivery_total{status="delivered"} ${counters.delivery.delivered}`,
        `notifications_delivery_total{status="read"} ${counters.delivery.read}`,
        `notifications_delivery_total{status="failed"} ${counters.delivery.failed}`,
        '',
      ].join('\n');
    },
    recordSend(channel, success) {
      if (success) counters.sendOk[channel] += 1;
      else counters.sendFail[channel] += 1;
    },
    recordDeliveryUpdate(status) {
      counters.delivery[status] += 1;
    },
  };
}
