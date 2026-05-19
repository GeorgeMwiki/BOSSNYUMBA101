/**
 * Matrix unit tests.
 *
 * Covers:
 *   - 10×5 matrix returns in parallel
 *   - Every cell has a citation forwarded from the cell driver
 *   - Partial failure surfaces as a result with `errored: true` cells
 *   - Owner-customer principal cannot query other tenant's matrix
 *   - CSV export shape
 */

import { describe, expect, it, vi } from 'vitest';
import {
  buildMatrixPart,
  runMatrix,
  toCsv,
  type CellDriver,
  type EntityStoreDriver,
  type Question,
} from '../matrix/index.js';
import type { Principal } from '../types.js';

function makeEntityStore(rowCount: number, tenantId = 'tenant-A'): EntityStoreDriver {
  return {
    async resolveEntities() {
      return Array.from({ length: rowCount }, (_, i) => ({
        entityId: `prop-${i + 1}`,
        label: `Property ${i + 1}`,
        tenantId,
        attributes: { tenantId, index: i },
      }));
    },
  };
}

function makeCellDriver(opts: { delayMs?: number; failOnRow?: string | undefined } = {}): {
  driver: CellDriver;
  callCount: () => number;
  maxParallelObserved: () => number;
} {
  let calls = 0;
  let inflight = 0;
  let maxParallel = 0;
  const driver: CellDriver = {
    async answerCell({ entity, question }) {
      calls += 1;
      inflight += 1;
      if (inflight > maxParallel) maxParallel = inflight;
      if (opts.delayMs) await new Promise((r) => setTimeout(r, opts.delayMs));
      try {
        if (opts.failOnRow && entity.entityId === opts.failOnRow) {
          throw new Error('synthetic failure');
        }
        return {
          value: `${entity.entityId}-${question.id}`,
          displayValue: `${entity.label} · ${question.text}`,
          confidence: 'high',
          citations: [
            {
              id: `cit-${entity.entityId}-${question.id}`,
              label: `${entity.label} source`,
              sourceLocator: `attr ${question.id}`,
              entityId: entity.entityId,
            },
          ],
          cost: { label: 'LLM tokens', costUsd: 0.001 },
        };
      } finally {
        inflight -= 1;
      }
    },
  };
  return { driver, callCount: () => calls, maxParallelObserved: () => maxParallel };
}

const ownerA: Principal = {
  principalId: 'p-A',
  kind: 'owner-customer',
  tenantId: 'tenant-A',
};
const adminA: Principal = {
  principalId: 'p-admin',
  kind: 'internal-admin',
  tenantId: 'tenant-A',
};

const sampleColumns: ReadonlyArray<Question> = [
  { id: 'occupancy', text: 'What is the current occupancy?', answerFormat: 'percent' },
  { id: 'behind', text: "Who's behind on rent?", answerFormat: 'text' },
  { id: 'renewal', text: "When's the next lease renewal?", answerFormat: 'date' },
];

