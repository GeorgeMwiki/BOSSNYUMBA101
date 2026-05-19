/**
 * File checkpointing — Phase K-A, R1 parity gap #4.
 *
 * Per-owner-message UUID-keyed snapshots of file content. Restores
 * "undo" to a first-class user action and gives the orchestrator a
 * recovery primitive when an agent action proves wrong.
 *
 * Mirrors Claude Code's file-checkpointing semantics
 * (`.research/r1-claude-code-parity-audit.md` §C.2):
 *
 *   1. Every owner message (the user's turn in the transcript) is
 *      stamped with a stable `checkpointUuid`.
 *   2. Each subsequent `Write` / `Edit` / `NotebookEdit` tool call
 *      records the file's BEFORE bytes into a snapshot keyed by the
 *      current message UUID.
 *   3. `rewindFiles(uuid)` walks every snapshot taken AFTER `uuid`
 *      (i.e. messages newer than the target) and restores the file
 *      content to what it was at the moment of the target message.
 *
 * Storage: the snapshot store is the Phase K-A SessionStore. We key
 * snapshots under `session:<sessionId>:checkpoint:<uuid>` so a worker
 * restart loses nothing — the SessionStore's Redis / Postgres adapter
 * keeps the bytes durable. The in-memory store is fine for tests.
 *
 * Limitations (parity-faithful with Claude Code):
 *   - Only Write/Edit/NotebookEdit are tracked. Bash-driven file
 *     changes (`echo > x`, `sed -i`) are NOT in scope.
 *   - File content only; directory create/move/delete is not undone.
 *   - Same-session only; you cannot rewind across a session boundary.
 *
 * The module is intentionally STORAGE-AGNOSTIC: it talks to a
 * `FileStore` port for the actual disk reads/writes (so tests can
 * use an in-memory file map) and to a `SessionStore` port for the
 * snapshot persistence (so production uses Redis/Postgres and tests
 * use in-memory). Composition wires both at startup.
 */

import type { SessionStore } from '../session-store/types.js';

// ─────────────────────────────────────────────────────────────────────
// File store port — narrow surface the checkpointer needs to capture
// + restore file content. Operators wire an `fs.promises` adapter at
// composition; tests use an in-memory implementation (below).
// ─────────────────────────────────────────────────────────────────────

export interface FileStore {
  /**
   * Read the current bytes of `path`. Returns `null` when the file
   * does not exist yet (e.g. the snapshot is recording a CREATE).
   */
  read(path: string): Promise<string | null>;
  /** Write `content` to `path`, overwriting any existing file. */
  write(path: string, content: string): Promise<void>;
  /** Delete `path`. Idempotent — returns `true` if removed. */
  delete(path: string): Promise<boolean>;
  /** Returns `true` when the file currently exists. */
  exists(path: string): Promise<boolean>;
}

// ─────────────────────────────────────────────────────────────────────
// Snapshot shape — one entry per file mutation. The store stamps it
// with the message UUID active at the time of the write.
// ─────────────────────────────────────────────────────────────────────

export interface FileSnapshotEntry {
  readonly path: string;
  /** BEFORE bytes; `null` means the file did not exist (create). */
  readonly previousContent: string | null;
  /** AFTER bytes; mirror of what was written. */
  readonly nextContent: string;
  readonly capturedAt: string;
}

export interface MessageCheckpoint {
  readonly sessionId: string;
  readonly checkpointUuid: string;
  /**
   * UUIDs of earlier checkpoints in the same session, ordered
   * oldest-first. Used by `rewindFiles` to reconstruct the chain.
   */
  readonly parentChain: ReadonlyArray<string>;
  readonly capturedAt: string;
  readonly entries: ReadonlyArray<FileSnapshotEntry>;
}

// ─────────────────────────────────────────────────────────────────────
// Public port — operator-facing.
// ─────────────────────────────────────────────────────────────────────

export interface FileCheckpointer {
  /**
   * Begin a new owner-message checkpoint. Pass the parent chain (all
   * prior message UUIDs in the session, ordered oldest-first) so a
   * later `rewindFiles` can compute "checkpoints newer than target".
   * Returns the freshly-allocated UUID.
   */
  beginMessage(sessionId: string, parentChain: ReadonlyArray<string>): Promise<string>;
  /**
   * Record a single file mutation under the currently-active message.
   * Captures the BEFORE bytes from the FileStore so a rewind can
   * restore them. The AFTER bytes are written by the CALLER (i.e. the
   * tool dispatcher) — this method does NOT touch the FileStore.
   */
  recordFileWrite(
    sessionId: string,
    checkpointUuid: string,
    path: string,
    nextContent: string,
  ): Promise<FileSnapshotEntry>;
  /**
   * Restore every file mentioned in any checkpoint taken AFTER `uuid`
   * (chronologically) back to the state it had when `uuid` was the
   * active message. Subsequent (post-rewind) checkpoints are dropped.
   * Returns the list of paths that were restored.
   */
  rewindFiles(
    sessionId: string,
    targetCheckpointUuid: string,
  ): Promise<ReadonlyArray<string>>;
  /** Read a single checkpoint by UUID. */
  getCheckpoint(
    sessionId: string,
    checkpointUuid: string,
  ): Promise<MessageCheckpoint | null>;
  /** List all checkpoints for a session, oldest-first. */
  listCheckpoints(sessionId: string): Promise<ReadonlyArray<MessageCheckpoint>>;
}

