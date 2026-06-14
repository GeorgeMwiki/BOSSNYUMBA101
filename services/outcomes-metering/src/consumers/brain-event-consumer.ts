/**
 * Brain-event-bus consumer for the outcomes-metering service.
 *
 * Subscribes to three event types and scores them using the pure
 * primitives in `@bossnyumba/outcomes`:
 *
 *   - `lease.signed`        → vacancy_filled
 *   - `payment.received`    → rent_collected (only when the payment
 *                              completes a monthly aggregate)
 *   - `ticket.resolved`     → ticket_resolved_within_sla
 *
 * The consumer is INTENTIONALLY thin: every domain decision lives in
 * the pure scorers. Our only jobs are:
 *
 *   1. Translate the brain event's `payload` into the typed
 *      `OutcomeEvent` shape the scorer expects (a `kind`-discriminated
 *      union).
 *   2. Idempotency guard: skip when the (tenantId, eventId) pair is
 *      already in the events table.
 *   3. Score → persist → log. Failures swallow into the optional
 *      logger so a malformed payload from one connector cannot
 *      stop the rest of the bus.
 *
 * Tenant scoping: every event carries `tenantId`; the store rejects
 * cross-tenant writes by construction (the store's id key includes
 * tenantId). The subscriber registration here is process-wide, but
 * downstream writes are tenant-scoped.
 */

import { randomUUID } from 'node:crypto';
import {
  scoreRentCollected,
  scoreTicketResolved,
  scoreVacancyFilled,
  type MeteringRecord,
  type OutcomeEvent,
  type RentCollectedEvent,
  type TicketResolvedEvent,
  type VacancyFilledEvent,
} from '@bossnyumba/outcomes';
import type {
  BrainEvent,
  BrainEventSubscriber,
  BrainEventSubscription,
} from '@bossnyumba/ai-copilot/brain-event-bus';
import { recordSecurityEvent } from '@bossnyumba/observability';
import type { BillingStore } from '../store/billing-store.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ConsumerLogger {
  info?(meta: object, msg: string): void;
  warn?(meta: object, msg: string): void;
  error?(meta: object, msg: string): void;
}

export interface BrainEventConsumerDeps {
  readonly bus: BrainEventSubscriber;
  readonly store: BillingStore;
  /** Optional clock for deterministic tests. Defaults to system clock. */
  readonly clock?: () => Date;
  /** Optional record-id minter. Defaults to `randomUUID`. */
  readonly newRecordId?: () => string;
  readonly logger?: ConsumerLogger;
}

export interface BrainEventConsumerHandle {
  /** Detach every subscription this consumer registered. */
  stop(): void;
  /** Subscription handles — useful for tests. */
  readonly subscriptions: ReadonlyArray<BrainEventSubscription>;
}

/**
 * Subscribed event names. Exported so the api-gateway / wiring layer
 * (and tests) can reference them by symbol rather than string.
 */
export const OUTCOMES_METERING_EVENT_TYPES = {
  LEASE_SIGNED: 'lease.signed',
  PAYMENT_RECEIVED: 'payment.received',
  TICKET_RESOLVED: 'ticket.resolved',
} as const;

// ---------------------------------------------------------------------------
// Public factory
// ---------------------------------------------------------------------------

export function createBrainEventConsumer(
  deps: BrainEventConsumerDeps,
): BrainEventConsumerHandle {
  const clock = deps.clock ?? (() => new Date());
  const newRecordId = deps.newRecordId ?? (() => randomUUID());
  const logger = deps.logger;

  const subscriptions: BrainEventSubscription[] = [
    deps.bus.subscribe(OUTCOMES_METERING_EVENT_TYPES.LEASE_SIGNED, async (event) => {
      await handleEvent({
        event,
        toOutcome: leaseSignedToVacancyFilled,
        scoreFn: (evt, recId, nowIso) =>
          scoreVacancyFilled(evt as VacancyFilledEvent, {
            recordId: recId,
            nowIso,
          }),
        deps,
        clock,
        newRecordId,
        logger,
      });
    }),
    deps.bus.subscribe(
      OUTCOMES_METERING_EVENT_TYPES.PAYMENT_RECEIVED,
      async (event) => {
        await handleEvent({
          event,
          toOutcome: paymentReceivedToRentCollected,
          scoreFn: (evt, recId, nowIso) =>
            scoreRentCollected(evt as RentCollectedEvent, {
              recordId: recId,
              nowIso,
            }),
          deps,
          clock,
          newRecordId,
          logger,
        });
      },
    ),
    deps.bus.subscribe(
      OUTCOMES_METERING_EVENT_TYPES.TICKET_RESOLVED,
      async (event) => {
        await handleEvent({
          event,
          toOutcome: ticketResolvedToTicketResolved,
          scoreFn: (evt, recId, nowIso) => {
            // Industry baseline human cost per ticket — minor units
            // (USD cents). Carried as part of the payload when the
            // estate provides it; falls back to a conservative
            // $40 (4000 cents) per the outcomes catalog rationale.
            const evTyped = evt as TicketResolvedEvent;
            const payloadAny = event.payload as {
              humanCostMinor?: number;
            };
            const humanCostMinor =
              typeof payloadAny.humanCostMinor === 'number'
                ? payloadAny.humanCostMinor
                : 4000;
            return scoreTicketResolved(evTyped, {
              recordId: recId,
              nowIso,
              humanCostMinor,
            });
          },
          deps,
          clock,
          newRecordId,
          logger,
        });
      },
    ),
  ];

  return {
    stop(): void {
      for (const sub of subscriptions) sub.unsubscribe();
    },
    subscriptions,
  };
}

