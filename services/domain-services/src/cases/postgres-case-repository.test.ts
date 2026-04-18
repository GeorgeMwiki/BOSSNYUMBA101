// @ts-nocheck — mirrors repo convention for Postgres repo tests
/**
 * Tests for PostgresCaseRepository using an in-memory drizzle fake.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PostgresCaseRepository } from './postgres-case-repository.js';
import type { Case, CaseTimelineEvent, CustomerId } from './index.js';
import { asCaseId } from './index.js';
import type {
  TenantId,
  UserId,
  ISOTimestamp,
} from '@bossnyumba/domain-models';

type Row = Record<string, unknown>;

vi.mock('drizzle-orm', () => ({
  and: (...parts: any[]) => (row: Row) =>
    parts.every((p) => (p ? p(row) : true)),
  eq: (col: any, val: unknown) => (row: Row) => row[col.name] === val,
  lt: (col: any, val: any) => (row: Row) => {
    const left = row[col.name];
    if (left instanceof Date && val instanceof Date) return left < val;
    if (left == null) return false;
    return (left as any) < val;
  },
}));

vi.mock('@bossnyumba/database', () => {
  const col = (name: string) => ({ name });
  return {
    cases: {
      _table: 'cases',
      id: col('id'),
      tenantId: col('tenantId'),
      resolutionDueAt: col('resolutionDueAt'),
      status: col('status'),
    },
  };
});

function makeFakeDb() {
  const tables: Record<string, Row[]> = { cases: [] };
  const toPred = (p: any) => (typeof p === 'function' ? p : () => true);
  return {
    tables,
    select: () => {
      let predicate: (r: Row) => boolean = () => true;
      let limit = Infinity;
      let currentTable: Row[] = [];
      const chain: any = {
        from: (t: any) => {
          currentTable = tables[t._table] ?? [];
          return chain;
        },
        where: (p: any) => ((predicate = toPred(p)), chain),
        limit: (n: number) => ((limit = n), chain),
        then: (resolve: (r: Row[]) => void) =>
          resolve(currentTable.filter(predicate).slice(0, limit)),
      };
      return chain;
    },
    insert: (t: any) => ({
      values(v: Row) {
        tables[t._table].push({ ...v });
      },
    }),
    update: (t: any) => {
      let patch: Row = {};
      const chain: any = {
        set: (p: Row) => ((patch = p), chain),
        where: (p: any) => {
          const pred = toPred(p);
          for (const row of tables[t._table]) if (pred(row)) Object.assign(row, patch);
          return Promise.resolve();
        },
      };
      return chain;
    },
  };
}

const TENANT = 'tenant_1' as TenantId;
const ACTOR = 'u_1' as UserId;
const CUSTOMER = 'cust_1' as CustomerId;

function makeCase(id: string, overrides: Partial<Case> = {}): Case {
  const now = new Date().toISOString() as ISOTimestamp;
  return {
    id: asCaseId(id),
    tenantId: TENANT,
    caseNumber: `CASE-${id}`,
    type: 'OTHER',
    severity: 'MEDIUM',
    status: 'OPEN',
    title: `Case ${id}`,
    description: 'test',
    customerId: CUSTOMER,
    timeline: [],
    notices: [],
    evidence: [],
    escalationLevel: 0,
    createdAt: now,
    createdBy: ACTOR,
    updatedAt: now,
    updatedBy: ACTOR,
    ...overrides,
  };
}

describe('PostgresCaseRepository', () => {
  let db: ReturnType<typeof makeFakeDb>;
  let repo: PostgresCaseRepository;

  beforeEach(() => {
    db = makeFakeDb();
    repo = new PostgresCaseRepository(db as any);
  });

  it('createCase + findById', async () => {
    const c = makeCase('k1');
    await repo.createCase(c);
    const found = await repo.findById(c.id, TENANT);
    expect(found?.caseNumber).toBe('CASE-k1');
    expect(found?.status).toBe('OPEN');
  });

  it('update persists changes', async () => {
    const c = makeCase('k2');
    await repo.createCase(c);
    await repo.update({ ...c, status: 'IN_PROGRESS' });
    const found = await repo.findById(c.id, TENANT);
    expect(found?.status).toBe('IN_PROGRESS');
  });

  it('appendTimelineEvent is additive', async () => {
    const c = makeCase('k3');
    await repo.createCase(c);
    const event: CaseTimelineEvent = {
      id: 'e1',
      type: 'STATUS_CHANGED',
      description: 'moved',
      createdAt: new Date().toISOString() as ISOTimestamp,
      createdBy: ACTOR,
    };
    await repo.appendTimelineEvent(c.id, TENANT, event, ACTOR);
    const found = await repo.findById(c.id, TENANT);
    expect(found?.timeline).toHaveLength(1);
  });

  it('findOverdue filters out terminal statuses', async () => {
    const past = new Date(Date.now() - 10_000).toISOString() as ISOTimestamp;
    const future = new Date(Date.now() + 10_000).toISOString() as ISOTimestamp;
    await repo.createCase(makeCase('overdue_open', { dueDate: past, status: 'OPEN' }));
    await repo.createCase(
      makeCase('overdue_closed', { dueDate: past, status: 'CLOSED' })
    );
    await repo.createCase(
      makeCase('future_open', { dueDate: future, status: 'OPEN' })
    );
    const now = new Date().toISOString() as ISOTimestamp;
    const overdue = await repo.findOverdue(TENANT, now);
    const ids = overdue.map((c) => c.id);
    expect(ids).toContain('overdue_open');
    expect(ids).not.toContain('overdue_closed');
    expect(ids).not.toContain('future_open');
  });
});
