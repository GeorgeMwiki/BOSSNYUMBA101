/**
 * PostgresSessionStore — Phase K-A, R1 gap #2.
 *
 * Postgres-backed snapshot store. Same deferred-port pattern as the
 * Redis adapter: the kernel does NOT bundle `drizzle-orm`, `pg`, or
 * `postgres.js`. The caller injects a minimal duck-typed `PgClient`
 * at composition time so the kernel boots with zero external deps.
 *
 * On-the-wire schema (migration 0169 in packages/database):
 *
 *   CREATE TABLE central_intelligence.session_snapshots (
 *     session_id     TEXT PRIMARY KEY,
 *     tenant_id      TEXT,               -- NULL for platform-tier
 *     persona_id     TEXT NOT NULL,
 *     captured_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
 *     expires_at     TIMESTAMPTZ,        -- NULL = retain indefinitely
 *     payload        JSONB NOT NULL,
 *     resume_token   TEXT,               -- secondary lookup
 *     UNIQUE (resume_token)
 *   );
 *
 * Cross-tenant safety: tenant_id RLS — every SELECT enforces
 * `tenant_id IS NULL OR tenant_id = current_setting('app.tenant_id')`.
 * The migration sets this up; the adapter relies on the caller having
 * already issued `SET LOCAL app.tenant_id = $1` for the request scope.
 *
 * TTL: stored as `expires_at = captured_at + ttlMs`. `read()` and
 * `list()` filter `(expires_at IS NULL OR expires_at > now())`.
 *
 * Falls back to InMemorySessionStore when `pg` is null/undefined —
 * same pattern as the Redis adapter.
 */

import {
  createInMemorySessionStore,
  type InMemorySessionStoreDeps,
} from './in-memory-session-store.js';
import type {
  SessionListEntry,
  SessionListFilter,
  SessionSnapshot,
  SessionStore,
} from './types.js';

// ─────────────────────────────────────────────────────────────────────
// Minimal Postgres surface — narrow on purpose. Matches the `pg`
// node client API by name (a `query(sql, params) -> { rows }` shape)
// but the kernel doesn't bundle it.
// ─────────────────────────────────────────────────────────────────────

export interface PgQueryResult<T> {
  readonly rows: ReadonlyArray<T>;
  readonly rowCount?: number;
}

export interface SessionStorePgLike {
  query<T = unknown>(
    sql: string,
    params?: ReadonlyArray<unknown>,
  ): Promise<PgQueryResult<T>>;
}

export interface PostgresSessionStoreDeps {
  /** Injected client; null/undefined falls back to in-memory. */
  readonly pg?: SessionStorePgLike | null;
  /**
   * Optional schema-qualified table override. Defaults to
   * `central_intelligence.session_snapshots`.
   */
  readonly tableName?: string;
  /** Injectable clock; defaults to `() => new Date()`. */
  readonly clock?: () => Date;
  /** Optional logger; defaults to `console.warn`. */
  readonly logger?: { warn: (msg: string) => void };
}

interface SnapshotRow {
  readonly session_id: string;
  readonly tenant_id: string | null;
  readonly persona_id: string;
  readonly captured_at: string;
  readonly expires_at: string | null;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly resume_token: string | null;
  readonly ttl_ms: number | null;
}

/**
 * Create a Postgres-backed SessionStore. When `deps.pg` is unset, the
 * store transparently falls back to in-memory and emits a single
 * WARN so an operator notices the unconfigured `DATABASE_URL`.
 */
