/**
 * Embedding Service (NEW 15)
 *
 * Chunks document text and generates vector embeddings. The actual
 * embedding-model call is stubbed with a TODO — swap in OpenAI
 * (`text-embedding-3-small`) or Anthropic/Voyage when wiring is added.
 */

export interface TextChunk {
  readonly chunkIndex: number;
  readonly text: string;
  readonly meta: Readonly<Record<string, unknown>>;
}

export interface EmbeddedChunk extends TextChunk {
  readonly embedding: readonly number[];
  readonly embeddingModel: string;
}

export interface IEmbeddingModelPort {
  readonly model: string;
  readonly dimensions: number;
  embed(texts: readonly string[]): Promise<readonly number[][]>;
}

export interface EmbeddingServiceOptions {
  readonly model: IEmbeddingModelPort;
  readonly chunkSize?: number;
  readonly chunkOverlap?: number;
}

export class EmbeddingService {
  private readonly chunkSize: number;
  private readonly chunkOverlap: number;

  constructor(private readonly options: EmbeddingServiceOptions) {
    this.chunkSize = options.chunkSize ?? 1000;
    this.chunkOverlap = options.chunkOverlap ?? 150;
  }

  /** Split text into overlapping character-window chunks. */
  chunk(text: string, meta: Record<string, unknown> = {}): readonly TextChunk[] {
    if (!text) return [];
    const clean = text.replace(/\s+/g, ' ').trim();
    const chunks: TextChunk[] = [];
    let start = 0;
    let idx = 0;
    while (start < clean.length) {
      const end = Math.min(clean.length, start + this.chunkSize);
      const slice = clean.slice(start, end);
      chunks.push({ chunkIndex: idx, text: slice, meta });
      if (end >= clean.length) break;
      start = end - this.chunkOverlap;
      idx += 1;
    }
    return chunks;
  }

  async embedChunks(chunks: readonly TextChunk[]): Promise<readonly EmbeddedChunk[]> {
    if (chunks.length === 0) return [];
    // TODO: batch with concurrency control; handle rate limits.
    const vectors = await this.options.model.embed(chunks.map((c) => c.text));
    if (vectors.length !== chunks.length) {
      throw new Error(
        `embedding count mismatch: expected ${chunks.length}, got ${vectors.length}`
      );
    }
    return chunks.map((c, i) => ({
      ...c,
      embedding: vectors[i] ?? [],
      embeddingModel: this.options.model.model,
    }));
  }

  async embedDocumentText(
    text: string,
    meta: Record<string, unknown> = {}
  ): Promise<readonly EmbeddedChunk[]> {
    const chunks = this.chunk(text, meta);
    return this.embedChunks(chunks);
  }
}

// ---------------------------------------------------------------------------
// Stub model — returns deterministic fake vectors so tests & devs can run
// without an API key. Replace with a real IEmbeddingModelPort.
// ---------------------------------------------------------------------------

export class StubEmbeddingModel implements IEmbeddingModelPort {
  readonly model = 'stub-embedding-v0';
  constructor(readonly dimensions: number = 1536) {}

  async embed(texts: readonly string[]): Promise<readonly number[][]> {
    return texts.map((t) => {
      // Deterministic fake: hash character codes into vector slots.
      const v = new Array<number>(this.dimensions).fill(0);
      for (let i = 0; i < t.length; i++) {
        v[i % this.dimensions] = (v[i % this.dimensions]! + t.charCodeAt(i) / 1000) % 1;
      }
      return v;
    });
  }
}
