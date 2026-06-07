/**
 * M2 — monitor-predicate source tests.
 *
 * Proves the orchestrator's `monitor` Decision now FIRES on a satisfiable
 * condition and EXPIRES cleanly otherwise, end-to-end through the in-process
 * supervisor:
 *
 *   - A satisfiable monitor (a completed work-order exists for the watched
 *     id) → the real `monitorChecker` returns `true` → the supervisor's
 *     tick fires the monitor and invokes the resume runner.
 *   - An unsatisfiable monitor (no matching row) → the checker returns
 *     `false` → the watch expires at its timeout with NO throw and NO
 *     resume.
 *   - A DB fault inside the checker → swallowed → `false` (the watch is
 *     retained until it expires, the supervisor never crashes).
 *   - The predicate parser maps the property-ops conditions the brain emits.
 *
 * The DB is a fake whose `select().from(table)…limit()` returns canned rows
 * keyed by the table reference, and whose `transaction(fn)` runs `fn(tx)`
 * against the same fake (so `withTenantContext` works without Postgres).
 */

import { describe, it, expect, vi } from 'vitest';

import {
  createMonitorPredicateChecker,
  parseMonitorPredicate,
} from '../monitor-predicate-source';
import { createInProcessWakeScheduler } from '@bossnyumba/central-intelligence';
import {
  workOrders,
  inspections,
  payments,
  invoices,
  leases,
  arrearsCases,
} from '@bossnyumba/database';

// ---------------------------------------------------------------------------
// Fake DB — a `withTenantContext`-compatible handle. `transaction(fn)` runs
// `fn(tx)` on the same fake; `select(...).from(table)` returns the canned
// rows registered for that table reference (default: empty).
// ---------------------------------------------------------------------------

type RowsByTable = ReadonlyMap<unknown, ReadonlyArray<Record<string, unknown>>>;

function createFakeDb(opts: {
  rowsByTable?: RowsByTable;
  throwOnSelect?: boolean;
} = {}): {
  transaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T>;
  execute(): Promise<{ rows: never[] }>;
} {
  const rowsByTable = opts.rowsByTable ?? new Map();

  function makeChain(): Record<string, unknown> {
    let table: unknown;
    const chain: Record<string, unknown> = {
      from(t: unknown) {
        table = t;
        return chain;
      },
      where() {
        return chain;
      },
      orderBy() {
        return chain;
      },
      async limit() {
        if (opts.throwOnSelect) throw new Error('synthetic-db-error');
        return rowsByTable.get(table) ?? [];
      },
      // PromiseLike so a query without a `.limit()` terminator still resolves.
      then<TResult1, TResult2 = never>(
        onfulfilled?: ((value: ReadonlyArray<unknown>) => TResult1 | PromiseLike<TResult1>) | null,
        onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
      ): PromiseLike<TResult1 | TResult2> {
        if (opts.throwOnSelect) {
          return Promise.reject(new Error('synthetic-db-error')).then(onfulfilled, onrejected);
        }
        return Promise.resolve(rowsByTable.get(table) ?? []).then(onfulfilled, onrejected);
      },
    };
    return chain;
  }

  const tx = {
    select() {
      return makeChain();
    },
    async execute() {
      return { rows: [] as never[] };
    },
  };

  return {
    async transaction<T>(fn: (t: unknown) => Promise<T>): Promise<T> {
      return fn(tx);
    },
    async execute() {
      return { rows: [] as never[] };
    },
  };
}

const tenantScope = {
  kind: 'tenant' as const,
  tenantId: 'tenant-A',
  actorUserId: 'user-1',
  roles: ['owner'] as ReadonlyArray<string>,
  personaId: 'mr-mwikila',
};

// ---------------------------------------------------------------------------
// 1. Predicate parser — structured grammar coverage.
// ---------------------------------------------------------------------------

