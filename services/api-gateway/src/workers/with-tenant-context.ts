/**
 * Worker tenant-context helper — G8 robustness audit closure
 * (2026-05-29).
 *
 * Closes audit gap G8 from `Docs/AUDIT/ROBUSTNESS_AUDIT_2026-05-29.md`:
 *
 *   Before: workers called
 *     SELECT set_config('app.current_tenant_id', $1, false)
 *     -- next query --
 *     INSERT INTO ai_audit_chain ...
 *
 *   Problem: postgres.js executes one statement per call on a
 *   checked-out connection. With `false` (session-scoped), the GUC
 *   persists on the connection AFTER the worker query returns. If
 *   Supabase reaps the connection between the set_config and the
 *   INSERT, OR returns it to the pool and a subsequent request grabs
 *   it before the next set_config overwrites the binding, queries can
 *   run with the wrong tenant context (other tenant's data, or NULL
 *   → empty result via RLS).
 *
 *   Fix: wrap every tenant-scoped block in BEGIN/COMMIT so the GUC
 *   binding is transaction-local (via `SET LOCAL`), AND pin the whole
 *   BEGIN..COMMIT sequence to ONE reserved postgres-js connection (see
 *   `pinConnection` below). Pinning matters because postgres-js
 *   multiplexes statements across a POOL: separate `db.execute()` calls
 *   can land on different connections, so a bare `db.execute(BEGIN)`
 *   does NOT by itself guarantee the SET LOCAL and the body share a
 *   connection. The earlier version of this comment claimed otherwise —
 *   it was wrong, and under the workers' per-tenant `Promise.all`
 *   concurrency the body could run with the wrong (or no) tenant GUC.
 *   With the connection reserved, the SET LOCAL reliably applies to the
 *   body; if the connection drops mid-tick the entire txn rolls back and
 *   the GUC binding dies with it. There is no window where a downstream
 *   query sees stale GUC state.
 *
 * This helper mirrors the pattern already used by
 *   `packages/database/src/rls/with-tenant-context.ts`
 * but adapted to the worker DbLike interface (raw `execute(q)`) so
 * workers don't need to lift to the full DatabaseClient surface.
 *
 * Both legacy (`app.tenant_id`) and canonical (`app.current_tenant_id`)
 * GUC names are bound so RLS policies on either migration generation
 * accept the call. Mirrors `services/api-gateway/src/middleware/database.ts`.
 *
 * Pure — no logging, no side effects beyond the SQL block. Caller
 * decides how to handle thrown errors.
 */

import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';

export interface TenantContextDbLike {
  execute(query: unknown): Promise<unknown>;
}

/**
 * postgres-js reserved-connection handle: callable as a tagged template and
 * carrying a `release()` to return the pinned connection to the pool.
 */
interface ReservedSqlLike {
  release(): void;
}

/**
 * A drizzle/postgres-js client that may expose its underlying postgres-js
 * `sql` instance via `$client`, whose `reserve()` checks the pool out onto
 * one connection for the lifetime of the BEGIN..COMMIT block.
 */
interface ReservablePoolClient {
  $client?: {
    reserve?: () => Promise<unknown>;
  };
}

/**
 * Resolve a connection-pinned `execute` handle for the BEGIN..COMMIT block,
 * plus a `release` to run in `finally`. Prefers a reserved postgres-js
 * connection wrapped back into drizzle so the pinned handle keeps the identical
 * `execute(sql\`…\`)` surface the body already uses. Falls back to the supplied
 * handle (already single-connection) when no reservable pool is exposed.
 */
async function pinConnection(
  db: TenantContextDbLike,
): Promise<{ pinned: TenantContextDbLike; release: () => void }> {
  const reserve = (db as ReservablePoolClient).$client?.reserve;
  if (typeof reserve !== 'function') {
    // No pool to reserve from (test fake / single-connection client). The
    // supplied handle is already a single connection, so running the whole
    // sequence on it keeps every statement co-located.
    return { pinned: db, release: () => {} };
  }
  const reserved = (await reserve.call(
    (db as ReservablePoolClient).$client,
  )) as ReservedSqlLike;
  // Wrap the reserved postgres-js `sql` back into a drizzle client so the
  // pinned handle exposes the same `execute(sql\`…\`)` surface — schema-less
  // drizzle is fine for raw `execute`. All statements (BEGIN / SET LOCAL /
  // body / COMMIT) now share this one reserved connection.
  const pinned = drizzle(reserved as never) as unknown as TenantContextDbLike;
  return { pinned, release: () => reserved.release() };
}

