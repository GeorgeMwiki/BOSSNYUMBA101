/**
 * Market Data Service — aggregates district metrics from internal + external
 * feeds, applies seasonality, and exposes a single query surface for callers.
 */

import type { DistrictMetric, UnitObservation } from './types.js';
import {
  aggregateInternal,
  type InternalAggregatorInput,
} from './feed-adapters/internal-aggregator.js';
import type { ExternalFeedAdapter } from './feed-adapters/external-feed-placeholder.js';
import { seasonalityMultiplier } from './seasonality.js';

export interface MarketDataServiceConfig {
  readonly externalFeeds?: readonly ExternalFeedAdapter[];
  readonly applySeasonality?: boolean;
}

export interface QueryMetricsInput {
  readonly countryCode: string;
  readonly asOf: string;
  readonly month?: number;
  readonly observations: readonly UnitObservation[];
}

export class MarketDataService {
  constructor(private readonly config: MarketDataServiceConfig = {}) {}

  async queryDistrictMetrics(
    input: QueryMetricsInput,
  ): Promise<readonly DistrictMetric[]> {
    const internalInput: InternalAggregatorInput = {
      observations: input.observations.filter(
        (o) => o.countryCode === input.countryCode,
      ),
      asOf: input.asOf,
    };
    const internal = aggregateInternal(internalInput);

    const externalResults = await Promise.all(
      (this.config.externalFeeds ?? []).map((feed) =>
        feed.fetchDistrictMetrics(input.countryCode, input.asOf).catch(() => []),
      ),
    );
    const external: readonly DistrictMetric[] = externalResults.flat();

    const merged = mergeMetrics([internal, external]);

    if (this.config.applySeasonality && input.month !== undefined) {
      const month = input.month;
      return merged.map((m) => {
        const mult = seasonalityMultiplier(input.countryCode, month);
        return {
          ...m,
          rentPerSqftKes:
            m.rentPerSqftKes !== undefined ? m.rentPerSqftKes * mult : undefined,
          rentPerSqftTzs:
            m.rentPerSqftTzs !== undefined ? m.rentPerSqftTzs * mult : undefined,
        };
      });
    }
    return merged;
  }
}

function mergeMetrics(
  sources: readonly (readonly DistrictMetric[])[],
): readonly DistrictMetric[] {
  const byId = new Map<string, DistrictMetric[]>();
  for (const src of sources) {
    for (const m of src) {
      const list = byId.get(m.districtId) ?? [];
      byId.set(m.districtId, [...list, m]);
    }
  }
  const merged: DistrictMetric[] = [];
  for (const [districtId, list] of byId) {
    if (list.length === 1) {
      merged.push(list[0]!);
      continue;
    }
    const totalSamples = list.reduce((a, b) => a + b.sampleSize, 0);
    const weighted = (key: keyof DistrictMetric): number | undefined => {
      let hasAny = false;
      let total = 0;
      for (const m of list) {
        const v = m[key];
        if (typeof v === 'number' && !Number.isNaN(v)) {
          hasAny = true;
          total += v * m.sampleSize;
        }
      }
      if (!hasAny || totalSamples === 0) return undefined;
      return total / totalSamples;
    };
    merged.push({
      districtId,
      districtName: list[0]!.districtName,
      countryCode: list[0]!.countryCode,
      rentPerSqftKes: weighted('rentPerSqftKes'),
      rentPerSqftTzs: weighted('rentPerSqftTzs'),
      vacancyRatePct: weighted('vacancyRatePct') ?? 0,
      capRatePct: weighted('capRatePct') ?? 0,
      yieldOnCostPct: weighted('yieldOnCostPct') ?? 0,
      sampleSize: totalSamples,
      asOf: list[0]!.asOf,
    });
  }
  return merged;
}

export function createMarketDataService(
  config: MarketDataServiceConfig = {},
): MarketDataService {
  return new MarketDataService(config);
}
