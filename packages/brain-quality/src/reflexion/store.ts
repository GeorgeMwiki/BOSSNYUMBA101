/**
 * In-memory ReflectionStore — embedding-indexed retrieval over reflection
 * notes. Production callers will swap this for a pgvector-backed mirror;
 * keeping the interface stable lets us inject either at the kernel.
 *
 * Maps to R3 #3 — Reflexion outer loop, retrieval side.
 */

import type { Embedding, ReflectionNote } from '../types.js';

export interface ReflectionStore {
  put(note: ReflectionNote): Promise<void> | void;
  /** Top-k cosine-similar notes for the given query embedding. */
  topK(
    queryEmbedding: Embedding,
    k: number,
    filter?: { readonly taskType?: string },
  ): Promise<readonly ReflectionNote[]> | readonly ReflectionNote[];
  size(): number;
}

export function cosineSimilarity(a: Embedding, b: Embedding): number {
  if (a.length === 0 || a.length !== b.length) {
    return 0;
  }
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i += 1) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    dot += ai * bi;
    magA += ai * ai;
    magB += bi * bi;
  }
  if (magA === 0 || magB === 0) {
    return 0;
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

/** Reference impl backed by an in-memory list. Deterministic + testable. */
export function createInMemoryReflectionStore(): ReflectionStore {
  const notes: ReflectionNote[] = [];

  return {
    put(note) {
      notes.push(note);
    },
    topK(queryEmbedding, k, filter) {
      const safeK = Math.max(1, Math.min(k, 50));
      const candidates = filter?.taskType
        ? notes.filter((n) => n.taskType === filter.taskType)
        : notes;
      const scored = candidates.map((note) => ({
        note,
        score: cosineSimilarity(queryEmbedding, note.embedding),
      }));
      scored.sort((a, b) => b.score - a.score);
      return Object.freeze(scored.slice(0, safeK).map((s) => s.note));
    },
    size() {
      return notes.length;
    },
  };
}
