/**
 * SessionStore — Phase K-A public surface.
 *
 * Closes R1 parity gap #2 (`.research/r1-claude-code-parity-audit.md`):
 * tenant sessions are now resumable from any worker, any host, any
 * redeploy via a swappable adapter port (in-memory / Redis / Postgres).
 *
 * The port is intentionally a SEPARATE concept from the legacy per-
 * decision `SessionStore` in `../orchestrator/checkpoint.ts`. The
 * legacy store records the orchestrator's tick-level Decision +
 * DispatchResult pairs; this store keeps whole-session snapshots
 * keyed by sessionId, suited to S3/Redis/Postgres backends.
 *
 * Adapters compose: the file checkpointing module persists its
 * per-message UUIDs THROUGH this store, so a `rewindFiles(uuid)` call
 * survives a worker restart as long as the underlying adapter is
 * durable.
 */

export type {
  SessionStore,
  SessionSnapshot,
  SessionListFilter,
  SessionListEntry,
} from './types.js';
export { tenantIdFromScope } from './types.js';

export {
  createInMemorySessionStore,
  type InMemorySessionStoreDeps,
} from './in-memory-session-store.js';

export {
  createRedisSessionStore,
  type RedisSessionStoreDeps,
  type SessionStoreRedisLike,
} from './redis-session-store.js';

export {
  createPostgresSessionStore,
  type PostgresSessionStoreDeps,
  type SessionStorePgLike,
  type PgQueryResult,
} from './postgres-session-store.js';

export {
  createSessionStore,
  type SessionStoreKind,
  type CreateSessionStoreOptions,
} from './factory.js';
