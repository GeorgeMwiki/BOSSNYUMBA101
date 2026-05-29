import { describe, expect, it } from 'vitest';
import { chunkText } from '../chunker.js';

describe('chunkText', () => {
  it('returns empty array for empty input', () => {
    expect(chunkText('', { seed: 'a' })).toEqual([]);
  });
  it('returns single chunk for short text', () => {
    const out = chunkText('hello world', { seed: 'a' });
    expect(out).toHaveLength(1);
    expect(out[0]?.text).toContain('hello');
    expect(out[0]?.chunkIndex).toBe(0);
  });
  it('splits long text into overlapping chunks', () => {
    const long = 'word '.repeat(800);
    const out = chunkText(long, { seed: 'a' });
    expect(out.length).toBeGreaterThan(1);
  });
  it('derives chunk ids deterministically from seed', () => {
    const a = chunkText('a long text '.repeat(200), { seed: 'lease-1' });
    const b = chunkText('a long text '.repeat(200), { seed: 'lease-1' });
    expect(a.map((c) => c.id)).toEqual(b.map((c) => c.id));
  });
  it('detects markdown section heading on chunk', () => {
    const text = '# Lease Agreement\n\nClause 1: rent is TZS 500,000.';
    const out = chunkText(text, { seed: 's' });
    expect(out[0]?.section).toBe('Lease Agreement');
  });
  it('respects custom chunkSize + chunkOverlap', () => {
    const out = chunkText('abcdefghij'.repeat(40), {
      seed: 's', chunkSize: 50, chunkOverlap: 10,
    });
    expect(out.length).toBeGreaterThan(2);
    expect(out[0]?.text.length).toBe(50);
  });
  it('returns empty for non-positive chunk size', () => {
    expect(chunkText('hello', { seed: 's', chunkSize: 0 })).toEqual([]);
  });
  it('normalises whitespace but preserves newlines', () => {
    const text = '## Section\n\n\n\nclause   one\t\tand   two';
    const out = chunkText(text, { seed: 's' });
    expect(out[0]?.text).not.toMatch(/\t/);
    expect(out[0]?.text).not.toMatch(/   /);
  });
});
