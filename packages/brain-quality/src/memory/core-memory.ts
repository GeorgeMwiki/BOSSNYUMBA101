/**
 * CoreMemory — session-scoped tier 2 (MemGPT / Letta).
 *
 * Explicit paging blocks the MD reads/writes via tool calls. Persists for
 * the duration of a session. Three exported tool-call entrypoints:
 *
 *   - appendCore({ kind, text })          // add to an existing block
 *   - replaceCore({ kind, text })         // overwrite block (with archival)
 *   - searchCore({ query, limit? })       // substring + kind-prefix search
 *
 * The MD invokes these as MCP tools; this module is the in-memory backing
 * store. The DB-backed mirror lives in 0151_core_memory_blocks.sql (already
 * shipped in Phase D8). This impl uses Map-of-Map for deterministic tests.
 *
 * Maps to R3 #2 — three-tier memory, layer 2 (medium-term).
 */

import { randomUUID } from 'node:crypto';

import { CoreBlockSchema, type CoreBlock } from '../types.js';
import { estimateTokens } from './context-memory.js';

export type CoreBlockKind = CoreBlock['kind'];

const CORE_BLOCK_KINDS: readonly CoreBlockKind[] = [
  'persona',
  'human',
  'preferences',
  'project',
  'scratchpad',
];

export interface CoreMemoryConfig {
  /** Per-block token cap. Default 800 tokens (~3200 chars). */
  readonly maxTokensPerBlock: number;
  /** Total token cap across all blocks. Default 4000 tokens. */
  readonly maxTokensTotal: number;
}

const DEFAULT_CONFIG: CoreMemoryConfig = {
  maxTokensPerBlock: 800,
  maxTokensTotal: 4000,
};

export interface CoreMemoryState {
  readonly blocks: ReadonlyMap<string, CoreBlock>;
  readonly tokens: number;
  readonly config: CoreMemoryConfig;
}

export function createCoreMemory(
  config: Partial<CoreMemoryConfig> = {},
): CoreMemoryState {
  return Object.freeze({
    blocks: new Map<string, CoreBlock>(),
    tokens: 0,
    config: Object.freeze({
      maxTokensPerBlock:
        config.maxTokensPerBlock ?? DEFAULT_CONFIG.maxTokensPerBlock,
      maxTokensTotal: config.maxTokensTotal ?? DEFAULT_CONFIG.maxTokensTotal,
    }),
  });
}

export class CoreMemoryOverflowError extends Error {
  constructor(
    public readonly kind: CoreBlockKind,
    public readonly attemptedTokens: number,
    public readonly capTokens: number,
  ) {
    super(
      `Core block "${kind}" exceeds cap: ${attemptedTokens} > ${capTokens} tokens`,
    );
    this.name = 'CoreMemoryOverflowError';
  }
}

export class UnknownCoreBlockKindError extends Error {
  constructor(public readonly kind: string) {
    super(
      `Unknown core block kind "${kind}" (valid: ${CORE_BLOCK_KINDS.join(', ')})`,
    );
    this.name = 'UnknownCoreBlockKindError';
  }
}

