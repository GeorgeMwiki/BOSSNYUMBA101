/**
 * RLS session-context helper.
 *
 * Wraps a database callback in a transaction that has the
 * `app.current_tenant_id` GUC bound to the supplied tenant id. Every
 * tenant-scoped table has an RLS policy of the shape
 *   tenant_id = current_setting('app.current_tenant_id', true)
 * so any query the callback runs is automatically filtered.
 *
 * Optional `opts.serviceRole = true` also sets `app.is_service_role`
 * to `'true'`. The companion 0179 migration installs a
 * `service_role_bypass` policy on every tenant-scoped table that
 * returns `true` when that GUC is set, so system jobs that legitimately
 * span tenants can opt-in without touching individual repository
 * queries.
 *
 * Both settings use `set_config(..., true)` — the `true` third
 * argument scopes the binding to the current transaction, so the
 * GUC cannot leak across requests on a pooled connection.
 */

import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import type { DatabaseClient } from '../client.js';

export interface WithTenantContextOpts {
  /** Set when the caller legitimately needs cross-tenant access. */
  readonly serviceRole?: boolean;
}

/**
 * Bind the per-request tenant + service-role GUCs and run `fn` inside
 * the same transaction so postgres-js executes everything on one
 * checked-out connection.
 *
 * The callback receives the same `db` handle it would have used
 * outside the wrapper; no API change is required at the call site.
 */
export async function withTenantContext<T>(
  db: DatabaseClient,
  tenantId: string,
  fn: (tx: DatabaseClient) => Promise<T>,
  opts?: WithTenantContextOpts,
): Promise<T> {
  if (!tenantId) {
    throw new Error('withTenantContext requires a non-empty tenantId');
  }
  const isService = opts?.serviceRole ?? false;

  // drizzle-orm/postgres-js transactions hand back a `tx` object that
  // is compatible enough with the outer `db` for repository code, but
  // recent drizzle releases added a `$client` property to
  // `PostgresJsDatabase` that `PgTransaction` does not carry, so the two
  // no longer structurally overlap. Repository code never touches the
  // `$client` escape hatch, so the cast through `unknown` is safe and
  // preserves the existing type surface for callers.
  return await db.transaction(async (tx) => {
    // Bind the per-tx tenant id. The `true` third arg of `set_config`
    // scopes it to the transaction.
    await tx.execute(
      sql`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`,
    );
    // Mirror the legacy `app.tenant_id` GUC for migrations (0146, 0156
    // helper) that still read the older name.
    await tx.execute(
      sql`SELECT set_config('app.tenant_id', ${tenantId}, true)`,
    );
    await tx.execute(
      sql`SELECT set_config('app.is_service_role', ${isService ? 'true' : 'false'}, true)`,
    );
    return await fn(tx as unknown as DatabaseClient);
  });
}

/**
 * Service-role variant — sugar for the common cross-tenant system-job
 * call site. Equivalent to `withTenantContext(db, '__system__',
 * fn, { serviceRole: true })`.
 *
 * The placeholder tenant id `__system__` is used so the GUC is never
 * empty (avoids accidental `tenant_id IS NULL` matches). The
 * service-role bypass policy short-circuits before the tenant predicate
 * fires, so the placeholder is never evaluated against real rows.
 */
export async function withServiceRoleContext<T>(
  db: DatabaseClient,
  fn: (tx: DatabaseClient) => Promise<T>,
): Promise<T> {
  return await withTenantContext(db, '__system__', fn, { serviceRole: true });
}

