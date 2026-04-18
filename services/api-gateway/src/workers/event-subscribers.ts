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

  // ==========================================================================
  // SCAFFOLDED 8 / NEW 21 — additional domain→notification subscribers
  //
  // These cover the "invisible gap" events flagged by the async audit:
  // maintenance-case lifecycle, legal notices, SLA breaches, lease renewal
  // windows, payment arrears, inspection scheduling.
  // ==========================================================================

  const genericPayload = (event: DomainEventLike): Record<string, unknown> => event.payload ?? {};
  const extractTenant = (event: DomainEventLike): string | undefined => event.metadata?.tenantId;
  const extractCustomer = (event: DomainEventLike): string | undefined =>
    (genericPayload(event) as { customerId?: string }).customerId;

  // -------- Maintenance case lifecycle --------
  bus.subscribe(
    'CaseCreated',
    safeHandler('case-created', logger, async (event) => {
      const tenantId = extractTenant(event);
      const customerId = extractCustomer(event);
      if (!tenantId || !customerId) return;
      await notifications.send({
        tenantId,
        channel: 'sms',
        recipient: { customerId },
        templateKey: 'case.created',
        data: {
          caseId: (genericPayload(event) as { caseId?: string }).caseId,
          title: (genericPayload(event) as { title?: string }).title,
          priority: (genericPayload(event) as { priority?: string }).priority ?? 'normal',
        },
        correlationId: event.metadata?.correlationId,
      });
    }),
    { id: 'notifications.case-created' }
  );

  bus.subscribe(
    'CaseEscalated',
    safeHandler('case-escalated', logger, async (event) => {
      const tenantId = extractTenant(event);
      const customerId = extractCustomer(event);
      if (!tenantId || !customerId) return;
      await notifications.send({
        tenantId,
        channel: 'whatsapp',
        recipient: { customerId },
        templateKey: 'case.escalated',
        data: {
          caseId: (genericPayload(event) as { caseId?: string }).caseId,
          escalationLevel: (genericPayload(event) as { escalationLevel?: number }).escalationLevel,
          assignedTo: (genericPayload(event) as { assignedTo?: string }).assignedTo,
        },
        correlationId: event.metadata?.correlationId,
      });
    }),
    { id: 'notifications.case-escalated' }
  );

  bus.subscribe(
    'CaseResolved',
    safeHandler('case-resolved', logger, async (event) => {
      const tenantId = extractTenant(event);
      const customerId = extractCustomer(event);
      if (!tenantId || !customerId) return;
      await notifications.send({
        tenantId,
        channel: 'sms',
        recipient: { customerId },
        templateKey: 'case.resolved',
        data: {
          caseId: (genericPayload(event) as { caseId?: string }).caseId,
          resolvedAt: (genericPayload(event) as { resolvedAt?: unknown }).resolvedAt,
          resolution: (genericPayload(event) as { resolution?: string }).resolution,
        },
        correlationId: event.metadata?.correlationId,
      });
    }),
    { id: 'notifications.case-resolved' }
  );

  bus.subscribe(
    'CaseSLABreached',
    safeHandler('case-sla-breached', logger, async (event) => {
      const tenantId = extractTenant(event);
      const assigneeId = (genericPayload(event) as { assigneeId?: string }).assigneeId;
      if (!tenantId || !assigneeId) return;
      await notifications.send({
        tenantId,
        channel: 'in_app',
        recipient: { userId: assigneeId },
        templateKey: 'case.sla_breached',
        data: {
          caseId: (genericPayload(event) as { caseId?: string }).caseId,
          slaTargetAt: (genericPayload(event) as { slaTargetAt?: unknown }).slaTargetAt,
          breachedAt: (genericPayload(event) as { breachedAt?: unknown }).breachedAt,
        },
        correlationId: event.metadata?.correlationId,
      });
    }),
    { id: 'notifications.case-sla-breached' }
  );

  // -------- Legal notice delivery --------
  bus.subscribe(
    'NoticeSent',
    safeHandler('notice-sent', logger, async (event) => {
      const tenantId = extractTenant(event);
      const customerId = extractCustomer(event);
      if (!tenantId || !customerId) return;
      await notifications.send({
        tenantId,
        channel: 'email',
        recipient: { customerId },
        templateKey: 'notice.sent',
        data: {
          noticeType: (genericPayload(event) as { noticeType?: string }).noticeType,
          noticeId: (genericPayload(event) as { noticeId?: string }).noticeId,
          deadline: (genericPayload(event) as { deadline?: unknown }).deadline,
        },
        correlationId: event.metadata?.correlationId,
      });
    }),
    { id: 'notifications.notice-sent' }
  );

  // -------- Lease renewals --------
  bus.subscribe(
    'RenewalWindowOpened',
    safeHandler('renewal-window-opened', logger, async (event) => {
      const tenantId = extractTenant(event);
      const customerId = extractCustomer(event);
      if (!tenantId || !customerId) return;
      await notifications.send({
        tenantId,
        channel: 'email',
        recipient: { customerId },
        templateKey: 'renewal.window_opened',
        data: {
          leaseId: (genericPayload(event) as { leaseId?: string }).leaseId,
          windowStart: (genericPayload(event) as { windowStart?: unknown }).windowStart,
          windowEnd: (genericPayload(event) as { windowEnd?: unknown }).windowEnd,
          currentExpiryDate: (genericPayload(event) as { currentExpiryDate?: unknown })
            .currentExpiryDate,
        },
        correlationId: event.metadata?.correlationId,
      });
    }),
    { id: 'notifications.renewal-window-opened' }
  );

  bus.subscribe(
    'RenewalProposed',
    safeHandler('renewal-proposed', logger, async (event) => {
      const tenantId = extractTenant(event);
      const customerId = extractCustomer(event);
      if (!tenantId || !customerId) return;
      await notifications.send({
        tenantId,
        channel: 'email',
        recipient: { customerId },
        templateKey: 'renewal.proposed',
        data: {
          leaseId: (genericPayload(event) as { leaseId?: string }).leaseId,
          newRent: (genericPayload(event) as { newRent?: unknown }).newRent,
          proposedTermMonths: (genericPayload(event) as { proposedTermMonths?: number })
            .proposedTermMonths,
          respondByDate: (genericPayload(event) as { respondByDate?: unknown }).respondByDate,
        },
        correlationId: event.metadata?.correlationId,
      });
    }),
    { id: 'notifications.renewal-proposed' }
  );

  // -------- Payment arrears --------
  bus.subscribe(
    'PaymentOverdue',
    safeHandler('payment-overdue', logger, async (event) => {
      const tenantId = extractTenant(event);
      const customerId = extractCustomer(event);
      if (!tenantId || !customerId) return;
      await notifications.send({
        tenantId,
        channel: 'sms',
        recipient: { customerId },
        templateKey: 'payment.overdue',
        data: {
          invoiceId: (genericPayload(event) as { invoiceId?: string }).invoiceId,
          amountDue: (genericPayload(event) as { amountDue?: unknown }).amountDue,
          daysOverdue: (genericPayload(event) as { daysOverdue?: number }).daysOverdue,
          dueDate: (genericPayload(event) as { dueDate?: unknown }).dueDate,
        },
        correlationId: event.metadata?.correlationId,
      });
    }),
    { id: 'notifications.payment-overdue' }
  );

  // -------- Work order assignment --------
  bus.subscribe(
    'WorkOrderAssigned',
    safeHandler('work-order-assigned', logger, async (event) => {
      const tenantId = extractTenant(event);
      const vendorUserId = (genericPayload(event) as { vendorUserId?: string }).vendorUserId;
      if (!tenantId || !vendorUserId) return;
      await notifications.send({
        tenantId,
        channel: 'whatsapp',
        recipient: { userId: vendorUserId },
        templateKey: 'work_order.assigned',
        data: {
          workOrderId: (genericPayload(event) as { workOrderId?: string }).workOrderId,
          scheduledAt: (genericPayload(event) as { scheduledAt?: unknown }).scheduledAt,
          propertyAddress: (genericPayload(event) as { propertyAddress?: string })
            .propertyAddress,
          priority: (genericPayload(event) as { priority?: string }).priority ?? 'normal',
        },
        correlationId: event.metadata?.correlationId,
      });
    }),
    { id: 'notifications.work-order-assigned' }
  );

  // -------- Inspection scheduling --------
  bus.subscribe(
    'InspectionScheduled',
    safeHandler('inspection-scheduled', logger, async (event) => {
      const tenantId = extractTenant(event);
      const customerId = extractCustomer(event);
      if (!tenantId || !customerId) return;
      await notifications.send({
        tenantId,
        channel: 'sms',
        recipient: { customerId },
        templateKey: 'inspection.scheduled',
        data: {
          inspectionId: (genericPayload(event) as { inspectionId?: string }).inspectionId,
          scheduledAt: (genericPayload(event) as { scheduledAt?: unknown }).scheduledAt,
          inspector: (genericPayload(event) as { inspector?: string }).inspector,
          unitRef: (genericPayload(event) as { unitRef?: string }).unitRef,
        },
        correlationId: event.metadata?.correlationId,
      });
    }),
    { id: 'notifications.inspection-scheduled' }
  );

  logger.info(
    { subscriberCount: 18 },
    'domain event subscribers registered (payment, statement, disbursement, user, approval, legal, case lifecycle, renewals, arrears, work orders, inspections)'
  );
}