// ─────────────────────────────────────────────────────────────────────
// Storage helpers — encode/decode the checkpoint shape as a single
// SessionStore snapshot. We key one SessionStore row per checkpoint
// UUID using a composite sessionId — this means a single session can
// have many SessionStore entries, one per message.
// ─────────────────────────────────────────────────────────────────────

const CHECKPOINT_KEY_PREFIX = 'fc:'; // file-checkpoint
const INDEX_KEY_SUFFIX = ':index';

function snapshotKey(sessionId: string, checkpointUuid: string): string {
  return `${CHECKPOINT_KEY_PREFIX}${sessionId}:${checkpointUuid}`;
}

function indexKey(sessionId: string): string {
  return `${CHECKPOINT_KEY_PREFIX}${sessionId}${INDEX_KEY_SUFFIX}`;
}

interface CheckpointIndex {
  readonly checkpointUuids: ReadonlyArray<string>;
}

// ─────────────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────────────

export interface FileCheckpointerDeps {
  readonly fileStore: FileStore;
  readonly sessionStore: SessionStore;
  /** Stable UUID generator. Defaults to `crypto.randomUUID()`. */
  readonly uuid?: () => string;
  /** Clock used for `capturedAt`. Defaults to `() => new Date()`. */
  readonly clock?: () => Date;
}

