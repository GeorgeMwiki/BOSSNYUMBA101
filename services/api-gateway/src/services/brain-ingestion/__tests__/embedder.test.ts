import { describe, expect, it } from 'vitest';
import { createStubEmbedder, embedChunks, resolveEmbedder } from '../embedder.js';

describe('createStubEmbedder', () => {
  it('returns 1024-dim vectors', async () => {
    const e = createStubEmbedder();
    const out = await e.embed(['hello world']);
    expect(out[0]?.length).toBe(1024);
    expect(e.dimensions).toBe(1024);
  });
  it('is deterministic - same input yields same vector', async () => {
    const e = createStubEmbedder();
    const [a] = await e.embed(['rent due']);
    const [b] = await e.embed(['rent due']);
    expect(a).toEqual(b);
  });
  it('returns vectors in (-1, 1) range', async () => {
    const e = createStubEmbedder();
    const [v] = await e.embed(['utility bill TZS 35,000']);
    for (const x of v!) {
      expect(x).toBeGreaterThanOrEqual(-1);
      expect(x).toBeLessThanOrEqual(1);
    }
  });
  it('handles empty input gracefully', async () => {
    const e = createStubEmbedder();
    expect(await e.embed([])).toEqual([]);
  });
  it('preserves order of input texts', async () => {
    const e = createStubEmbedder();
    const out = await e.embed(['a', 'b', 'c']);
    expect(out).toHaveLength(3);
    const [a1] = await e.embed(['a']);
    const [c1] = await e.embed(['c']);
    expect(out[0]).toEqual(a1);
    expect(out[2]).toEqual(c1);
  });
});

describe('embedChunks', () => {
  it('hydrates each chunk with its vector', async () => {
    const e = createStubEmbedder();
    const chunks = [
      { id: '1', text: 'a', section: null, chunkIndex: 0 },
      { id: '2', text: 'b', section: null, chunkIndex: 1 },
    ] as const;
    const out = await embedChunks(e, chunks);
    expect(out).toHaveLength(2);
    expect(out[0]?.embedding.length).toBe(1024);
    expect(out[0]?.id).toBe('1');
  });
  it('returns empty for empty chunks input', async () => {
    expect(await embedChunks(createStubEmbedder(), [])).toEqual([]);
  });
});

describe('resolveEmbedder', () => {
  it('returns the stub embedder when OPENAI_API_KEY is absent', () => {
    const e = resolveEmbedder({} as NodeJS.ProcessEnv);
    expect(e.dimensions).toBe(1024);
  });
  it('returns the openai embedder when OPENAI_API_KEY is present', () => {
    const e = resolveEmbedder({ OPENAI_API_KEY: 'sk-test' } as unknown as NodeJS.ProcessEnv);
    expect(e.dimensions).toBe(1024);
    expect(typeof e.embed).toBe('function');
  });
});
