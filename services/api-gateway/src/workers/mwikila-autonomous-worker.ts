/**
 * Mr. Mwikila autonomous worker — fires per-tenant per-handler ticks
 * at a configurable cadence (real-estate domain).
 *
 * Ported from Borjie services/api-gateway/src/workers/mwikila-autonomous-worker.ts.
 * Mining-specific concepts ("shift", "tonnage rolling-avg", "ore-parcel")
 * map onto the property analogues already wired in
 * services/mwikila-autonomy/handlers/ (rent_scheduler, regulatory_filing,
 * lease_renewal, payroll_prep, listing_counter_offer).
 *
 * Composition root wires:
 *   - the recorder + delegation store + handler runtime (already exported
 *     from services/mwikila-autonomy/index.ts)
 *   - the 5 canonical per-category handlers
 *   - a tenant-listing port so the worker iterates every active
 *     tenant exactly once per tick
 *
 * Guardrail parity with Borjie:
 *   - Kill-switch: `MwikilaHandlerRuntime` already respects the
 *     `isKillSwitchOpen` port bound at composition time; this worker
 *     never bypasses runtime.run().
 *   - Four-eye: handlers that propose a HIGH-stakes action emit
 *     `awaiting_owner_review` status; the runtime queues an inbox row
 *     instead of executing.
 *   - Audit-chain: every executed/queued inbox row carries the
 *     hash-chained provenance trail recorded by the inbox-recorder.
 *
 * Pure-logic shape mirrors saved-search-worker — DbLike / port stubs
 * let vitest drive every branch.
 *
 * Failure containment:
 *   - Per-handler exception caught + logged via Pino; the loop
 *     continues to the next handler.
 *   - Tenant listing failure aborts the tick (logged, no partial
 *     writes); the next interval retries.
 *   - BOSSNYUMBA_MWIKILA_WORKER_DISABLED=true or MWIKILA_WORKER_DISABLED=true
 *     leaves the timer inert (degraded mode + tests).
 */

import type { Logger } from 'pino';

import type {
  MwikilaHandler,
  MwikilaHandlerRuntime,
  MwikilaInboxRow,
} from '../services/mwikila-autonomy/index.js';

export interface MwikilaTenantPort {
  /**
   * Return tenants the worker should tick this turn. The composition
   * root wires this to read active tenants from `tenants`.
   */
  listActiveTenants(): Promise<
    ReadonlyArray<{
      readonly tenantId: string;
      readonly ownerUserId: string;
    }>
  >;
}

export interface MwikilaAutonomousWorkerOptions {
  readonly runtime: MwikilaHandlerRuntime;
  readonly tenants: MwikilaTenantPort;
  readonly handlers: ReadonlyArray<MwikilaHandler>;
  readonly logger?: Logger;
  readonly intervalMs?: number;
}

export interface MwikilaAutonomousWorker {
  start(): void;
  stop(): void;
  tickOnce(): Promise<{
    readonly tenantsScanned: number;
    readonly handlersInvoked: number;
    readonly inboxRowsWritten: number;
  }>;
}

const DEFAULT_INTERVAL_MS = 15 * 60 * 1000;

export function createMwikilaAutonomousWorker(
  opts: MwikilaAutonomousWorkerOptions,
): MwikilaAutonomousWorker {
  const interval = opts.intervalMs ?? DEFAULT_INTERVAL_MS;
  const logger = opts.logger;
  let timer: ReturnType<typeof setInterval> | null = null;

  async function tickOnce() {
    let tenants: ReadonlyArray<{
      readonly tenantId: string;
      readonly ownerUserId: string;
    }>;
    try {
      tenants = await opts.tenants.listActiveTenants();
    } catch (err) {
      logger?.error(
        { err: err instanceof Error ? err.message : String(err) },
        'mwikila autonomous worker — listActiveTenants failed; skipping tick',
      );
      return {
        tenantsScanned: 0,
        handlersInvoked: 0,
        inboxRowsWritten: 0,
      };
    }

    let handlersInvoked = 0;
    let inboxRowsWritten = 0;
    for (const tenant of tenants) {
      for (const handler of opts.handlers) {
        handlersInvoked += 1;
        try {
          const row: MwikilaInboxRow | null = await opts.runtime.run({
            tenantId: tenant.tenantId,
            actingOnUserId: tenant.ownerUserId,
            handler,
          });
          if (row !== null) inboxRowsWritten += 1;
        } catch (err) {
          logger?.error(
            {
              err: err instanceof Error ? err.message : String(err),
              tenantId: tenant.tenantId,
              actionKind: handler.actionKind,
            },
            'mwikila autonomous worker — handler failed',
          );
        }
      }
    }
    return {
      tenantsScanned: tenants.length,
      handlersInvoked,
      inboxRowsWritten,
    };
  }

  return {
    start() {
      if (timer) return;
      if (
        process.env.MWIKILA_WORKER_DISABLED === 'true' ||
        process.env.BOSSNYUMBA_MWIKILA_WORKER_DISABLED === 'true'
      ) {
        return;
      }
      timer = setInterval(() => {
        void tickOnce().catch((err: unknown) => {
          logger?.error(
            { err: err instanceof Error ? err.message : String(err) },
            'mwikila autonomous worker tick crashed',
          );
        });
      }, interval);
      // Avoid pinning the event loop in dev / shutdown windows.
      timer.unref?.();
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
    },
    tickOnce,
  };
}
