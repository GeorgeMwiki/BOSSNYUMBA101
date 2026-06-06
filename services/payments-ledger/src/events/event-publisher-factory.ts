/**
 * Selects the event publisher (M1) with the same fail-loud-in-prod
 * discipline as the repository + idempotency-store factories:
 *
 *   1. DB client present → durable, outbox-backed publisher. Events are
 *      persisted to `event_outbox` and relayed at-least-once, surviving
 *      restarts and crossing to the api-gateway subscribers.
 *   2. else in production → THROW. The in-memory publisher drops events
 *      on restart and never leaves the process — that is the exact P0 we
 *      are fixing, so we refuse to start.
 *   3. else (dev/test) → in-memory publisher.
 */
import type { DatabaseClient } from '@bossnyumba/database';
import {
  DurableEventPublisher,
  InMemoryEventPublisher,
  type IEventPublisher,
} from './event-publisher';
import { DrizzleOutboxRepository } from '../repositories/drizzle-outbox.repository';

export interface EventPublisherFactoryDeps {
  /** Drizzle client or null when DATABASE_URL is unset / init failed. */
  db: DatabaseClient | null;
  isProduction: boolean;
  logger: {
    warn: (obj: object, msg: string) => void;
    info?: (obj: object, msg: string) => void;
  };
}

export function createEventPublisher(
  deps: EventPublisherFactoryDeps,
): IEventPublisher {
  if (deps.db) {
    deps.logger.info?.(
      { publisher: 'durable-outbox' },
      'event publisher: durable, outbox-backed (event_outbox)',
    );
    return new DurableEventPublisher(new DrizzleOutboxRepository(deps.db));
  }

  if (deps.isProduction) {
    deps.logger.warn(
      { publisher: 'none', reason: 'no_database_url' },
      'event publisher: refusing to start with the in-memory publisher in production',
    );
    throw new Error(
      'Cannot start payments-ledger: no durable event publisher (DATABASE_URL required). ' +
        'The in-memory publisher loses events on restart and never reaches the api-gateway.',
    );
  }

  deps.logger.warn(
    { publisher: 'in-memory', reason: 'dev_or_test_fallback' },
    'event publisher: using in-memory publisher (events NOT durable — dev/test only)',
  );
  return new InMemoryEventPublisher();
}
