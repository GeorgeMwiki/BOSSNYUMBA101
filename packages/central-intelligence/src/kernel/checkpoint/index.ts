/**
 * Checkpoint subsystem — Phase K-A public surface.
 *
 * Two layers:
 *
 *  1. The legacy `orchestrator/checkpoint.ts` Decision-level
 *     checkpoint store (continues unchanged; re-exported here so
 *     callers have a single import root).
 *  2. The Phase K-A file checkpointer — per-owner-message UUID
 *     snapshots of file content + `rewindFiles(uuid)` restoration.
 *
 * The two layers are independent — file checkpoints are NOT a
 * subkind of Decision checkpoints. They share the SessionStore as
 * the persistence substrate so a session that uses both still only
 * needs one backend wired.
 */

export {
  createFileCheckpointer,
  createInMemoryFileStore,
  type FileCheckpointer,
  type FileCheckpointerDeps,
  type FileStore,
  type FileSnapshotEntry,
  type MessageCheckpoint,
} from './file-checkpoint.js';
