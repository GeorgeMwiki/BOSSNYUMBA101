/**
 * InMemorySessionStore — Phase K-A.
 *
 * The dev/test default. Holds snapshots in a Map keyed by sessionId.
 * Honours TTL by lazily sweeping on `read()` and `list()`. Suitable
 * ONLY for single-process / single-host deployments and tests; the
 * factory `createSessionStore()` refuses to fall back to in-memory
 * in production (see `./factory.ts`).
 *
 * Thread-safety: the kernel package is single-threaded JavaScript, so
 * the Map is safe. Tests that exercise concurrent writes do so via
 * await — sequencing is deterministic.
 */

import type {
  SessionListEntry,
  SessionListFilter,
  SessionSnapshot,
  SessionStore,
} from './types.js';

export interface InMemorySessionStoreDeps {
  /** Injectable clock — defaults to `() => new Date()`. */
  readonly clock?: () => Date;
}

export function createInMemorySessionStore(
  deps: InMemorySessionStoreDeps = {},
): SessionStore {
  const clock = deps.clock ?? ((): Date => new Date());
  const snapshots = new Map<string, SessionSnapshot>();
  /** Optional secondary index for resumeToken → sessionId lookups. */
  const tokenIndex = new Map<string, string>();

  /** Lazily drop a snapshot whose TTL has elapsed. */
  function sweepIfExpired(snapshot: SessionSnapshot): SessionSnapshot | null {
    if (snapshot.ttlMs === undefined) return snapshot;
    const captured = Date.parse(snapshot.capturedAt);
    if (Number.isNaN(captured)) return snapshot;
    const nowMs = clock().getTime();
    if (nowMs - captured > snapshot.ttlMs) {
      snapshots.delete(snapshot.sessionId);
      if (snapshot.resumeToken !== undefined) {
        tokenIndex.delete(snapshot.resumeToken);
      }
      return null;
    }
    return snapshot;
  }

  async function read(sessionId: string): Promise<SessionSnapshot | null> {
    const found = snapshots.get(sessionId);
    if (!found) return null;
    return sweepIfExpired(found);
  }

  async function write(snapshot: SessionSnapshot): Promise<SessionSnapshot> {
    // Stamp the captured-at with the adapter clock — callers may pass
    // a stale value; the contract says the store decides "when".
    const persisted: SessionSnapshot = {
      ...snapshot,
      capturedAt: clock().toISOString(),
    };
    // If the previous snapshot under this id had a resumeToken pointing
    // to it, drop the index entry so a re-keyed write doesn't dangle.
    const previous = snapshots.get(snapshot.sessionId);
    if (previous?.resumeToken && previous.resumeToken !== snapshot.resumeToken) {
      tokenIndex.delete(previous.resumeToken);
    }
    snapshots.set(persisted.sessionId, persisted);
    if (persisted.resumeToken) {
      tokenIndex.set(persisted.resumeToken, persisted.sessionId);
    }
    return persisted;
  }

  async function list(
    filter: SessionListFilter = {},
  ): Promise<ReadonlyArray<SessionListEntry>> {
    const rows: SessionListEntry[] = [];
    for (const snap of snapshots.values()) {
      const live = sweepIfExpired(snap);
      if (!live) continue;
      if (filter.tenantId !== undefined && live.tenantId !== filter.tenantId) {
        continue;
      }
      if (filter.personaId !== undefined && live.personaId !== filter.personaId) {
        continue;
      }
      rows.push({
        sessionId: live.sessionId,
        tenantId: live.tenantId,
        personaId: live.personaId,
        capturedAt: live.capturedAt,
      });
    }
    // DESC by capturedAt.
    rows.sort((a, b) =>
      a.capturedAt < b.capturedAt ? 1 : a.capturedAt > b.capturedAt ? -1 : 0,
    );
    if (filter.limit !== undefined && rows.length > filter.limit) {
      return rows.slice(0, filter.limit);
    }
    return rows;
  }

  async function deleteSnapshot(sessionId: string): Promise<boolean> {
    const existing = snapshots.get(sessionId);
    if (!existing) return false;
    snapshots.delete(sessionId);
    if (existing.resumeToken !== undefined) {
      tokenIndex.delete(existing.resumeToken);
    }
    return true;
  }

  return {
    read,
    write,
    list,
    delete: deleteSnapshot,
  };
}
