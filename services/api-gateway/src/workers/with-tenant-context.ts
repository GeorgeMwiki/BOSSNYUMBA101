/**
 * Worker tenant-context helper — G8 robustness fix.
 *
 * Wraps work in `BEGIN; SET LOCAL app.{current_tenant_id,tenant_id} = $1;
 * <body>; COMMIT;` so the GUC binding is transaction-local. The DB
 * driver keeps the same connection for the duration of the txn; if the
 * connection drops mid-tick the entire txn rolls back and the GUC
 * binding dies with it. There is no window where a downstream query
 * sees stale GUC state.
 *
 * Both legacy (`app.tenant_id`) and canonical (`app.current_tenant_id`)
 * GUC names are bound so RLS policies on either migration generation
 * accept the call.
 *
 * Pure — no logging, no side effects beyond the SQL block. Caller
 * decides how to handle thrown errors.
 */

import { sql } from 'drizzle-orm';

export interface TenantContextDbLike {
  execute(query: unknown): Promise<unknown>;
}

export async function withWorkerTenantContext<T>(
  db: TenantContextDbLike,
  tenantId: string,
  body: () => Promise<T>,
): Promise<T> {
  if (!tenantId || tenantId.trim().length === 0) {
    throw new Error('withWorkerTenantContext: tenantId must be non-empty');
  }
  await db.execute(sql`BEGIN`);
  try {
    await db.execute(
      sql`SELECT set_config('app.current_tenant_id', ${tenantId}, true),
                  set_config('app.tenant_id', ${tenantId}, true)`,
    );
    const result = await body();
    await db.execute(sql`COMMIT`);
    return result;
  } catch (err) {
    try {
      await db.execute(sql`ROLLBACK`);
    } catch {
      // Ignore — original error takes precedence.
    }
    throw err;
  }
}
