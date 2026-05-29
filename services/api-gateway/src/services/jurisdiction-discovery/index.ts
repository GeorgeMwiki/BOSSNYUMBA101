/**
 * Public surface of the jurisdiction-discovery service — JC-1
 * (real-estate edition).
 *
 * Mr. Mwikila NEVER says "I don't know" about a country. When the
 * tenant or user asks about a jurisdiction not in our seeded set,
 * `createJurisdictionDiscoveryService({webSearch, corpus, cache})`
 * runs the discovery pipeline and surfaces real housing-authority,
 * tribunal, revenue, and data-protection info + sources live.
 *
 * Ported from Borjie — see services/jurisdiction-discovery on that
 * repo for the original mining-domain implementation.
 */

export { createJurisdictionDiscoveryService } from './service.js';
export { createDrizzleDiscoveryCache } from './drizzle-cache.js';
export { createDrizzleCorpusSearch } from './drizzle-corpus.js';
export { normalizeCountryInput, listKnownCountries } from './country-normalizer.js';
export { synthesize } from './synthesizer.js';

export type {
  BrainWebSearchAdapter,
  CorpusSearchAdapter,
  DiscoveredRegulator,
  DiscoveryCacheAdapter,
  DiscoveryResult,
  DiscoverySource,
  JurisdictionDiscoveryService,
  JurisdictionProfile,
} from './types.js';
