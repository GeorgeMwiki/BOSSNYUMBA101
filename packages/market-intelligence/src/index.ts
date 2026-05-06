/**
 * @bossnyumba/market-intelligence
 *
 * Property market data aggregation: rent-per-sqft, vacancy, cap-rate, and
 * yield-on-cost by district. Pluggable feed adapters, seasonality, and
 * comparable-unit finder.
 *
 * Plus the per-query MarketDataPort (external market-data scaffolding)
 * — a single interface operators plug Zillow / Airbnb / Rentometer /
 * regional comparable-rent providers behind. Distinct from the
 * district-level `ExternalFeedAdapter` consumed by `MarketDataService`;
 * `MarketDataPort` is a finer-grained per-question port the kernel
 * calls via tools.
 */

export * from './types.js';
export * from './market-data-service.js';
export * from './seasonality.js';
export * from './comparable-finder.js';
export * from './feed-adapters/index.js';

// Per-query MarketDataPort — pluggable external provider interface.
export type {
  MarketDataPort,
  MarketDataOutcome,
  ComparableRent,
  ComparableRentsArgs,
  VacancyTrend,
  VacancyTrendArgs,
  MarketDataCacheServiceShape,
} from './port.js';
export {
  createZillowMarketDataAdapter,
  ZILLOW_MOCK_HEADER,
  type ZillowMarketDataAdapterConfig,
} from './adapters/zillow.js';
export {
  createAirbnbMarketDataAdapter,
  AIRBNB_MOCK_HEADER,
  type AirbnbMarketDataAdapterConfig,
} from './adapters/airbnb.js';
