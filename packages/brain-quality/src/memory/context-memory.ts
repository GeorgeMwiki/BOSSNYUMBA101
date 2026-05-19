/**
 * ContextMemory — turn-scoped tier 1.
 *
 * Fits inside the current LLM context window. Maintains a token budget
 * and evicts oldest messages first (except for any pinned system frame).
 * Pure data structure — no I/O. All operations return new instances
 * (immutability per coding-style rule).
 *
 * Maps to R3 #2 — three-tier memory, layer 1 (short-term).
 */

import { ContextMessageSchema, type ContextMessage } from '../types.js';

export interface ContextMemoryConfig {
  /** Hard token cap for the entire context window. Default 180k. */
  readonly maxTokens: number;
  /** Number of leading messages that are never evicted (e.g. system frame). */
  readonly pinnedHead: number;
}

const DEFAULT_CONFIG: ContextMemoryConfig = {
  maxTokens: 180_000,
  pinnedHead: 1,
};

export interface ContextMemorySnapshot {
  readonly messages: readonly ContextMessage[];
  readonly tokens: number;
  readonly config: ContextMemoryConfig;
}

/** Empty snapshot — factory ensures immutability. */
export function createContextMemory(
  config: Partial<ContextMemoryConfig> = {},
): ContextMemorySnapshot {
  const merged: ContextMemoryConfig = {
    maxTokens: config.maxTokens ?? DEFAULT_CONFIG.maxTokens,
    pinnedHead: Math.max(0, config.pinnedHead ?? DEFAULT_CONFIG.pinnedHead),
  };
  return Object.freeze({
    messages: Object.freeze([]),
    tokens: 0,
    config: Object.freeze(merged),
  });
}

/**
 * Append a message, evicting oldest non-pinned messages until under cap.
 * Returns a new snapshot — never mutates the input.
 */
export function appendMessage(
  snapshot: ContextMemorySnapshot,
  message: ContextMessage,
): ContextMemorySnapshot {
  const validated = ContextMessageSchema.parse(message);
  const next: ContextMessage[] = [...snapshot.messages, validated];
  let totalTokens = snapshot.tokens + validated.tokens;

  // Evict from after pinned head until under budget.
  while (
    totalTokens > snapshot.config.maxTokens &&
    next.length > snapshot.config.pinnedHead
  ) {
    const evicted = next.splice(snapshot.config.pinnedHead, 1)[0];
    if (!evicted) {
      break;
    }
    totalTokens -= evicted.tokens;
  }

  return Object.freeze({
    messages: Object.freeze(next),
    tokens: totalTokens,
    config: snapshot.config,
  });
}

/** Returns true iff the snapshot is within its token budget. */
export function isWithinBudget(snapshot: ContextMemorySnapshot): boolean {
  return snapshot.tokens <= snapshot.config.maxTokens;
}

/** Token-aware rough estimator — 4 chars per token (matches Anthropic guidance). */
export function estimateTokens(text: string): number {
  if (!text) {
    return 0;
  }
  return Math.ceil(text.length / 4);
}
