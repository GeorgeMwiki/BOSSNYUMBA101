/**
 * External feed adapter PLACEHOLDER — deferred under KI-015.
 *
 * Interface-ready so real feeds (Trulia-style, Zoopla-style, or a
 * regional real-estate data partner) can be wired in without touching
 * the aggregation layer. By default this adapter returns empty data —
 * it is the aggregator's job to gracefully prefer internal data when
 * external data is missing. See Docs/KNOWN_ISSUES.md#ki-015.
 */

import type { DistrictMetric } from '../types.js';

export interface ExternalFeedAdapter {
  readonly feedId: string;
  fetchDistrictMetrics(
    countryCode: string,
    asOf: string,
  ): Promise<readonly DistrictMetric[]>;
}

export function createPlaceholderFeed(
  feedId = 'placeholder-external',
): ExternalFeedAdapter {
  return {
    feedId,
    async fetchDistrictMetrics(
      _countryCode: string,
      _asOf: string,
    ): Promise<readonly DistrictMetric[]> {
      return [];
    },
  };
}
