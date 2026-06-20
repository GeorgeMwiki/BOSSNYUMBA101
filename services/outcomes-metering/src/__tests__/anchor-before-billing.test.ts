/**
 * ANCHOR-BEFORE-BILLING regression tests (Wave-B money finding #6).
 *
 * The old code committed the idempotency anchor BEFORE the billing line,
 * non-transactionally:
 *   - a billing-line failure AFTER the anchor permanently lost revenue;
 *   - a duplicate retry then returned 200 `idempotent: true` (false
 *     success) because the orphaned anchor satisfied the dup check.
 *
 * The fix routes BOTH writes through `store.commitOutcome` in ONE atomic
 * transaction and scores the (pure) outcome BEFORE the claim. These tests
 * pin the new invariants:
 *
 *   1. In-memory store: `commitOutcome` writes the anchor AND the billing
 *      line atomically; a duplicate is a TRUE replay (billing line exists).
 *   2. HTTP route: a `commitOutcome` THROW returns a retryable 503 (NOT
 *      idempotent success), and a subsequent retry SUCCEEDS (the anchor
 *      was never claimed) and produces the billing line.
 *   3. HTTP route: a scorer throw never claims an anchor — a retry with a
 *      valid payload still records the outcome.
 *   4. Bus consumer: a `commitOutcome` THROW does NOT claim the anchor, so
 *      re-delivery reprocesses and lands the billing line.
 */

import { describe, it, expect, vi } from 'vitest';
import type {
  BillingStore,
  CommitOutcomeResult,
  MonthlyBillingAggregate,
  RecordEventInput,
  RecordEventResult,
} from '../store/billing-store.js';
import { createInMemoryBillingStore } from '../store/billing-store.js';
import { buildApp } from '../index.js';
import type { AuthUser } from '../middleware/auth.js';
import { createInMemoryBrainEventBus } from '@bossnyumba/ai-copilot/brain-event-bus';
import type { BrainEvent } from '@bossnyumba/ai-copilot/brain-event-bus';
import { createBrainEventConsumer, OUTCOMES_METERING_EVENT_TYPES } from '../consumers/brain-event-consumer.js';
import type { MeteringRecord } from '@bossnyumba/outcomes';

const TENANT = 't_demo';

const injector = (tenantId: string): ((req: unknown) => AuthUser) =>
  () => ({ userId: 'u_test', tenantId, role: 'user' });

function vacancyPayload(eventId: string) {
  return {
    kind: 'vacancy_filled' as const,
    eventId,
    tenantId: TENANT,
    propertyId: 'p_1',
    agentId: 'agent_a',
    occurredAt: '2026-05-10T10:00:00.000Z',
    confidence: 0.9,
    evidenceHash: 'sha256:abc',
    unitId: 'unit_42',
    leaseId: 'lease_42',
    leaseExecuted: true,
    moveInCompleted: true,
    monthlyRentMinor: 500_000,
    currency: 'USD',
    cancelledWithinWindow: false,
  };
}

/**
 * Wrap a real store so `commitOutcome` throws the FIRST `failTimes` calls
 * then delegates. Models a transient DB fault on the money path.
 */
function flakyCommitStore(inner: BillingStore, failTimes: number): BillingStore {
  let failsLeft = failTimes;
  return {
    async commitOutcome(
      input: RecordEventInput,
      record: MeteringRecord,
    ): Promise<CommitOutcomeResult> {
      if (failsLeft > 0) {
        failsLeft -= 1;
        throw new Error('simulated billing transaction failure');
      }
      return inner.commitOutcome(input, record);
    },
    recordEvent: (i: RecordEventInput): Promise<RecordEventResult> => inner.recordEvent(i),
    recordBillingLine: (r: MeteringRecord): Promise<RecordEventResult> =>
      inner.recordBillingLine(r),
    getMonthlyBilling: (t: string, m: string): Promise<MonthlyBillingAggregate> =>
      inner.getMonthlyBilling(t, m),
  };
}

describe('in-memory commitOutcome atomicity', () => {
  it('writes anchor + billing line atomically; duplicate is a true replay', async () => {
    const store = createInMemoryBillingStore();
    const record: MeteringRecord = {
      recordId: 'rec_1',
      outcomeKind: 'vacancy_filled',
      tenantId: TENANT,
      propertyId: 'p_1',
      eventId: 'evt_atomic_1',
      qualified: true,
      reason: 'ok',
      billableAmountMinor: 250_000,
      currency: 'USD',
      priceUnitApplied: null,
      scoredAt: '2026-05-20T12:00:00.000Z',
      clawbackClosesAt: '2026-06-03T12:00:00.000Z',
    };
    const input: RecordEventInput = {
      tenantId: TENANT,
      eventId: 'evt_atomic_1',
      outcomeKind: 'vacancy_filled',
      propertyId: 'p_1',
      agentId: 'agent_a',
      occurredAtIso: '2026-05-10T10:00:00.000Z',
      payload: { kind: 'vacancy_filled' } as never,
      sourceEventType: 'http.outcome.event',
    };

    const first = await store.commitOutcome(input, record);
    expect(first.inserted).toBe(true);

    const agg = await store.getMonthlyBilling(TENANT, '2026-05');
    expect(agg.byOutcome.vacancy_filled.totalBillableMinor).toBe(250_000);

    // Duplicate — anchor already committed WITH a billing line. No second line.
    const second = await store.commitOutcome(input, record);
    expect(second.inserted).toBe(false);
    const agg2 = await store.getMonthlyBilling(TENANT, '2026-05');
    expect(agg2.byOutcome.vacancy_filled.qualifiedCount).toBe(1);
  });
});

