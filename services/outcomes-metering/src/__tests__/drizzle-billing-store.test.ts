/**
 * Drizzle BillingStore adapter tests (Wave-B money finding #7 —
 * BORN-DARK + FAKE-PERSISTENCE).
 *
 * The adapter is now SHIPPED (no longer a fake in-memory-only store).
 * These tests drive it against a fake Drizzle client that:
 *   - records every SQL fragment it is handed (so we can assert the
 *     money path runs inside ONE `db.transaction`);
 *   - simulates Postgres `ON CONFLICT DO NOTHING ... RETURNING` against
 *     in-memory maps keyed on the real UNIQUE indexes
 *     (`(tenant_id, event_id)` and `(tenant_id, record_id)`);
 *   - binds the RLS GUC via `set_config('app.current_tenant_id', ...)`.
 *
 * What this pins:
 *   1. `commitOutcome` writes the anchor + billing line in ONE
 *      transaction and claims atomically.
 *   2. A duplicate `commitOutcome` is a true replay — `inserted:false`,
 *      and NO second billing line is written.
 *   3. The RLS GUC is bound inside the transaction before any write.
 *   4. `getMonthlyBilling` aggregates the qualified lines.
 */

import { describe, it, expect } from 'vitest';
import type { MeteringRecord } from '@bossnyumba/outcomes';
import {
  createDrizzleBillingStore,
  type DrizzleBillingClient,
  type DrizzleTxLike,
} from '../store/drizzle-billing-store.js';
import type { RecordEventInput } from '../store/billing-store.js';

const TENANT = 't_demo';

interface FakeRow {
  readonly [k: string]: unknown;
}

/**
 * A fake Drizzle client backed by in-memory tables that honour the
 * migration-0169 unique indexes. It inspects the `sql` template's
 * compiled query text to decide which statement is running. The
 * drizzle-orm `sql` tagged template exposes `.queryChunks` / a
 * `getSQL()`; we read the raw string segments via a structural cast.
 */
function createFakeDrizzle(): {
  client: DrizzleBillingClient;
  sqlLog: string[];
  txCount: () => number;
  boundTenants: string[];
  events: Map<string, FakeRow>;
  lines: Map<string, FakeRow>;
} {
  const events = new Map<string, FakeRow>();
  const lines = new Map<string, FakeRow>();
  const sqlLog: string[] = [];
  const boundTenants: string[] = [];
  let txCount = 0;

  // Pull the literal SQL text + the interpolated values out of a
  // drizzle `sql` object. `queryChunks` alternates `StringChunk`
  // (`.value: string[]` — the literal segments) with the raw
  // interpolated values (plain primitives, `null`, or nested SQL
  // objects). We flatten to a text + ordered-params view good enough
  // to route the fake. Params are collected in interpolation order so
  // the adapter's column order maps 1:1.
  function decode(query: unknown): { text: string; params: unknown[] } {
    const chunks =
      (query as { queryChunks?: ReadonlyArray<unknown> }).queryChunks ?? [];
    let text = '';
    const params: unknown[] = [];
    for (const chunk of chunks) {
      const isStringChunk =
        chunk !== null &&
        typeof chunk === 'object' &&
        Array.isArray((chunk as { value?: unknown }).value) &&
        ((chunk as { value: unknown[] }).value).every((v) => typeof v === 'string');
      if (isStringChunk) {
        text += ((chunk as { value: string[] }).value).join('');
        continue;
      }
      const nested = chunk as { queryChunks?: ReadonlyArray<unknown> };
      if (nested && typeof nested === 'object' && Array.isArray(nested.queryChunks)) {
        const sub = decode(nested);
        text += ` ${sub.text} `;
        params.push(...sub.params);
        continue;
      }
      // Raw interpolated value (string/number/boolean/null/Date).
      params.push(chunk);
      text += ' ? ';
    }
    return { text, params };
  }

  async function run(query: unknown): Promise<unknown> {
    const { text, params } = decode(query);
    sqlLog.push(text.replace(/\s+/g, ' ').trim());

    if (text.includes('set_config')) {
      const tenant = params[0];
      if (typeof tenant === 'string') boundTenants.push(tenant);
      return { rows: [] };
    }

    if (text.includes('INSERT INTO outcome_events')) {
      // params order: tenant_id, event_id, outcome_kind, property_id,
      // agent_id, occurred_at_iso, payload, source_event_type
      const tenantId = String(params[0]);
      const eventId = String(params[1]);
      const key = `${tenantId}::${eventId}`;
      if (events.has(key)) return { rows: [] }; // ON CONFLICT DO NOTHING
      events.set(key, { tenantId, eventId });
      return { rows: [{ event_id: eventId }] };
    }

    if (text.includes('INSERT INTO outcome_billing_lines')) {
      // params order: tenant_id, record_id, event_id, outcome_kind,
      // property_id, billing_month, qualified, reason,
      // billable_amount_minor, currency, price_unit_applied,
      // scored_at_iso, clawback_closes_at_iso
      const tenantId = String(params[0]);
      const recordId = String(params[1]);
      const key = `${tenantId}::${recordId}`;
      const hasReturning = text.includes('RETURNING');
      if (lines.has(key)) return { rows: [] };
      lines.set(key, {
        tenantId,
        recordId,
        outcome_kind: params[3],
        billing_month: params[5],
        qualified: params[6],
        billable_amount_minor: params[8],
        currency: params[9],
      });
      return { rows: hasReturning ? [{ record_id: recordId }] : [] };
    }

    if (text.includes('SELECT outcome_kind, currency')) {
      const tenantId = String(params[0]);
      const month = String(params[1]);
      const grouped = new Map<string, { count: number; minor: number }>();
      for (const row of lines.values()) {
        if (row.tenantId !== tenantId) continue;
        if (row.billing_month !== month) continue;
        if (row.qualified !== true) continue;
        const gk = `${String(row.outcome_kind)}::${String(row.currency)}`;
        const cur = grouped.get(gk) ?? { count: 0, minor: 0 };
        cur.count += 1;
        cur.minor += Number(row.billable_amount_minor);
        grouped.set(gk, cur);
      }
      const rows: FakeRow[] = [];
      for (const [gk, agg] of grouped) {
        const [kind, currency] = gk.split('::');
        rows.push({
          outcome_kind: kind,
          currency,
          qualified_count: String(agg.count),
          total_minor: String(agg.minor),
        });
      }
      return { rows };
    }

    return { rows: [] };
  }

  const client: DrizzleBillingClient = {
    execute: (query: unknown) => run(query),
    async transaction<T>(fn: (tx: DrizzleTxLike) => Promise<T>): Promise<T> {
      txCount += 1;
      const tx: DrizzleTxLike = { execute: (query: unknown) => run(query) };
      return fn(tx);
    },
  };

  return {
    client,
    sqlLog,
    txCount: () => txCount,
    boundTenants,
    events,
    lines,
  };
}

