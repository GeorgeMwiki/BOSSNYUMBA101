/**
 * Sovereign-ledger port ACTIVATION test (Wave-B fail-closed).
 *
 * This is the composition-root proof that the fail-closed protection is
 * no longer DORMANT. The kernel executor already inverts the sovereign-
 * tier ledger default to fail-closed (proven exhaustively in
 * `packages/central-intelligence/.../__tests__/executor-sovereign-ledger
 * .test.ts`), but that guard is a no-op unless a real
 * `SovereignActionLedgerPort` is bound at the composition root. Before
 * this wiring, none of the three `createExecutor` call sites passed a
 * `sovereignLedger` — so an irreversible sovereign action whose audit
 * write failed STILL reported success.
 *
 * Here we wire the composition's REAL `createSovereignLedgerPort`
 * (which builds the Drizzle-backed `createSovereignActionLedgerService`)
 * into a real `createExecutor`, then drive it through a fake Drizzle
 * client. We assert:
 *
 *   1. ACTIVATION — when the DB ledger write FAILS, a sovereign-tier
 *      tool that the tool itself reported as success is flipped to
 *      `failed` with reason `sovereign-audit-write-failed`. The
 *      fail-closed branch FIRES because a ledger is now bound to fail.
 *      (Pre-fix: this would have been a silent success.)
 *
 *   2. ISOLATION — a NON-sovereign tool is unaffected by a failing
 *      ledger: it never touches the ledger and reports success.
 *
 *   3. HAPPY PATH — when the DB write SUCCEEDS, the sovereign-tier tool
 *      reports success and the bound port issued exactly one append
 *      (advisory-lock probe + head-read + INSERT against the fake
 *      Drizzle client), confirming the port really routes through the
 *      database service rather than a stub.
 *
 * We do NOT re-test the kernel's internal fail-closed mechanics — that
 * is owned by the kernel test above. This test owns the SEAM: does the
 * composition adapter actually reach the DB service, and does a DB-level
 * failure propagate far enough to trip fail-closed?
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { agency as agencyKernel } from '@bossnyumba/central-intelligence';
import { createSovereignLedgerPort } from '../sovereign-ledger-port.js';

// ---------------------------------------------------------------------------
// Fake Drizzle client — models ONLY the surface the sovereign-action-
// ledger service touches in `appendLedgerEntry`:
//   - `execute(sql)`  → advisory-lock probe (the service RETHROWS if this
//                       rejects, which is our deterministic failure lever)
//   - `select(...).from(...).where(...).orderBy(...).limit(1)` → head read
//   - `insert(...).values(...)` → the actual append
// No `.transaction` method is exposed, so the service takes its
// stub-client fallback path (`runInside(undefined)`), which still issues
// the advisory-lock SELECT.
// ---------------------------------------------------------------------------

interface FakeDbOptions {
  /** When true, the advisory-lock `execute` rejects → append() throws. */
  readonly failOnExecute?: boolean;
}

interface FakeDb {
  readonly executeCalls: number;
  readonly insertCalls: number;
  execute(q: unknown): Promise<unknown>;
  select(args?: unknown): FakeChain;
  insert(table: unknown): FakeChain;
}

interface FakeChain {
  from(args: unknown): FakeChain;
  where(args: unknown): FakeChain;
  orderBy(...args: unknown[]): FakeChain;
  limit(n: number): Promise<unknown[]>;
  values(args: unknown): Promise<unknown>;
}

function createFakeDb(options: FakeDbOptions = {}): FakeDb {
  const counters = { executeCalls: 0, insertCalls: 0 };

  const chain: FakeChain = {
    from() {
      return chain;
    },
    where() {
      return chain;
    },
    orderBy() {
      return chain;
    },
    // Head read for prev_hash — empty so the service uses GENESIS_HASH.
    limit() {
      return Promise.resolve([]);
    },
    // The terminal INSERT — resolves so the happy path completes.
    values() {
      counters.insertCalls += 1;
      return Promise.resolve(undefined);
    },
  };

  return {
    get executeCalls() {
      return counters.executeCalls;
    },
    get insertCalls() {
      return counters.insertCalls;
    },
    execute() {
      counters.executeCalls += 1;
      if (options.failOnExecute) {
        // The service's advisory-lock branch RETHROWS this, so the bound
        // port's `appendLedgerEntry` throws — exactly the DB-failure the
        // executor's fail-closed branch is meant to catch.
        return Promise.reject(new Error('db connection lost'));
      }
      return Promise.resolve(undefined);
    },
    select() {
      return chain;
    },
    insert() {
      return chain;
    },
  };
}

// ---------------------------------------------------------------------------
// Tools. A sovereign-tier tool (deny-list name, low stakes so it bypasses
// the four-eye gate and actually executes), and a plain non-sovereign
// low-stakes tool.
// ---------------------------------------------------------------------------

function sovereignTool(): agencyKernel.ActionToolDef<
  Record<string, unknown>,
  { id: string }