export function createPostgresSessionStore(
  deps: PostgresSessionStoreDeps = {},
): SessionStore {
  const logger = deps.logger ?? { warn: (msg: string): void => console.warn(msg) };
  if (!deps.pg) {
    logger.warn(
      'session-store: Postgres client not provided — falling back to in-memory store',
    );
    const memDeps: InMemorySessionStoreDeps = {};
    if (deps.clock !== undefined) {
      (memDeps as { clock: () => Date }).clock = deps.clock;
    }
    return createInMemorySessionStore(memDeps);
  }

  const pg = deps.pg;
  const tableName = deps.tableName ?? 'central_intelligence.session_snapshots';

  function rowToSnapshot(row: SnapshotRow): SessionSnapshot {
    const snap: SessionSnapshot = {
      sessionId: row.session_id,
      tenantId: row.tenant_id,
      personaId: row.persona_id,
      capturedAt: row.captured_at,
      payload: row.payload,
      ...(row.resume_token !== null ? { resumeToken: row.resume_token } : {}),
      ...(row.ttl_ms !== null ? { ttlMs: row.ttl_ms } : {}),
    };
    return snap;
  }

  async function read(sessionId: string): Promise<SessionSnapshot | null> {
    const sql = `
      SELECT session_id, tenant_id, persona_id,
             captured_at::text AS captured_at,
             expires_at::text  AS expires_at,
             payload, resume_token, ttl_ms
      FROM ${tableName}
      WHERE session_id = $1
        AND (expires_at IS NULL OR expires_at > now())
      LIMIT 1
    `;
    const result = await pg.query<SnapshotRow>(sql, [sessionId]);
    const row = result.rows[0];
    if (!row) return null;
    return rowToSnapshot(row);
  }

  async function write(snapshot: SessionSnapshot): Promise<SessionSnapshot> {
    // Upsert. Tenant-mismatch attempts are blocked by RLS on the
    // table; the adapter does not try to defend against bypasses.
    const sql = `
      INSERT INTO ${tableName}
        (session_id, tenant_id, persona_id, captured_at, expires_at,
         payload, resume_token, ttl_ms)
      VALUES
        ($1, $2, $3, now(),
         CASE WHEN $4::bigint IS NULL THEN NULL
              ELSE now() + ($4::bigint * INTERVAL '1 millisecond')
         END,
         $5::jsonb, $6, $4)
      ON CONFLICT (session_id) DO UPDATE
        SET tenant_id    = EXCLUDED.tenant_id,
            persona_id   = EXCLUDED.persona_id,
            captured_at  = EXCLUDED.captured_at,
            expires_at   = EXCLUDED.expires_at,
            payload      = EXCLUDED.payload,
            resume_token = EXCLUDED.resume_token,
            ttl_ms       = EXCLUDED.ttl_ms
      RETURNING session_id, tenant_id, persona_id,
                captured_at::text AS captured_at,
                expires_at::text  AS expires_at,
                payload, resume_token, ttl_ms
    `;
    const result = await pg.query<SnapshotRow>(sql, [
      snapshot.sessionId,
      snapshot.tenantId,
      snapshot.personaId,
      snapshot.ttlMs ?? null,
      JSON.stringify(snapshot.payload),
      snapshot.resumeToken ?? null,
    ]);
    const row = result.rows[0];
    if (!row) {
      throw new Error(
        `PostgresSessionStore.write returned no row for sessionId=${snapshot.sessionId}`,
      );
    }
    return rowToSnapshot(row);
  }

  async function list(
    filter: SessionListFilter = {},
  ): Promise<ReadonlyArray<SessionListEntry>> {
    if (filter.tenantId === undefined) {
      throw new Error(
        'PostgresSessionStore.list requires an explicit tenantId (pass null for platform-tier)',
      );
    }
    const conditions: string[] = [
      '(expires_at IS NULL OR expires_at > now())',
      filter.tenantId === null
        ? 'tenant_id IS NULL'
        : 'tenant_id = $1',
    ];
    const params: unknown[] = [];
    if (filter.tenantId !== null) params.push(filter.tenantId);

    if (filter.personaId !== undefined) {
      params.push(filter.personaId);
      conditions.push(`persona_id = $${params.length}`);
    }
    let sql = `
      SELECT session_id, tenant_id, persona_id,
             captured_at::text AS captured_at
      FROM ${tableName}
      WHERE ${conditions.join(' AND ')}
      ORDER BY captured_at DESC
    `;
    if (filter.limit !== undefined) {
      params.push(filter.limit);
      sql += ` LIMIT $${params.length}`;
    }
    const result = await pg.query<SessionListEntry & { captured_at: string }>(
      sql,
      params,
    );
    return result.rows.map((r) => ({
      // The column names differ from the camelCase TS fields; map.
      sessionId: (r as unknown as SnapshotRow).session_id,
      tenantId: (r as unknown as SnapshotRow).tenant_id,
      personaId: (r as unknown as SnapshotRow).persona_id,
      capturedAt: (r as unknown as SnapshotRow).captured_at,
    }));
  }

  async function deleteSnapshot(sessionId: string): Promise<boolean> {
    const sql = `DELETE FROM ${tableName} WHERE session_id = $1`;
    const result = await pg.query(sql, [sessionId]);
    return (result.rowCount ?? 0) > 0;
  }

  return {
    read,
    write,
    list,
    delete: deleteSnapshot,
  };
}
