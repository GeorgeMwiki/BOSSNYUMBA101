/**
 * InspectionRepository — cross-tenant isolation for child tables.
 *
 * THREAT MODEL
 * ────────────
 * In production the api-gateway connects to Postgres as a BYPASSRLS role
 * (Supabase `service_role`), so Row-Level-Security is INERT and tenant
 * isolation rests SOLELY on the app-level `WHERE tenant_id = ?` predicate
 * in this repository. `inspection_items` / `inspection_signatures` were
 * previously scoped ONLY by `inspection_id`, which is a cross-tenant IDOR:
 * tenant B could read tenant A's items/signatures by guessing an
 * inspection id. Migration 0014 already declares `tenant_id NOT NULL` on
 * both tables; these tests prove the repository now filters on it.
 *
 * HOW THIS RUNS WITHOUT POSTGRES
 * ──────────────────────────────
 * `drizzle-orm` is mocked so `eq` / `and` produce a structured predicate
 * tree that captures each column's SQL name. The in-memory DatabaseClient
 * simulator then *actually evaluates* that predicate against its stored
 * rows — so a cross-tenant read genuinely returns `[]`, rather than the
 * test merely asserting "a predicate token was passed". This mirrors the
 * simulator pattern in `customer-encryption-roundtrip.test.ts`.
 */

import { describe, it, expect, vi } from 'vitest';
import { getTableConfig } from 'drizzle-orm/pg-core';

import { InspectionRepository } from '../inspection.repository.js';
import {
  inspectionItems,
  inspectionSignatures,
} from '../../schemas/index.js';
import type { DatabaseClient } from '../../client.js';
import type { TenantId } from '@bossnyumba/domain-models';

// ───────────────────────────────────────────────────────────────────────
// Predicate-aware drizzle mock.
//
// `eq(col, val)` captures the column's SQL `.name` so the simulator can
// resolve it back to the row field. `and(...)` nests the leaf predicates.
// `asc` is a no-op marker (ordering is irrelevant to isolation).
// ───────────────────────────────────────────────────────────────────────
type Leaf = { readonly _op: 'eq'; readonly name: string; readonly val: unknown };
type AndNode = { readonly _op: 'and'; readonly preds: readonly Predicate[] };
type Predicate = Leaf | AndNode;

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    eq: (col: { name: string }, val: unknown): Leaf => ({
      _op: 'eq',
      name: col.name,
      val,
    }),
    and: (...preds: Predicate[]): AndNode => ({ _op: 'and', preds }),
    asc: () => ({ _op: 'asc' }),
  };
});

// SQL-name → JS-key map per table, derived from the column objects. The
// repo inserts rows keyed by JS prop (`tenantId`), but predicates capture
// the SQL name (`tenant_id`); this bridges the two.
function sqlNameToJsKey(
  table: typeof inspectionItems | typeof inspectionSignatures,
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const [jsKey, col] of Object.entries(table)) {
    if (col && typeof col === 'object' && typeof (col as { name?: unknown }).name === 'string') {
      map[(col as { name: string }).name] = jsKey;
    }
  }
  return map;
}

function matchesPredicate(
  row: Record<string, unknown>,
  pred: Predicate,
  nameToKey: Record<string, string>,
): boolean {
  if (pred._op === 'and') {
    return pred.preds.every((p) => matchesPredicate(row, p, nameToKey));
  }
  const jsKey = nameToKey[pred.name] ?? pred.name;
  return row[jsKey] === pred.val;
}

/**
 * In-memory DatabaseClient simulator that captures `.values(...)` on
 * insert and *filters* on `.where(predicate)` for select. One simulator
 * is bound to one table (the repo only touches one child table per call
 * chain).
 */
function makeDbSim(
  table: typeof inspectionItems | typeof inspectionSignatures,
): { client: DatabaseClient; readonly rawRows: Record<string, unknown>[] } {
  const rows: Record<string, unknown>[] = [];
  const nameToKey = sqlNameToJsKey(table);

  const insertChain = {
    values(v: Record<string, unknown>) {
      const stored = { ...v };
      rows.push(stored);
      return { returning: () => Promise.resolve([stored]) };
    },
  };

  function makeSelectChain() {
    let filtered = [...rows];
    const chain: Record<string, unknown> = {
      from() {
        return chain;
      },
      where(pred: Predicate) {
        filtered = filtered.filter((r) => matchesPredicate(r, pred, nameToKey));
        return chain;
      },
      orderBy() {
        return Promise.resolve(filtered);
      },
      // getSignatures resolves the chain at `.where(...)` (no orderBy), so
      // the chain must itself be awaitable.
      then(onFulfilled: (v: Record<string, unknown>[]) => unknown) {
        return Promise.resolve(filtered).then(onFulfilled);
      },
    };
    return chain;
  }

  const db = {
    insert() {
      return insertChain;
    },
    select() {
      return makeSelectChain();
    },
    update() {
      return {
        set() {
          return {
            where(pred: Predicate) {
              return {
                returning() {
                  return Promise.resolve(
                    rows.filter((r) => matchesPredicate(r, pred, nameToKey)),
                  );
                },
              };
            },
          };
        },
      };
    },
  };

  return {
    client: db as unknown as DatabaseClient,
    get rawRows() {
      return rows;
    },
  };
}

