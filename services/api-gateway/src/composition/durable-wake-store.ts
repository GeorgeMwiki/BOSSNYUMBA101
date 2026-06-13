/**
 * Postgres-backed `DurableWakeStore` — the crash-resilient backing store for
 * the in-process wake supervisor.
 *
 * Context
 * -------
 * The orchestrator's `schedule_wake` / `monitor` Decisions are armed by
 * `packages/central-intelligence/src/durable/in-process-wake-scheduler.ts` on a
 * process-local `setInterval` tick. Without a backing store an arm made before
 * a process restart is LOST (BN-EXE-08 BLOCKER). This module implements the
 * pure `DurableWakeStore` port over Postgres/Drizzle so the supervisor persists
 * every armed entry, deletes it on fire/expiry, and rehydrates the pending set
 * on boot — making durable scheduling the DEFAULT (the storeless supervisor is
 * then the explicit fallback only).
 *
 * RLS + scope
 * -----------
 * The supervisor is a SYSTEM job that spans tenants on boot, so all reads/
 * writes run inside `withServiceRoleContext` (the 0179 service-role-bypass
 * policy lets the cross-tenant poller through). The persisted `tenant_id` is
 * the scope the resumed turn re-enters under (NULL for a `platform`-scoped
 * wake); the full `ScopeContext` is stored in the `scope` jsonb so the resume
 * re-enters identically.
 *
 * Honesty + safety contract
 * -------------------------
 *   - The port methods MAY reject; the supervisor catches + degrades (an arm
 *     stays live in-process, it just won't survive a restart). So this impl
 *     never swallows errors — it lets them propagate so the supervisor logs the
 *     precise degrade. `loadPending` is the one exception the supervisor calls
 *     at boot; a throw there is also caught (empty pending set).
 *   - Immutable: inputs are `readonly`; rows are UPSERTed (re-arm replaces) and
 *     DELETEd (fire/expiry), never mutated in place.
 *   - Pino only — the gateway's structured logger; no console.
 *
 * Migration: packages/database/src/migrations/0315_durable_scheduled_wakes.sql
 * Schema:    packages/database/src/schemas/durable-scheduled-wakes.schema.ts
 */

import { sql } from 'drizzle-orm';
import {
  createDatabaseClient,
  withServiceRoleContext,
} from '@bossnyumba/database';
import type {
  DurableWakeStore,
  PersistedMonitorRecord,
  PersistedPendingSet,
  PersistedWakeRecord,
} from '@bossnyumba/central-intelligence';

/**
 * DatabaseClient type — derived from the factory return rather than the
 * package-barrel `type` export, which TypeScript resolves as a *namespace*
 * through the `export *` re-export chain (TS2709). Mirrors the identical
 * workaround in `monitor-predicate-source.ts` / `middleware/database.ts`.
 */
type DatabaseClient = ReturnType<typeof createDatabaseClient>;

/** Structural Pino subset the gateway threads in. Optional for tests. */
export interface DurableWakeStoreLogger {
  info?(meta: object, msg: string): void;
  warn?(meta: object, msg: string): void;
  error?(meta: object, msg: string): void;
}

export interface DurableWakeStoreDeps {
  readonly db: DatabaseClient;
  readonly logger?: DurableWakeStoreLogger;
}

/** Extract the persisted `tenant_id` from a scope (NULL for platform). */
function tenantIdOf(
  scope: PersistedWakeRecord['scope'] | PersistedMonitorRecord['scope'],
): string | null {
  return scope.kind === 'tenant' ? scope.tenantId : null;
}

/**
 * Normalise a Drizzle `execute()` result to a row array. postgres-js returns
 * the rows array directly; node-postgres returns `{ rows }`. Mirrors the
 * established `rowsOf` idiom in `workers/outcome-reconciliation-worker.ts`.
 */
function rowsOf(result: unknown): ReadonlyArray<Record<string, unknown>> {
  if (Array.isArray(result)) {
    return result as ReadonlyArray<Record<string, unknown>>;
  }
  const wrapped = result as {
    rows?: ReadonlyArray<Record<string, unknown>>;
  };
  return wrapped?.rows ?? [];
}

/**
 * Parse a stored `scope` jsonb back into a `ScopeContext`. The jsonb is written
 * straight from the typed record, so a well-formed row round-trips. A
 * structurally-invalid row (hand-edited / corrupted) is rejected by the loader
 * so a bad row never resurrects a turn under an unknown scope.
 */
function isWakeScope(value: unknown): value is PersistedWakeRecord['scope'] {
  if (typeof value !== 'object' || value === null) return false;
  const kind = (value as { kind?: unknown }).kind;
  if (kind === 'platform') return true;
  if (kind === 'tenant') {
    return typeof (value as { tenantId?: unknown }).tenantId === 'string';
  }
  return false;
}

