/**
 * Anthropic `/memories` tool wiring — file-based per-thread scratchpad.
 *
 * This is NOT the same as the LITFIN four-tier domain memory hierarchy
 * (episodic / semantic / procedural / reflective) — those store
 * *property-management* facts. The `/memories` primitive is the MD's
 * OWN working notebook: a chunk of files, scoped to one thread, that
 * the MD reads + writes between turns to remember its plan, partial
 * computations, intermediate tool outputs, etc.
 *
 * Storage shape:
 *
 *   /memories/thread_<threadId>/
 *   ├── plan.md
 *   ├── scratch.md
 *   └── tool-cache/<callId>.json
 *
 * The port is pure-async — composition root wires an S3 / local-disk /
 * Postgres-jsonb adapter; tests use the in-memory implementation.
 */

import type { ScopeContext } from '../../types.js';

// ─────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────

export interface MemoryEntry {
  readonly path: string;
  readonly content: string;
  readonly updatedAt: string;
}

export interface MemoryRecallArgs {
  readonly scope: ScopeContext;
  /** Optional path prefix to filter — default returns the whole thread. */
  readonly prefix?: string;
  /** Max entries returned. */
  readonly limit?: number;
}

export interface MemoryRecallResult {
  readonly entries: ReadonlyArray<MemoryEntry>;
  readonly totalBytes: number;
}

export interface MemoryTool {
  /** Bulk recall used by the orchestrator at the start of each tick. */
  recall(args: MemoryRecallArgs): Promise<MemoryRecallResult>;
  read(threadId: string, path: string): Promise<MemoryEntry | null>;
  write(threadId: string, path: string, content: string): Promise<MemoryEntry>;
  list(threadId: string, prefix?: string): Promise<ReadonlyArray<string>>;
  delete(threadId: string, path: string): Promise<boolean>;
}

// ─────────────────────────────────────────────────────────────────────
// Path safety — defence-in-depth so a hostile path escape (..) can't
// reach another thread's memory bucket.
// ─────────────────────────────────────────────────────────────────────

export class MemoryPathError extends Error {
  constructor(public readonly path: string) {
    super(`unsafe memory path: ${path}`);
    this.name = 'MemoryPathError';
  }
}

export function safeMemoryPath(threadId: string, raw: string): string {
  if (!threadId || /[^a-zA-Z0-9_\-]/.test(threadId)) {
    throw new MemoryPathError(threadId);
  }
  const trimmed = raw.replace(/^\/+/, '');
  if (trimmed.includes('..') || trimmed.includes('\\')) {
    throw new MemoryPathError(raw);
  }
  return `/memories/thread_${threadId}/${trimmed}`;
}

// ─────────────────────────────────────────────────────────────────────
// In-memory MemoryTool — test fixture + early composition.
// ─────────────────────────────────────────────────────────────────────

export function createInMemoryMemoryTool(
  clock: () => Date = () => new Date(),
): MemoryTool {
  const store = new Map<string, MemoryEntry>();

  function threadIdOfScope(scope: ScopeContext): string {
    return scope.kind === 'platform' ? '_platform' : scope.tenantId;
  }

  async function recall(
    args: MemoryRecallArgs,
  ): Promise<MemoryRecallResult> {
    const threadId = threadIdOfScope(args.scope);
    const prefix = safeMemoryPath(threadId, args.prefix ?? '');
    const entries: MemoryEntry[] = [];
    let totalBytes = 0;
    for (const [path, entry] of store) {
      if (!path.startsWith(prefix)) continue;
      entries.push(entry);
      totalBytes += entry.content.length;
      if (args.limit && entries.length >= args.limit) break;
    }
    return { entries, totalBytes };
  }

  async function read(
    threadId: string,
    path: string,
  ): Promise<MemoryEntry | null> {
    return store.get(safeMemoryPath(threadId, path)) ?? null;
  }

  async function write(
    threadId: string,
    path: string,
    content: string,
  ): Promise<MemoryEntry> {
    const full = safeMemoryPath(threadId, path);
    const entry: MemoryEntry = {
      path: full,
      content,
      updatedAt: clock().toISOString(),
    };
    store.set(full, entry);
    return entry;
  }

  async function list(
    threadId: string,
    prefix?: string,
  ): Promise<ReadonlyArray<string>> {
    const base = safeMemoryPath(threadId, prefix ?? '');
    return [...store.keys()].filter((k) => k.startsWith(base));
  }

  async function del(
    threadId: string,
    path: string,
  ): Promise<boolean> {
    const full = safeMemoryPath(threadId, path);
    return store.delete(full);
  }

  return { recall, read, write, list, delete: del };
}
