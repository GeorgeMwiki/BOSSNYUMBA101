/**
 * Unit tests for createKernelGoalsService.
 *
 * Mocks the Drizzle DatabaseClient with an in-memory store + the small
 * subset of drizzle-orm operators the service uses. Tests:
 *
 *   1. open() inserts a row + auto-allocates step ids
 *   2. list() filtered by status returns only matching goals
 *   3. get() returns the matching goal
 *   4. updateStepStatus() rewrites the step + bumps stepsDone on done
 *   5. setStatus() rewrites status + stamps completedAt on completed
 *   6. list() orders by createdAt DESC
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createKernelGoalsService } from './kernel-goals.service.js';
import type { DatabaseClient } from '../client.js';

interface Row {
  id: string;
  tenantId: string;
  userId: string;
  threadId: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
  steps: ReadonlyArray<Record<string, unknown>>;
  stepsTotal: number;
  stepsDone: number;
}

interface CapturedFilter {
  tenantId?: string;
  userId?: string;
  status?: string;
  id?: string;
}

const captured: { current: CapturedFilter; orderBy?: 'createdAt-desc' } = {
  current: {},
};

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    eq: (column: { name?: string }, value: unknown) => {
      const colName = String(column?.name ?? '');
      if (colName === 'tenant_id') captured.current.tenantId = String(value);
      else if (colName === 'user_id') captured.current.userId = String(value);
      else if (colName === 'status') captured.current.status = String(value);
      else if (colName === 'id') captured.current.id = String(value);
      return { _op: 'eq', col: colName, value };
    },
    desc: (col: unknown) => ({ _op: 'desc', column: col }),
    and: (...args: unknown[]) => ({ _op: 'and', args }),
  };
});

function makeStubDb(initial: ReadonlyArray<Row> = []): {
  client: DatabaseClient;
  readonly rows: Row[];
} {
  const state = { rows: [...initial] };

  function applyFilter(rows: Row[]): Row[] {
    const f = captured.current;
    let out = [...rows];
    if (f.tenantId !== undefined) out = out.filter((r) => r.tenantId === f.tenantId);
    if (f.userId !== undefined) out = out.filter((r) => r.userId === f.userId);
    if (f.status !== undefined) out = out.filter((r) => r.status === f.status);
    if (f.id !== undefined) out = out.filter((r) => r.id === f.id);
    return out;
  }

  function makeSelectChain(): unknown {
    const chain: Record<string, unknown> = {
      from: () => chain,
      where: () => chain,
      orderBy: () => chain,
      limit: () => chain,
      then: (resolve: (rows: unknown) => unknown) => {
        let out = applyFilter(state.rows);
        out.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        captured.current = {};
        return resolve(out);
      },
    };
    return chain;
  }

  function makeInsertChain(): unknown {
    const chain: Record<string, unknown> = {
      values: (v: Partial<Row>) => {
        state.rows.push({
          id: String(v.id ?? `r_${state.rows.length}`),
          tenantId: String(v.tenantId ?? ''),
          userId: String(v.userId ?? ''),
          threadId: String(v.threadId ?? ''),
          title: String(v.title ?? ''),
          description: String(v.description ?? ''),
          status: String(v.status ?? 'active'),
          priority: String(v.priority ?? 'medium'),
          createdAt: v.createdAt ?? new Date(),
          updatedAt: v.updatedAt ?? new Date(),
          completedAt: (v.completedAt ?? null) as Date | null,
          steps: (v.steps ?? []) as ReadonlyArray<Record<string, unknown>>,
          stepsTotal: Number(v.stepsTotal ?? 0),
          stepsDone: Number(v.stepsDone ?? 0),
        });
        return chain;
      },
      then: (resolve: (rows: unknown) => unknown) => resolve(undefined),
    };
    return chain;
  }

  function makeUpdateChain(): unknown {
    const chain: Record<string, unknown> = {
      _set: null as Partial<Row> | null,
      set: (v: Partial<Row>) => {
        chain._set = v;
        return chain;
      },
      where: () => chain,
      then: (resolve: (rows: unknown) => unknown) => {
        const target = applyFilter(state.rows);
        const set = (chain._set ?? {}) as Partial<Row>;
        for (const row of target) {
          if (set.steps !== undefined) row.steps = set.steps as ReadonlyArray<Record<string, unknown>>;
          if (set.stepsDone !== undefined) row.stepsDone = Number(set.stepsDone);
          if (set.status !== undefined) row.status = String(set.status);
          if (set.completedAt !== undefined) {
            row.completedAt = set.completedAt as Date | null;
          }
          if (set.updatedAt !== undefined) {
            row.updatedAt = set.updatedAt as Date;
          }
        }
        captured.current = {};
        return resolve(undefined);
      },
    };
    return chain;
  }

  const db: Record<string, unknown> = {
    select: () => makeSelectChain(),
    insert: () => makeInsertChain(),
    update: () => makeUpdateChain(),
  };
  const result = { client: db as unknown as DatabaseClient } as {
    client: DatabaseClient;
    readonly rows: Row[];
  };
  Object.defineProperty(result, 'rows', { get: () => state.rows });
  return result;
}

describe('createKernelGoalsService', () => {
  beforeEach(() => {
    captured.current = {};
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('open() inserts a row and auto-allocates step ids', async () => {
    const stub = makeStubDb();
    const svc = createKernelGoalsService(stub.client);

    const { id } = await svc.open({
      tenantId: 't_demo',
      userId: 'u_alice',
      threadId: 'th_1',
      title: 'Resolve arrears for unit 4B',
      description: 'Unit 4B has 30+ days of arrears.',
      status: 'active',
      priority: 'high',
      steps: [
        {
          seq: 0,
          description: 'Send reminder',
          toolName: 'rent.send-reminder',
          toolPayload: { leaseId: 'L1', channel: 'sms' },
        },
        {
          seq: 1,
          description: 'Wait 24h',
          toolName: null,
          toolPayload: null,
        },
      ],
    });

    expect(id).toBeTruthy();
    expect(stub.rows).toHaveLength(1);
    const row = stub.rows[0]!;
    expect(row.title).toBe('Resolve arrears for unit 4B');
    expect(row.stepsTotal).toBe(2);
    const steps = row.steps as Array<Record<string, unknown>>;
    expect(steps).toHaveLength(2);
    expect(typeof steps[0]?.id).toBe('string');
    expect(steps[0]?.status).toBe('pending');
  });

  it('list() filtered by status returns only matching goals', async () => {
    const now = new Date();
    const stub = makeStubDb([
      makeRow({
        id: 'g1',
        tenantId: 't',
        userId: 'u',
        status: 'active',
        title: 'A',
        createdAt: new Date(now.getTime() - 1000),
      }),
      makeRow({
        id: 'g2',
        tenantId: 't',
        userId: 'u',
        status: 'completed',
        title: 'B',
        createdAt: new Date(now.getTime() - 500),
      }),
    ]);
    const svc = createKernelGoalsService(stub.client);

    const out = await svc.list({
      tenantId: 't',
      userId: 'u',
      status: 'active',
    });
    expect(out).toHaveLength(1);
    expect(out[0]?.title).toBe('A');
  });

  it('get() returns the matching goal', async () => {
    const stub = makeStubDb([
      makeRow({ id: 'g1', tenantId: 't', userId: 'u', title: 'one' }),
    ]);
    const svc = createKernelGoalsService(stub.client);
    const out = await svc.get('g1');
    expect(out?.id).toBe('g1');
    expect(out?.title).toBe('one');

    const miss = await svc.get('g_unknown');
    expect(miss).toBeNull();
  });

  it('updateStepStatus() rewrites the step and bumps stepsDone on done', async () => {
    const stub = makeStubDb([
      makeRow({
        id: 'g1',
        tenantId: 't',
        userId: 'u',
        title: 'one',
        stepsTotal: 2,
        stepsDone: 0,
        steps: [
          { id: 's1', seq: 0, description: 'a', toolName: null, toolPayload: null, status: 'pending', startedAt: null, endedAt: null, outcome: null, errorMessage: null },
          { id: 's2', seq: 1, description: 'b', toolName: null, toolPayload: null, status: 'pending', startedAt: null, endedAt: null, outcome: null, errorMessage: null },
        ],
      }),
    ]);
    const svc = createKernelGoalsService(stub.client);

    await svc.updateStepStatus({
      goalId: 'g1',
      stepId: 's1',
      status: 'done',
      outcome: 'ok',
    });

    const updated = stub.rows[0]!;
    expect(updated.stepsDone).toBe(1);
    const steps = updated.steps as Array<Record<string, unknown>>;
    const s1 = steps.find((s) => s.id === 's1');
    expect(s1?.status).toBe('done');
    expect(s1?.outcome).toBe('ok');
  });

  it('setStatus() rewrites status and stamps completedAt on completed', async () => {
    const stub = makeStubDb([
      makeRow({ id: 'g1', tenantId: 't', userId: 'u', title: 'one' }),
    ]);
    const svc = createKernelGoalsService(stub.client);

    await svc.setStatus('g1', 'completed');
    const row = stub.rows[0]!;
    expect(row.status).toBe('completed');
    expect(row.completedAt).not.toBeNull();
  });

  it('list() orders by createdAt DESC', async () => {
    const t0 = new Date('2026-01-01T00:00:00Z');
    const stub = makeStubDb([
      makeRow({
        id: 'g1',
        tenantId: 't',
        userId: 'u',
        title: 'older',
        createdAt: t0,
      }),
      makeRow({
        id: 'g2',
        tenantId: 't',
        userId: 'u',
        title: 'newer',
        createdAt: new Date(t0.getTime() + 5_000),
      }),
    ]);
    const svc = createKernelGoalsService(stub.client);
    const rows = await svc.list({ tenantId: 't', userId: 'u' });
    expect(rows.map((r) => r.title)).toEqual(['newer', 'older']);
  });
});

function makeRow(over: Partial<Row>): Row {
  return {
    id: 'r',
    tenantId: 't',
    userId: 'u',
    threadId: 'th',
    title: 'goal',
    description: '',
    status: 'active',
    priority: 'medium',
    createdAt: new Date(),
    updatedAt: new Date(),
    completedAt: null,
    steps: [],
    stepsTotal: 0,
    stepsDone: 0,
    ...over,
  };
}
