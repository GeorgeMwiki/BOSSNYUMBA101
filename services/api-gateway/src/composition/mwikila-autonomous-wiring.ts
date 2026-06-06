/**
 * Mr. Mwikila autonomous-MD worker — composition root (BN real-estate).
 *
 * Wires the autonomous worker so it fires per-tenant per-handler on a
 * cadence with REAL Drizzle-backed ports against the BN tables:
 *
 *   rent-scheduler        → leases × invoices
 *   regulatory-filing     → tenants × units × invoices snapshot
 *   lease-renewal         → leases.endDate + mwikila inbox history
 *   payroll-prep          → employees × hr.attendance (when present)
 *   listing-counter-offer → negotiations × negotiation_policies
 *
 * The autonomy invariants (kill-switch fail-closed, four-eye policy,
 * envelope thresholds, family-relation guard) ride the inviolable-rail
 * check in the runtime regardless of whether any handler proposes.
 *
 * Lifecycle + failure containment follow the same shape as
 * `outcomeReconciliationWorker` — `.start()` arms the cron, `.stop()`
 * is idempotent, errors inside a tick are logged via pino and never
 * crash the process.
 */

import { sql } from 'drizzle-orm';
import type { Logger } from 'pino';

import {
  createMwikilaAutonomousWorker,
  type MwikilaAutonomousWorker,
} from '../workers/mwikila-autonomous-worker.js';
import {
  createMwikilaDelegationStore,
  createMwikilaHandlerRuntime,
  createMwikilaInboxRecorder,
  createLeaseRenewalHandler,
  createListingCounterOfferHandler,
  createPayrollHandler,
  createRegulatoryFilingHandler,
  createRentSchedulerHandler,
  type MwikilaHandler,
} from '../services/mwikila-autonomy/index.js';
import {
  buildLeaseRenewalPorts,
  buildListingCounterOfferPorts,
  buildPayrollPorts,
  buildRegulatoryFilingPorts,
  buildRentSchedulerPorts,
} from './mwikila-autonomous-ports.js';

const DEFAULT_INTERVAL_MS = 15 * 60 * 1000;
const MIN_INTERVAL_MS = 60 * 1000;
const MAX_INTERVAL_MS = 60 * 60 * 1000;

interface DbLike {
  execute(query: unknown): Promise<unknown>;
}

export interface MwikilaWiringDeps {
  readonly db: DbLike | null;
  readonly logger: Logger;
  readonly isKillSwitchOpen?: () => Promise<boolean> | boolean;
  readonly intervalMs?: number;
  /**
   * Optional cluster-wide single-flight gate (multi-replica safety),
   * forwarded to the underlying worker so only the advisory-lock-holding
   * replica runs the per-tenant handler sweep per cadence.
   */
  readonly clusterLock?: (fn: () => Promise<void>) => Promise<void>;
}

const INERT_WORKER: MwikilaAutonomousWorker = Object.freeze({
  start() {},
  stop() {},
  async tickOnce() {
    return Object.freeze({
      tenantsScanned: 0,
      handlersInvoked: 0,
      inboxRowsWritten: 0,
    });
  },
});

function resolveIntervalMs(override?: number): number {
  const envRaw = process.env.BOSSNYUMBA_MWIKILA_AUTONOMOUS_INTERVAL_MS?.trim();
  const envNum = envRaw ? Number(envRaw) : NaN;
  const candidate =
    typeof override === 'number' && Number.isFinite(override) && override > 0
      ? override
      : Number.isFinite(envNum) && envNum > 0
        ? envNum
        : DEFAULT_INTERVAL_MS;
  return Math.min(
    MAX_INTERVAL_MS,
    Math.max(MIN_INTERVAL_MS, Math.floor(candidate)),
  );
}

/**
 * Active-tenant lister with owner-user resolution. Joins `tenants` ×
 * `user_roles` × `roles` where role.name='OWNER' to find the tenant's
 * canonical owner-user. Tenants without an OWNER are silently dropped.
 */
