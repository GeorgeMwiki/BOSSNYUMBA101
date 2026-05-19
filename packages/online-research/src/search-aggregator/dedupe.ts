/**
 * Hit-level dedupe + ranking across providers.
 *
 * Algorithm:
 *
 *   1. Group hits by `normaliseUrl(hit.url)`. Unparseable URLs fall
 *      into their own singleton group keyed by raw URL.
 *
 *   2. For each group, pick the canonical representative — the hit
 *      with the longest snippet, breaking ties by highest score, then
 *      by provider preference order (Anthropic > Tavily > Exa for
 *      citation quality; configurable).
 *
 *   3. Compute a fused score: each duplicate adds a small boost.
 *      This rewards consensus across providers without letting a
 *      single high-score provider dominate.
 *
 *   4. Sort descending by fused score.
 */

import type { SearchHit } from '../types/index.js';
import { normaliseUrl } from './url-normalise.js';

export interface DedupeResult {
  readonly hits: ReadonlyArray<SearchHit>;
  readonly duplicatesCollapsed: number;
}

const PROVIDER_PREFERENCE_ORDER: Readonly<
  Record<'anthropic' | 'tavily' | 'exa' | 'browser-use', number>
> = {
  anthropic: 0,
  tavily: 1,
  exa: 2,
  'browser-use': 3,
};

const CONSENSUS_BOOST = 0.08; // score added per duplicate provider.

export function dedupeHits(
  allHits: ReadonlyArray<SearchHit>,
): DedupeResult {
  const groups = new Map<string, SearchHit[]>();
  for (const hit of allHits) {
    const key = normaliseUrl(hit.url) ?? hit.url;
    const group = groups.get(key);
    if (group === undefined) {
      groups.set(key, [hit]);
    } else {
      group.push(hit);
    }
  }

  const canonical: Array<SearchHit & { readonly _fusedScore: number }> = [];

  for (const group of groups.values()) {
    const rep = pickRepresentative(group);
    const fused = Math.min(
      1,
      rep.score + Math.max(0, group.length - 1) * CONSENSUS_BOOST,
    );
    canonical.push(Object.freeze({ ...rep, _fusedScore: fused }));
  }

  canonical.sort((a, b) => b._fusedScore - a._fusedScore);
  const stripped: SearchHit[] = canonical.map((c) => {
    // Strip internal scoring channel from public output, preserve score.
    const { _fusedScore, ...rest } = c;
    void _fusedScore;
    return Object.freeze({ ...rest, score: c._fusedScore });
  });

  return Object.freeze({
    hits: Object.freeze(stripped),
    duplicatesCollapsed: allHits.length - stripped.length,
  });
}

function pickRepresentative(group: ReadonlyArray<SearchHit>): SearchHit {
  // Longest snippet wins. Ties broken by score desc, then provider
  // preference, then publishedAt desc.
  const sorted = [...group].sort((a, b) => {
    const lenDiff = b.snippet.length - a.snippet.length;
    if (lenDiff !== 0) {
      return lenDiff;
    }
    const scoreDiff = b.score - a.score;
    if (scoreDiff !== 0) {
      return scoreDiff;
    }
    const provDiff =
      PROVIDER_PREFERENCE_ORDER[a.provider] -
      PROVIDER_PREFERENCE_ORDER[b.provider];
    if (provDiff !== 0) {
      return provDiff;
    }
    const pa = a.publishedAt ?? '';
    const pb = b.publishedAt ?? '';
    return pb.localeCompare(pa);
  });
  const head = sorted[0];
  if (head === undefined) {
    // Group always has at least one entry (we only seed from real hits).
    throw new Error('pickRepresentative: empty group');
  }
  return head;
}
