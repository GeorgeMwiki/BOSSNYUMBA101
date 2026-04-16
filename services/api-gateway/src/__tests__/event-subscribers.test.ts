/**
 * Domain event subscriber tests.
 *
 * Validates that events published on the bus actually trigger
 * notification dispatches with the right shape. Uses a stub bus +
 * stub dispatcher so the tests don't depend on real infrastructure.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import pino from 'pino';
import {
  registerDomainEventSubscribers,
  type SubscribableBus,
  type DomainEventLike,
  type NotificationDispatcher,
} from '../workers/event-subscribers';

class FakeBus implements SubscribableBus {
  private handlers = new Map<string, (event: DomainEventLike) => Promise<void> | void>();
  subscribe(
    pattern: string,
    handler: (event: DomainEventLike) => Promise<void> | void
  ): string {
    this.handlers.set(pattern, handler);
    return pattern;
  }
  async publish(event: DomainEventLike): Promise<void> {
    const key = event.eventType ?? event.type;
    if (!key) return;
    const h = this.handlers.get(key);
    if (h) await h(event);
  }
}

function createDeps(): {
  bus: FakeBus;
  dispatcher: NotificationDispatcher & { sends: Array<Parameters<NotificationDispatcher['send']>[0]> };
  logger: ReturnType<typeof pino>;
} {
  const bus = new FakeBus();
  const sends: Array<Parameters<NotificationDispatcher['send']>[0]> = [];
  const dispatcher: NotificationDispatcher & { sends: typeof sends } = {
    sends,
    async send(params) {
      sends.push(params);
      return { success: true };
    },
  };
  const logger = pino({ level: 'silent' });
  return { bus, dispatcher, logger };
}

describe('registerDomainEventSubscribers', () => {
  let deps: ReturnType<typeof createDeps>;

  beforeEach(() => {
    deps = createDeps();
    registerDomainEventSubscribers({
      bus: deps.bus,
      notifications: deps.dispatcher,
      logger: deps.logger,
    });
  });

  it('bridges PAYMENT_SUCCEEDED to an SMS to the payer', async () => {
    await deps.bus.publish({
      eventType: 'PAYMENT_SUCCEEDED',
      aggregateType: 'PaymentIntent',
      aggregateId: 'pi_1',
      payload: {
        customerId: 'cust_123',
        amount: { amount: 50000, currency: 'KES' },
        paidAt: new Date('2026-04-16T10:00:00Z'),
        receiptUrl: 'https://bossnyumba.example/receipts/pi_1',
      },
      metadata: { tenantId: 'tnt_1', correlationId: 'cor_1' },
    });

    expect(deps.dispatcher.sends).toHaveLength(1);
    const sent = deps.dispatcher.sends[0];
    expect(sent.tenantId).toBe('tnt_1');
    expect(sent.channel).toBe('sms');
    expect(sent.recipient).toEqual({ customerId: 'cust_123' });
    expect(sent.templateKey).toBe('payment.succeeded');
    expect(sent.data.amount).toEqual({ amount: 50000, currency: 'KES' });
    expect(sent.correlationId).toBe('cor_1');
  });

  it('skips PAYMENT_SUCCEEDED when tenant or customer is missing', async () => {
    await deps.bus.publish({
      eventType: 'PAYMENT_SUCCEEDED',
      payload: { amount: { amount: 100, currency: 'KES' } },
      metadata: {},
    });
    expect(deps.dispatcher.sends).toHaveLength(0);
  });

  it('bridges PAYMENT_FAILED to a failure notice', async () => {
    await deps.bus.publish({
      eventType: 'PAYMENT_FAILED',
      payload: {
        customerId: 'cust_42',
        failureReason: 'insufficient_funds',
        failureCode: 'E101',
      },
      metadata: { tenantId: 'tnt_1' },
    });
    expect(deps.dispatcher.sends).toHaveLength(1);
    expect(deps.dispatcher.sends[0].templateKey).toBe('payment.failed');
    expect(deps.dispatcher.sends[0].data.failureReason).toBe('insufficient_funds');
  });

  it('bridges STATEMENT_GENERATED to owner or customer', async () => {
    await deps.bus.publish({
      eventType: 'STATEMENT_GENERATED',
      payload: {
        statementId: 'stmt_1',
        ownerId: 'usr_owner',
        periodStart: '2026-04-01',
        periodEnd: '2026-04-30',
      },
      metadata: { tenantId: 'tnt_1' },
    });
    expect(deps.dispatcher.sends).toHaveLength(1);
    expect(deps.dispatcher.sends[0].recipient).toEqual({ userId: 'usr_owner' });
    expect(deps.dispatcher.sends[0].channel).toBe('email');
  });

  it('only notifies on escalating legal-case transitions, not draft→pending', async () => {
    // Should NOT notify (not in the allowed transition list)
    await deps.bus.publish({
      eventType: 'LegalCaseStatusChanged',
      payload: {
        caseId: 'case_1',
        customerId: 'cust_1',
        fromStatus: 'draft',
        toStatus: 'pending',
      },
      metadata: { tenantId: 'tnt_1' },
    });
    expect(deps.dispatcher.sends).toHaveLength(0);

    // Should notify
    await deps.bus.publish({
      eventType: 'LegalCaseStatusChanged',
      payload: {
        caseId: 'case_1',
        customerId: 'cust_1',
        fromStatus: 'pending',
        toStatus: 'filed',
      },
      metadata: { tenantId: 'tnt_1' },
    });
    expect(deps.dispatcher.sends).toHaveLength(1);
    expect(deps.dispatcher.sends[0].templateKey).toBe('legal_case.filed');
  });

  it('absorbs dispatcher errors instead of throwing', async () => {
    const { bus, logger } = createDeps();
    const throwingDispatcher: NotificationDispatcher = {
      async send() {
        throw new Error('downstream outage');
      },
    };
    registerDomainEventSubscribers({ bus, notifications: throwingDispatcher, logger });

    // Must not throw — subscriber failures cannot crash the drainer tick.
    await expect(
      bus.publish({
        eventType: 'PAYMENT_SUCCEEDED',
        payload: {
          customerId: 'cust_1',
          amount: { amount: 100, currency: 'KES' },
          paidAt: new Date(),
        },
        metadata: { tenantId: 'tnt_1' },
      })
    ).resolves.toBeUndefined();
  });

  it('registers all expected event types', () => {
    const bus = new FakeBus();
    const spy = vi.spyOn(bus, 'subscribe');
    registerDomainEventSubscribers({
      bus,
      notifications: { async send() { return { success: true }; } },
      logger: pino({ level: 'silent' }),
    });
    const patterns = spy.mock.calls.map((c) => c[0]).sort();
    expect(patterns).toEqual([
      'ApprovalRequested',
      'DISBURSEMENT_COMPLETED',
      'LegalCaseStatusChanged',
      'PAYMENT_FAILED',
      'PAYMENT_REFUNDED',
      'PAYMENT_SUCCEEDED',
      'STATEMENT_GENERATED',
      'UserInvited',
    ]);
  });
});
