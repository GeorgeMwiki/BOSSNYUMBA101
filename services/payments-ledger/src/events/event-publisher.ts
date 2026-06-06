/**
 * Event Publisher
 * Publishes domain events to the message bus (outbox pattern)
 */
import { v4 as uuidv4 } from 'uuid';
import { TenantId } from '@bossnyumba/domain-models';
import { DomainEvent, PaymentDomainEvent } from './payment-events';
import { logger } from '../logger.js';
import type { RepoTx } from '../repositories/transaction';

/**
 * Outbox entry for transactional event publishing
 */
export interface OutboxEntry {
  id: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: string;
  tenantId: TenantId;
  createdAt: Date;
  publishedAt?: Date;
  retryCount: number;
  lastError?: string;
}

/**
 * Event handler type
 */
export type EventHandler<T extends DomainEvent = DomainEvent> = (event: T) => Promise<void>;

/**
 * Event Publisher Interface
 */
export interface IEventPublisher {
  /**
   * Publish an event (adds to outbox for reliable delivery)
   */
  publish(event: PaymentDomainEvent): Promise<void>;

  /**
   * Publish multiple events atomically
   */
  publishBatch(events: PaymentDomainEvent[]): Promise<void>;

  /**
   * Subscribe to events (for in-process handling)
   */
  subscribe<T extends PaymentDomainEvent>(
    eventType: T['eventType'],
    handler: EventHandler<T>
  ): void;

  /**
   * Unsubscribe from events
   */
  unsubscribe(eventType: string, handler: EventHandler): void;

  /**
   * MUST-FIX 3a — persist events to the durable outbox INSIDE a caller's
   * transaction, WITHOUT notifying in-process handlers. Lets the ledger
   * co-commit `event_outbox` rows atomically with entries + balances so a
   * crash between commit and a separate outbox write cannot lose the
   * event. The caller is responsible for invoking {@link notifySubscribers}
   * AFTER the transaction commits (live delivery must not run for an
   * uncommitted write). Optional so minimal test fakes need not implement
   * it; callers fall back to {@link publish} after commit when absent.
   */
  enqueueToOutbox?(events: PaymentDomainEvent[], tx: RepoTx): Promise<void>;

  /**
   * MUST-FIX 3a — notify ONLY the in-process subscribers for already-
   * persisted events. Called after the transaction commits when the
   * outbox rows were written via {@link enqueueToOutbox} inside the tx.
   * Optional; paired with {@link enqueueToOutbox}.
   */
  notifySubscribers?(events: PaymentDomainEvent[]): Promise<void>;
}

/**
 * Outbox Repository Interface
 */
export interface IOutboxRepository {
  /**
   * Add events to outbox. When `tx` is supplied the rows are written on
   * that transaction so they co-commit with the caller's other writes
   * (MUST-FIX 3a); otherwise they are written on the top-level client.
   */
  addToOutbox(entries: OutboxEntry[], tx?: RepoTx): Promise<void>;

  /**
   * Get unpublished events
   */
  getUnpublished(limit: number): Promise<OutboxEntry[]>;

  /**
   * Mark event as published
   */
  markPublished(id: string): Promise<void>;

  /**
   * Record publish failure
   */
  recordFailure(id: string, error: string): Promise<void>;

  /**
   * Delete old published events
   */
  cleanup(olderThan: Date): Promise<number>;
}

/**
 * In-memory Event Publisher for testing and local development
 */
export class InMemoryEventPublisher implements IEventPublisher {
  private handlers: Map<string, Set<EventHandler>> = new Map();
  private outbox: OutboxEntry[] = [];

  async publish(event: PaymentDomainEvent): Promise<void> {
    // Add to outbox
    const entry: OutboxEntry = {
      id: uuidv4(),
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      eventType: event.eventType,
      payload: JSON.stringify(event),
      tenantId: event.tenantId,
      createdAt: new Date(),
      retryCount: 0
    };
    this.outbox.push(entry);

    // Notify in-process handlers
    await this.notifyHandlers(event);
  }

  async publishBatch(events: PaymentDomainEvent[]): Promise<void> {
    for (const event of events) {
      await this.publish(event);
    }
  }

