/**
 * Kernel tools — barrel.
 *
 * Re-exports the four Neo4j-backed graph kernel tools, the bundle
 * factory, and the market-data tools (Zillow / Airbnb / future external
 * providers behind the duck-typed MarketDataPort). Wired into the kernel
 * namespace via packages/central-intelligence/src/kernel/index.ts so
 * callers compose with `import { tools } from '@bossnyumba/central-intelligence'`.
 */

export {
  createPortfolioConcentrationTool,
  createConnectedPartiesTool,
  createLeaseNetworkTool,
  createVacancyClustersTool,
  createGraphKernelTools,
  type GraphReadClient,
  type GraphToolDeps,
  type GraphKernelToolBundle,
  type ConcentrationFlag,
  type PortfolioConcentrationInput,
  type PortfolioConcentrationOutput,
  type ConnectedPartiesInput,
  type ConnectedPartiesOutput,
  type LeaseNetworkInput,
  type LeaseNetworkOutput,
  type VacancyClustersInput,
  type VacancyClustersOutput,
} from './graph-tools.js';

// External market-data kernel tools — wraps a duck-typed MarketDataPort
// (concrete impl supplied by @bossnyumba/market-intelligence at the
// composition root) into agent-loop callable tools. Two tools:
//   - market.comparable_rents
//   - market.vacancy_trends
export {
  createMarketComparableRentsTool,
  createMarketVacancyTrendsTool,
  createMarketDataKernelTools,
  createMarketDataTool,
  type MarketDataPortShape,
  type MarketDataOutcomeShape,
  type MarketDataToolDeps,
  type MarketDataKernelToolBundle,
  type MarketComparableRent,
  type MarketVacancyTrend,
  type ComparableRentsInput,
  type ComparableRentsOutput,
  type VacancyTrendsInput,
  type VacancyTrendsOutput,
} from './market-data-tool.js';
