/**
 * 8 query types exercised against the unified aggregator.
 */

import { describe, it, expect } from 'vitest';
import { createSearchAggregator } from '../aggregator.js';
import { createInMemoryProvider } from '../in-memory-provider.js';
import type { SearchProviderInput } from '../../types/index.js';

const NOW = 1747632000000;
let clockMs = NOW;
const clock = { nowMs: () => clockMs };

const tavily = createInMemoryProvider({
  name: 'tavily',
  supportsDeep: true,
  catalog: [
    {
      url: 'https://kra.go.ke/wht',
      title: 'KRA WHT 2026',
      snippet: 'WHT is 7.5% on residential rent.',
      keywords: ['kra', 'wht', 'tax'],
      score: 0.95,
      publishedAt: '2026-03-15',
      fullText: 'Full text on WHT in Kenya.',
    },
    {
      url: 'https://kra.go.ke/wht?utm_source=email',
      title: 'KRA WHT 2026 (tracked)',
      snippet: 'WHT is 7.5%.',
      keywords: ['kra', 'wht'],
      score: 0.9,
    },
  ],
});

const exa = createInMemoryProvider({
  name: 'exa',
  catalog: [
    {
      url: 'https://example.com/similar-property-1',
      title: 'Similar 3-bed in Westlands',
      snippet: 'Comparable property listing.',
      keywords: ['property', 'westlands', 'rent', 'similar'],
      score: 0.85,
    },
    {
      url: 'https://example.com/vendor-jumia',
      title: 'Jumia vendor pricing',
      snippet: 'Cleaning at KES 3,500.',
      keywords: ['vendor', 'jumia', 'cleaning', 'pricing'],
      score: 0.8,
    },
  ],
});

const anthropic = createInMemoryProvider({
  name: 'anthropic',
  catalog: [
    {
      url: 'https://parliament.go.ke/bill-2026',
      title: 'Rent Control Bill',
      snippet: 'Caps annual increase at 7%.',
      keywords: ['rent', 'control', 'bill', 'regulation'],
      score: 0.92,
    },
    {
      url: 'https://news.go.ke/article-1',
      title: 'Rent news update',
      snippet: 'New rent rules take effect July 1.',
      keywords: ['news', 'rent', 'rules'],
      score: 0.7,
      publishedAt: '2026-05-15',
    },
  ],
});

const aggregator = createSearchAggregator({
  providers: [tavily, exa, anthropic],
  clock,
});

const baseInput: SearchProviderInput = {
  query: '',
  depth: 'standard',
  freshness: 'any',
  maxHits: 20,
};

describe('createSearchAggregator — 8 query types', () => {
  it('type 1: specific KRA tax lookup → Tavily wins', async () => {
    const r = await aggregator.searchUnified({ ...baseInput, query: 'KRA WHT rate' });
    expect(r.hits[0]?.url).toMatch(/kra\.go\.ke/u);
    expect(r.duplicatesCollapsed).toBe(1); // kra.go.ke/wht + tracked variant
  });

  it('type 2: comparable-property semantic → Exa wins', async () => {
    const r = await aggregator.searchUnified({ ...baseInput, query: 'similar properties in Westlands' });
    expect(r.hits.some((h) => h.url.includes('similar-property'))).toBe(true);
  });

  it('type 3: regulation/legislative lookup → Anthropic wins', async () => {
    const r = await aggregator.searchUnified({ ...baseInput, query: 'rent control bill regulation' });
    expect(r.hits.some((h) => h.url.includes('parliament'))).toBe(true);
  });

  it('type 4: vendor pricing → Exa wins', async () => {
    const r = await aggregator.searchUnified({ ...baseInput, query: 'vendor pricing jumia' });
    expect(r.hits.some((h) => h.url.includes('jumia'))).toBe(true);
  });

  it('type 5: news/freshness query → preserves publishedAt', async () => {
    const r = await aggregator.searchUnified({ ...baseInput, query: 'rent news rules', freshness: 'week' });
    expect(r.hits.some((h) => h.publishedAt !== undefined)).toBe(true);
  });

  it('type 6: deep-research call goes to Tavily /research', async () => {
    const r = await aggregator.searchUnified({ ...baseInput, query: 'KRA WHT tax research', depth: 'deep' });
    expect(r.hits.some((h) => h.fullText !== undefined)).toBe(true);
  });

  it('type 7: include-domain restricts to allowed hosts', async () => {
    const r = await aggregator.searchUnified({
      ...baseInput,
      query: 'KRA tax rent',
      includeDomains: ['kra.go.ke'],
    });
    expect(r.hits.every((h) => h.url.includes('kra.go.ke'))).toBe(true);
  });

  it('type 8: exclude-domain blocks certain hosts', async () => {
    const r = await aggregator.searchUnified({
      ...baseInput,
      query: 'rent property news',
      excludeDomains: ['parliament.go.ke'],
    });
    expect(r.hits.every((h) => !h.url.includes('parliament'))).toBe(true);
  });

  it('survives a failing provider — uses Promise.allSettled semantics', async () => {
    const flaky = {
      name: 'tavily' as const,
      search: async () => {
        throw new Error('rate-limited');
      },
    };
    const broken = createSearchAggregator({ providers: [flaky, anthropic], clock });
    const r = await broken.searchUnified({ ...baseInput, query: 'rent control bill' });
    expect(r.providerCounts.tavily).toBe(0);
    expect(r.hits.length).toBeGreaterThan(0);
  });

  it('clamps to maxHits', async () => {
    const r = await aggregator.searchUnified({ ...baseInput, query: 'rent tax bill', maxHits: 1 });
    expect(r.hits).toHaveLength(1);
  });

  it('records cost across providers', async () => {
    const r = await aggregator.searchUnified({ ...baseInput, query: 'KRA' });
    expect(r.costUsd).toBeGreaterThan(0);
  });

  it('returns providerCounts pre-dedupe per provider', async () => {
    const r = await aggregator.searchUnified({ ...baseInput, query: 'KRA WHT' });
    expect(Object.keys(r.providerCounts).sort()).toEqual(['anthropic', 'exa', 'tavily']);
  });
});