function assertKind(kind: string): asserts kind is CoreBlockKind {
  if (!CORE_BLOCK_KINDS.includes(kind as CoreBlockKind)) {
    throw new UnknownCoreBlockKindError(kind);
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

function buildBlock(
  kind: CoreBlockKind,
  text: string,
  prior?: CoreBlock,
): CoreBlock {
  const now = nowIso();
  const candidate: CoreBlock = {
    id: prior?.id ?? randomUUID(),
    kind,
    text,
    tokens: estimateTokens(text),
    createdAt: prior?.createdAt ?? now,
    updatedAt: now,
  };
  // Validate at the boundary — defensive even though we built it.
  CoreBlockSchema.parse(candidate);
  return Object.freeze(candidate);
}

function recomputeTokens(blocks: ReadonlyMap<string, CoreBlock>): number {
  let total = 0;
  for (const block of blocks.values()) {
    total += block.tokens;
  }
  return total;
}

/**
 * Tool-call entrypoint: append (concat) to the block of the given kind.
 * If the block does not exist, it is created.
 */
export function appendCore(
  state: CoreMemoryState,
  args: { readonly kind: string; readonly text: string },
): CoreMemoryState {
  assertKind(args.kind);
  const text = String(args.text ?? '');
  if (text.length === 0) {
    return state;
  }

  const next = new Map(state.blocks);
  const prior = next.get(args.kind);
  const combined = prior ? `${prior.text}\n${text}` : text;
  const updated = buildBlock(args.kind, combined, prior);

  if (updated.tokens > state.config.maxTokensPerBlock) {
    throw new CoreMemoryOverflowError(
      args.kind,
      updated.tokens,
      state.config.maxTokensPerBlock,
    );
  }
  next.set(args.kind, updated);

  const newTotal = recomputeTokens(next);
  if (newTotal > state.config.maxTokensTotal) {
    throw new CoreMemoryOverflowError(
      args.kind,
      newTotal,
      state.config.maxTokensTotal,
    );
  }

  return Object.freeze({
    blocks: next,
    tokens: newTotal,
    config: state.config,
  });
}

/** Tool-call entrypoint: replace (overwrite) the block of the given kind. */
export function replaceCore(
  state: CoreMemoryState,
  args: { readonly kind: string; readonly text: string },
): CoreMemoryState {
  assertKind(args.kind);
  const text = String(args.text ?? '');
  const next = new Map(state.blocks);
  const prior = next.get(args.kind);

  if (text.length === 0) {
    next.delete(args.kind);
    return Object.freeze({
      blocks: next,
      tokens: recomputeTokens(next),
      config: state.config,
    });
  }

  const updated = buildBlock(args.kind, text, prior);
  if (updated.tokens > state.config.maxTokensPerBlock) {
    throw new CoreMemoryOverflowError(
      args.kind,
      updated.tokens,
      state.config.maxTokensPerBlock,
    );
  }
  next.set(args.kind, updated);

  const newTotal = recomputeTokens(next);
  if (newTotal > state.config.maxTokensTotal) {
    throw new CoreMemoryOverflowError(
      args.kind,
      newTotal,
      state.config.maxTokensTotal,
    );
  }

  return Object.freeze({
    blocks: next,
    tokens: newTotal,
    config: state.config,
  });
}

/**
 * Tool-call entrypoint: case-insensitive substring search across blocks.
 * Returns a copy of the matching blocks; never mutates the store.
 */
export function searchCore(
  state: CoreMemoryState,
  args: { readonly query: string; readonly limit?: number },
): readonly CoreBlock[] {
  const query = (args.query ?? '').trim().toLowerCase();
  const limit = Math.max(1, Math.min(args.limit ?? 5, 25));
  if (query.length === 0) {
    return [];
  }

  const hits: CoreBlock[] = [];
  for (const block of state.blocks.values()) {
    if (block.text.toLowerCase().includes(query)) {
      hits.push(block);
    }
  }
  hits.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  return Object.freeze(hits.slice(0, limit));
}

/** Returns the block of the given kind (or undefined). */
export function getCoreBlock(
  state: CoreMemoryState,
  kind: string,
): CoreBlock | undefined {
  return state.blocks.get(kind);
}

/** Renders all core blocks into a single string for prompt injection. */
export function renderCoreBlocks(state: CoreMemoryState): string {
  const ordered = CORE_BLOCK_KINDS.filter((k) => state.blocks.has(k)).map(
    (k) => state.blocks.get(k)!,
  );
  return ordered.map((b) => `## ${b.kind}\n${b.text}`).join('\n\n');
}

export const SUPPORTED_CORE_BLOCK_KINDS: readonly CoreBlockKind[] =
  CORE_BLOCK_KINDS;
