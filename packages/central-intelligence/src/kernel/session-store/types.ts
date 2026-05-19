/**
 * SessionStore — Phase K-A adapter pattern, R1 parity gap #2.
 *
 * Closes the "sessions die with the worker" durability hole: with this
 * port, any tenant session is resumable from any worker, any host,
 * any redeploy. Mirrors the Claude Agent SDK v0.3.x `SessionStore`
 * protocol (see `.research/r1-claude-code-parity-audit.md` §L.3).
 *
 * Distinct from the legacy `SessionStore` in `../orchestrator/
 * checkpoint.ts` which is per-decision and per-thread (resumeOrCreate
 * + checkpoint + history). This new port is per-SESSION with a
 * key-value snapshot shape that maps cleanly to S3 / Redis / Postgres.
 *
 * Cross-tenant safety: every snapshot carries a `tenantId` (or `null`
 * for platform-tier). Adapters MUST scope `list()` and `read()`
 * filtering by tenant — the in-memory adapter does this in-process,
 * the Postgres adapter via RLS, the Redis adapter via key prefix.
 *
 * Fail-closed: when `SESSION_STORE` env is unset in production
 * (`NODE_ENV === 'production'`), the factory `createSessionStore()`
 * throws rather than silently falling back to in-memory — sessions
 * vanishing on redeploy is exactly the bug this module exists to
 * prevent.
 */

import type { ScopeContext } from '../../types.js';

// ─────────────────────────────────────────────────────────────────────
// Snapshot shape — opaque blob keyed by sessionId. Adapters do not
// inspect the payload, they just persist it. The shape is intentionally
// loose so callers can evolve the schema without an adapter rev.
// ─────────────────────────────────────────────────────────────────────

export interface SessionSnapshot {
  /** Stable session identifier — typically thread/turn pair. */
  readonly sessionId: string;
  /** Owner tenant; null for platform-tier sessions. */
  readonly tenantId: string | null;
  /** Persona id at the time the snapshot was taken. */
  readonly personaId: string;
  /** Wall-clock ISO timestamp the snapshot was written. */
  readonly capturedAt: string;
  /**
   * Whole-session payload. Schema is opaque to the store; callers
   * (typically the orchestrator + checkpoint module) define it. JSON-
   * serialisable, structured-clone-safe.
   */
  readonly payload: Readonly<Record<string, unknown>>;
  /**
   * Optional resume token issued by a `defer` hook. When present, the
   * caller can re-enter with this token and the store will return
   * exactly the matching snapshot (1:1 mapping enforced by adapters).
   */
  readonly resumeToken?: string;
  /**
   * Optional millisecond TTL — adapters MAY honour it (Redis sets
   * pexpire; Postgres compares against `expires_at`). When unset the
   * snapshot is retained until explicit `delete()`.
   */
  readonly ttlMs?: number;
}

// ─────────────────────────────────────────────────────────────────────
// List filter — adapters MUST scope by tenantId when supplied.
// ─────────────────────────────────────────────────────────────────────

export interface SessionListFilter {
  /** Restrict to a specific tenant; pass `null` for platform-tier. */
  readonly tenantId?: string | null;
  /** Restrict to a specific persona. */
  readonly personaId?: string;
  /** Optional cap; adapters return at most N most-recent snapshots. */
  readonly limit?: number;
}

export interface SessionListEntry {
  readonly sessionId: string;
  readonly tenantId: string | null;
  readonly personaId: string;
  readonly capturedAt: string;
}

// ─────────────────────────────────────────────────────────────────────
// Adapter port — four operations. Every adapter implements the same
// contract; the shared conformance suite in __tests__/contract.ts
// runs against all of them so the semantics are uniform.
// ─────────────────────────────────────────────────────────────────────

export interface SessionStore {
  /**
   * Read a snapshot by `sessionId`. Returns `null` when not found OR
   * when the snapshot expired (TTL elapsed). Adapters MUST sweep
   * expired entries lazily on read.
   */
  read(sessionId: string): Promise<SessionSnapshot | null>;
  /**
   * Write or overwrite a snapshot. Adapters MUST replace any existing
   * snapshot under the same `sessionId` atomically (last-write-wins).
   * Returns the snapshot as persisted (echoing back the capturedAt the
   * adapter clock saw).
   */
  write(snapshot: SessionSnapshot): Promise<SessionSnapshot>;
  /**
   * List snapshots matching `filter`, sorted by capturedAt DESC. The
   * adapter MUST scope by `tenantId` when the filter supplies one;
   * passing no `tenantId` returns rows from ALL tenants — callers in
   * a tenant context MUST always supply the tenantId.
   */
  list(filter?: SessionListFilter): Promise<ReadonlyArray<SessionListEntry>>;
  /** Delete a snapshot by id. Returns `true` when a row was removed. */
  delete(sessionId: string): Promise<boolean>;
}

// ─────────────────────────────────────────────────────────────────────
// Scope helpers
// ─────────────────────────────────────────────────────────────────────

/**
 * Derive a tenantId-or-null from a ScopeContext. Used by adapters that
 * need to scope queries (Postgres RLS, Redis key prefix) by tenant.
 */
export function tenantIdFromScope(scope: ScopeContext): string | null {
  if (scope.kind === 'tenant') return scope.tenantId;
  return null;
}
