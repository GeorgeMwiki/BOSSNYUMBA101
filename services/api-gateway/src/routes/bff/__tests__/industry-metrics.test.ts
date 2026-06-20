/**
 * industry-metrics — pure aggregator unit tests (live detectors).
 *
 * Drives `computeIndustrySlot` / `computeAllIndustrySlots` against a
 * fake drizzle handle so the maths is verified without a live DB:
 *
 *   - occupancy %    = occupied / (occupied + vacant), 1dp
 *   - vendor reopen  = reopened / total, 1dp
 *   - renewal rate   = accepted / (accepted + declined), 1dp
 *   - sentiment      = avg(current_sentiment 0..1) → 0..100
 *   - maintenance    = avg(completed-created) seconds → days, 1dp
 *   - arrears        = open-case count, integer
 *   - unknown slot   → null (caller maps to 404)
 *   - query throw    → null (caller maps to 503, never a fabricated 0)
 */

import { describe, it, expect } from 'vitest';
import {
  units,
  workOrders,
  leases,
  arrearsCases,
  frictionFingerprints,
} from '@bossnyumba/database';
import {
  computeIndustrySlot,
  computeAllIndustrySlots,
  INDUSTRY_SLOT_KEYS,
} from '../industry-metrics';

type Rows = ReadonlyArray<Record<string, unknown>>;

/**
 * A fake drizzle select-chain. Every terminal method (`where`,
 * `groupBy`) — and the builder itself — is awaitable and resolves to the
 * rows seeded for the table handed to `.from()`. A `byTable` resolver
 * lets a single chain serve multiple `.from()` targets (vendor-reopen
 * issues two queries against `work_orders`); a per-call counter lets the
 * total/reopened pair return different rows.
 */
function fakeDb(resolve: (table: unknown, callIndex: number) => Rows) {
  let callIndex = -1;
  // Snapshot callIndex per query at select() time and thread it through the
  // chain. The handler issues some queries CONCURRENTLY (Promise.all, e.g.
  // vendor-reopen's total+reopened), so reading the shared mutable callIndex
  // lazily at await would make every concurrent query see the FINAL index and
  // resolve to the same rows (total === reopened → 100%). Binding the snapshot
  // keeps each query tied to the index it was built with.
  function makeChain(table: unknown, idx: number) {
    const rows = () => resolve(table, idx);
    const chain: Record<string, unknown> = {
      from(t: unknown) {
        return makeChain(t, idx);
      },
      where() {
        return makeChain(table, idx);
      },
      groupBy() {
        return makeChain(table, idx);
      },
      then(onFulfilled: (v: Rows) => unknown) {
        return Promise.resolve(rows()).then(onFulfilled);
      },
    };
    return chain;
  }
  return {
    select() {
      callIndex += 1;
      return makeChain(undefined, callIndex);
    },
  };
}

describe('industry-metrics — occupancy', () => {
  it('computes occupancy % from occupied vs vacant units', async () => {
    const db = fakeDb((table) =>
      table === units
        ? [
            { status: 'occupied', value: 80 },
            { status: 'vacant', value: 20 },
            { status: 'under_maintenance', value: 5 },
          ]
        : [],
    );
    const out = await computeIndustrySlot(db, 'occupancy-by-class');
    expect(out).toEqual({ metric: 'occupancy_rate', value: 80, unit: '%' });
  });

  it('returns 0% when there are no occupied or vacant units', async () => {
    const db = fakeDb(() => []);
    const out = await computeIndustrySlot(db, 'occupancy-by-class');
    expect(out?.value).toBe(0);
  });
});

describe('industry-metrics — vendor reopen rate', () => {
  it('computes reopened / total as a percent (1dp)', async () => {
    // First select() → total (40), second select() → reopened (3).
    const db = fakeDb((table, callIndex) => {
      if (table !== workOrders) return [];
      return callIndex === 0 ? [{ value: 40 }] : [{ value: 3 }];
    });
    const out = await computeIndustrySlot(db, 'vendor-reopen-rate');
    expect(out).toEqual({
      metric: 'vendor_reopen_rate',
      value: 7.5,
      unit: '%',
    });
  });
});

describe('industry-metrics — renewal rate', () => {
  it('computes accepted / (accepted + declined) (1dp)', async () => {
    const db = fakeDb((table) =>
      table === leases
        ? [
            { renewalStatus: 'accepted', value: 30 },
            { renewalStatus: 'declined', value: 10 },
          ]
        : [],
    );
    const out = await computeIndustrySlot(db, 'renewal-rate');
    expect(out).toEqual({ metric: 'renewal_rate', value: 75, unit: '%' });
  });
});

describe('industry-metrics — sentiment index', () => {
  it('scales mean current_sentiment (0..1) to a 0..100 index', async () => {
    const db = fakeDb((table) =>
      table === frictionFingerprints ? [{ value: '0.732' }] : [],
    );
    const out = await computeIndustrySlot(db, 'sentiment-index');
    expect(out).toEqual({ metric: 'sentiment_index', value: 73.2, unit: '/100' });
  });

  it('returns 0 when no fingerprints carry a sentiment', async () => {
    const db = fakeDb((table) =>
      table === frictionFingerprints ? [{ value: null }] : [],
    );
    const out = await computeIndustrySlot(db, 'sentiment-index');
    expect(out?.value).toBe(0);
  });
});

describe('industry-metrics — maintenance time-to-close', () => {
  it('converts avg seconds to days (1dp)', async () => {
    // 3.5 days in seconds = 302400.
    const db = fakeDb((table) =>
      table === workOrders ? [{ value: 302_400 }] : [],
    );
    const out = await computeIndustrySlot(db, 'maintenance-ttc');
    expect(out).toEqual({ metric: 'maintenance_ttc', value: 3.5, unit: 'days' });
  });
});

describe('industry-metrics — arrears headline', () => {
  it('returns the open-arrears case count as an integer', async () => {
    const db = fakeDb((table) =>
      table === arrearsCases ? [{ value: 17 }] : [],
    );
    const out = await computeIndustrySlot(db, 'arrears-by-jurisdiction');
    expect(out).toEqual({
      metric: 'open_arrears_cases',
      value: 17,
      unit: 'cases',
    });
  });
});

describe('industry-metrics — failure + unknown slot semantics', () => {
  it('returns null for an unknown slot key (→ 404 upstream)', async () => {
    const db = fakeDb(() => []);
    const out = await computeIndustrySlot(db, 'totally-made-up');
    expect(out).toBeNull();
  });

  it('returns null (not a fabricated 0) when the query throws', async () => {
    const throwingDb = {
      select() {
        return {
          from() {
            throw new Error('db exploded');
          },
        };
      },
    };
    const out = await computeIndustrySlot(throwingDb, 'occupancy-by-class');
    expect(out).toBeNull();
  });

  it('computeAllIndustrySlots returns an entry for every known slot', async () => {
    const db = fakeDb(() => []);
    const all = await computeAllIndustrySlots(db);
    for (const key of INDUSTRY_SLOT_KEYS) {
      expect(Object.prototype.hasOwnProperty.call(all, key)).toBe(true);
    }
  });
});