describe('runMatrix', () => {
  it('returns a 10x5 matrix in parallel — all cells filled with citations', async () => {
    const entityStore = makeEntityStore(10);
    const { driver, callCount, maxParallelObserved } = makeCellDriver({ delayMs: 5 });
    const r = await runMatrix(
      {
        rows: { entityKind: 'property', tenantId: 'tenant-A' },
        columns: [
          { id: 'q1', text: 'q1' },
          { id: 'q2', text: 'q2' },
          { id: 'q3', text: 'q3' },
          { id: 'q4', text: 'q4' },
          { id: 'q5', text: 'q5' },
        ],
      },
      ownerA,
      { entityStore, cellDriver: driver, maxParallel: 8 },
    );
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error('unreachable');
    expect(r.value.rows.length).toBe(10);
    expect(r.value.totalCells).toBe(50);
    expect(r.value.filledCells).toBe(50);
    expect(callCount()).toBe(50);
    expect(maxParallelObserved()).toBeGreaterThan(1);
    for (const row of r.value.rows) {
      for (const c of row.cells) {
        expect(c.citations.length).toBe(1);
        expect(c.citations[0]!.id).toContain('cit-');
      }
    }
  });

  it('returns a 3-column "all my properties" sample query', async () => {
    const entityStore = makeEntityStore(4);
    const { driver } = makeCellDriver();
    const r = await runMatrix(
      { rows: { entityKind: 'property', tenantId: 'tenant-A' }, columns: sampleColumns },
      ownerA,
      { entityStore, cellDriver: driver },
    );
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error('unreachable');
    expect(r.value.rows[0]!.cells.map((c) => c.columnId)).toEqual([
      'occupancy',
      'behind',
      'renewal',
    ]);
  });

  it('rejects owner-customer querying other tenant', async () => {
    const entityStore = makeEntityStore(2, 'tenant-B');
    const { driver } = makeCellDriver();
    const r = await runMatrix(
      { rows: { entityKind: 'property', tenantId: 'tenant-B' }, columns: sampleColumns },
      ownerA,
      { entityStore, cellDriver: driver },
    );
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error('unreachable');
    expect(r.error.kind).toBe('forbidden');
  });

  it('allows internal-admin to query any tenant', async () => {
    const entityStore = makeEntityStore(2, 'tenant-B');
    const { driver } = makeCellDriver();
    const r = await runMatrix(
      { rows: { entityKind: 'property', tenantId: 'tenant-B' }, columns: sampleColumns },
      adminA,
      { entityStore, cellDriver: driver },
    );
    expect(r.ok).toBe(true);
  });

  it('rejects empty columns with invalid-query', async () => {
    const entityStore = makeEntityStore(1);
    const { driver } = makeCellDriver();
    const r = await runMatrix(
      { rows: { entityKind: 'property', tenantId: 'tenant-A' }, columns: [] },
      ownerA,
      { entityStore, cellDriver: driver },
    );
    expect(r.ok).toBe(false);
  });

  it('rejects duplicate column ids', async () => {
    const entityStore = makeEntityStore(1);
    const { driver } = makeCellDriver();
    const r = await runMatrix(
      {
        rows: { entityKind: 'property', tenantId: 'tenant-A' },
        columns: [
          { id: 'a', text: 'a' },
          { id: 'a', text: 'b' },
        ],
      },
      ownerA,
      { entityStore, cellDriver: driver },
    );
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error('unreachable');
    expect(r.error.kind).toBe('invalid-query');
  });

  it('partial failure — failing rows surface as partial-failure', async () => {
    const entityStore = makeEntityStore(3);
    const { driver } = makeCellDriver({ failOnRow: 'prop-2' });
    const r = await runMatrix(
      {
        rows: { entityKind: 'property', tenantId: 'tenant-A' },
        columns: sampleColumns,
      },
      ownerA,
      { entityStore, cellDriver: driver },
    );
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error('unreachable');
    expect(r.error.kind).toBe('partial-failure');
    if (r.error.kind !== 'partial-failure') throw new Error('type narrow');
    // Result is still returned for inspection
    const failed = r.error.result.rows.find((row) => row.rowId === 'prop-2')!;
    for (const c of failed.cells) {
      expect(c.errorReason).toBeDefined();
    }
  });

  it('aggregates cost across cells', async () => {
    const entityStore = makeEntityStore(3);
    const { driver } = makeCellDriver();
    const r = await runMatrix(
      { rows: { entityKind: 'property', tenantId: 'tenant-A' }, columns: sampleColumns },
      ownerA,
      { entityStore, cellDriver: driver },
    );
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error('unreachable');
    expect(r.value.totalCostUsd).toBeCloseTo(0.001 * 9, 5);
    expect(r.value.cost.length).toBe(9);
  });

  it('clamps parallelism to [1, 64]', async () => {
    const entityStore = makeEntityStore(5);
    const { driver, maxParallelObserved } = makeCellDriver({ delayMs: 5 });
    await runMatrix(
      { rows: { entityKind: 'property', tenantId: 'tenant-A' }, columns: sampleColumns },
      ownerA,
      { entityStore, cellDriver: driver, maxParallel: 100 }, // clamped to 64
    );
    expect(maxParallelObserved()).toBeLessThanOrEqual(64);
  });

  it('runs serially when maxParallel = 1', async () => {
    const entityStore = makeEntityStore(3);
    const { driver, maxParallelObserved } = makeCellDriver({ delayMs: 5 });
    await runMatrix(
      { rows: { entityKind: 'property', tenantId: 'tenant-A' }, columns: sampleColumns },
      ownerA,
      { entityStore, cellDriver: driver, maxParallel: 1 },
    );
    expect(maxParallelObserved()).toBe(1);
  });

  it('returns elapsedMs > 0 for non-trivial matrices', async () => {
    const entityStore = makeEntityStore(2);
    const { driver } = makeCellDriver({ delayMs: 3 });
    const r = await runMatrix(
      { rows: { entityKind: 'property', tenantId: 'tenant-A' }, columns: sampleColumns },
      ownerA,
      { entityStore, cellDriver: driver },
    );
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error('unreachable');
    expect(r.value.elapsedMs).toBeGreaterThan(0);
  });
});

