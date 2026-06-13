import { createHash } from 'node:crypto';
import type { EmbeddedChunk, TextChunk } from './types.js';

export interface Embedder {
  readonly dimensions: number;
  /**
   * Stable identifier for the model that produced these vectors. Retrieval
   * quality is only auditable when the persisted chunk records which model
   * embedded them — a real OpenAI model id vs. the degraded hash stub are NOT
   * interchangeable in pgvector cosine space. Optional so existing test doubles
   * keep compiling; the concrete factories always populate it.
   */
  readonly modelId?: string;
  /**
   * True when this embedder produces non-semantic placeholder vectors (the
   * sha256 hash stub). Degraded vectors corrupt cosine search, so callers MUST
   * either fail the ingest or stamp the upload/chunk row so retrieval results
   * are flagged untrustworthy. Real providers leave this `false`. Optional +
   * treated as `true` (untrusted) when absent — fail safe, not fail open.
   */
  readonly degraded?: boolean;
  embed(texts: ReadonlyArray<string>): Promise<ReadonlyArray<ReadonlyArray<number>>>;
}

/** True when an embedder must be treated as producing untrustworthy vectors. */
export function isDegradedEmbedder(embedder: Embedder): boolean {
  // Absent flag => unknown provenance => treat as degraded (fail safe).
  return embedder.degraded !== false;
}

/** Model id stamped on hash-stub vectors so degraded retrieval is auditable. */
export const STUB_EMBEDDER_MODEL_ID = 'stub-sha256-hash@1024';

export interface OpenAIEmbedderConfig {
  readonly apiKey: string;
  readonly baseUrl?: string;
  readonly model?: string;
  readonly batchSize?: number;
}

export function createOpenAIEmbedder(config: OpenAIEmbedderConfig): Embedder {
  const baseUrl = config.baseUrl ?? 'https://api.openai.com';
  const model = config.model ?? 'text-embedding-3-large';
  const batchSize = Math.max(1, Math.min(config.batchSize ?? 32, 256));
  return {
    dimensions: 1024,
    modelId: model,
    degraded: false,
    async embed(texts) {
      if (texts.length === 0) return Object.freeze([]);
      const out: number[][] = [];
      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        const response = await fetch(`${baseUrl}/v1/embeddings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify({ model, input: batch, dimensions: 1024 }),
        });
        if (!response.ok) {
          const body = await response.text();
          throw new Error(`openai embeddings ${response.status}: ${body.slice(0, 400)}`);
        }
        const json = (await response.json()) as { data?: Array<{ embedding?: number[] }> };
        const data = json.data ?? [];
        if (data.length !== batch.length) {
          throw new Error(`openai embeddings: expected ${batch.length} vectors, got ${data.length}`);
        }
        for (const row of data) {
          if (!Array.isArray(row.embedding)) {
            throw new Error('openai embeddings: missing embedding field');
          }
          out.push(row.embedding);
        }
      }
      return Object.freeze(out.map((v) => Object.freeze([...v])));
    },
  };
}

export function createStubEmbedder(): Embedder {
  return {
    dimensions: 1024,
    modelId: STUB_EMBEDDER_MODEL_ID,
    degraded: true,
    async embed(texts) {
      return Object.freeze(
        texts.map((text) => {
          const hash = createHash('sha256').update(text).digest();
          const vec = new Array<number>(1024);
          for (let i = 0; i < 1024; i++) {
            vec[i] = (hash[i % hash.length]! - 128) / 128;
          }
          return Object.freeze(vec);
        }),
      );
    },
  };
}

export async function embedChunks(
  embedder: Embedder,
  chunks: ReadonlyArray<TextChunk>,
): Promise<ReadonlyArray<EmbeddedChunk>> {
  if (chunks.length === 0) return Object.freeze([]);
  const vectors = await embedder.embed(chunks.map((c) => c.text));
  if (vectors.length !== chunks.length) {
    throw new Error(`embedder returned ${vectors.length} vectors for ${chunks.length} chunks`);
  }
  return Object.freeze(
    chunks.map((c, i) => Object.freeze({ ...c, embedding: vectors[i]! })),
  );
}

/** Minimal logger surface — matches the pino-shaped logger ingest.ts injects. */
export interface EmbedderResolverLogger {
  warn(obj: Record<string, unknown>, msg?: string): void;
}

/**
 * Raised when no real embedding provider is configured and degraded
 * hash-stub vectors are NOT permitted. Carries a stable `code` so callers can
 * surface an honest failure instead of silently indexing hash noise.
 */
export class EmbedderUnavailableError extends Error {
  readonly code = 'EMBEDDER_UNAVAILABLE';
  constructor(message: string) {
    super(message);
    this.name = 'EmbedderUnavailableError';
  }
}

/**
 * Resolve the embedder for an ingest run.
 *
 * When `OPENAI_API_KEY` is present we return the real OpenAI embedder. When it
 * is ABSENT we must never silently substitute the sha256 hash stub as if it
 * were real — hash vectors are non-semantic noise that corrupt pgvector cosine
 * search while reporting success (#21). Instead:
 *
 *   - In production (`NODE_ENV=production`), and anywhere the
 *     `BRAIN_EMBEDDER_FAIL_CLOSED` flag is not explicitly `'false'`, we FAIL the
 *     ingest by throwing `EmbedderUnavailableError`.
 *   - Otherwise (dev/test, or explicit `BRAIN_EMBEDDER_FAIL_CLOSED=false`) we
 *     emit a `warn` carrying the degraded `modelId` and return the stub
 *     embedder, whose `degraded` flag the caller stamps onto the upload/chunk
 *     row so retrieval quality stays auditable.
 */
export function resolveEmbedder(
  env: NodeJS.ProcessEnv = process.env,
  logger?: EmbedderResolverLogger,
): Embedder {
  const key = env.OPENAI_API_KEY?.trim();
  if (key) {
    return createOpenAIEmbedder({ apiKey: key });
  }

  const failClosed =
    env.BRAIN_EMBEDDER_FAIL_CLOSED === 'false'
      ? false
      : env.NODE_ENV === 'production' || env.BRAIN_EMBEDDER_FAIL_CLOSED === 'true';

  if (failClosed) {
    throw new EmbedderUnavailableError(
      'OPENAI_API_KEY not configured — refusing to index hash-stub vectors as ' +
        'real embeddings. Set OPENAI_API_KEY, or set ' +
        'BRAIN_EMBEDDER_FAIL_CLOSED=false to ingest in explicit degraded mode.',
    );
  }

  logger?.warn(
    { modelId: STUB_EMBEDDER_MODEL_ID, degraded: true },
    'brain-embedder: OPENAI_API_KEY unset — using DEGRADED hash-stub embedder; ' +
      'cosine retrieval over these chunks is not trustworthy',
  );
  return createStubEmbedder();
}
