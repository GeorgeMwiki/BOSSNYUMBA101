/**
 * Unit tests for the market-surveillance composition wiring.
 *
 * These tests verify the wiring contract — degraded fall-through when
 * no DB client is provided, the stub-port marker, the empty
 * `listActiveUnits` no-op contract, and `insertSnapshot` delegation to
 * the underlying Drizzle service. They do NOT exercise the agent's own
 * pipeline (those tests live in
 * packages/ai-copilot/src/ai-native/__tests__/market-surveillance.test.ts).
 *
 * The Drizzle client is faked with a chainable recorder identical in
 * spirit to agency-binding.test.ts, so the surveillance loop can run
 * end-to-end without a real Postgres.
 */

import { describe, it, expect } from 'vitest';
import {
  STUB_ADAPTER_ID,
  createDrizzleMarketSurveillanceRepository,
  createMarketSurveillanceWiring,
  createStubMarketRatePort,
} from '../market-surveillance-wiring';
import type { MarketRateSnapshot } from '@bossnyumba/ai-copilot/ai-native';

// ---------------------------------------------------------------------------
// Fake Drizzle client — minimal chainable shape that records every insert
// invocation. We only need `db.insert(table).values(...)` to resolve for
// the storage adapter's `insert` path; reads are not exercised here.
// ---------------------------------------------------------------------------

interface FakeInsertCall {
  readonly table: unknown;
  readonly values: unknown;
}

interface FakeDb {
  __inserts: FakeInsertCall[];
  insert(table: unknown): {
    values(values: unknown): Promise<void>;
  };
  select(): {
    from(table: unknown): {
      where(args: unknown): {
        orderBy(args: unknown): {
          limit(n: number): Promise<readonly unknown[]>;
        };
      };
    };
  };
}

function createFakeDb(): FakeDb {
  const inserts: FakeInsertCall[] = [];
  const db: FakeDb = {
    __inserts: inserts,
    insert(table) {
      return {
        async values(values) {
          inserts.push({ table, values });
        },
      };
    },
    select() {
      return {
        from() {
          return {
            where() {
              return {
                orderBy() {
                  return {
                    async limit() {
                      return [];
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  };
  return db;
}

function makeSnapshot(overrides: Partial<MarketRateSnapshot> = {}): MarketRateSnapshot {
  return {
    id: 'mrss_test_1',
    tenantId: 't1',
    unitId: 'u1',
    propertyId: 'p1',
    currencyCode: 'TZS',
    ourRentMinor: 250_000,
    marketMedianMinor: null,
    marketP25Minor: null,
    marketP75Minor: null,
    marketSampleSize: 0,
    deltaPct: null,
    driftFlag: null,
    compRadiusKm: 2,
    sourceAdapter: STUB_ADAPTER_ID,
    sourceMetadata: { comparableCount: 0 },
    modelVersion: 'degraded',
    promptHash: null,
    observedAt: '2026-05-08T00:00:00.000Z',
    ...overrides,
  };
}

describe('market-surveillance-wiring', () => {
  it('returns null when db is absent (degraded mode) and warns via logger', () => {
    const warnings: Array<{ meta: object; msg: string }> = [];
    const wiring = createMarketSurveillanceWiring({
      db: null,
      logger: {
        warn(meta, msg) {
          warnings.push({ meta, msg });
        },
      },
    });
    expect(wiring).toBeNull();
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.msg).toMatch(/no database client/);
  });

  it('returns wiring with .agent when db is provided', () => {
    const db = createFakeDb();
    const wiring = createMarketSurveillanceWiring({
      db: db as unknown as Parameters<typeof createMarketSurveillanceWiring>[0]['db'],
    });
    expect(wiring).not.toBeNull();
    expect(typeof wiring?.agent.scanTenant).toBe('function');
    expect(typeof wiring?.agent.scanUnit).toBe('function');
    expect(typeof wiring?.agent.listRecentSnapshots).toBe('function');
  });

  it('stub market-rate port advertises the not-configured adapterId and returns no comparables', async () => {
    const port = createStubMarketRatePort();
    expect(port.adapterId).toBe(STUB_ADAPTER_ID);
    const comps = await port.fetchComparables({
      tenantId: 't1',
      unitId: 'u1',
      latitude: null,
      longitude: null,
      radiusKm: 2,
      bedrooms: null,
    });
    expect(comps).toEqual([]);
  });

  it('listActiveUnits returns [] until the units adapter lands; scanTenant tolerates the empty list', async () => {
    const db = createFakeDb();
    const repo = createDrizzleMarketSurveillanceRepository(
      db as unknown as Parameters<typeof createDrizzleMarketSurveillanceRepository>[0],
    );
    const units = await repo.listActiveUnits('t1');
    expect(units).toEqual([]);

    // And confirm the surveillance loop tolerates this — scanTenant should
    // resolve with an empty snapshot array, not throw.
    const wiring = createMarketSurveillanceWiring({
      db: db as unknown as Parameters<typeof createMarketSurveillanceWiring>[0]['db'],
    });
    const out = await wiring!.agent.scanTenant('t1');
    expect(out).toEqual([]);
    // No insert was issued because there were no units to scan.
    expect(db.__inserts).toHaveLength(0);
  });

  it('repo adapter delegates insertSnapshot to the underlying Drizzle service', async () => {
    const db = createFakeDb();
    const repo = createDrizzleMarketSurveillanceRepository(
      db as unknown as Parameters<typeof createDrizzleMarketSurveillanceRepository>[0],
    );
    const snapshot = makeSnapshot({ id: 'mrss_alpha', tenantId: 'tenant-a', unitId: 'unit-a' });
    const stored = await repo.insertSnapshot(snapshot);

    expect(stored.id).toBe('mrss_alpha');
    expect(stored.sourceAdapter).toBe(STUB_ADAPTER_ID);
    expect(db.__inserts).toHaveLength(1);

    // The DB service column rename `ourRentMinor` -> `ourRentAmountMinor`
    // happens inside the storage adapter, so the recorded `values` payload
    // should carry the renamed column.
    const written = db.__inserts[0]?.values as Record<string, unknown>;
    expect(written.id).toBe('mrss_alpha');
    expect(written.tenantId).toBe('tenant-a');
    expect(written.unitId).toBe('unit-a');
    expect(written.ourRentAmountMinor).toBe(250_000);
    expect(written.sourceAdapter).toBe(STUB_ADAPTER_ID);
  });
});
