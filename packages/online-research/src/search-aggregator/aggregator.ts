/**
 * Unified search aggregator across Tavily + Exa + Anthropic web search.
 *
 *   - Tavily `/research` for deep one-call research (best for "what's
 *     the current KRA WHT rate?").
 *   - Exa Neural for "find similar properties / vendors" semantic
 *     search.
 *   - Anthropic web search for in-domain inline lookups (free when
 *     paired with code execution).
 *
 * For depth === 'deep' the aggregator also fans out to the deep-research
 * provider methods (currently Tavily) and rolls their results into
 * the same dedupe pipeline.
 *
 * Closes L2 #6 (search composition), L2 #13 (Tavily research), L2 #14
 * (Exa Neural).
 */

import type {
  SearchProviderPort,
  SearchProviderInput,
} from '../ports/index.js';
import type { SearchHits, SearchHit } from '../types/index.js';
import { dedupeHits } from './dedupe.js';

export interface SearchAggregatorDeps {
  /** Concrete provider adapters wired by the caller. */
  readonly providers: ReadonlyArray<SearchProviderPort>;
  /** Wall-clock for elapsedMs. */
  readonly clock: { readonly nowMs: () => number };
}

export interface SearchAggregator {
  readonly searchUnified: (input: SearchProviderInput) => Promise<SearchHits>;
}

/**
 * Construct an aggregator over the supplied provider list.
 *
 * Providers run in parallel via `Promise.allSettled` — a single
 * provider's failure does not poison the others. Failed providers
 * are recorded with zero hits in `providerCounts` so the caller
 * can observe degradation.
 */
export function createSearchAggregator(
  deps: SearchAggregatorDeps,
): SearchAggregator {
  return {
    searchUnified: async (input) => {
      const startMs = deps.clock.nowMs();
      const settled = await Promise.allSettled(
        deps.providers.map((p) => callProvider(p, input)),
      );

      const allHits: SearchHit[] = [];
      const providerCounts: Record<string, number> = {};
      let costUsd = 0;

      for (let i = 0; i < settled.length; i++) {
        const result = settled[i];
        const provider = deps.providers[i];
        if (provider === undefined) {
          continue;
        }
        if (result === undefined) {
          continue;
        }
        if (result.status === 'fulfilled') {
          providerCounts[provider.name] = result.value.hits.length;
          for (const hit of result.value.hits) {
            allHits.push(hit);
          }
          costUsd += result.value.costUsd;
        } else {
          providerCounts[provider.name] = 0;
        }
      }

      const { hits: deduped, duplicatesCollapsed } = dedupeHits(allHits);
      const clamped = clampToMax(deduped, input.maxHits);
      const elapsedMs = deps.clock.nowMs() - startMs;

      return Object.freeze({
        hits: clamped,
        elapsedMs,
        providerCounts: Object.freeze({ ...providerCounts }),
        duplicatesCollapsed,
        costUsd,
      });
    },
  };
}

async function callProvider(
  provider: SearchProviderPort,
  input: SearchProviderInput,
): Promise<SearchHits> {
  if (input.depth === 'deep' && provider.deepResearch !== undefined) {
    const deep = await provider.deepResearch(input);
    return deep.hits;
  }
  return provider.search(input);
}

function clampToMax(
  hits: ReadonlyArray<SearchHit>,
  maxHits: number,
): ReadonlyArray<SearchHit> {
  if (hits.length <= maxHits) {
    return hits;
  }
  return Object.freeze(hits.slice(0, maxHits));
}