async function listActiveTenantsWithOwner(
  db: DbLike,
  logger: Logger,
): Promise<ReadonlyArray<{ readonly tenantId: string; readonly ownerUserId: string }>> {
  try {
    const result = await db.execute(sql`
      SELECT DISTINCT ON (t.id)
        t.id        AS tenant_id,
        ur.user_id  AS owner_user_id
      FROM tenants t
      JOIN user_roles ur ON ur.tenant_id = t.id
      JOIN roles r       ON r.id = ur.role_id
      WHERE t.status   = 'active'
        AND r.is_system = TRUE
        AND r.name      = 'OWNER'
      ORDER BY t.id, ur.id ASC
    `);
    const rows = Array.isArray(result)
      ? (result as ReadonlyArray<Record<string, unknown>>)
      : (((result as { rows?: ReadonlyArray<Record<string, unknown>> }).rows ??
          []) as ReadonlyArray<Record<string, unknown>>);
    const out: Array<{ readonly tenantId: string; readonly ownerUserId: string }> = [];
    for (const r of rows) {
      const tenantId = typeof r.tenant_id === 'string' ? r.tenant_id : null;
      const ownerUserId =
        typeof r.owner_user_id === 'string' ? r.owner_user_id : null;
      if (tenantId && ownerUserId) {
        out.push(Object.freeze({ tenantId, ownerUserId }));
      }
    }
    return Object.freeze(out);
  } catch (err) {
    logger.warn(
      {
        worker: 'mwikila-autonomous',
        err: err instanceof Error ? err.message : String(err),
      },
      'mwikila-autonomous: listActiveTenantsWithOwner failed; degrading to []',
    );
    return Object.freeze([]);
  }
}

function buildRealHandlers(
  db: DbLike,
  logger: Logger,
): ReadonlyArray<MwikilaHandler> {
  const rentScheduler = createRentSchedulerHandler(
    buildRentSchedulerPorts(db, logger),
  );
  const regulatoryFiling = createRegulatoryFilingHandler(
    buildRegulatoryFilingPorts(db, logger),
  );
  const leaseRenewal = createLeaseRenewalHandler(
    buildLeaseRenewalPorts(db, logger),
  );
  const payroll = createPayrollHandler(buildPayrollPorts(db, logger));
  const listingCounterOffer = createListingCounterOfferHandler(
    buildListingCounterOfferPorts(db, logger),
  );
  return Object.freeze([
    rentScheduler,
    regulatoryFiling,
    leaseRenewal,
    payroll,
    listingCounterOffer,
  ]);
}

export function createMwikilaAutonomousWiring(
  deps: MwikilaWiringDeps,
): MwikilaAutonomousWorker {
  if (!deps.db) {
    deps.logger.info(
      { worker: 'mwikila-autonomous' },
      'mwikila-autonomous: no DB — wiring inert stub',
    );
    return INERT_WORKER;
  }
  if (
    process.env.NODE_ENV === 'test' ||
    process.env.BOSSNYUMBA_MWIKILA_WORKER_DISABLED === 'true' ||
    process.env.MWIKILA_WORKER_DISABLED === 'true'
  ) {
    deps.logger.info(
      { worker: 'mwikila-autonomous' },
      'mwikila-autonomous: disabled by env — wiring inert stub',
    );
    return INERT_WORKER;
  }
  const db = deps.db;
  const recorder = createMwikilaInboxRecorder({ db });
  const delegations = createMwikilaDelegationStore({ db });
  const runtime = createMwikilaHandlerRuntime({
    recorder,
    delegations,
    ...(deps.isKillSwitchOpen !== undefined && {
      isKillSwitchOpen: deps.isKillSwitchOpen,
    }),
  });

  const intervalMs = resolveIntervalMs(deps.intervalMs);
  const worker = createMwikilaAutonomousWorker({
    runtime,
    tenants: {
      async listActiveTenants() {
        return listActiveTenantsWithOwner(db, deps.logger);
      },
    },
    handlers: buildRealHandlers(db, deps.logger),
    logger: deps.logger,
    intervalMs,
    ...(deps.clusterLock !== undefined && { clusterLock: deps.clusterLock }),
  });

  deps.logger.info(
    {
      worker: 'mwikila-autonomous',
      intervalMs,
      handlerCount: 5,
    },
    'mwikila-autonomous: wired (rent-scheduler, regulatory-filing, lease-renewal, payroll, listing-counter-offer)',
  );

  return worker;
}

export const __testing = {
  listActiveTenantsWithOwner,
  resolveIntervalMs,
};
