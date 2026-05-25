/**
 * RPA bot orchestrator.
 *
 * Composes a directed graph of `RpaStep`s with topological
 * ordering, dependency awaits, bounded retries (exponential
 * backoff), and idempotency-key de-duplication.
 */

import type { RpaRunResult, RpaStep } from '../types.js';

export interface OrchestratorOptions {
  /** Cap on retries even when a step asks for more. */
  readonly globalMaxAttempts?: number;
  /** Base backoff (ms). */
  readonly backoffBaseMs?: number;
  /** Optional already-completed idempotency keys. */
  readonly completedIdempotencyKeys?: ReadonlyArray<string>;
}

export async function orchestrate(
  steps: ReadonlyArray<RpaStep>,
  options: OrchestratorOptions = {},
): Promise<RpaRunResult[]> {
  const globalMax = options.globalMaxAttempts ?? 5;
  const base = options.backoffBaseMs ?? 0;
  const done = new Map<string, RpaRunResult>();
  const completedKeys = new Set(options.completedIdempotencyKeys ?? []);

  const order = topoSort(steps);

  for (const step of order) {
    const deps = step.dependsOn ?? [];
    const failedDep = deps.find((d) => done.get(d)?.status === 'failure');
    if (failedDep) {
      done.set(step.id, {
        stepId: step.id,
        status: 'skipped',
        attempts: 0,
        error: `dependency ${failedDep} failed`,
      });
      continue;
    }

    if (step.idempotencyKey && completedKeys.has(step.idempotencyKey)) {
      done.set(step.id, { stepId: step.id, status: 'success', attempts: 0 });
      continue;
    }

    const maxAttempts = Math.min(step.maxAttempts ?? 3, globalMax);
    let attempt = 0;
    let lastError: string | undefined;
    while (attempt < maxAttempts) {
      attempt += 1;
      try {
        await step.run();
        if (step.idempotencyKey) completedKeys.add(step.idempotencyKey);
        done.set(step.id, { stepId: step.id, status: 'success', attempts: attempt });
        lastError = undefined;
        break;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        if (attempt < maxAttempts && base > 0) {
          await sleep(base * 2 ** (attempt - 1));
        }
      }
    }
    if (lastError !== undefined) {
      done.set(step.id, {
        stepId: step.id,
        status: 'failure',
        attempts: attempt,
        error: lastError,
      });
    }
  }

  return order.map((s) => done.get(s.id)!);
}

function topoSort(steps: ReadonlyArray<RpaStep>): RpaStep[] {
  const byId = new Map(steps.map((s) => [s.id, s]));
  const visited = new Set<string>();
  const ordered: RpaStep[] = [];
  function visit(id: string, stack: ReadonlyArray<string>): void {
    if (visited.has(id)) return;
    if (stack.includes(id)) {
      throw new Error(`rpa: cycle detected at ${id}`);
    }
    const step = byId.get(id);
    if (!step) throw new Error(`rpa: missing step ${id}`);
    for (const d of step.dependsOn ?? []) visit(d, [...stack, id]);
    visited.add(id);
    ordered.push(step);
  }
  for (const s of steps) visit(s.id, []);
  return ordered;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
