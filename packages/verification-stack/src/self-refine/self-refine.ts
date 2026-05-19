/**
 * Self-Refine — Madaan 2023, arxiv 2303.17651.
 *
 * Generator → Critic → Refiner loop. We do NOT regenerate from scratch
 * — the Generator step is the original draft (passed in). The loop is
 * Critic → Refiner → Critic → … up to `maxIterations`.
 *
 * Closes L1 #5.
 */

import type {
  RefinedMessage,
  SelfRefineCritique,
  Verdict,
} from '../types.js';
import { systemClock, type Clock } from '../ports/clock.js';
import type { CriticPort } from './critic.js';
import type { RefinerPort } from './refiner.js';

export interface SelfRefineDeps {
  readonly critic: CriticPort;
  readonly refiner: RefinerPort;
  readonly clock?: Clock;
  /** Max iterations of (critic → refiner). Default 3. */
  readonly maxIterations?: number;
}

export interface SelfRefineInput {
  readonly initialDraft: string;
  readonly actionClass: string;
  readonly originalContext: string;
  readonly tenantJurisdiction?: string;
}

/**
 * Run Self-Refine on `input.initialDraft`. Returns the final draft +
 * the critique trail.
 *
 * Early-exit: once `critic.accepted === true`, we stop. The verdict is
 * `pass` if the final critique accepted, `flag` if it did not.
 */
export async function selfRefine(
  input: SelfRefineInput,
  deps: SelfRefineDeps,
): Promise<RefinedMessage> {
  const clock = deps.clock ?? systemClock;
  const start = clock.monotonicMs();
  const maxIterations = Math.max(1, deps.maxIterations ?? 3);

  const iterations: SelfRefineCritique[] = [];
  let currentDraft = input.initialDraft;
  let accepted = false;

  for (let i = 1; i <= maxIterations; i += 1) {
    const critique = await deps.critic.critique({
      iteration: i,
      draft: currentDraft,
      originalContext: input.originalContext,
      actionClass: input.actionClass,
      ...(input.tenantJurisdiction !== undefined
        ? { tenantJurisdiction: input.tenantJurisdiction }
        : {}),
    });

    iterations.push(critique);

    if (critique.accepted) {
      accepted = true;
      break;
    }

    if (i === maxIterations) break;

    const next = await deps.refiner.refine({
      draft: currentDraft,
      critique,
      actionClass: input.actionClass,
      originalContext: input.originalContext,
      ...(input.tenantJurisdiction !== undefined
        ? { tenantJurisdiction: input.tenantJurisdiction }
        : {}),
    });
    currentDraft = next;
  }

  const verdict: Verdict = accepted ? 'pass' : 'flag';

  return {
    initialDraft: input.initialDraft,
    finalDraft: currentDraft,
    iterations,
    accepted,
    verdict,
    elapsedMs: clock.monotonicMs() - start,
  };
}
