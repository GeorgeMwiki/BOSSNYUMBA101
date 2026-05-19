/**
 * In-memory SearchProviderPort — used for tests + dev. Returns
 * deterministic hits keyed by a small scripted catalog. Production
 * wraps Tavily, Exa, and the Anthropic web-search tool.
 */

import type {
  SearchProviderInput,
  SearchProviderPort,
  DeepResearchResult,
} from '../ports/index.js';
import type { SearchHit, SearchHits } from '../types/index.js';

export interface InMemoryProviderConfig {
  readonly name: 'tavily' | 'exa' | 'anthropic';
  readonly catalog: ReadonlyArray<InMemoryCatalogEntry>;
  /** Per-call cost the provider claims. Default 0.001. */
  readonly costPerCallUsd?: number;
  /** Whether the provider supports deep research. */
  readonly supportsDeep?: boolean;
}

export interface InMemoryCatalogEntry {
  readonly url: string;
  readonly title: string;
  readonly snippet: string;
  readonly publishedAt?: string;
  /** Keywords that trigger inclusion when present in the query. */
  readonly keywords: ReadonlyArray<string>;
  /** Provider-native score in [0, 1]. */
  readonly score: number;
  /** Optional full text for deep-research mode. */
  readonly fullText?: string;
}

export function createInMemoryProvider(
  config: InMemoryProviderConfig,
): SearchProviderPort {
  const baseSearch = async (input: SearchProviderInput): Promise<SearchHits> => {
    const matches = matchEntries(config.catalog, input);
    const hits: SearchHit[] = matches.slice(0, input.maxHits).map((entry) =>
      Object.freeze({
        url: entry.url,
        title: entry.title,
        snippet: entry.snippet,
        ...(entry.publishedAt ? { publishedAt: entry.publishedAt } : {}),
        provider: config.name,
        score: entry.score,
        raw: { source: 'in-memory', provider: config.name },
      }),
    );
    return Object.freeze({
      hits: Object.freeze(hits),
      elapsedMs: 1,
      providerCounts: Object.freeze({ [config.name]: hits.length }),
      duplicatesCollapsed: 0,
      costUsd: config.costPerCallUsd ?? 0.001,
    });
  };

  const port: SearchProviderPort = {
    name: config.name,
    search: baseSearch,
    ...(config.supportsDeep === true
      ? {
          deepResearch: async (input: SearchProviderInput): Promise<DeepResearchResult> => {
            const matches = matchEntries(config.catalog, input);
            const hits: SearchHit[] = matches.slice(0, input.maxHits).map((entry) =>
              Object.freeze({
                url: entry.url,
                title: entry.title,
                snippet: entry.snippet,
                ...(entry.publishedAt ? { publishedAt: entry.publishedAt } : {}),
                ...(entry.fullText ? { fullText: entry.fullText } : {}),
                provider: config.name,
                score: entry.score,
                raw: { source: 'in-memory-deep', provider: config.name },
              }),
            );
            const synthesized =
              hits.length === 0
                ? `No results for "${input.query}".`
                : `Synthesized from ${hits.length} sources: ${hits.map((h) => h.title).join('; ')}.`;
            return Object.freeze({
              kind: 'ok',
              hits: Object.freeze({
                hits: Object.freeze(hits),
                elapsedMs: 2,
                providerCounts: Object.freeze({ [config.name]: hits.length }),
                duplicatesCollapsed: 0,
                costUsd: (config.costPerCallUsd ?? 0.001) * 4,
              }),
              synthesized,
            });
          },
        }
      : {}),
  };

  return port;
}

function matchEntries(
  catalog: ReadonlyArray<InMemoryCatalogEntry>,
  input: SearchProviderInput,
): InMemoryCatalogEntry[] {
  const q = input.query.toLowerCase();
  const tokens = q.split(/\W+/u).filter((t) => t.length > 2);
  const scored = catalog
    .map((entry) => {
      let s = entry.score;
      let hits = 0;
      for (const kw of entry.keywords) {
        for (const token of tokens) {
          if (kw.toLowerCase().includes(token) || token.includes(kw.toLowerCase())) {
            hits++;
            break;
          }
        }
      }
      // Domain restrictor
      if (input.includeDomains && input.includeDomains.length > 0) {
        try {
          const host = new URL(entry.url).host;
          const allowed = input.includeDomains.some((d) => host.endsWith(d));
          if (!allowed) {
            return { entry, s: 0 };
          }
        } catch {
          return { entry, s: 0 };
        }
      }
      if (input.excludeDomains && input.excludeDomains.length > 0) {
        try {
          const host = new URL(entry.url).host;
          const blocked = input.excludeDomains.some((d) => host.endsWith(d));
          if (blocked) {
            return { entry, s: 0 };
          }
        } catch {
          // ignore
        }
      }
      // Require at least one keyword hit to match. Tests assume strict
      // keyword filtering; loose fallback was producing false-positive
      // matches across catalogs.
      if (hits === 0) {
        return { entry, s: 0 };
      }
      return { entry, s: s + hits * 0.05 };
    })
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s);
  return scored.map((x) => x.entry);
}