/**
 * Build the Postgres-backed durable wake store. Bound at the composition root
 * and threaded into `createInProcessWakeScheduler({ store })`.
 */
export function createPgDurableWakeStore(
  deps: DurableWakeStoreDeps,
): DurableWakeStore {
  const { db, logger } = deps;

  return {
    async saveWake(record: PersistedWakeRecord): Promise<void> {
      const tenantId = tenantIdOf(record.scope);
      const wakeAt = new Date(record.wakeAtMs).toISOString();
      await withServiceRoleContext(db, async (tx) => {
        await tx.execute(sql`
          INSERT INTO durable_scheduled_wakes
            (resume_token, thread_id, wake_at, reason, tenant_id, scope)
          VALUES (
            ${record.resumeToken}, ${record.threadId}, ${wakeAt},
            ${record.reason}, ${tenantId},
            ${JSON.stringify(record.scope)}::jsonb
          )
          ON CONFLICT (resume_token) DO UPDATE SET
            thread_id = EXCLUDED.thread_id,
            wake_at   = EXCLUDED.wake_at,
            reason    = EXCLUDED.reason,
            tenant_id = EXCLUDED.tenant_id,
            scope     = EXCLUDED.scope
        `);
      });
    },

    async deleteWake(resumeToken: string): Promise<void> {
      await withServiceRoleContext(db, async (tx) => {
        await tx.execute(sql`
          DELETE FROM durable_scheduled_wakes
          WHERE resume_token = ${resumeToken}
        `);
      });
    },

    async saveMonitor(record: PersistedMonitorRecord): Promise<void> {
      const tenantId = tenantIdOf(record.scope);
      const expiresAt = new Date(record.expiresAtMs).toISOString();
      await withServiceRoleContext(db, async (tx) => {
        await tx.execute(sql`
          INSERT INTO durable_armed_monitors
            (watch_id, thread_id, predicate, expires_at, tenant_id, scope)
          VALUES (
            ${record.watchId}, ${record.threadId}, ${record.predicate},
            ${expiresAt}, ${tenantId},
            ${JSON.stringify(record.scope)}::jsonb
          )
          ON CONFLICT (watch_id) DO UPDATE SET
            thread_id  = EXCLUDED.thread_id,
            predicate  = EXCLUDED.predicate,
            expires_at = EXCLUDED.expires_at,
            tenant_id  = EXCLUDED.tenant_id,
            scope      = EXCLUDED.scope
        `);
      });
    },

    async deleteMonitor(watchId: string): Promise<void> {
      await withServiceRoleContext(db, async (tx) => {
        await tx.execute(sql`
          DELETE FROM durable_armed_monitors
          WHERE watch_id = ${watchId}
        `);
      });
    },

    async loadPending(): Promise<PersistedPendingSet> {
      return await withServiceRoleContext(db, async (tx) => {
        const wakeResult = await tx.execute(sql`
          SELECT resume_token, thread_id, wake_at, reason, scope
          FROM durable_scheduled_wakes
        `);
        const monitorResult = await tx.execute(sql`
          SELECT watch_id, thread_id, predicate, expires_at, scope
          FROM durable_armed_monitors
        `);

        const wakes: PersistedWakeRecord[] = [];
        for (const row of rowsOf(wakeResult)) {
          const scope = row.scope;
          if (!isWakeScope(scope)) {
            logger?.warn?.(
              { resumeToken: row.resume_token },
              'durable-wake-store: skipping wake row with invalid scope',
            );
            continue;
          }
          wakes.push({
            resumeToken: String(row.resume_token),
            threadId: String(row.thread_id),
            wakeAtMs: new Date(String(row.wake_at)).getTime(),
            reason: String(row.reason),
            scope,
          });
        }

        const monitors: PersistedMonitorRecord[] = [];
        for (const row of rowsOf(monitorResult)) {
          const scope = row.scope;
          if (!isWakeScope(scope)) {
            logger?.warn?.(
              { watchId: row.watch_id },
              'durable-wake-store: skipping monitor row with invalid scope',
            );
            continue;
          }
          monitors.push({
            watchId: String(row.watch_id),
            threadId: String(row.thread_id),
            predicate: String(row.predicate),
            expiresAtMs: new Date(String(row.expires_at)).getTime(),
            scope,
          });
        }

        logger?.info?.(
          { wakes: wakes.length, monitors: monitors.length },
          'durable-wake-store: loaded pending wakes/monitors',
        );
        return { wakes, monitors };
      });
    },
  };
}
