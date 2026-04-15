/**
 * Payment domain event publisher.
 *
 * Fans out payment lifecycle events to:
 *   1. The webhooks service (tenant-subscribed external callback delivery).
 *   2. The payments-ledger service (double-entry journal recording).
 *
 * Delivery is fire-and-forget: the caller (e.g. the POST /payments or
 * POST /payments/:id/confirm handler) SHOULD NOT await this function or
 * include its outcome in the HTTP response. Failures are logged with
 * structured context but never thrown back to the request path.
 *
 * Contract with payments-ledger:
 *   POST `${PAYMENTS_LEDGER_URL}/internal/ledger`
 *   Headers: `X-Internal-Key: ${INTERNAL_API_KEY}`, `Content-Type: application/json`
 *   Body: { type, tenantId, payload, eventId, occurredAt }
 *
 * NOTE: `/internal/ledger` is the agreed internal contract; payments-ledger
 * must expose this route. Today that service exposes the public
 * `POST /api/v1/journal` endpoint, which the internal route can delegate to.
 */

import { randomUUID } from 'crypto';
import { logger } from '../utils/logger';
// Relative import — webhooks is a separate workspace package
// (@bossnyumba/webhooks-service) but is not currently declared as a
// dependency of api-gateway. A relative import keeps the change minimal.
import { trigger } from '../../../webhooks/src/webhook-service';
import type { WebhookEvent, WebhookEventType } from '../../../webhooks/src/types';

export type PaymentEventType =
  | 'payment.created'
  | 'payment.succeeded'
  | 'payment.failed';

export interface PaymentEvent {
  type: PaymentEventType;
  tenantId: string;
  payload: Record<string, unknown>;
}

const LEDGER_TIMEOUT_MS = 5_000;
const WEBHOOK_TIMEOUT_MS = 10_000;

function getLedgerUrl(): string | undefined {
  const raw = process.env.PAYMENTS_LEDGER_URL;
  if (!raw || raw.trim() === '') return undefined;
  return raw.replace(/\/$/, '');
}

async function notifyLedger(event: PaymentEvent, eventId: string, occurredAt: string): Promise<void> {
  const base = getLedgerUrl();
  if (!base) {
    logger.warn(
      { eventId, eventType: event.type, tenantId: event.tenantId },
      'PAYMENTS_LEDGER_URL not configured; skipping ledger notification'
    );
    return;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LEDGER_TIMEOUT_MS);

  try {
    const res = await fetch(`${base}/internal/ledger`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Key': process.env.INTERNAL_API_KEY || '',
      },
      body: JSON.stringify({
        eventId,
        type: event.type,
        tenantId: event.tenantId,
        occurredAt,
        payload: event.payload,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      logger.error(
        { eventId, eventType: event.type, tenantId: event.tenantId, status: res.status, body: text.slice(0, 500) },
        'payments-ledger rejected event'
      );
      return;
    }
    logger.info(
      { eventId, eventType: event.type, tenantId: event.tenantId },
      'payments-ledger accepted event'
    );
  } catch (err) {
    const aborted = (err as Error)?.name === 'AbortError';
    logger.error(
      {
        eventId,
        eventType: event.type,
        tenantId: event.tenantId,
        aborted,
        error: err instanceof Error ? err.message : String(err),
      },
      aborted ? 'payments-ledger call timed out' : 'payments-ledger call failed'
    );
  } finally {
    clearTimeout(timer);
  }
}

async function notifyWebhooks(event: PaymentEvent, eventId: string, occurredAt: string): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

  const whEvent: WebhookEvent = {
    id: eventId,
    type: event.type as WebhookEventType,
    tenantId: event.tenantId,
    payload: event.payload,
    timestamp: occurredAt,
  };

  try {
    const result = await Promise.race([
      trigger(whEvent),
      new Promise<never>((_, reject) => {
        controller.signal.addEventListener('abort', () =>
          reject(Object.assign(new Error('webhook fan-out timeout'), { name: 'AbortError' }))
        );
      }),
    ]);
    logger.info(
      {
        eventId,
        eventType: event.type,
        tenantId: event.tenantId,
        delivered: result.delivered,
        failed: result.failed,
      },
      'webhook fan-out complete'
    );
  } catch (err) {
    const aborted = (err as Error)?.name === 'AbortError';
    logger.error(
      {
        eventId,
        eventType: event.type,
        tenantId: event.tenantId,
        aborted,
        error: err instanceof Error ? err.message : String(err),
      },
      aborted ? 'webhook fan-out timed out' : 'webhook fan-out failed'
    );
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Publish a payment domain event. Fire-and-forget: never throws, never blocks
 * the caller on downstream delivery. Callers can optionally `void` the return.
 */
export function publishPaymentEvent(event: PaymentEvent): void {
  const eventId = randomUUID();
  const occurredAt = new Date().toISOString();

  // Intentionally not awaited. Each branch has its own timeout + logging.
  void Promise.allSettled([
    notifyLedger(event, eventId, occurredAt),
    notifyWebhooks(event, eventId, occurredAt),
  ]).catch((err) => {
    logger.error(
      { eventId, eventType: event.type, tenantId: event.tenantId, error: String(err) },
      'publishPaymentEvent unexpected failure'
    );
  });
}