// ---------------------------------------------------------------------------
// Worker-context helpers (raw `execute` surface).
//
// Mirror `services/api-gateway/src/workers/with-tenant-context.ts` but live
// in the shared package so SEPARATE services (consolidation-worker,
// brain-evolution-worker, proactive-triggers-worker, …) — which hold a raw
// `execute`-only handle and cannot import the api-gateway-local copy — can
// bind RLS GUCs transactionally.
//
// CONNECTION PINNING (why this is not just `db.execute(BEGIN)`):
//   postgres-js multiplexes statements across a POOL (default max:10). A bare
//   `db.execute(sql\`BEGIN\`)` followed by separate `db.execute(SET LOCAL …)`,
//   `body()`, and `db.execute(COMMIT)` calls can each land on a DIFFERENT
//   pooled connection. The `SET LOCAL` GUC is connection-local, so the body's
//   query may run on a connection that never saw the SET LOCAL — RLS then
//   silently zeroes rows (or, worse, leaks a prior request's residual GUC).
//   Under the `Promise.all` per-tenant concurrency these workers use, that
//   race is not theoretical.
//
//   Fix: reserve ONE connection for the whole BEGIN..COMMIT sequence via
//   postgres-js `sql.reserve()` and run every statement — including the body —
//   on that single pinned handle, releasing it in `finally`. The body receives
//   the pinned handle and MUST issue its DB calls through it (callers thread it
//   through); only then is every statement guaranteed to share the connection
//   the SET LOCAL bound. `SET LOCAL` still dies at COMMIT/ROLLBACK, so the GUC
//   never leaks back onto the released connection.
//
//   When the supplied handle does not expose a reservable pool (test fakes /
//   single-connection clients with only `execute`), we degrade to running the
//   sequence on the supplied handle directly — that handle is already a single
//   connection, so the pinning invariant holds trivially.
// ---------------------------------------------------------------------------

/** Minimal raw-execute surface the worker-context helpers touch. */
export interface WorkerExecLike {
  execute(query: unknown): Promise<unknown>;
}

/**
 * postgres-js reserved-connection handle: callable as a tagged template and
 * carrying a `release()` to return the pinned connection to the pool. We only
 * touch the subset we need.
 */
interface ReservedSqlLike {
  release(): void;
}

/**
 * A drizzle/postgres-js client that may expose its underlying postgres-js
 * `sql` instance via `$client`. `reserve()` checks the pool out onto one
 * connection for the lifetime of the BEGIN..COMMIT block.
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
  db: WorkerExecLike,
): Promise<{ pinned: WorkerExecLike; release: () => void }> {
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
  const pinned = drizzle(reserved as never) as unknown as WorkerExecLike;
  return { pinned, release: () => reserved.release() };
}

/**
 * Per-tenant worker binding: `BEGIN; SET LOCAL app.{current_tenant_id,
 * tenant_id} = $1; <body>; COMMIT`, all pinned to ONE reserved connection so
 * the SET LOCAL GUC reliably applies to the body. Activates the
 * `tenant_isolation` policies for the given tenant. `tenantId` must be
 * non-empty (an empty GUC would silently zero rows — fail loud instead).
 *
 * `body` receives the pinned handle and MUST run its DB calls through it (not
 * the outer pooled `db`) so they execute on the connection the SET LOCAL bound.
 */
export async function withWorkerTenantContext<T>(
  db: WorkerExecLike,
  tenantId: string,
  body: (pinned: WorkerExecLike) => Promise<T>,
): Promise<T> {
  if (!tenantId || tenantId.trim().length === 0) {
    throw new Error('withWorkerTenantContext: tenantId must be non-empty');
  }
  const { pinned, release } = await pinConnection(db);
  try {
    await pinned.execute(sql`BEGIN`);
    try {
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
 * Cross-tenant worker binding: `BEGIN; SET LOCAL app.is_service_role =
 * 'true'; <body>; COMMIT`, all pinned to ONE reserved connection. Activates
 * the 0179 `service_role_bypass` policies. USE ONLY for genuinely cross-tenant
 * work whose target table carries a `service_role_bypass` policy.
 *
 * `body` receives the pinned handle and MUST run its DB calls through it (not
 * the outer pooled `db`) so they execute on the connection the SET LOCAL bound.
 */
export async function withWorkerServiceRoleContext<T>(
  db: WorkerExecLike,
  body: (pinned: WorkerExecLike) => Promise<T>,
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