/**
 * Wraps `body` in `BEGIN; SET LOCAL app.{current_tenant_id,tenant_id} = $1;
 * <body>; COMMIT;` — all pinned to ONE reserved connection.
 *
 * CONNECTION PINNING: postgres-js multiplexes statements across a POOL, so a
 * bare `db.execute(BEGIN)` followed by separate `SET LOCAL`, `body()`, and
 * `COMMIT` calls can each land on a DIFFERENT connection. The `SET LOCAL` GUC
 * is connection-local, so the body could run on a connection that never saw
 * it — RLS then silently zeroes rows (or leaks a residual GUC). We reserve one
 * connection via postgres-js `sql.reserve()` and run every statement on it,
 * releasing in `finally`. The GUC binding is transaction-scoped (`SET LOCAL`
 * dies at COMMIT/ROLLBACK) so it cannot leak onto the released connection.
 *
 * `body` receives the pinned handle and MUST run all its DB calls through it
 * (not the outer pooled `db`) so every statement shares the connection the
 * SET LOCAL bound.
 *
 * `tenantId` must be non-empty; empty strings are rejected as a
 * programmer error (the SET LOCAL would still execute but RLS would
 * silently zero rows downstream — fail loud instead).
 */
export async function withWorkerTenantContext<T>(
  db: TenantContextDbLike,
  tenantId: string,
  body: (pinned: TenantContextDbLike) => Promise<T>,
): Promise<T> {
  if (!tenantId || tenantId.trim().length === 0) {
    throw new Error('withWorkerTenantContext: tenantId must be non-empty');
  }
  const { pinned, release } = await pinConnection(db);
  try {
    await pinned.execute(sql`BEGIN`);
    try {
      // SET LOCAL scopes the GUC to the current transaction; the second
      // SET LOCAL covers policies installed before migration 0172 that
      // still read the legacy `app.tenant_id` name. Both die at COMMIT
      // / ROLLBACK, so no leak onto the released connection is possible.
      await pinned.execute(
        sql`SELECT set_config('app.current_tenant_id', ${tenantId}, true),
                    set_config('app.tenant_id', ${tenantId}, true)`,
      );
      const result = await body(pinned);
      await pinned.execute(sql`COMMIT`);
      return result;
    } catch (err) {
      try {
        await pinned.execute(sql`ROLLBACK`);
      } catch {
        // Ignore — original error takes precedence.
      }
      throw err;
    }
  } finally {
    release();
  }
}

/**
 * Service-role variant for the cross-tenant system-job path.
 *
 * Some background jobs legitimately span tenants in a SINGLE query — e.g.
 * the notification-dispatch drainer claims `pending` rows across all
 * tenants with `FOR UPDATE SKIP LOCKED`, so there is no one tenant id to
 * bind. For those, wrap the DB-touching step in this helper: it binds
 * `app.is_service_role = 'true'` (transaction-local via `SET LOCAL`),
 * which activates the 0179 `service_role_bypass` RLS policy so the rows
 * are actually visible/updatable. A `__system__` placeholder tenant id is
 * also bound so the tenant GUC is never empty (the bypass short-circuits
 * before the tenant predicate fires).
 *
 * USE ONLY when (a) the work is genuinely cross-tenant AND (b) the target
 * table carries a `service_role_bypass` policy. For per-tenant work prefer
 * `withWorkerTenantContext`, which does not grant cross-tenant reach.
 *
 * Same BEGIN/COMMIT mechanics + leak-safety as `withWorkerTenantContext`.
 */
export async function withWorkerServiceRoleContext<T>(
  db: TenantContextDbLike,
  body: (pinned: TenantContextDbLike) => Promise<T>,
): Promise<T> {
  const { pinned, release } = await pinConnection(db);
  try {
    await pinned.execute(sql`BEGIN`);
    try {
      await pinned.execute(
        sql`SELECT set_config('app.is_service_role', 'true', true),
                    set_config('app.current_tenant_id', '__system__', true),
                    set_config('app.tenant_id', '__system__', true)`,
      );
      const result = await body(pinned);
      await pinned.execute(sql`COMMIT`);
      return result;
    } catch (err) {
      try {
        await pinned.execute(sql`ROLLBACK`);
      } catch {
        // Ignore — original error takes precedence.
      }
      throw err;
    }
  } finally {
    release();
  }
}
