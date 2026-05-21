/**
 * Hybrid retrieval — BM25 + vector union via Reciprocal Rank Fusion.
 *
 * Per Cormack et al. (TREC 2009) RRF combines two rankings by summing
 * `1 / (k + rank_i)` for each document over the two rank lists. The
 * constant `k=60` is the canonical default (Cormack-Cleverdon-Voorhees);
 * we use the same here so callers can reason about the score scale
 * across the codebase.
 *
 * Inputs:
 *   - BM25 candidate list  (top 30)
 *   - Vector candidate list (top 30)
 *
 * Output: top-8 unique candidate texts as a `ReadonlyArray<string>` —
 * the shape `kernel.ts` already passes to Self-RAG as
 * `retrievedContext`. The score is internal; the caller only needs
 * the de-duplicated ranked text.
 *
 * Pure logic — the two retrieval branches are delegated to an injected
 * `HybridRetrievalRepo` port. No I/O here.
 */

import type { HybridRetrievalRepo, RetrievalCandidate } from './types-amem.js';

/** Cormack-Cleverdon-Voorhees RRF constant. */
export const RRF_K = 60;

/** Default per-source candidate pool size. */
export const PER_SOURCE_LIMIT = 30;

/** Default final top-N returned to the caller. */
export const DEFAULT_TOP_N = 8;

/**
 * Compose the merged top-`topN` retrieval context for the given user
 * message. Embedded by `embedder` once and routed to both BM25 and
 * vector branches in parallel.
 */
export async function buildRetrievedContext(
  tenantId: string,
  sessionId: string,
  userMsg: string,
  embedder: (text: string) => Promise<ReadonlyArray<number>>,
  repo: HybridRetrievalRepo,
  options?: {
    readonly topN?: number;
    readonly perSourceLimit?: number;
  },
): Promise<ReadonlyArray<string>> {
  if (typeof embedder !== 'function') {
    throw new Error('hybrid-retrieval: embedder is required');
  }
  if (
    !repo ||
    typeof repo.searchBm25 !== 'function' ||
    typeof repo.searchVector !== 'function'
  ) {
    throw new Error('hybrid-retrieval: repo must implement searchBm25 + searchVector');
  }
  const trimmed = (userMsg ?? '').trim();
  if (trimmed.length === 0) return [];

  const topN = clamp(options?.topN ?? DEFAULT_TOP_N, 1, 50);
  const perSource = clamp(
    options?.perSourceLimit ?? PER_SOURCE_LIMIT,
    1,
    200,
  );

  // Run both branches concurrently — they are independent.
  const [bm25Raw, embedding] = await Promise.all([
    safeSearchBm25(repo, tenantId, sessionId, trimmed, perSource),
    safeEmbed(embedder, trimmed),
  ]);
  const vectorRaw =
    embedding.length === 0
      ? []
      : await safeSearchVector(repo, tenantId, sessionId, embedding, perSource);

  const fused = reciprocalRankFusion(bm25Raw, vectorRaw);
  return fused.slice(0, topN).map((entry) => entry.text);
}

// ─────────────────────────────────────────────────────────────────────
// RRF — exported for unit testing the fusion stage independently.
// ─────────────────────────────────────────────────────────────────────

export interface FusedEntry {
  readonly id: string;
  readonly text: string;
  readonly score: number;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Reciprocal Rank Fusion. `score(doc) = Σ 1/(K + rank_i)` summed
 * across both rank lists; rank is 1-based. Returns a stable-sorted
 * descending array; ties are broken by id for determinism.
 */
export function reciprocalRankFusion(
  bm25: ReadonlyArray<RetrievalCandidate>,
  vector: ReadonlyArray<RetrievalCandidate>,
  k: number = RRF_K,
): ReadonlyArray<FusedEntry> {
  const scores = new Map<
    string,
    { score: number; text: string; metadata?: Record<string, unknown> }
  >();

  function ingest(
    list: ReadonlyArray<RetrievalCandidate>,
    weight = 1,
  ): void {
    for (let i = 0; i < list.length; i += 1) {
      const cand = list[i];
      if (!cand || typeof cand.id !== 'string' || cand.id.length === 0) {
        continue;
      }
      const rank = i + 1;
      const contribution = weight / (k + rank);
      const prev = scores.get(cand.id);
      if (prev) {
        const merged: { score: number; text: string; metadata?: Record<string, unknown> } = {
          score: prev.score + contribution,
          text: prev.text,
        };
        const meta = prev.metadata ?? cand.metadata;
        if (meta !== undefined) merged.metadata = meta;
        scores.set(cand.id, merged);
      } else {
        const fresh: { score: number; text: string; metadata?: Record<string, unknown> } = {
          score: contribution,
          text: cand.text ?? '',
        };
        if (cand.metadata !== undefined) fresh.metadata = cand.metadata;
        scores.set(cand.id, fresh);
      }
    }
  }

  ingest(bm25);
  ingest(vector);

  const merged: FusedEntry[] = Array.from(scores.entries()).map(
    ([id, val]): FusedEntry => {
      const entry: { id: string; text: string; score: number; metadata?: Record<string, unknown> } = {
        id,
        text: val.text,
        score: val.score,
      };
      if (val.metadata !== undefined) entry.metadata = val.metadata;
      return entry;
    },
  );

  merged.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // Deterministic tie-breaker so two equal-score docs never reshuffle.
    return a.id.localeCompare(b.id);
  });
  return merged;
}

// ─────────────────────────────────────────────────────────────────────
// Internal helpers — fail-soft wrappers so a flaky branch never blanks
// the retrieved context completely. Either branch returning empty is
// safe; both empty produces an empty result.
// ─────────────────────────────────────────────────────────────────────

async function safeSearchBm25(
  repo: HybridRetrievalRepo,
  tenantId: string,
  sessionId: string,
  query: string,
  limit: number,
): Promise<ReadonlyArray<RetrievalCandidate>> {
  try {
    return await repo.searchBm25({ tenantId, sessionId, query, limit });
  } catch {
    return [];
  }
}

async function safeSearchVector(
  repo: HybridRetrievalRepo,
  tenantId: string,
  sessionId: string,
  embedding: ReadonlyArray<number>,
  limit: number,
): Promise<ReadonlyArray<RetrievalCandidate>> {
  try {
    return await repo.searchVector({
      tenantId,
      sessionId,
      embedding,
      limit,
    });
  } catch {
    return [];
  }
}

async function safeEmbed(
  embedder: (text: string) => Promise<ReadonlyArray<number>>,
  text: string,
): Promise<ReadonlyArray<number>> {
  try {
    const out = await embedder(text);
    return Array.from(out ?? []);
  } catch {
    return [];
  }
}

function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  if (n < lo) return lo;
  if (n > hi) return hi;
  return n;
}