  subscribe<T extends PaymentDomainEvent>(
    eventType: T['eventType'],
    handler: EventHandler<T>
  ): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler as EventHandler);
  }

  unsubscribe(eventType: string, handler: EventHandler): void {
    const handlers = this.handlers.get(eventType);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  /**
   * MUST-FIX 3a — persist to the in-memory outbox WITHOUT notifying
   * handlers. The InMemory runner has no real transaction, so `tx` is
   * ignored; the contract (outbox row first, notify after commit) is
   * preserved structurally so the same LedgerService code path works in
   * dev/test as in production.
   */
  async enqueueToOutbox(
    events: PaymentDomainEvent[],
    _tx: RepoTx,
  ): Promise<void> {
    for (const event of events) {
      this.outbox.push(toOutboxEntry(event));
    }
  }

  /** MUST-FIX 3a — notify in-process subscribers for committed events. */
  async notifySubscribers(events: PaymentDomainEvent[]): Promise<void> {
    for (const event of events) {
      await this.notifyHandlers(event);
    }
  }

  private async notifyHandlers(event: PaymentDomainEvent): Promise<void> {
    const handlers = this.handlers.get(event.eventType);
    if (handlers) {
      for (const handler of handlers) {
        try {
          await handler(event);
        } catch (error) {
          logger.error(`Error in event handler for ${event.eventType}`, { error: error });
        }
      }
    }
  }

  // Test helpers
  getOutbox(): OutboxEntry[] {
    return [...this.outbox];
  }

  clearOutbox(): void {
    this.outbox = [];
  }
}

/**
 * Durable, outbox-backed Event Publisher (M1).
 *
 * Replaces `InMemoryEventPublisher` on the production path. Every
 * `publish` persists the event to the transactional outbox
 * (`IOutboxRepository` → `event_outbox`) so a relay/worker delivers it
 * at-least-once, surviving restarts and crossing to the api-gateway
 * subscribers. In-process handlers are still notified so same-process
 * subscriptions keep working; a handler that throws is isolated and does
 * NOT undo the durable write (the outbox row is the source of truth for
 * delivery).
 *
 * Sequencing: the outbox table requires a monotone `sequenceNumber` per
 * the relay's ordering. The repository assigns it (see the Drizzle
 * adapter) — the publisher hands over fully-formed domain events and a
 * stable id per entry.
 */
export class DurableEventPublisher implements IEventPublisher {
  private handlers: Map<string, Set<EventHandler>> = new Map();

  constructor(private readonly outbox: IOutboxRepository) {}

  async publish(event: PaymentDomainEvent): Promise<void> {
    await this.outbox.addToOutbox([toOutboxEntry(event)]);
    await this.notifyHandlers(event);
  }

  async publishBatch(events: PaymentDomainEvent[]): Promise<void> {
    if (events.length === 0) return;
    // Single batched write so the relay sees them together.
    await this.outbox.addToOutbox(events.map(toOutboxEntry));
    for (const event of events) {
      await this.notifyHandlers(event);
    }
  }

  subscribe<T extends PaymentDomainEvent>(
    eventType: T['eventType'],
    handler: EventHandler<T>
  ): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler as EventHandler);
  }

  unsubscribe(eventType: string, handler: EventHandler): void {
    this.handlers.get(eventType)?.delete(handler);
  }

  /**
   * MUST-FIX 3a — persist events to the outbox on the caller's tx so they
   * co-commit. No handler notification here; the caller calls
   * {@link notifySubscribers} after the tx commits.
   */
  async enqueueToOutbox(
    events: PaymentDomainEvent[],
    tx: RepoTx,
  ): Promise<void> {
    if (events.length === 0) return;
    await this.outbox.addToOutbox(events.map(toOutboxEntry), tx);
  }

  /** MUST-FIX 3a — notify in-process subscribers for committed events. */
  async notifySubscribers(events: PaymentDomainEvent[]): Promise<void> {
    for (const event of events) {
      await this.notifyHandlers(event);
    }
  }

  private async notifyHandlers(event: PaymentDomainEvent): Promise<void> {
    const handlers = this.handlers.get(event.eventType);
    if (!handlers) return;
    for (const handler of handlers) {
      try {
        await handler(event);
      } catch (error) {
        // Isolate handler failures — the durable outbox row already
        // guarantees the event will be delivered by the relay.
        logger.error(`Error in event handler for ${event.eventType}`, { error });
      }
    }
  }
}

/**
 * Map a domain event onto an outbox entry. The full event is serialised
 * into `payload` so the relay can reconstruct and dispatch it verbatim.
 */
function toOutboxEntry(event: PaymentDomainEvent): OutboxEntry {
  return {
    id: uuidv4(),
    aggregateType: event.aggregateType,
    aggregateId: event.aggregateId,
    eventType: event.eventType,
    payload: JSON.stringify(event),
    tenantId: event.tenantId,
    createdAt: new Date(),
    retryCount: 0,
  };
}

/**
 * Create a domain event helper
 */
export function createEvent<T extends PaymentDomainEvent>(
  eventType: T['eventType'],
  aggregateType: T['aggregateType'],
  aggregateId: string,
  tenantId: TenantId,
  payload: T['payload'],
  options?: {
    correlationId?: string;
    causationId?: string;
    metadata?: Record<string, unknown>;
  }
): T {
  return {
    eventId: uuidv4(),
    eventType,
    aggregateType,
    aggregateId,
    tenantId,
    timestamp: new Date(),
    version: 1,
    payload,
    correlationId: options?.correlationId,
    causationId: options?.causationId,
    metadata: options?.metadata
  } as T;
}