export function createFileCheckpointer(
  deps: FileCheckpointerDeps,
): FileCheckpointer {
  const { fileStore, sessionStore } = deps;
  const uuid = deps.uuid ?? ((): string => {
    // Node 19+ exposes crypto.randomUUID at the global; we use it
    // without the import dance.
    const g = globalThis as unknown as {
      crypto?: { randomUUID?: () => string };
    };
    if (g.crypto?.randomUUID) return g.crypto.randomUUID();
    // Fallback: not cryptographically strong but stable for tests.
    const rnd = (): string =>
      Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0');
    return `${rnd()}-${rnd()}-${rnd()}-${rnd()}`;
  });
  const clock = deps.clock ?? ((): Date => new Date());

  async function readIndex(sessionId: string): Promise<string[]> {
    const snap = await sessionStore.read(indexKey(sessionId));
    if (!snap) return [];
    const payload = snap.payload as Partial<CheckpointIndex>;
    return Array.isArray(payload.checkpointUuids)
      ? [...payload.checkpointUuids]
      : [];
  }

  async function writeIndex(
    sessionId: string,
    checkpointUuids: ReadonlyArray<string>,
  ): Promise<void> {
    await sessionStore.write({
      sessionId: indexKey(sessionId),
      tenantId: null, // index rows are not tenant-keyed; the underlying
      // checkpoint rows carry tenantId in their payload via the
      // session's actual snapshot envelope. Operators with multi-tenant
      // Postgres should pass the same tenantId on every checkpoint via
      // the helper `withTenant` below if they want set-level isolation.
      personaId: 'file-checkpoint',
      capturedAt: clock().toISOString(),
      payload: { checkpointUuids: [...checkpointUuids] },
    });
  }

  async function readCheckpoint(
    sessionId: string,
    checkpointUuid: string,
  ): Promise<MessageCheckpoint | null> {
    const snap = await sessionStore.read(snapshotKey(sessionId, checkpointUuid));
    if (!snap) return null;
    const p = snap.payload as Partial<MessageCheckpoint>;
    if (typeof p.sessionId !== 'string' || typeof p.checkpointUuid !== 'string') {
      return null;
    }
    return {
      sessionId: p.sessionId,
      checkpointUuid: p.checkpointUuid,
      parentChain: Array.isArray(p.parentChain) ? [...p.parentChain] : [],
      capturedAt:
        typeof p.capturedAt === 'string' ? p.capturedAt : snap.capturedAt,
      entries: Array.isArray(p.entries) ? [...p.entries] : [],
    };
  }

  async function writeCheckpoint(cp: MessageCheckpoint): Promise<void> {
    await sessionStore.write({
      sessionId: snapshotKey(cp.sessionId, cp.checkpointUuid),
      tenantId: null,
      personaId: 'file-checkpoint',
      capturedAt: cp.capturedAt,
      payload: { ...cp },
    });
  }

  async function beginMessage(
    sessionId: string,
    parentChain: ReadonlyArray<string>,
  ): Promise<string> {
    const id = uuid();
    const cp: MessageCheckpoint = {
      sessionId,
      checkpointUuid: id,
      parentChain: [...parentChain],
      capturedAt: clock().toISOString(),
      entries: [],
    };
    await writeCheckpoint(cp);
    const idx = await readIndex(sessionId);
    idx.push(id);
    await writeIndex(sessionId, idx);
    return id;
  }

  async function recordFileWrite(
    sessionId: string,
    checkpointUuid: string,
    path: string,
    nextContent: string,
  ): Promise<FileSnapshotEntry> {
    const cp = await readCheckpoint(sessionId, checkpointUuid);
    if (!cp) {
      throw new Error(
        `recordFileWrite: no active checkpoint ${checkpointUuid} for session ${sessionId}`,
      );
    }
    const previousContent = await fileStore.read(path);
    const entry: FileSnapshotEntry = {
      path,
      previousContent,
      nextContent,
      capturedAt: clock().toISOString(),
    };
    const updated: MessageCheckpoint = {
      ...cp,
      entries: [...cp.entries, entry],
    };
    await writeCheckpoint(updated);
    return entry;
  }

  async function rewindFiles(
    sessionId: string,
    targetCheckpointUuid: string,
  ): Promise<ReadonlyArray<string>> {
    const idx = await readIndex(sessionId);
    const targetPos = idx.indexOf(targetCheckpointUuid);
    if (targetPos === -1) {
      throw new Error(
        `rewindFiles: unknown checkpoint ${targetCheckpointUuid} in session ${sessionId}`,
      );
    }
    // Newer-than-target checkpoints in chronological order. For each
    // path, the FIRST `previousContent` we see (in oldest-newest
    // traversal) is the state the file had at the moment just BEFORE
    // the rewind target's successor — which is exactly the "rewind
    // to the target's state" semantic we want. Subsequent writes are
    // intermediate states; we ignore their `previousContent`.
    const newer = idx.slice(targetPos + 1);
    const targetState = new Map<string, string | null>();
    for (const newerUuid of newer) {
      const cp = await readCheckpoint(sessionId, newerUuid);
      if (!cp) continue;
      for (const entry of cp.entries) {
        if (!targetState.has(entry.path)) {
          // First time we see this path — its previousContent is the
          // bytes the file had at the rewind target's moment.
          targetState.set(entry.path, entry.previousContent);
        }
      }
    }
    // Apply the restoration.
    const restored: string[] = [];
    for (const [path, previousContent] of targetState.entries()) {
      restored.push(path);
      if (previousContent === null) {
        await fileStore.delete(path);
      } else {
        await fileStore.write(path, previousContent);
      }
    }
    // Drop the newer checkpoints from the store + index — rewind is
    // destructive (matches Claude Code semantics).
    for (const newerUuid of newer) {
      await sessionStore.delete(snapshotKey(sessionId, newerUuid));
    }
    // Trim the index to the target inclusive.
    await writeIndex(sessionId, idx.slice(0, targetPos + 1));
    return restored;
  }

  async function getCheckpoint(
    sessionId: string,
    checkpointUuid: string,
  ): Promise<MessageCheckpoint | null> {
    return readCheckpoint(sessionId, checkpointUuid);
  }

  async function listCheckpoints(
    sessionId: string,
  ): Promise<ReadonlyArray<MessageCheckpoint>> {
    const idx = await readIndex(sessionId);
    const out: MessageCheckpoint[] = [];
    for (const id of idx) {
      const cp = await readCheckpoint(sessionId, id);
      if (cp) out.push(cp);
    }
    return out;
  }

  return {
    beginMessage,
    recordFileWrite,
    rewindFiles,
    getCheckpoint,
    listCheckpoints,
  };
}

// ─────────────────────────────────────────────────────────────────────
// In-memory FileStore — for tests + Phase K-A dev composition.
// ─────────────────────────────────────────────────────────────────────

export function createInMemoryFileStore(
  initial: Readonly<Record<string, string>> = {},
): FileStore & { readonly snapshot: () => Readonly<Record<string, string>> } {
  const files = new Map<string, string>(Object.entries(initial));
  return {
    async read(path: string): Promise<string | null> {
      return files.has(path) ? (files.get(path) as string) : null;
    },
    async write(path: string, content: string): Promise<void> {
      files.set(path, content);
    },
    async delete(path: string): Promise<boolean> {
      return files.delete(path);
    },
    async exists(path: string): Promise<boolean> {
      return files.has(path);
    },
    snapshot(): Readonly<Record<string, string>> {
      return Object.fromEntries(files.entries());
    },
  };
}