const TENANT_A = 'tenant_aaaa' as TenantId;
const TENANT_B = 'tenant_bbbb' as TenantId;

describe('InspectionRepository inspection_items tenant isolation', () => {
  it('insert persists tenant_id from the caller context', async () => {
    const sim = makeDbSim(inspectionItems);
    const repo = new InspectionRepository(sim.client);

    const row = await repo.addItem(TENANT_A, {
      id: 'item_1',
      inspectionId: 'insp_1',
      room: 'Kitchen',
      item: 'Sink',
      condition: 'good',
    });

    expect(row.tenantId).toBe(TENANT_A);
    expect(sim.rawRows[0]?.tenantId).toBe(TENANT_A);
  });

  it('getItems returns the owning tenant rows', async () => {
    const sim = makeDbSim(inspectionItems);
    const repo = new InspectionRepository(sim.client);
    await repo.addItem(TENANT_A, {
      id: 'item_1',
      inspectionId: 'insp_1',
      room: 'Kitchen',
      item: 'Sink',
      condition: 'good',
    });

    const items = await repo.getItems('insp_1', TENANT_A);
    expect(items).toHaveLength(1);
    expect(items[0]?.id).toBe('item_1');
  });

  it('cross-tenant read returns EMPTY (tenant B cannot see tenant A items)', async () => {
    const sim = makeDbSim(inspectionItems);
    const repo = new InspectionRepository(sim.client);
    await repo.addItem(TENANT_A, {
      id: 'item_1',
      inspectionId: 'insp_1',
      room: 'Kitchen',
      item: 'Sink',
      condition: 'good',
    });

    // Same inspectionId, attacker's tenantId → must be empty.
    const leaked = await repo.getItems('insp_1', TENANT_B);
    expect(leaked).toEqual([]);
  });

  it('updateItem cannot mutate another tenant row', async () => {
    const sim = makeDbSim(inspectionItems);
    const repo = new InspectionRepository(sim.client);
    await repo.addItem(TENANT_A, {
      id: 'item_1',
      inspectionId: 'insp_1',
      room: 'Kitchen',
      item: 'Sink',
      condition: 'good',
    });

    const asTenantB = await repo.updateItem('item_1', 'insp_1', TENANT_B, {
      condition: 'damaged',
    });
    expect(asTenantB).toBeNull();

    const asTenantA = await repo.updateItem('item_1', 'insp_1', TENANT_A, {
      condition: 'damaged',
    });
    expect(asTenantA?.id).toBe('item_1');
  });
});

describe('InspectionRepository inspection_signatures tenant isolation', () => {
  it('insert persists tenant_id from the caller context', async () => {
    const sim = makeDbSim(inspectionSignatures);
    const repo = new InspectionRepository(sim.client);

    const row = await repo.addSignature(TENANT_A, {
      id: 'sig_1',
      inspectionId: 'insp_1',
      signerType: 'tenant',
      signerName: 'Asha Kweli',
      signatureData: 'data:image/png;base64,AAAA',
    });

    expect(row.tenantId).toBe(TENANT_A);
    expect(sim.rawRows[0]?.tenantId).toBe(TENANT_A);
  });

  it('getSignatures returns the owning tenant rows', async () => {
    const sim = makeDbSim(inspectionSignatures);
    const repo = new InspectionRepository(sim.client);
    await repo.addSignature(TENANT_A, {
      id: 'sig_1',
      inspectionId: 'insp_1',
      signerType: 'tenant',
      signerName: 'Asha Kweli',
      signatureData: 'data:image/png;base64,AAAA',
    });

    const sigs = await repo.getSignatures('insp_1', TENANT_A);
    expect(sigs).toHaveLength(1);
    expect(sigs[0]?.id).toBe('sig_1');
  });

  it('cross-tenant read returns EMPTY (tenant B cannot see tenant A signatures)', async () => {
    const sim = makeDbSim(inspectionSignatures);
    const repo = new InspectionRepository(sim.client);
    await repo.addSignature(TENANT_A, {
      id: 'sig_1',
      inspectionId: 'insp_1',
      signerType: 'tenant',
      signerName: 'Asha Kweli',
      signatureData: 'data:image/png;base64,AAAA',
    });

    const leaked = await repo.getSignatures('insp_1', TENANT_B);
    expect(leaked).toEqual([]);
  });
});

describe('inspection child schemas declare tenant_id (migration 0014 parity)', () => {
  it('inspection_items has a NOT NULL tenant_id column', () => {
    const cfg = getTableConfig(inspectionItems);
    const tenantCol = cfg.columns.find((c) => c.name === 'tenant_id');
    expect(tenantCol).toBeDefined();
    expect(tenantCol?.notNull).toBe(true);
  });

  it('inspection_signatures has a NOT NULL tenant_id column', () => {
    const cfg = getTableConfig(inspectionSignatures);
    const tenantCol = cfg.columns.find((c) => c.name === 'tenant_id');
    expect(tenantCol).toBeDefined();
    expect(tenantCol?.notNull).toBe(true);
  });
});
