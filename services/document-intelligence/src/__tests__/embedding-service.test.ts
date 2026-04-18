import { describe, it, expect } from 'vitest';
import { EmbeddingService, StubEmbeddingModel } from '../services/embedding-service.js';

describe('EmbeddingService', () => {
  const svc = new EmbeddingService({
    model: new StubEmbeddingModel(16),
    chunkSize: 50,
    chunkOverlap: 10,
  });

  it('chunks text into overlapping windows', () => {
    const chunks = svc.chunk('a'.repeat(200));
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.text.length).toBeLessThanOrEqual(50);
  });

  it('returns empty for empty text', () => {
    expect(svc.chunk('')).toEqual([]);
  });

  it('embeds chunks with dimensions matching the model', async () => {
    const chunks = svc.chunk('hello world');
    const embedded = await svc.embedChunks(chunks);
    expect(embedded).toHaveLength(chunks.length);
    for (const e of embedded) {
      expect(e.embedding.length).toBe(16);
      expect(e.embeddingModel).toBe('stub-embedding-v0');
    }
  });
});