describe('HTTP route — anchor-before-billing fix', () => {
  it('a commit failure returns retryable 503 (NOT idempotent success) and a retry succeeds', async () => {
    const store = flakyCommitStore(createInMemoryBillingStore(), 1);
    const { app } = await buildApp({
      store,
      testAuthInjector: injector(TENANT),
      requireProdAdapters: false,
    });

    // First attempt — commit throws.
    const fail = await app.inject({
      method: 'POST',
      url: '/outcomes/events',
      headers: { 'content-type': 'application/json' },
      payload: vacancyPayload('evt_retry_1'),
    });
    expect(fail.statusCode).toBe(503);
    const failBody = fail.json() as { error: string; retryable: boolean; idempotent?: boolean };
    expect(failBody.error).toBe('billing_commit_failed');
    expect(failBody.retryable).toBe(true);
    // CRITICAL: a post-validation failure must NOT report idempotent success.
    expect(failBody.idempotent).toBeUndefined();

    // Retry — the anchor was never claimed, so this lands a real billing line.
    const ok = await app.inject({
      method: 'POST',
      url: '/outcomes/events',
      headers: { 'content-type': 'application/json' },
      payload: vacancyPayload('evt_retry_1'),
    });
    expect(ok.statusCode).toBe(201);
    const okBody = ok.json() as { idempotent: boolean; billableAmountMinor: number };
    expect(okBody.idempotent).toBe(false);
    expect(okBody.billableAmountMinor).toBe(250_000);

    const agg = await store.getMonthlyBilling(TENANT, new Date().toISOString().slice(0, 7));
    expect(agg.byOutcome.vacancy_filled.totalBillableMinor).toBe(250_000);
  });

  it('a scorer throw never claims an anchor — a later valid retry still records', async () => {
    const store = createInMemoryBillingStore();
    const commitSpy = vi.spyOn(store, 'commitOutcome');
    // Force the scorer to throw by making newRecordId throw — the scorer
    // path runs before commitOutcome, so commitOutcome must never be called.
    let first = true;
    const newRecordId = (): string => {
      if (first) {
        first = false;
        throw new Error('simulated scorer dependency failure');
      }
      return 'rec_after_scorer_recovery';
    };
    const { app } = await buildApp({
      store,
      testAuthInjector: injector(TENANT),
      newRecordId,
      requireProdAdapters: false,
    });

    const boom = await app.inject({
      method: 'POST',
      url: '/outcomes/events',
      headers: { 'content-type': 'application/json' },
      payload: vacancyPayload('evt_scorer_1'),
    });
    expect(boom.statusCode).toBe(500);
    // The anchor was never taken — commitOutcome must not have run.
    expect(commitSpy).not.toHaveBeenCalled();

    const ok = await app.inject({
      method: 'POST',
      url: '/outcomes/events',
      headers: { 'content-type': 'application/json' },
      payload: vacancyPayload('evt_scorer_1'),
    });
    expect(ok.statusCode).toBe(201);
    expect(commitSpy).toHaveBeenCalledTimes(1);
  });
});

describe('bus consumer — anchor-before-billing fix', () => {
  function leaseEvent(eventId: string): BrainEvent {
    return {
      type: OUTCOMES_METERING_EVENT_TYPES.LEASE_SIGNED,
      tenantId: TENANT,
      actorId: 'agent_a',
      subjectId: 'unit_42',
      sourceSystem: 'system',
      observedAt: new Date('2026-05-10T10:00:00.000Z'),
      acl: { userIds: [], roleIds: [] },
      payload: {
        eventId,
        propertyId: 'p_1',
        agentId: 'agent_a',
        occurredAt: '2026-05-10T10:00:00.000Z',
        confidence: 0.95,
        evidenceHash: 'sha256:abc',
        unitId: 'unit_42',
        leaseId: 'lease_42',
        leaseExecuted: true,
        moveInCompleted: true,
        monthlyRentMinor: 500_000,
        currency: 'USD',
        cancelledWithinWindow: false,
      },
    };
  }

  async function settle(): Promise<void> {
    await new Promise((r) => setTimeout(r, 0));
  }

  it('a commit failure leaves the anchor unclaimed so re-delivery reprocesses', async () => {
    const bus = createInMemoryBrainEventBus();
    const store = flakyCommitStore(createInMemoryBillingStore(), 1);
    createBrainEventConsumer({
      bus,
      store,
      clock: () => new Date('2026-05-20T12:00:00.000Z'),
    });

    const ev = leaseEvent('evt_bus_retry_1');
    // First delivery — commitOutcome throws (handler re-throws; bus isolates).
    await bus.publish(ev);
    await settle();
    let agg = await store.getMonthlyBilling(TENANT, '2026-05');
    expect(agg.byOutcome.vacancy_filled.qualifiedCount).toBe(0);

    // Re-delivery — anchor was never claimed, so this lands the billing line.
    await bus.publish(ev);
    await settle();
    agg = await store.getMonthlyBilling(TENANT, '2026-05');
    expect(agg.byOutcome.vacancy_filled.qualifiedCount).toBe(1);
    expect(agg.byOutcome.vacancy_filled.totalBillableMinor).toBe(250_000);
  });
});