// ---------------------------------------------------------------------------
// Internal — translate brain event → typed OutcomeEvent and persist.
// ---------------------------------------------------------------------------

interface HandleEventArgs {
  readonly event: BrainEvent;
  readonly toOutcome: (event: BrainEvent) => OutcomeEvent | null;
  readonly scoreFn: (
    outcome: OutcomeEvent,
    recordId: string,
    nowIso: string,
  ) => MeteringRecord;
  readonly deps: BrainEventConsumerDeps;
  readonly clock: () => Date;
  readonly newRecordId: () => string;
  readonly logger?: ConsumerLogger;
}

async function handleEvent(args: HandleEventArgs): Promise<void> {
  const { event, toOutcome, scoreFn, deps, clock, newRecordId, logger } = args;

  let outcome: OutcomeEvent | null = null;
  try {
    outcome = toOutcome(event);
  } catch (err) {
    logger?.warn?.(
      {
        eventType: event.type,
        tenantId: event.tenantId,
        err: asMessage(err),
      },
      'outcomes-metering: failed to translate brain event → outcome event',
    );
    return;
  }
  if (!outcome) {
    // The translator decided this event does not produce a billable
    // outcome (e.g. partial payment that does not close a month).
    // Not an error — silent skip.
    return;
  }

  // 1. Score (PURE) FIRST — before any DB claim. A scorer throw here
  //    leaves NO row written, so it can never orphan an idempotency
  //    anchor (finding ANCHOR-BEFORE-BILLING).
  let metering: MeteringRecord;
  try {
    metering = scoreFn(outcome, newRecordId(), clock().toISOString());
  } catch (err) {
    logger?.warn?.(
      {
        eventType: event.type,
        tenantId: event.tenantId,
        eventId: outcome.eventId,
        err: asMessage(err),
      },
      'outcomes-metering: scorer threw; no anchor taken, no billing line written',
    );
    return;
  }

  // 2. Commit the anchor + billing line ATOMICALLY (one transaction).
  //    The idempotency claim is taken ONLY when the billing line lands
  //    too. A commit failure leaves the anchor UNCLAIMED so the bus's
  //    at-least-once re-delivery reprocesses cleanly — we surface a
  //    staff alert instead of swallowing a lost-revenue case.
  let inserted: boolean;
  try {
    const result = await deps.store.commitOutcome(
      {
        tenantId: event.tenantId,
        eventId: outcome.eventId,
        outcomeKind: outcome.kind,
        propertyId: outcome.propertyId,
        agentId: outcome.agentId,
        occurredAtIso: outcome.occurredAt,
        payload: outcome,
        sourceEventType: event.type,
      },
      metering,
    );
    inserted = result.inserted;
  } catch (err) {
    logger?.error?.(
      {
        eventType: event.type,
        tenantId: event.tenantId,
        eventId: outcome.eventId,
        recordId: metering.recordId,
        err: asMessage(err),
      },
      'outcomes-metering: billing commit failed — revenue at risk, bus retry expected',
    );
    await emitConsumerCommitFailureAlert({
      eventType: event.type,
      tenantId: event.tenantId,
      eventId: outcome.eventId,
      recordId: metering.recordId,
      err,
    });
    // Re-throw so an at-least-once bus can redeliver. The bus catches
    // handler errors per-subscription (a malformed sibling event never
    // blocks the stream); re-throwing keeps the failed event eligible
    // for retry rather than silently dropping billable revenue.
    throw err instanceof Error ? err : new Error(asMessage(err));
  }

  if (!inserted) {
    logger?.info?.(
      {
        eventType: event.type,
        tenantId: event.tenantId,
        eventId: outcome.eventId,
      },
      'outcomes-metering: duplicate event skipped',
    );
    return;
  }

  logger?.info?.(
    {
      eventType: event.type,
      tenantId: event.tenantId,
      eventId: outcome.eventId,
      recordId: metering.recordId,
      qualified: metering.qualified,
      billableAmountMinor: metering.billableAmountMinor,
    },
    'outcomes-metering: outcome committed (anchor + billing line)',
  );
}

function asMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Staff alert for a consumer-side money-path commit failure. Fires a
 * `critical` security event (routes to SRE per `recordSecurityEvent`
 * semantics) so a dropped billable outcome on the bus path is visible,
 * not silent. Best effort — `recordSecurityEvent` never throws.
 */
async function emitConsumerCommitFailureAlert(args: {
  readonly eventType: string;
  readonly tenantId: string;
  readonly eventId: string;
  readonly recordId: string;
  readonly err: unknown;
}): Promise<void> {
  await recordSecurityEvent({
    action: 'outcomes.consumer.billing_commit_failed',
    resource: 'events',
    severity: 'critical',
    method: 'BUS',
    route: args.eventType,
    tenantId: args.tenantId,
    actorId: null,
    detail: {
      eventId: args.eventId,
      recordId: args.recordId,
      err: asMessage(args.err),
      note: 'anchor + billing line commit failed on the bus path; no anchor claimed; redelivery expected',
    },
  });
}

// ---------------------------------------------------------------------------
// Translators — brain event payload → typed OutcomeEvent.
// ---------------------------------------------------------------------------

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function leaseSignedToVacancyFilled(event: BrainEvent): OutcomeEvent | null {
  const p = event.payload as Readonly<Record<string, unknown>>;
  const eventId = asString(p['eventId']);
  if (!eventId) return null;
  const out: VacancyFilledEvent = {
    kind: 'vacancy_filled',
    eventId,
    tenantId: event.tenantId,
    propertyId: asString(p['propertyId']),
    agentId: asString(p['agentId'], event.actorId ?? 'unknown-agent'),
    occurredAt: asString(p['occurredAt'], event.observedAt.toISOString()),
    confidence: asNumber(p['confidence'], 1),
    evidenceHash: asString(p['evidenceHash'], ''),
    unitId: asString(p['unitId']),
    leaseId: asString(p['leaseId']),
    leaseExecuted: asBoolean(p['leaseExecuted'], true),
    moveInCompleted: asBoolean(p['moveInCompleted'], false),
    monthlyRentMinor: asNumber(p['monthlyRentMinor']),
    currency: asString(p['currency'], 'USD'),
    cancelledWithinWindow: asBoolean(p['cancelledWithinWindow'], false),
  };
  return out;
}

function paymentReceivedToRentCollected(event: BrainEvent): OutcomeEvent | null {
  const p = event.payload as Readonly<Record<string, unknown>>;
  const eventId = asString(p['eventId']);
  if (!eventId) return null;

  // A `payment.received` event only translates to a billable outcome
  // when the connector explicitly marks it as a monthly-close event
  // (`monthClose: true`) so partial / intermediate payments don't
  // double-bill. The outcomes catalog's `rent_collected` scorer is
  // designed for monthly aggregates, not individual line items.
  if (asBoolean(p['monthClose']) !== true) {
    return null;
  }

  const out: RentCollectedEvent = {
    kind: 'rent_collected',
    eventId,
    tenantId: event.tenantId,
    propertyId: asString(p['propertyId']),
    agentId: asString(p['agentId'], event.actorId ?? 'unknown-agent'),
    occurredAt: asString(p['occurredAt'], event.observedAt.toISOString()),
    confidence: asNumber(p['confidence'], 1),
    evidenceHash: asString(p['evidenceHash'], ''),
    billingPeriod: asString(p['billingPeriod']),
    collectedMinor: asNumber(p['collectedMinor']),
    recoveredDelinquencyMinor: asNumber(p['recoveredDelinquencyMinor']),
    baselineCollectedMinor: asNumber(p['baselineCollectedMinor']),
    bankReconciled: asBoolean(p['bankReconciled']),
    chargedBack: asBoolean(p['chargedBack']),
  };
  return out;
}

function ticketResolvedToTicketResolved(
  event: BrainEvent,
): OutcomeEvent | null {
  const p = event.payload as Readonly<Record<string, unknown>>;
  const eventId = asString(p['eventId']);
  if (!eventId) return null;
  const out: TicketResolvedEvent = {
    kind: 'ticket_resolved_within_sla',
    eventId,
    tenantId: event.tenantId,
    propertyId: asString(p['propertyId']),
    agentId: asString(p['agentId'], event.actorId ?? 'unknown-agent'),
    occurredAt: asString(p['occurredAt'], event.observedAt.toISOString()),
    confidence: asNumber(p['confidence'], 1),
    evidenceHash: asString(p['evidenceHash'], ''),
    ticketId: asString(p['ticketId']),
    slaWindowHours: asNumber(p['slaWindowHours']),
    resolutionTimeHours: asNumber(p['resolutionTimeHours']),
    tenantConfirmed: asBoolean(p['tenantConfirmed']),
    reopenedWithinWindow: asBoolean(p['reopenedWithinWindow']),
  };
  return out;
}
