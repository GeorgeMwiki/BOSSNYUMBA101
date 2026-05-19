import { describe, it, expect } from 'vitest';
import { createInMemoryProvider } from '../in-memory-provider.js';

describe('createInMemoryProvider', () => {
  it('returns matching catalog entries by keyword', async () => {
    const p = createInMemoryProvider({
      name: 'tavily',
      catalog: [
        { url: 'https://a.com/', title: 'A', snippet: 's', keywords: ['kra'], score: 0.9 },
        { url: 'https://b.com/', title: 'B', snippet: 's', keywords: ['rent'], score: 0.8 },
      ],
    });
    const r = await p.search({ query: 'KRA tax', depth: 'standard', freshness: 'any', maxHits: 5 });
    expect(r.hits).toHaveLength(1);
    expect(r.hits[0]?.title).toBe('A');
  });
  it('clamps to maxHits', async () => {
    const p = createInMemoryProvider({
      name: 'exa',
      catalog: [
        { url: 'https://a.com/', title: 'A', snippet: 's', keywords: ['x'], score: 0.9 },
        { url: 'https://b.com/', title: 'B', snippet: 's', keywords: ['x'], score: 0.8 },
        { url: 'https://c.com/', title: 'C', snippet: 's', keywords: ['x'], score: 0.7 },
      ],
    });
    const r = await p.search({ query: 'xenon', depth: 'standard', freshness: 'any', maxHits: 2 });
    expect(r.hits).toHaveLength(2);
  });
  it('exposes deepResearch when supportsDeep: true', async () => {
    const p = createInMemoryProvider({
      name: 'tavily',
      supportsDeep: true,
      catalog: [
        {
          url: 'https://a.com/',
          title: 'A',
          snippet: 's',
          keywords: ['z'],
          score: 0.9,
          fullText: 'Full text here.',
        },
      ],
    });
    expect(p.deepResearch).toBeDefined();
    const d = await p.deepResearch!({
      query: 'zoning',
      depth: 'deep',
      freshness: 'any',
      maxHits: 5,
    });
    expect(d.kind).toBe('ok');
    if (d.kind === 'ok') {
      expect(d.hits.hits[0]?.fullText).toBe('Full text here.');
      expect(d.synthesized.length).toBeGreaterThan(0);
    }
  });
  it('returns no hits + deep synthesised "no results" message for misses', async () => {
    const p = createInMemoryProvider({
      name: 'tavily',
      supportsDeep: true,
      catalog: [{ url: 'https://a.com/', title: 'A', snippet: 's', keywords: ['x'], score: 0.9 }],
    });
    const d = await p.deepResearch!({
      query: 'nothing-matches-here',
      depth: 'deep',
      freshness: 'any',
      maxHits: 5,
    });
    if (d.kind === 'ok') {
      expect(d.hits.hits).toHaveLength(0);
    }
  });
  it('respects includeDomains restrictor', async () => {
    const p = createInMemoryProvider({
      name: 'exa',
      catalog: [
        { url: 'https://allowed.com/x', title: 'A', snippet: 's', keywords: ['t'], score: 0.9 },
        { url: 'https://blocked.com/x', title: 'B', snippet: 's', keywords: ['t'], score: 0.9 },
      ],
    });
    const r = await p.search({
      query: 'tag',
      depth: 'standard',
      freshness: 'any',
      maxHits: 5,
      includeDomains: ['allowed.com'],
    });
    expect(r.hits).toHaveLength(1);
    expect(r.hits[0]?.url).toContain('allowed.com');
  });
});