describe('parseMonitorPredicate', () => {
  it('parses dotted payment predicates with a lease ref', () => {
    expect(parseMonitorPredicate('rent.paid for lease:L1')).toEqual({
      kind: 'payment',
      condition: 'paid',
      leaseId: 'L1',
    });
  });

  it('parses a natural-language rent-paid predicate', () => {
    expect(parseMonitorPredicate('notify when rent is paid for lease L9')).toEqual({
      kind: 'payment',
      condition: 'paid',
      leaseId: 'L9',
    });
  });

  it('parses invoice balance cleared', () => {
    expect(parseMonitorPredicate('invoice INV-2 balance cleared')).toEqual({
      kind: 'payment',
      condition: 'balance_cleared',
      invoiceId: 'INV-2',
    });
  });

  it('parses arrears settled', () => {
    expect(parseMonitorPredicate('arrears settled for customer:C3')).toEqual({
      kind: 'payment',
      condition: 'arrears_settled',
      customerId: 'C3',
    });
  });

  it('parses inspection completed', () => {
    expect(parseMonitorPredicate('inspection.completed for property:P1')).toEqual({
      kind: 'inspection',
      propertyId: 'P1',
    });
  });

  it('parses work-order closed', () => {
    expect(parseMonitorPredicate('work_order:WO-7 closed')).toEqual({
      kind: 'work_order',
      workOrderId: 'WO-7',
    });
  });

  it('parses lease signed / renewed / expired', () => {
    expect(parseMonitorPredicate('lease:L1 signed')).toEqual({
      kind: 'lease',
      condition: 'signed',
      leaseId: 'L1',
    });
    expect(parseMonitorPredicate('lease L2 renewed')).toEqual({
      kind: 'lease',
      condition: 'renewed',
      leaseId: 'L2',
    });
    expect(parseMonitorPredicate('lease:L3 has expired')).toEqual({
      kind: 'lease',
      condition: 'expired',
      leaseId: 'L3',
    });
  });

  it('maps an unrecognised free-text predicate to unknown', () => {
    expect(parseMonitorPredicate('the vibe shifts')).toEqual({ kind: 'unknown' });
    expect(parseMonitorPredicate('')).toEqual({ kind: 'unknown' });
  });
});

// ---------------------------------------------------------------------------
// 2. Checker — structured existence queries fire / do not fire.
// ---------------------------------------------------------------------------

