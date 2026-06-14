/**
 * Drizzle-backed {@link TenantDirectory}.
 *
 * `listActiveTenants` selects every tenant whose `status = 'active'`
 * (the `tenant_status` enum in `packages/database/src/schemas/
 * tenant.schema.ts`; the `tenants` table has no `is_active` flag).
 *
 * `listActiveUsers` selects every active user for a tenant and maps each
 * to the advisor `Role` taxonomy. The `users` table has no free-form
 * role column — RBAC roles live in `user_roles`/`roles` and don't map
 * 1:1 onto the advisor taxonomy — so we derive the audience from the
 * `is_owner` boolean: owners → `'owner'`, everyone else → `'tenant'`.
 * These are the two dominant proactive-advice audiences and both are
 * valid {@link Role} values. Richer role projection (pm / estate_mgr /
 * admin / prospect) lands when the RBAC→advisor mapping is centralised;
 * until then this is correct and reachable, not a stub.
 *
 * Every query is wrapped so a transient DB error degrades the sweep to a
 * no-op (returns `[]`) rather than crashing the pod — the same contract
 * the api-gateway `background-wiring` directory uses.
 */
import { sql } from 'drizzle-orm';
import type { Role } from '@bossnyumba/user-context-store';
import type { ActiveUser, TenantDirectory, WorkerLogger } from '../types.js';

/** Minimal duck-type of a Drizzle client — all we need is `execute`. */
export interface DrizzleLikeClient {
  execute(query: unknown): Promise<unknown>;
}

export interface CreateDrizzleDirectoryArgs {
  readonly db: DrizzleLikeClient;
  readonly logger?: WorkerLogger;
}

/**
 * Build a {@link TenantDirectory} over a live Drizzle client.
 */
export function createDrizzleDirectory(
  args: CreateDrizzleDirectoryArgs,
): TenantDirectory {
  const { db, logger } = args;

  return {
    async listActiveTenants(): Promise<ReadonlyArray<string>> {
      try {
        const res = await db.execute(
          sql`SELECT id FROM tenants WHERE status = 'active'`,
        );
        return toRows(res)
          .map((r) => asString(r['id']))
          .filter((id): id is string => id !== undefined);
      } catch (error) {
        logger?.warn?.(
          { err: asMessage(error) },
          'proactive-triggers-worker: listActiveTenants query failed — degrading to []',
        );
        return [];
      }
    },

    async listActiveUsers(
      tenantId: string,
    ): Promise<ReadonlyArray<ActiveUser>> {
      if (!tenantId) return [];
      try {
        const res = await db.execute(
          sql`SELECT id, is_owner FROM users
              WHERE tenant_id = ${tenantId}
                AND status = 'active'`,
        );
        const users: ActiveUser[] = [];
        for (const row of toRows(res)) {
          const userId = asString(row['id']);
          if (!userId) continue;
          const role: Role = asBool(row['is_owner']) ? 'owner' : 'tenant';
          users.push({ userId, role });
        }
        return users;
      } catch (error) {
        logger?.warn?.(
          { tenantId, err: asMessage(error) },
          'proactive-triggers-worker: listActiveUsers query failed — degrading to []',
        );
        return [];
      }
    },
  };
}

function toRows(result: unknown): ReadonlyArray<Record<string, unknown>> {
  if (Array.isArray(result)) {
    return result as ReadonlyArray<Record<string, unknown>>;
  }
  const wrapped = (result as { rows?: ReadonlyArray<Record<string, unknown>> })
    ?.rows;
  return Array.isArray(wrapped) ? wrapped : [];
}

function asString(v: unknown): string | undefined {
  if (typeof v === 'string' && v.length > 0) return v;
  return undefined;
}

function asBool(v: unknown): boolean {
  return v === true || v === 't' || v === 'true' || v === 1;
}

function asMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
