/**
 * M1 — selection of the event publisher.
 *
 *   - DB client present → durable, outbox-backed publisher.
 *   - else in production → THROW (in-memory drops events on restart —
 *     the bug we are fixing).
 *   - else (dev/test) → in-memory publisher.
 */
import { describe, expect, it, vi } from 'vitest';
import {
  createEventPublisher,
  type EventPublisherFactoryDeps,
} from '../events/event-publisher-factory';
import {
  DurableEventPublisher,
  InMemoryEventPublisher,
} from '../events/event-publisher';

const logger = { warn: vi.fn(), info: vi.fn() };

function fakeDb() {
  return {} as unknown as EventPublisherFactoryDeps['db'];
}

describe('createEventPublisher (M1)', () => {
  it('returns a durable outbox-backed publisher when a db client is present', () => {
    const pub = createEventPublisher({ db: fakeDb(), isProduction: true, logger });
    expect(pub).toBeInstanceOf(DurableEventPublisher);
  });

  it('THROWS in production when no db client is available', () => {
    expect(() =>
      createEventPublisher({ db: null, isProduction: true, logger }),
    ).toThrow(/durable event publisher|outbox/i);
  });

  it('falls back to in-memory in dev/test when no db client is available', () => {
    const pub = createEventPublisher({ db: null, isProduction: false, logger });
    expect(pub).toBeInstanceOf(InMemoryEventPublisher);
  });
});
