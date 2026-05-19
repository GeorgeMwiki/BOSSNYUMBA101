/**
 * `runMatrix` — orchestrates a Hebbia-style Matrix query.
 *
 * Algorithm:
 *
 *   1. Validate principal can run against `selector.tenantId`.
 *      (owner-customer principals are pinned to their own tenant.)
 *   2. Resolve the row set from the entity store.
 *   3. For each (row, column) cell, invoke the `CellDriver`.
 *   4. Dispatch in parallel with concurrency bounded by
 *      `maxParallel` (default 8). Cells fail independently — one
 *      cell's exception does NOT abort other cells.
 *   5. Collect cells back into rows preserving the original column
 *      order, sum cost, return `MatrixResult`.
 *
 * Provenance: every cell carries citations forwarded from the driver,
 * unchanged. The runner never invents citations.
 */

import type { CostLine, Principal } from '../types.js';
import { err, ok } from '../types.js';
import type {
  CellDriver,
  EntityStoreDriver,
  MatrixCell,
  MatrixError,
  MatrixQuery,
  MatrixResult,
  MatrixRow,
  Question,
  RunMatrixResult,
} from './types.js';

export interface RunMatrixConfig {
  readonly entityStore: EntityStoreDriver;
  readonly cellDriver: CellDriver;
  /** Max in-flight cell driver calls. Default 8. Clamped to [1, 64]. */
  readonly maxParallel?: number;
  readonly now?: () => Date;
}

export async function runMatrix(
  query: MatrixQuery,
  principal: Principal,
  config: RunMatrixConfig,
): Promise<RunMatrixResult> {
  // 1. Validate principal can see selector tenant.
  if (principal.kind !== 'internal-admin' && query.rows.tenantId !== principal.tenantId) {
    return err<MatrixError>({
      kind: 'forbidden',
      reason: `principal ${principal.principalId} cannot query tenant ${query.rows.tenantId}`,
    });
  }
  // 2. Validate query shape.
  if (query.columns.length === 0) {
    return err<MatrixError>({ kind: 'invalid-query', reason: 'no columns supplied' });
  }
  // Reject duplicate column ids.
  const colIds = new Set<string>();
  for (const c of query.columns) {
    if (colIds.has(c.id)) {
      return err<MatrixError>({
        kind: 'invalid-query',
        reason: `duplicate column id ${c.id}`,
      });
    }
    colIds.add(c.id);
  }

  const now = config.now ?? (() => new Date());
  const startedAt = now().getTime();

  // 3. Resolve row entities.
  const entities = await config.entityStore.resolveEntities(query.rows);

  // 4. Build the cell work list.
  type CellTask = {
    readonly row: (typeof entities)[number];
    readonly question: Question;
  };
  const tasks: ReadonlyArray<CellTask> = entities.flatMap((row) =>
    query.columns.map((question) => ({ row, question })),
  );

  // 5. Bounded-parallelism dispatch.
  const maxParallel = clampParallel(config.maxParallel ?? 8);
  const completed: Array<{
    readonly task: CellTask;
    readonly cell: MatrixCell;
  }> = [];
  let cursor = 0;
  async function worker(): Promise<void> {
    for (;;) {
      const idx = cursor;
      cursor += 1;
      if (idx >= tasks.length) return;
      const t = tasks[idx];
      if (!t) return;
      const cell = await answerOne(config.cellDriver, principal, t);
      completed.push({ task: t, cell });
    }
  }
  const workers = Array.from({ length: maxParallel }, () => worker());
  await Promise.all(workers);

  // 6. Assemble rows preserving column order.
  const rows: MatrixRow[] = entities.map((e) => {
    const cells = query.columns.map((c) => {
      const found = completed.find((x) => x.task.row.entityId === e.entityId && x.task.question.id === c.id);
      return (
        found?.cell ?? {
          rowId: e.entityId,
          columnId: c.id,
          value: null,
          displayValue: '—',
          confidence: 'low' as const,
          citations: [],
          errorReason: 'cell not computed',
        }
      );
    });
    return { rowId: e.entityId, label: e.label, cells };
  });

  // 7. Aggregate cost.
  const costLines: CostLine[] = [];
  let totalCostUsd = 0;
  let filled = 0;
  for (const r of rows) {
    for (const c of r.cells) {
      if (c.cost) {
        costLines.push(c.cost);
        totalCostUsd += c.cost.costUsd;
      }
      if (!c.errorReason) filled += 1;
    }
  }

  const result: MatrixResult = {
    query,
    rows,
    columns: query.columns,
    filledCells: filled,
    totalCells: tasks.length,
    cost: costLines,
    totalCostUsd: round6(totalCostUsd),
    elapsedMs: now().getTime() - startedAt,
  };

  // 8. Partial-failure surface — at least one cell errored.
  if (filled < tasks.length) {
    return err<MatrixError>({
      kind: 'partial-failure',
      reason: `${tasks.length - filled} of ${tasks.length} cells failed`,
      result,
    });
  }
  return ok(result);
}

async function answerOne(
  driver: CellDriver,
  principal: Principal,
  task: { readonly row: { readonly entityId: string; readonly label: string; readonly tenantId: string; readonly attributes: Readonly<Record<string, unknown>> }; readonly question: Question },
): Promise<MatrixCell> {
  try {
    const out = await driver.answerCell({
      entity: task.row,
      question: task.question,
      principal,
    });
    return {
      rowId: task.row.entityId,
      columnId: task.question.id,
      value: out.value,
      displayValue: out.displayValue,
      confidence: out.confidence,
      citations: out.citations,
      ...(out.cost ? { cost: out.cost } : {}),
    };
  } catch (e) {
    const reason = e instanceof Error ? e.message : 'unknown error';
    return {
      rowId: task.row.entityId,
      columnId: task.question.id,
      value: null,
      displayValue: '—',
      confidence: 'low',
      citations: [],
      errorReason: reason,
    };
  }
}

function clampParallel(n: number): number {
  if (!Number.isFinite(n) || n < 1) return 1;
  if (n > 64) return 64;
  return Math.floor(n);
}

function round6(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000;
}