describe('createMonitorPredicateChecker', () => {
  it('returns true when the watched work order is completed', async () => {
    const db = createFakeDb({
      rowsByTable: new Map([[workOrders, [{ id: 'WO-7' }]]]),
    });
    const checker = createMonitorPredicateChecker({ db: db as never });
    const fired = await checker({
      watchId: 'w1',
      predicate: 'work_order:WO-7 closed',
      scope: tenantScope,
    });
    expect(fired).toBe(true);
  });

  it('returns false when the watched work order is not yet closed', async () => {
    const db = createFakeDb({ rowsByTable: new Map([[workOrders, []]]) });
    const checker = createMonitorPredicateChecker({ db: db as never });
    const fired = await checker({
      watchId: 'w1',
      predicate: 'work_order:WO-7 closed',
      scope: tenantScope,
    });
    expect(fired).toBe(false);
  });

  it('fires on a completed inspection for the watched property', async () => {
    const db = createFakeDb({
      rowsByTable: new Map([[inspections, [{ id: 'I1' }]]]),
    });
    const checker = createMonitorPredicateChecker({ db: db as never });
    expect(
      await checker({
        watchId: 'w2',
        predicate: 'inspection completed for property:P1',
        scope: tenantScope,
      }),
    ).toBe(true);
  });

  it('fires on a completed payment for the watched lease', async () => {
    const db = createFakeDb({
      rowsByTable: new Map([[payments, [{ id: 'PMT-1' }]]]),
    });
    const checker = createMonitorPredicateChecker({ db: db as never });
    expect(
      await checker({
        watchId: 'w3',
        predicate: 'rent paid for lease:L1',
        scope: tenantScope,
      }),
    ).toBe(true);
  });

  it('fires on a signed lease (both parties signed)', async () => {
    const db = createFakeDb({
      rowsByTable: new Map([[leases, [{ id: 'L1' }]]]),
    });
    const checker = createMonitorPredicateChecker({ db: db as never });
    expect(
      await checker({
        watchId: 'w4',
        predicate: 'lease:L1 signed',
        scope: tenantScope,
      }),
    ).toBe(true);
  });

  it('does not fire a bare payment predicate with no entity scope', async () => {
    // Honest: "rent paid" with no lease/customer/invoice cannot be grounded
    // to a specific obligation, so it must not fire on any tenant payment.
    const db = createFakeDb({
      rowsByTable: new Map([[payments, [{ id: 'PMT-X' }]]]),
    });
    const checker = createMonitorPredicateChecker({ db: db as never });
    expect(
      await checker({ watchId: 'w5', predicate: 'rent.paid', scope: tenantScope }),
    ).toBe(false);
  });

  it('returns false (never throws) on a DB fault', async () => {
    const db = createFakeDb({ throwOnSelect: true });
    const logs: string[] = [];
    const checker = createMonitorPredicateChecker({
      db: db as never,
      logger: { error: (_m, msg) => logs.push(msg) },
    });
    await expect(
      checker({ watchId: 'w6', predicate: 'work_order:WO-1 closed', scope: tenantScope }),
    ).resolves.toBe(false);
    expect(logs.some((m) => m.includes('evaluation failed'))).toBe(true);
  });

  it('returns false for a platform-scoped watch (no tenant to ground)', async () => {
    const db = createFakeDb({ rowsByTable: new Map([[workOrders, [{ id: 'WO-1' }]]]) });
    const checker = createMonitorPredicateChecker({ db: db as never });
    expect(
      await checker({
        watchId: 'w7',
        predicate: 'work_order:WO-1 closed',
        scope: {
          kind: 'platform',
          actorUserId: 'u',
          roles: [],
          personaId: 'industry-observer',
        },
      }),
    ).toBe(false);
  });

  it('returns false for free-text when no Anthropic client is bound', async () => {
    const db = createFakeDb();
    const checker = createMonitorPredicateChecker({ db: db as never });
    expect(
      await checker({ watchId: 'w8', predicate: 'the market turns bullish', scope: tenantScope }),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 3. End-to-end through the in-process supervisor — FIRE vs EXPIRE.
// ---------------------------------------------------------------------------

describe('monitor end-to-end via in-process supervisor', () => {
  it('FIRES: a satisfiable monitor resumes the turn on the next tick', async () => {
    const db = createFakeDb({
      rowsByTable: new Map([[workOrders, [{ id: 'WO-7' }]]]),
    });
    const monitorResumeRunner = vi.fn(async () => undefined);
    const supervisor = createInProcessWakeScheduler({
      resumeTurnRunner: async () => undefined,
      monitorResumeRunner,
      monitorChecker: createMonitorPredicateChecker({ db: db as never }),
      monitorAvailable: true,
    });

    const handle = await supervisor.monitorRegistry.register({
      watchId: 'w-fire',
      threadId: 't-1',
      predicate: 'work_order:WO-7 closed',
      timeoutMs: 60_000,
      scope: tenantScope,
    });
    expect(handle.mode).toBe('in-process');
    expect(supervisor.armedMonitorCount()).toBe(1);

    const outcome = await supervisor.tick();
    expect(outcome.monitorsFired).toBe(1);
    expect(monitorResumeRunner).toHaveBeenCalledTimes(1);
    // Fired watch is removed so it never double-fires.
    expect(supervisor.armedMonitorCount()).toBe(0);
  });

  it('EXPIRES cleanly: an unsatisfiable monitor never fires and self-expires', async () => {
    // No matching row → checker returns false every tick.
    const db = createFakeDb({ rowsByTable: new Map([[workOrders, []]]) });
    const monitorResumeRunner = vi.fn(async () => undefined);
    let now = 1_000;
    const supervisor = createInProcessWakeScheduler({
      resumeTurnRunner: async () => undefined,
      monitorResumeRunner,
      monitorChecker: createMonitorPredicateChecker({ db: db as never }),
      monitorAvailable: true,
      clock: () => now,
    });

    await supervisor.monitorRegistry.register({
      watchId: 'w-expire',
      threadId: 't-2',
      predicate: 'work_order:WO-404 closed',
      timeoutMs: 5_000,
      scope: tenantScope,
    });

    // Tick before timeout: no fire, no expiry, watch retained.
    const t1 = await supervisor.tick(2_000);
    expect(t1.monitorsFired).toBe(0);
    expect(t1.monitorsExpired).toBe(0);
    expect(supervisor.armedMonitorCount()).toBe(1);

    // Tick after timeout: clean expiry, NO resume, NO throw.
    now = 10_000;
    const t2 = await supervisor.tick(10_000);
    expect(t2.monitorsFired).toBe(0);
    expect(t2.monitorsExpired).toBe(1);
    expect(monitorResumeRunner).not.toHaveBeenCalled();
    expect(supervisor.armedMonitorCount()).toBe(0);
  });

  it('a checker DB-fault keeps the watch armed (retained) until it expires', async () => {
    const db = createFakeDb({ throwOnSelect: true });
    const monitorResumeRunner = vi.fn(async () => undefined);
    let now = 0;
    const supervisor = createInProcessWakeScheduler({
      resumeTurnRunner: async () => undefined,
      monitorResumeRunner,
      monitorChecker: createMonitorPredicateChecker({ db: db as never }),
      monitorAvailable: true,
      clock: () => now,
    });
    await supervisor.monitorRegistry.register({
      watchId: 'w-fault',
      threadId: 't-3',
      predicate: 'work_order:WO-9 closed',
      timeoutMs: 5_000,
      scope: tenantScope,
    });
    // Checker swallows the fault → false → watch retained, no throw.
    const t1 = await supervisor.tick(1_000);
    expect(t1.monitorsFired).toBe(0);
    expect(supervisor.armedMonitorCount()).toBe(1);
    // Eventually expires.
    now = 10_000;
    const t2 = await supervisor.tick(10_000);
    expect(t2.monitorsExpired).toBe(1);
    expect(monitorResumeRunner).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 4. Remaining structured kinds — invoice balance + arrears.
// ---------------------------------------------------------------------------

describe('createMonitorPredicateChecker — payment sub-conditions', () => {
  it('fires balance_cleared when the watched invoice is paid', async () => {
    const db = createFakeDb({ rowsByTable: new Map([[invoices, [{ id: 'INV-2' }]]]) });
    const checker = createMonitorPredicateChecker({ db: db as never });
    expect(
      await checker({
        watchId: 'w-bal',
        predicate: 'invoice INV-2 balance cleared',
        scope: tenantScope,
      }),
    ).toBe(true);
  });

  it('fires arrears_settled when the arrears case is settled', async () => {
    const db = createFakeDb({ rowsByTable: new Map([[arrearsCases, [{ id: 'AC-1' }]]]) });
    const checker = createMonitorPredicateChecker({ db: db as never });
    expect(
      await checker({
        watchId: 'w-arr',
        predicate: 'arrears settled for lease:L1',
        scope: tenantScope,
      }),
    ).toBe(true);
  });

  it('does not fire arrears_settled while the case is still open', async () => {
    const db = createFakeDb({ rowsByTable: new Map([[arrearsCases, []]]) });
    const checker = createMonitorPredicateChecker({ db: db as never });
    expect(
      await checker({
        watchId: 'w-arr2',
        predicate: 'arrears settled for lease:L1',
        scope: tenantScope,
      }),
    ).toBe(false);
  });
});