function record(over: Partial<MeteringRecord> = {}): MeteringRecord {
  return {
    recordId: 'rec_1',
    outcomeKind: 'vacancy_filled',
    tenantId: TENANT,
    propertyId: 'p_1',
    eventId: 'evt_1',
    qualified: true,
    reason: 'ok',
    billableAmountMinor: 250_000,
    currency: 'USD',
    priceUnitApplied: null,
    scoredAt: '2026-05-20T12:00:00.000Z',
    clawbackClosesAt: '2026-06-03T12:00:00.000Z',
    ...over,
  };
}

function eventInput(over: Partial<RecordEventInput> = {}): RecordEventInput {
  return {
    tenantId: TENANT,
    eventId: 'evt_1',
    outcomeKind: 'vacancy_filled',
    propertyId: 'p_1',
    agentId: 'agent_a',
    occurredAtIso: '2026-05-10T10:00:00.000Z',
    payload: { kind: 'vacancy_filled' } as never,
    sourceEventType: 'http.outcome.event',
    ...over,
  };
}

describe('createDrizzleBillingStore', () => {
  it('commitOutcome writes anchor + billing line in ONE transaction', async () => {
    const fake = createFakeDrizzle();
    const store = createDrizzleBillingStore({ db: fake.client });

    const result = await store.commitOutcome(eventInput(), record());
    expect(result.inserted).toBe(true);
    // One transaction wrapped the whole money path.
    expect(fake.txCount()).toBe(1);
    // Anchor + billing line both landed.
    expect(fake.events.size).toBe(1);
    expect(fake.lines.size).toBe(1);
    // RLS GUC bound before the writes.
    expect(fake.boundTenants).toContain(TENANT);
    expect(fake.sqlLog.some((s) => s.includes('INSERT INTO outcome_events'))).toBe(true);
    expect(fake.sqlLog.some((s) => s.includes('INSERT INTO outcome_billing_lines'))).toBe(true);
  });

  it('a duplicate commitOutcome is a true replay — inserted:false, no second line', async () => {
    const fake = createFakeDrizzle();
    const store = createDrizzleBillingStore({ db: fake.client });

    await store.commitOutcome(eventInput(), record());
    const dup = await store.commitOutcome(
      eventInput(),
      record({ recordId: 'rec_2' }), // even a different recordId must not double-bill
    );
    expect(dup.inserted).toBe(false);
    expect(fake.lines.size).toBe(1); // no second billing line
  });

  it('getMonthlyBilling aggregates the qualified lines', async () => {
    const fake = createFakeDrizzle();
    const store = createDrizzleBillingStore({ db: fake.client });

    await store.commitOutcome(
      eventInput({ eventId: 'evt_a' }),
      record({ recordId: 'rec_a', eventId: 'evt_a', billableAmountMinor: 100_000 }),
    );
    await store.commitOutcome(
      eventInput({ eventId: 'evt_b' }),
      record({ recordId: 'rec_b', eventId: 'evt_b', billableAmountMinor: 50_000 }),
    );

    const agg = await store.getMonthlyBilling(TENANT, '2026-05');
    expect(agg.qualifiedLineCount).toBe(2);
    expect(agg.byOutcome.vacancy_filled.totalBillableMinor).toBe(150_000);
    expect(agg.totalBillableMinor).toBe(150_000);
    expect(agg.dominantCurrency).toBe('USD');
  });
});
