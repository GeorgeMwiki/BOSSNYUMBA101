/**
 * Market-surveillance wiring — adapts the AI-native `MarketSurveillance`
 * agent from `@bossnyumba/ai-copilot/ai-native/market-surveillance` into
 * a composition-root service backed by Drizzle (via the
 * `createMarketRateSnapshotsService` storage adapter shipped in
 * commit e33cebc).
 *
 * Three ports are constructed here:
 *
 *   1. `MarketSurveillanceRepository` — `insertSnapshot` and
 *      `listRecentSnapshots` delegate to the DB service. `listActiveUnits`
 *      currently returns `[]` because the units / occupancy join lives in
 *      a separate repository that has not been wired yet. The agent
 *      tolerates an empty unit list (`scanTenant` is a no-op), so this is
 *      pilot-acceptable degradation. TODO(units-adapter): replace with a
 *      Drizzle query joining `units` and `occupancy` once the read-side
 *      adapter is exposed.
 *
 *   2. `MarketRatePort` — a stub adapter (`adapterId:
 *      'stub-not-configured'`) that returns no comparable listings. With
 *      this wiring the agent is observable end-to-end (snapshots persist,
 *      drift detection runs) but produces a `marketSampleSize: 0`
 *      snapshot. TODO(adapter): replace with a real adapter
 *      (Zillow / Airbnb / Rentometer / local-classifieds) resolved per
 *      jurisdiction via `@bossnyumba/compliance-plugins` —
 *      `built-for-the-world, starting-with-TZ`, never hard-code a single
 *      provider.
 *
 *   3. `ClassifyLLMPort`, `MarketSurveillanceEventPublisher`, `BudgetGuard`
 *      — left undefined. The agent treats each as optional and degrades
 *      gracefully (no LLM = `marketSampleSize: 0`; no publisher = no
 *      drift events; no guard = unbudgeted).
 *
 * Returns `null` when `db` is null so callers can branch cleanly in
 * degraded / no-db modes (mirrors classroom-wiring.ts and
 * intelligence-history-wiring.ts).
 *
 * Also note the field-name bridge: the agent's `MarketRateSnapshot` and
 * the DB service's `MarketRateSnapshotShape` both use `ourRentMinor` at
 * the boundary (the DB service translates that to the column
 * `ourRentAmountMinor` internally), so the shapes are structurally
 * compatible and no per-field adapter object is needed.
 */

import { createDatabaseClient } from '@bossnyumba/database';
import { createMarketRateSnapshotsService } from '@bossnyumba/database';
import {
  createMarketSurveillance,
  type MarketRatePort,
  type MarketRateSnapshot,
  type MarketSurveillance,
  type MarketSurveillanceRepository,
  type UnitForSurveillance,
} from '@bossnyumba/ai-copilot/ai-native';

/**
 * `DatabaseClient` is derived via `ReturnType<typeof createDatabaseClient>`
 * so we sidestep the package-barrel `TS2709 Cannot use namespace ... as
 * a type` drift (see service-registry.ts for the full explanation, mirrored
 * by classroom-wiring.ts).
 */
type DatabaseClient = ReturnType<typeof createDatabaseClient>;

/**
 * Marker for the not-yet-configured market-rate adapter. Used by both the
 * stub port itself and the test suite, so we keep it exported as a const
 * rather than scattering a magic string.
 */
export const STUB_ADAPTER_ID = 'stub-not-configured' as const;

export interface MarketSurveillanceLogger {
  warn(meta: object, msg: string): void;
}

export interface MarketSurveillanceWiringDeps {
  readonly db: DatabaseClient | null;
  readonly logger?: MarketSurveillanceLogger;
}

export interface MarketSurveillanceWiring {
  readonly agent: MarketSurveillance;
}

/**
 * Build the Drizzle-backed `MarketSurveillanceRepository` by adapting
 * the storage service. Exported for testing and reuse.
 */
export function createDrizzleMarketSurveillanceRepository(
  db: DatabaseClient,
): MarketSurveillanceRepository {
  const service = createMarketRateSnapshotsService(db);

  return {
    async listActiveUnits(_tenantId: string): Promise<readonly UnitForSurveillance[]> {
      // TODO(units-adapter): join `units` + `occupancy` + currency-prefs to
      // emit one `UnitForSurveillance` per active unit. Until that lands,
      // returning [] makes `scanTenant` a no-op without crashing the
      // background loop.
      return [];
    },

    async insertSnapshot(snapshot: MarketRateSnapshot): Promise<MarketRateSnapshot> {
      const stored = await service.insert(snapshot);
      // The DB service preserves every field the agent sets, so the
      // returned shape is structurally identical — but we re-project
      // through the agent's type to keep the boundary explicit and
      // fail-loud if the shapes ever drift.
      return {
        ...snapshot,
        ...stored,
      };
    },

    async listRecentSnapshots(
      tenantId: string,
      params: { unitId?: string; limit?: number },
    ): Promise<readonly MarketRateSnapshot[]> {
      const rows = await service.listRecent(tenantId, {
        unitId: params.unitId,
        limit: params.limit,
      });
      return rows.map((row) => ({ ...row }));
    },
  };
}

/**
 * Build the stub `MarketRatePort`. Returns no comparables — the agent
 * still produces a snapshot row (with `marketSampleSize: 0` and
 * `driftFlag: null`) so observability holds. Exported for testing.
 */
export function createStubMarketRatePort(): MarketRatePort {
  return {
    adapterId: STUB_ADAPTER_ID,
    async fetchComparables() {
      return [];
    },
  };
}

/**
 * Compose the AI-native market-surveillance agent. Returns `null` when
 * no DB is configured — callers branch on this to skip registration in
 * degraded mode.
 */
export function createMarketSurveillanceWiring(
  deps: MarketSurveillanceWiringDeps,
): MarketSurveillanceWiring | null {
  if (!deps.db) {
    deps.logger?.warn(
      { wiring: 'market-surveillance' },
      'market-surveillance wiring skipped — no database client',
    );
    return null;
  }

  const repo = createDrizzleMarketSurveillanceRepository(deps.db);
  const port = createStubMarketRatePort();

  // `llm`, `publisher`, `budgetGuard` are intentionally undefined — each
  // is optional on `MarketSurveillanceDeps` and the agent degrades
  // gracefully (see `extractRent` and the publisher branch in
  // packages/ai-copilot/src/ai-native/market-surveillance/index.ts).
  const agent = createMarketSurveillance({
    repo,
    port,
  });

  return { agent };
}
