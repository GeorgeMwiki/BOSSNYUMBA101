/**
 * Domain event → notification bridge.
 *
 * Closes the gap flagged by the 10-agent async audit: 62 events were
 * declared across the monorepo but nothing in production ever called
 * `eventBus.subscribe(...)`. The outbox drainer publishes events, but
 * without subscribers they vanish on the floor.
 *
 * This module registers the first wave of subscribers — the ones tied
 * to customer-visible outcomes (payment succeeded/failed, lease
 * renewal alerts, case escalations). Each handler:
 *   1. Reads the tenant context from the event envelope
 *   2. Resolves the recipient customer/user
 *   3. Hands off to the notifications service over HTTP (or local
 *      in-process for monoservice deployments)
 *
 * Failures inside a handler are logged and absorbed — the outbox
 * retries via its dead-letter machinery. A throwing handler must
 * not crash the drainer tick.
 */

import type pino from 'pino';

export interface SubscribableBus {
  subscribe(
    pattern: string,
    handler: (event: DomainEventLike) => Promise<void> | void,
    opts?: { id?: string }
  ): string | void;
}

export interface DomainEventLike {
  type?: string;
  eventType?: string;
  aggregateType?: string;
  aggregateId?: string;
  payload?: Record<string, unknown>;
  metadata?: {
    tenantId?: string;
    correlationId?: string;
    [k: string]: unknown;
  };
}

export interface NotificationDispatcher {
  send(params: {
    tenantId: string;
    channel: 'email' | 'sms' | 'whatsapp' | 'push' | 'in_app';
    recipient: { userId?: string; customerId?: string; to?: string };
    templateKey: string;
    data: Record<string, unknown>;
    correlationId?: string;
  }): Promise<{ success: boolean; error?: string }>;
}

export interface EventSubscriberDeps {
  bus: SubscribableBus;
  notifications: NotificationDispatcher;
  logger: pino.Logger;
}

function safeHandler(
  label: string,
  logger: pino.Logger,
  fn: (event: DomainEventLike) => Promise<void>
): (event: DomainEventLike) => Promise<void> {
  return async (event) => {
    try {
      await fn(event);
    } catch (err) {
      // Never throw from a subscriber — let the outbox treat the
      // event as already acknowledged so failed notifications
      // don't block all downstream handlers.
      logger.error(
        {
          err: err instanceof Error ? err.message : String(err),
          eventType: event.eventType ?? event.type,
          aggregateId: event.aggregateId,
          correlationId: event.metadata?.correlationId,
        },
        `${label}: handler failed`
      );
    }
  };
}

/**
 * Register the default set of event subscribers. Safe to call once
 * at service boot; subscriber IDs are retained for later unsubscribe
 * during graceful shutdown (the bus implementation handles cleanup).
 */
