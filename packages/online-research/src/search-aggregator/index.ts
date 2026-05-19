/**
 * search-aggregator — public surface.
 *
 * Closes L2 #6 (web search + fetch + code execution composition),
 * L2 #13 (Tavily /research), L2 #14 (Exa Neural).
 */

export {
  createSearchAggregator,
  type SearchAggregator,
  type SearchAggregatorDeps,
} from './aggregator.js';
export { dedupeHits, type DedupeResult } from './dedupe.js';
export { normaliseUrl } from './url-normalise.js';
export {
  createInMemoryProvider,
  type InMemoryProviderConfig,
  type InMemoryCatalogEntry,
} from './in-memory-provider.js';
