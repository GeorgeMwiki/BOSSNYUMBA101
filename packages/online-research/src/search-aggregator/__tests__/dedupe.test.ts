import { describe, it, expect } from 'vitest';
import { dedupeHits } from '../dedupe.js';
import type { SearchHit } from '../../types/index.js';

const hit = (over: Partial<SearchHit>): SearchHit => ({
  url: 'https://example.com/x',
  title: 'X',
  snippet: 'snippet',
  provider: 'anthropic',
  score: 0.5,
  ...over,
});

describe('dedupeHits', () => {
  it('returns empty on empty input', () => {
    const r = dedupeHits([]);
    expect(r.hits).toEqual([]);
    expect(r.duplicatesCollapsed).toBe(0);
  });
  it('passes through unique hits', () => {
    const r = dedupeHits([
      hit({ url: 'https://a.com/' }),
      hit({ url: 'https://b.com/' }),
    ]);
    expect(r.hits).toHaveLength(2);
    expect(r.duplicatesCollapsed).toBe(0);
  });
  it('collapses tracking-param duplicates to one canonical', () => {
    const r = dedupeHits([
      hit({ url: 'https://example.com/x?utm_source=fb', provider: 'tavily' }),
      hit({ url: 'https://example.com/x?utm_source=tw', provider: 'exa' }),
    ]);
    expect(r.hits).toHaveLength(1);
    expect(r.duplicatesCollapsed).toBe(1);
  });
  it('picks the hit with the longest snippet as representative', () => {
    const r = dedupeHits([
      hit({ url: 'https://example.com/x', snippet: 'short', provider: 'tavily', score: 0.99 }),
      hit({ url: 'https://example.com/x', snippet: 'much longer snippet content', provider: 'anthropic', score: 0.5 }),
    ]);
    expect(r.hits[0]?.snippet).toBe('much longer snippet content');
  });
  it('applies consensus boost — duplicates raise the fused score', () => {
    const r = dedupeHits([
      hit({ url: 'https://example.com/x', provider: 'tavily', score: 0.5 }),
      hit({ url: 'https://example.com/x?utm_source=g', provider: 'exa', score: 0.5 }),
      hit({ url: 'https://example.com/x#frag', provider: 'anthropic', score: 0.5 }),
    ]);
    expect(r.hits[0]!.score).toBeGreaterThan(0.5);
  });
  it('sorts descending by fused score', () => {
    const r = dedupeHits([
      hit({ url: 'https://a.com/', score: 0.3 }),
      hit({ url: 'https://b.com/', score: 0.9 }),
      hit({ url: 'https://c.com/', score: 0.6 }),
    ]);
    expect(r.hits.map((h) => h.url)).toEqual([
      'https://b.com/',
      'https://c.com/',
      'https://a.com/',
    ]);
  });
  it('prefers Anthropic provider when ties on snippet+score', () => {
    const r = dedupeHits([
      hit({ url: 'https://example.com/x', provider: 'exa', score: 0.7, snippet: 'same' }),
      hit({ url: 'https://example.com/x?utm_source=g', provider: 'anthropic', score: 0.7, snippet: 'same' }),
    ]);
    expect(r.hits[0]?.provider).toBe('anthropic');
  });
  it('caps consensus boost at score 1.0', () => {
    const r = dedupeHits(
      Array.from({ length: 30 }, (_, i) =>
        hit({ url: `https://example.com/x?utm=${i}`, score: 0.95 }),
      ),
    );
    expect(r.hits[0]!.score).toBeLessThanOrEqual(1);
  });
});
