/**
 * Jurisdiction-discovery service tests — JC-1 (6 cases, real-estate edition).
 *
 * Covers:
 *   1. seeded-short-circuit  — KE resolves immediately, web/corpus never called.
 *   2. web-search-only       — corpus empty, web hits drive synthesis.
 *   3. corpus-only           — web fails, corpus hits drive synthesis.
 *   4. combined              — both signal streams contribute.
 *   5. low-confidence-flag   — both streams empty ⇒ fallback origin + flag.
 *   6. cache-hit             — second call short-circuits to cache.
 *
 * Ported from Borjie tests — country fixtures swapped from Peru (PE) +
 * MINEM (mining regulator) to Ghana (GH) + Rent Control Department
 * (rental housing authority). The seed-short-circuit fixture flips from
 * Tanzania (Borjie home market) to Kenya (BossNyumba home market).
 */

import { describe, it, expect, vi } from 'vitest';

import { createJurisdictionDiscoveryService } from '../service.js';
import type {
  BrainWebSearchAdapter,
  CorpusSearchAdapter,
  DiscoveryCacheAdapter,
  DiscoveryResult,
} from '../types.js';

const GHANA_WEB_HITS = [
  {
    url: 'https://www.mlnr.gov.gh/rent-control',
    title:
      'Ghana Rent Control Department — Ministry of Works and Housing',
    snippet:
      'The Rent Control Department under the Ministry of Works and Housing administers the Ghana Landlord and Tenant Act. Currency GHS. Languages: english.',
  },
  {
    url: 'https://gra.gov.gh',
    title: 'Ghana Revenue Authority (GRA) — Rental Income Tax',
    snippet:
      'GRA collects rental income tax on residential and commercial properties. Currency GHS.',
  },
];

const GHANA_CORPUS_HITS = [
  {
    evidenceId: 'corpus-gh-1',
    title: 'Ghana tenancy framework — corpus chunk',
    snippet:
      'Ghanaian tenancy operates under the Rent Act 220; the Rent Control Department mediates disputes between landlords and tenants.',
  },
];

function fakeWeb(
  hits: typeof GHANA_WEB_HITS,
  options: { throws?: boolean } = {},
): BrainWebSearchAdapter {
  return {
    async search(_input) {
      if (options.throws) throw new Error('web search down');
      return hits;
    },
  };
}

function fakeCorpus(
  hits: typeof GHANA_CORPUS_HITS,
  options: { throws?: boolean } = {},
): CorpusSearchAdapter {
  return {
    async search(_input) {
      if (options.throws) throw new Error('corpus down');
      return hits;
    },
  };
}

function fakeCache(): DiscoveryCacheAdapter & {
  readonly puts: Array<{ countryCode: string; result: DiscoveryResult }>;
} {
  const puts: Array<{ countryCode: string; result: DiscoveryResult }> = [];
  let stored: { code: string; result: DiscoveryResult } | null = null;
  return {
    puts,
    async get(code) {
      if (stored && stored.code === code) return stored.result;
      return null;
    },
    async put(input) {
      puts.push(input);
      stored = { code: input.countryCode, result: input.result };
    },
  };
}

describe('jurisdiction-discovery — JC-1 contract (real-estate edition)', () => {
  it('1. seeded short-circuit: KE resolves from seed without hitting web/corpus', async () => {
    const webSpy = vi.fn();
    const corpusSpy = vi.fn();
    const svc = createJurisdictionDiscoveryService({
      webSearch: { search: webSpy },
      corpus: { search: corpusSpy },
      cache: fakeCache(),
    });
    const result = await svc.discover('KE');
    expect(result.origin).toBe('seed');
    expect(result.lowConfidence).toBe(false);
    expect(result.profile.regulators.length).toBeGreaterThanOrEqual(4);
    expect(webSpy).not.toHaveBeenCalled();
    expect(corpusSpy).not.toHaveBeenCalled();
  });

  it('2. web-search-only: corpus empty, web hits drive synthesis', async () => {
    const svc = createJurisdictionDiscoveryService({
      webSearch: fakeWeb(GHANA_WEB_HITS),
      corpus: fakeCorpus([]),
      cache: fakeCache(),
    });
    const result = await svc.discover('Ghana');
    expect(result.origin).toBe('discovered');
    expect(result.profile.countryCode).toBe('GH');
    expect(result.profile.regulators.length).toBeGreaterThan(0);
    expect(result.profile.validityScore).toBeCloseTo(0.55, 2);
    expect(
      result.sources.some((s) => s.kind === 'web_search'),
    ).toBe(true);
  });

  it('3. corpus-only: web fails, corpus hits drive synthesis', async () => {
    const svc = createJurisdictionDiscoveryService({
      webSearch: fakeWeb([], { throws: true }),
      corpus: fakeCorpus(GHANA_CORPUS_HITS),
      cache: fakeCache(),
    });
    const result = await svc.discover('Ghana');
    expect(result.origin).toBe('discovered');
    expect(result.profile.validityScore).toBeCloseTo(0.55, 2);
    expect(
      result.sources.some((s) => s.kind === 'corpus'),
    ).toBe(true);
  });

  it('4. combined: both signal streams contribute, validity is highest tier', async () => {
    const svc = createJurisdictionDiscoveryService({
      webSearch: fakeWeb(GHANA_WEB_HITS),
      corpus: fakeCorpus(GHANA_CORPUS_HITS),
      cache: fakeCache(),
    });
    const result = await svc.discover('Ghana');
    expect(result.origin).toBe('discovered');
    expect(result.profile.validityScore).toBeCloseTo(0.85, 2);
    expect(result.lowConfidence).toBe(false);
    expect(
      result.sources.some((s) => s.kind === 'web_search'),
    ).toBe(true);
    expect(
      result.sources.some((s) => s.kind === 'corpus'),
    ).toBe(true);
  });

  it('5. low-confidence-flag: both streams empty ⇒ fallback origin + flag', async () => {
    const svc = createJurisdictionDiscoveryService({
      webSearch: fakeWeb([]),
      corpus: fakeCorpus([]),
      cache: fakeCache(),
    });
    const result = await svc.discover('Botswana');
    expect(result.origin).toBe('fallback');
    expect(result.lowConfidence).toBe(true);
    expect(result.profile.validityScore).toBeCloseTo(0.2, 2);
    // Still surfaces a regulator placeholder — Mr. Mwikila NEVER says "I don't know".
    expect(result.profile.regulators.length).toBeGreaterThan(0);
  });

  it('6. cache-hit: second call returns cached entry, web not re-invoked', async () => {
    const cache = fakeCache();
    const webSpy = vi.fn(async () => GHANA_WEB_HITS);
    const svc = createJurisdictionDiscoveryService({
      webSearch: { search: webSpy },
      corpus: fakeCorpus([]),
      cache,
    });
    const first = await svc.discover('Ghana');
    expect(first.origin).toBe('discovered');
    expect(cache.puts).toHaveLength(1);
    expect(webSpy).toHaveBeenCalledTimes(1);

    const second = await svc.discover('Ghana');
    expect(second.origin).toBe('cache');
    expect(webSpy).toHaveBeenCalledTimes(1);
  });
});