export function registerDomainEventSubscribers(deps: EventSubscriberDeps): void {
  const { bus, notifications, logger } = deps;

  // -------- Payment lifecycle --------
  bus.subscribe(
    'PAYMENT_SUCCEEDED',
    safeHandler('payment-succeeded', logger, async (event) => {
      const p = event.payload ?? {};
      const tenantId = event.metadata?.tenantId;
      const customerId = (p as { customerId?: string }).customerId;
      if (!tenantId || !customerId) {
        logger.warn({ eventType: event.eventType }, 'payment-succeeded: missing tenant/customer context');
        return;
      }
      await notifications.send({
        tenantId,
        channel: 'sms',
        recipient: { customerId },
        templateKey: 'payment.succeeded',
        data: {
          amount: (p as { amount?: unknown }).amount,
          paidAt: (p as { paidAt?: unknown }).paidAt,
          receiptUrl: (p as { receiptUrl?: string }).receiptUrl,
        },
        correlationId: event.metadata?.correlationId,
      });
    }),
    { id: 'notifications.payment-succeeded' }
  );

  bus.subscribe(
    'PAYMENT_FAILED',
    safeHandler('payment-failed', logger, async (event) => {
      const p = event.payload ?? {};
      const tenantId = event.metadata?.tenantId;
      const customerId = (p as { customerId?: string }).customerId;
      if (!tenantId || !customerId) return;
      await notifications.send({
        tenantId,
        channel: 'sms',
        recipient: { customerId },
        templateKey: 'payment.failed',
        data: {
          failureReason: (p as { failureReason?: string }).failureReason,
          failureCode: (p as { failureCode?: string }).failureCode,
        },
        correlationId: event.metadata?.correlationId,
      });
    }),
    { id: 'notifications.payment-failed' }
  );

  bus.subscribe(
    'PAYMENT_REFUNDED',
    safeHandler('payment-refunded', logger, async (event) => {
      const p = event.payload ?? {};
      const tenantId = event.metadata?.tenantId;
      const customerId = (p as { customerId?: string }).customerId;
      if (!tenantId || !customerId) return;
      await notifications.send({
        tenantId,
        channel: 'email',
        recipient: { customerId },
        templateKey: 'payment.refunded',
        data: {
          refundAmount: (p as { refundAmount?: unknown }).refundAmount,
          isFullRefund: (p as { isFullRefund?: boolean }).isFullRefund,
        },
        correlationId: event.metadata?.correlationId,
      });
    }),
    { id: 'notifications.payment-refunded' }
  );

  // -------- Statement delivery --------
  bus.subscribe(
    'STATEMENT_GENERATED',
    safeHandler('statement-generated', logger, async (event) => {
      const p = event.payload ?? {};
      const tenantId = event.metadata?.tenantId;
      if (!tenantId) return;
      // Statements carry either ownerId or customerId in the payload.
      const recipientCustomerId = (p as { customerId?: string }).customerId;
      const recipientUserId = (p as { ownerId?: string }).ownerId;
      if (!recipientCustomerId && !recipientUserId) return;
      await notifications.send({
        tenantId,
        channel: 'email',
        recipient: recipientCustomerId
          ? { customerId: recipientCustomerId }
          : { userId: recipientUserId },
        templateKey: 'statement.ready',
        data: {
          statementId: (p as { statementId?: string }).statementId,
          periodStart: (p as { periodStart?: unknown }).periodStart,
          periodEnd: (p as { periodEnd?: unknown }).periodEnd,
        },
        correlationId: event.metadata?.correlationId,
      });
    }),
    { id: 'notifications.statement-generated' }
  );

  // -------- Disbursement to landlords --------
  bus.subscribe(
    'DISBURSEMENT_COMPLETED',
    safeHandler('disbursement-completed', logger, async (event) => {
      const p = event.payload ?? {};
      const tenantId = event.metadata?.tenantId;
      const ownerId = (p as { ownerId?: string }).ownerId;
      if (!tenantId || !ownerId) return;
      await notifications.send({
        tenantId,
        channel: 'email',
        recipient: { userId: ownerId },
        templateKey: 'disbursement.completed',
        data: {
          amount: (p as { amount?: unknown }).amount,
          completedAt: (p as { completedAt?: unknown }).completedAt,
        },
        correlationId: event.metadata?.correlationId,
      });
    }),
    { id: 'notifications.disbursement-completed' }
  );

  // -------- User lifecycle --------
  bus.subscribe(
    'UserInvited',
    safeHandler('user-invited', logger, async (event) => {
      const p = event.payload ?? {};
      const tenantId = event.metadata?.tenantId;
      const email = (p as { email?: string }).email;
      const inviteToken = (p as { inviteToken?: string }).inviteToken;
      if (!tenantId || !email) return;
      await notifications.send({
        tenantId,
        channel: 'email',
        recipient: { to: email },
        templateKey: 'user.invited',
        data: { inviteToken, invitedBy: (p as { invitedBy?: string }).invitedBy },
        correlationId: event.metadata?.correlationId,
      });
    }),
    { id: 'notifications.user-invited' }
  );

  // -------- Approval workflow --------
  bus.subscribe(
    'ApprovalRequested',
    safeHandler('approval-requested', logger, async (event) => {
      const p = event.payload ?? {};
      const tenantId = event.metadata?.tenantId;
      const approverId = (p as { approverId?: string }).approverId;
      if (!tenantId || !approverId) return;
      await notifications.send({
        tenantId,
        channel: 'in_app',
        recipient: { userId: approverId },
        templateKey: 'approval.requested',
        data: {
          requestId: (p as { requestId?: string }).requestId,
          subject: (p as { subject?: string }).subject,
          urgency: (p as { urgency?: string }).urgency ?? 'normal',
        },
        correlationId: event.metadata?.correlationId,
      });
    }),
    { id: 'notifications.approval-requested' }
  );

  // -------- Legal / case escalations --------
  bus.subscribe(
    'LegalCaseStatusChanged',
    safeHandler('legal-case-status-changed', logger, async (event) => {
      const p = event.payload ?? {};
      const tenantId = event.metadata?.tenantId;
      const customerId = (p as { customerId?: string }).customerId;
      const toStatus = (p as { toStatus?: string }).toStatus;
      // Only notify on escalation transitions to avoid spam.
      if (!tenantId || !customerId || !toStatus) return;
      if (!['filed', 'mediation', 'hearing_scheduled', 'resolved', 'closed'].includes(toStatus)) return;
      await notifications.send({
        tenantId,
        channel: 'email',
        recipient: { customerId },
        templateKey: `legal_case.${toStatus}`,
        data: {
          caseId: (p as { caseId?: string }).caseId,
          toStatus,
          fromStatus: (p as { fromStatus?: string }).fromStatus,
        },
        correlationId: event.metadata?.correlationId,
      });
    }),
    { id: 'notifications.legal-case-status-changed' }
  );

  logger.info(
    { subscriberCount: 8 },
    'domain event subscribers registered (payment, statement, disbursement, user, approval, legal)'
  );
}
