/**
 * M1 (CRITICAL) — events must be durable.
 *
 * `server.ts` wired `InMemoryEventPublisher` (self-labeled test-only) in
 * PRODUCTION → published domain events were lost on restart and never
 * crossed to the api-gateway subscribers. The replacement is a durable,
 * outbox-backed publisher: every `publish` persists the event to the
 * transactional outbox (`event_outbox`) so a relay/worker can deliver it
 * at-least-once even across restarts. In-process handlers are still
 * notified so same-process subscriptions keep working.
 *
 * These tests pin the publisher's contract against an in-memory
 * `IOutboxRepository` (the Drizzle adapter implements the same interface).
 */
import { describe, expect, it } from 'vitest';
import { TenantId } from '@bossnyumba/domain-models';
import {
  DurableEventPublisher,
  type IOutboxRepository,
  type OutboxEntry,
  createEvent,
} from '../events/event-publisher';
import type { PaymentSucceededEvent } from '../events/payment-events';

const TENANT = 'tnt_outbox' as TenantId;

function makeFakeOutbox(): IOutboxRepository & { readonly rows: OutboxEntry[] } {
  const rows: OutboxEntry[] = [];
  return {
    rows,
    async addToOutbox(entries: OutboxEntry[]): Promise<void> {
      rows.push(...entries);
    },
    async getUnpublished(limit: number): Promise<OutboxEntry[]> {
      return rows.filter((r) => !r.publishedAt).slice(0, limit);
    },
    async markPublished(id: string): Promise<void> {
      const r = rows.find((x) => x.id === id);
      if (r) r.publishedAt = new Date();
    },
    async recordFailure(id: string, error: string): Promise<void> {
      const r = rows.find((x) => x.id === id);
      if (r) {
        r.retryCount += 1;
        r.lastError = error;
      }
    },
    async cleanup(): Promise<number> {
      return 0;
    },
  };
}

function paymentSucceeded() {
  return createEvent<PaymentSucceededEvent>(
    'PAYMENT_SUCCEEDED',
    'PaymentIntent',
    'pi_outbox_1',
    TENANT,
    {
      customerId: 'cust_1' as never,
      amount: { amountMinorUnits: 1000, currency: 'TZS' } as never,
      paidAt: new Date(),
    },
  );
}

describe('DurableEventPublisher (M1)', () => {
  it('persists every published event to the outbox', async () => {
    const outbox = makeFakeOutbox();
    const publisher = new DurableEventPublisher(outbox);

    await publisher.publish(paymentSucceeded());

    expect(outbox.rows).toHaveLength(1);
    const row = outbox.rows[0];
    expect(row.eventType).toBe('PAYMENT_SUCCEEDED');
    expect(row.aggregateType).toBe('PaymentIntent');
    expect(row.aggregateId).toBe('pi_outbox_1');
    expect(row.tenantId).toBe(TENANT);
    // Payload is the serialised event so the relay can reconstruct it.
    expect(JSON.parse(row.payload).eventType).toBe('PAYMENT_SUCCEEDED');
    // Newly written, not yet relayed.
    expect(row.publishedAt).toBeUndefined();
  });

  it('persists a batch atomically (one addToOutbox call)', async () => {
    const outbox = makeFakeOutbox();
    let calls = 0;
    const spy: IOutboxRepository = {
      ...outbox,
      async addToOutbox(entries) {
        calls += 1;
        await outbox.addToOutbox(entries);
      },
    };
    const publisher = new DurableEventPublisher(spy);

    await publisher.publishBatch([paymentSucceeded(), paymentSucceeded()]);

    expect(outbox.rows).toHaveLength(2);
    expect(calls).toBe(1); // single batched write, not one-per-event
  });

  it('still notifies in-process subscribers (same-process delivery preserved)', async () => {
    const outbox = makeFakeOutbox();
    const publisher = new DurableEventPublisher(outbox);

    const received: string[] = [];
    publisher.subscribe<PaymentSucceededEvent>('PAYMENT_SUCCEEDED', async (e) => {
      received.push(e.aggregateId);
    });

    await publisher.publish(paymentSucceeded());

    expect(received).toEqual(['pi_outbox_1']);
    // And it was still persisted.
    expect(outbox.rows).toHaveLength(1);
  });

  it('a throwing in-process handler does not prevent durable persistence', async () => {
    const outbox = makeFakeOutbox();
    const publisher = new DurableEventPublisher(outbox);
    publisher.subscribe<PaymentSucceededEvent>('PAYMENT_SUCCEEDED', async () => {
      throw new Error('subscriber blew up');
    });

    // Must not throw — the durable write is what matters; handler errors
    // are isolated (the relay/worker is the source of truth for delivery).
    await expect(publisher.publish(paymentSucceeded())).resolves.toBeUndefined();
    expect(outbox.rows).toHaveLength(1);
  });
});
