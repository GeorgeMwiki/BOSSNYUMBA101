/**
 * Sovereign-ledger port adapter (composition root).
 *
 * Wave-B fail-closed ACTIVATION wiring. The kernel executor
 * (`packages/central-intelligence/.../executor/executor.ts`) inverts the
 * sovereign-tier ledger default to FAIL-CLOSED, but that protection is
 * DORMANT until a real `SovereignActionLedgerPort` is bound: the
 * executor's `safeSovereignLedger` is a no-op when `deps.sovereignLedger`
 * is missing (returns `{ ok: true }`), so an irreversible sovereign
 * action (eviction / owner-payout / KRA-MRI / GePG / market-rate-override
 * / inspection-major-damage) could not be blocked by a failed audit
 * write — there was no ledger to fail.
 *
 * This module closes the gap. It builds the kernel-facing
 * `SovereignActionLedgerPort` from the Drizzle-backed
 * `createSovereignActionLedgerService` in `@bossnyumba/database`.
 *
 * Why a thin adapter (not the raw service):
 *   1. The database service's `appendLedgerEntry` accepts a SUPERSET of
 *      the port args (it also takes an optional `rollbackPayload`) and
 *      returns a concrete `SovereignLedgerAppendResult`. The kernel port
 *      wants exactly the six-field arg and `Promise<unknown>`. Narrowing
 *      to the port surface here keeps the kernel's structural contract
 *      the single source of truth — the executor never sees the wider
 *      service surface.
 *   2. The cross-package Drizzle `DatabaseClient` type does not always
 *      resolve cleanly into the api-gateway's TS project (NodeNext +
 *      isolatedModules), so the existing composition roots pass
 *      `db as never` into the database service factories (see
 *      `sovereign-ledger-verify-cron.ts:210`,
 *      `wake-loop-cron.ts:311/327`). We absorb that one boundary cast
 *      here so the three `createExecutor` call sites stay clean.
 *
 * The adapter is intentionally a pass-through: it does NOT swallow
 * errors. A throwing `appendLedgerEntry` MUST propagate so the kernel's
 * fail-closed branch fires and flips the sovereign-tier step to `failed`.
 */
import { createSovereignActionLedgerService } from '@bossnyumba/database';
import type { agency as agencyKernel } from '@bossnyumba/central-intelligence';

/** Kernel-facing port the executor consumes (structural surface only). */
type SovereignActionLedgerPort = agencyKernel.SovereignActionLedgerPort;

/**
 * Build the kernel `SovereignActionLedgerPort` over the same Drizzle
 * client a composition scope already resolved for its executor. The
 * returned port appends a hash-chained row for every sovereign-tier
 * action; append failures propagate (no try/catch) so the executor's
 * Wave-B fail-closed roll-back can fire.
 *
 * @param db The composition scope's resolved Drizzle client. Typed as
 *   `unknown` so callers can pass their `getDb()` / `deps.db` handle
 *   without importing the cross-package `DatabaseClient` type; the cast
 *   to the database service's expected shape is contained here.
 */
export function createSovereignLedgerPort(
  db: unknown,
): SovereignActionLedgerPort {
  const service = createSovereignActionLedgerService(db as never);
  return {
    appendLedgerEntry(args) {
      // Pass through exactly the port's six fields. The service accepts
      // an optional `rollbackPayload` we never set here; the executor
      // does not produce one. Errors are NOT caught — a failed audit
      // write must reach the kernel's fail-closed branch.
      return service.appendLedgerEntry({
        tenantId: args.tenantId,
        actionType: args.actionType,
        payloadJson: args.payloadJson,
        proposer: args.proposer,
        approvers: args.approvers,
        executedAt: args.executedAt,
      });
    },
  };
}
