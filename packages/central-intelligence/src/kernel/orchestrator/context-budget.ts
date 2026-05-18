/**
 * Context budget — keeps the assembled prompt under the 80%-of-window
 * threshold so the model retains headroom for its own response.
 *
 * Two responsibilities:
 *
 *   1. `compactIfOver(transcript, ratio)` — when the rolling transcript
 *      exceeds `ratio * windowSize` tokens, fold the oldest turns into
 *      a synopsis block ("[summary of turns 1..N]") so the recent
 *      turns survive intact.
 *
 *   2. `ToolSearch` primitive — instead of loading the full tool
 *      registry into every request, expose a `searchRelevant(goal, k)`
 *      surface that returns the top-k tools by goal-similarity. Mirrors
 *      Anthropic's deferred-tool ToolSearch pattern.
 *
 * The compactor is provider-agnostic; token counts come from an injected
 * `tokenCounter` so tests run with a deterministic word-count stub and
 * production wires tiktoken / Anthropic's counter.
 */

import type { TranscriptTurn } from './checkpoint.js';

// ─────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────

export const DEFAULT_WINDOW_TOKENS = 200_000;
export const DEFAULT_COMPACT_RATIO = 0.8;
export const DEFAULT_KEEP_RECENT_TURNS = 6;

// ─────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────

export interface TokenCounter {
  count(text: string): number;
}

export interface ContextBudgetDeps {
  readonly windowTokens?: number;
  readonly keepRecentTurns?: number;
  readonly tokenCounter?: TokenCounter;
  /** Optional caller-supplied synopsis function — receives folded turns. */
  readonly summarise?: (
    turns: ReadonlyArray<TranscriptTurn>,
  ) => Promise<string>;
}

export interface CompactionOutcome {
  readonly turns: ReadonlyArray<TranscriptTurn>;
  readonly compacted: boolean;
  readonly originalTokens: number;
  readonly finalTokens: number;
  readonly synopsisInsertedAt: number;
}

export interface ContextBudget {
  compactIfOver(
    transcript: ReadonlyArray<TranscriptTurn>,
    ratio?: number,
  ): Promise<CompactionOutcome>;
  countTokens(text: string): number;
}

// ─────────────────────────────────────────────────────────────────────
// ToolSearch — deferred-tool primitive.
// ─────────────────────────────────────────────────────────────────────

export interface ToolDescriptor {
  readonly name: string;
  readonly description: string;
  readonly keywords: ReadonlyArray<string>;
}

export interface ToolSearch {
  /** Top-k tools by overlap between the goal text and each tool's keywords. */
  searchRelevant(goal: string, k: number): Promise<ReadonlyArray<ToolDescriptor>>;
}

// ─────────────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────────────

export function createContextBudget(
  deps: ContextBudgetDeps = {},
): ContextBudget {
  const windowTokens = deps.windowTokens ?? DEFAULT_WINDOW_TOKENS;
  const keepRecent = deps.keepRecentTurns ?? DEFAULT_KEEP_RECENT_TURNS;
  const counter = deps.tokenCounter ?? createWordCountTokenCounter();
  const summariser = deps.summarise ?? defaultSummariser;

  function countTokens(text: string): number {
    return counter.count(text);
  }

  function tokensOf(turns: ReadonlyArray<TranscriptTurn>): number {
    return turns.reduce((sum, t) => sum + counter.count(t.content), 0);
  }

  async function compactIfOver(
    transcript: ReadonlyArray<TranscriptTurn>,
    ratio: number = DEFAULT_COMPACT_RATIO,
  ): Promise<CompactionOutcome> {
    const originalTokens = tokensOf(transcript);
    const threshold = Math.floor(windowTokens * ratio);
    if (originalTokens <= threshold) {
      return {
        turns: transcript,
        compacted: false,
        originalTokens,
        finalTokens: originalTokens,
        synopsisInsertedAt: -1,
      };
    }
    const recent = transcript.slice(-keepRecent);
    const older = transcript.slice(0, transcript.length - keepRecent);
    const synopsis = await summariser(older);
    const synopsisTurn: TranscriptTurn = {
      role: 'assistant',
      content: `[synopsis of ${older.length} earlier turns]\n${synopsis}`,
      timestamp: new Date().toISOString(),
    };
    const next = [synopsisTurn, ...recent];
    return {
      turns: next,
      compacted: true,
      originalTokens,
      finalTokens: tokensOf(next),
      synopsisInsertedAt: 0,
    };
  }

  return { compactIfOver, countTokens };
}

// ─────────────────────────────────────────────────────────────────────
// Default in-memory ToolSearch — keyword overlap ranker.
// ─────────────────────────────────────────────────────────────────────

export function createInMemoryToolSearch(
  tools: ReadonlyArray<ToolDescriptor>,
): ToolSearch {
  return {
    async searchRelevant(
      goal: string,
      k: number,
    ): Promise<ReadonlyArray<ToolDescriptor>> {
      const goalTokens = tokenise(goal);
      const ranked = tools
        .map((t) => ({
          tool: t,
          score: overlap(goalTokens, [...t.keywords, ...tokenise(t.description)]),
        }))
        .filter((r) => r.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, Math.max(1, k))
        .map((r) => r.tool);
      return ranked;
    },
  };
}

// ─────────────────────────────────────────────────────────────────────
// Internal — token counter + summariser defaults.
// ─────────────────────────────────────────────────────────────────────

function createWordCountTokenCounter(): TokenCounter {
  return {
    count(text: string): number {
      if (!text) return 0;
      // Cheap heuristic: 1 token ≈ 0.75 words. Tests override via dep.
      const words = text.trim().split(/\s+/).filter(Boolean).length;
      return Math.ceil(words / 0.75);
    },
  };
}

async function defaultSummariser(
  turns: ReadonlyArray<TranscriptTurn>,
): Promise<string> {
  const parts = turns.map((t) => `${t.role}: ${t.content.slice(0, 80)}`);
  return parts.join('\n');
}

function tokenise(text: string): ReadonlyArray<string> {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2);
}

function overlap(
  a: ReadonlyArray<string>,
  b: ReadonlyArray<string>,
): number {
  const setA = new Set(a);
  let count = 0;
  for (const w of b) if (setA.has(w)) count += 1;
  return count;
}