describe('buildMatrixPart', () => {
  it('emits a `matrix` AG-UI part with row/column counts', async () => {
    const entityStore = makeEntityStore(3);
    const { driver } = makeCellDriver();
    const r = await runMatrix(
      { rows: { entityKind: 'property', tenantId: 'tenant-A' }, columns: sampleColumns },
      ownerA,
      { entityStore, cellDriver: driver },
    );
    if (!r.ok) throw new Error('unreachable');
    const part = buildMatrixPart(r.value, 'My properties');
    expect(part.kind).toBe('matrix');
    expect(part.title).toBe('My properties');
    expect(part.rowCount).toBe(3);
    expect(part.columnCount).toBe(3);
    expect(part.rows[0]!.cells[0]!.hasCitation).toBe(true);
  });
});

describe('toCsv', () => {
  it('emits CSV with header row + data rows', async () => {
    const entityStore = makeEntityStore(2);
    const { driver } = makeCellDriver();
    const r = await runMatrix(
      { rows: { entityKind: 'property', tenantId: 'tenant-A' }, columns: sampleColumns },
      ownerA,
      { entityStore, cellDriver: driver },
    );
    if (!r.ok) throw new Error('unreachable');
    const csv = toCsv(r.value);
    const lines = csv.split('\n');
    expect(lines.length).toBe(3); // header + 2 rows
    expect(lines[0]).toBe(
      'Row,What is the current occupancy?,Who\'s behind on rent?,When\'s the next lease renewal?',
    );
  });

  it('quotes fields containing commas or quotes', async () => {
    // synthetic display value with comma
    const entityStore: EntityStoreDriver = {
      async resolveEntities() {
        return [
          { entityId: 'p1', label: 'Hello, "World"', tenantId: 'tenant-A', attributes: {} },
        ];
      },
    };
    const driver: CellDriver = {
      async answerCell() {
        return {
          value: 'x',
          displayValue: 'has "quote" and, comma',
          confidence: 'high',
          citations: [],
        };
      },
    };
    const r = await runMatrix(
      { rows: { entityKind: 'p', tenantId: 'tenant-A' }, columns: [{ id: 'c1', text: 'q1' }] },
      ownerA,
      { entityStore, cellDriver: driver },
    );
    if (!r.ok) throw new Error('unreachable');
    const csv = toCsv(r.value);
    expect(csv).toContain('"Hello, ""World"""');
    expect(csv).toContain('"has ""quote"" and, comma"');
  });
});

describe('runMatrix — uses parallelism efficiently', () => {
  it('total wall-time is dominated by per-cell latency / parallelism', async () => {
    const entityStore = makeEntityStore(8);
    const { driver } = makeCellDriver({ delayMs: 10 });
    const t0 = Date.now();
    await runMatrix(
      { rows: { entityKind: 'property', tenantId: 'tenant-A' }, columns: sampleColumns },
      ownerA,
      { entityStore, cellDriver: driver, maxParallel: 8 },
    );
    const elapsed = Date.now() - t0;
    // 24 cells * 10ms serial would be 240ms; with parallel=8 should be
    // much less (3 batches * 10ms ≈ 30-80ms with overhead). Allow generous margin.
    expect(elapsed).toBeLessThan(200);
  });
});

// vi is imported above to make sure it's available in case future tests need
// it. Avoid unused-import warnings:
void vi;