> {
  // `tenant-eviction-proposed` is on SOVEREIGN_TIER_ACTION_NAMES, so it is
  // sovereign-tier even at `low` stakes — and `low` keeps it out of the
  // four-eye approval gate so it executes inline and reaches the ledger.
  return {
    name: 'tenant-eviction-proposed',
    description: 'Sovereign-tier action (deny-list), low stakes to execute inline.',
    stakes: 'low',
    inputSchema: {},
    async invoke() {
      return { ok: true as const, output: { id: 'evict_1' } };
    },
  };
}

function nonSovereignTool(): agencyKernel.ActionToolDef<
  Record<string, unknown>,
  { id: string }
> {
  return {
    name: 'rent.send-reminder-stub',
    description: 'Non-sovereign low-stakes tool — must never touch the ledger.',
    stakes: 'low',
    inputSchema: {},
    async invoke() {
      return { ok: true as const, output: { id: 'rem_1' } };
    },
  };
}

/**
 * Build a real executor with the composition's REAL sovereign-ledger
 * port (over the fake DB), open a one-step goal that invokes `tool`, run
 * it, and return the executor outcome. This is the seam under test: the
 * adapter must reach the database service AND a DB-level failure must
 * propagate far enough to trip the kernel's fail-closed branch.
 *
 * No `sovereignLedgerFailClosed` is passed → Wave-B safe default
 * (fail-closed), matching every production `createExecutor` call site.
 */
async function runSingleStep(
  db: FakeDb,
  tool: agencyKernel.ActionToolDef<Record<string, unknown>, { id: string }>,
): Promise<agencyKernel.ExecutorOutcome> {
  const goals = agencyKernel.createInMemoryGoalsPort();
  const tools = agencyKernel.createActionToolRegistry();
  tools.register(tool);
  const executor = agencyKernel.createExecutor({
    goals,
    tools,
    auditSink: agencyKernel.createInMemoryActionAuditSink(),
    autonomyPolicy: agencyKernel.createDefaultAllowLowStakesPolicy(),
    sovereignLedger: createSovereignLedgerPort(db),
  });
  const { id } = await goals.open({
    tenantId: 't-activation',
    userId: 'u-1',
    threadId: 'th-1',
    title: 'activation',
    description: '',
    status: 'active',
    priority: 'high',
    steps: [
      {
        seq: 0,
        description: 'run tool',
        toolName: tool.name,
        toolPayload: { leaseId: 'l-1' },
      },
    ],
  });
  return executor.executeGoal(id);
}

describe('composition: sovereign-ledger port activation (Wave-B fail-closed)', () => {
  beforeEach(() => {
    // The executor logs the fail-closed event via the default kernel
    // logger when no `logger` dep is passed; silence console noise.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('ACTIVATION: bound ledger + failing DB write flips a sovereign-tier success to failed', async () => {
    const db = createFakeDb({ failOnExecute: true });
    const out = await runSingleStep(db, sovereignTool());

    // Pre-fix this would have been `stepsSucceeded: 1` (no ledger bound,
    // safeSovereignLedger no-op). With the real port bound and the DB
    // write failing, fail-closed FIRES.
    expect(out.stepsSucceeded).toBe(0);
    expect(out.stepsFailed).toBe(1);
    expect(out.failureMessages).toContain(
      agencyKernel.SOVEREIGN_AUDIT_WRITE_FAILED_REASON,
    );
    // Proof the port actually reached the DB service (advisory-lock probe
    // ran before it rethrew).
    expect(db.executeCalls).toBeGreaterThan(0);
    expect(db.insertCalls).toBe(0);
  });

  it('ISOLATION: a non-sovereign tool is unaffected by a failing ledger', async () => {
    const db = createFakeDb({ failOnExecute: true });
    const out = await runSingleStep(db, nonSovereignTool());

    // Non-sovereign tools never touch the ledger, so the failing DB is
    // irrelevant — the step succeeds.
    expect(out.stepsSucceeded).toBe(1);
    expect(out.stepsFailed).toBe(0);
    expect(out.failureMessages).toEqual([]);
    // The ledger was never invoked for a non-sovereign tool.
    expect(db.executeCalls).toBe(0);
    expect(db.insertCalls).toBe(0);
  });

  it('HAPPY PATH: bound ledger + succeeding DB write records the sovereign action and reports success', async () => {
    const db = createFakeDb({ failOnExecute: false });
    const out = await runSingleStep(db, sovereignTool());

    expect(out.stepsSucceeded).toBe(1);
    expect(out.stepsFailed).toBe(0);
    expect(out.failureMessages).toEqual([]);
    // The port routed through the real database service: advisory-lock
    // probe + a single INSERT (the append).
    expect(db.executeCalls).toBeGreaterThan(0);
    expect(db.insertCalls).toBe(1);
  });

  it('isSovereignTier agrees: the deny-list tool is sovereign even at low stakes', () => {
    expect(
      agencyKernel.isSovereignTier({
        name: 'tenant-eviction-proposed',
        stakes: 'low',
      }),
    ).toBe(true);
    expect(
      agencyKernel.isSovereignTier({
        name: 'rent.send-reminder-stub',
        stakes: 'low',
      }),
    ).toBe(false);
  });
});
