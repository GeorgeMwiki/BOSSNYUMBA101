/**
 * Decomposition algorithm — turns a single research question into 1-7
 * parallel sub-questions that workers can fan out on.
 *
 * Follows the scaling rules embedded in Anthropic's Multi-Agent Research
 * prompts (per L1 §4.2):
 *
 *   Simple fact:      1 worker, 3-10 tool calls
 *   Comparison:       2-4 workers, 10-15 calls each
 *   Complex research: 5-10+ workers with divided responsibilities
 *
 * The depth knob maps onto this scale. The lead LLM produces the actual
 * decomposition; this module just enforces bounds + topological order.
 */

import type { SubQuestion } from '../types/index.js';

const DEFAULT_WORKER_CAPS: Readonly<Record<'quick' | 'standard' | 'deep', number>> = {
  quick: 1,
  standard: 4,
  deep: 7,
};

/**
 * Bound a planner's worker count to the depth-appropriate range.
 * Anthropic's research blog reports that complex research with 10+
 * sub-agents shows diminishing returns; we cap at 7 by default.
 */
export function clampWorkerCount(
  proposed: number,
  depth: 'quick' | 'standard' | 'deep',
  maxWorkers?: number,
): number {
  const cap = maxWorkers ?? DEFAULT_WORKER_CAPS[depth];
  if (proposed < 1) {
    return 1;
  }
  if (proposed > cap) {
    return cap;
  }
  return proposed;
}

/**
 * Topological sort over sub-question dependencies. Returns waves of
 * IDs that can be executed in parallel.
 *
 * Detects cycles and throws — callers should treat that as a planner
 * bug and fall back to a flat single-wave plan.
 */
export function toposortSubQuestions(
  subs: ReadonlyArray<SubQuestion>,
): ReadonlyArray<ReadonlyArray<string>> {
  if (subs.length === 0) {
    return [];
  }

  const byId = new Map(subs.map((s) => [s.id, s]));
  const remaining = new Set(subs.map((s) => s.id));
  const waves: Array<ReadonlyArray<string>> = [];
  const completed = new Set<string>();

  // Validate every dependency exists. Unknown deps -> drop them so we
  // never block on phantom edges.
  for (const sub of subs) {
    for (const dep of sub.dependsOn) {
      if (!byId.has(dep)) {
        throw new Error(
          `Sub-question ${sub.id} declares unknown dependency ${dep}`,
        );
      }
    }
  }

  while (remaining.size > 0) {
    const wave: string[] = [];
    for (const id of remaining) {
      const sub = byId.get(id);
      if (sub === undefined) {
        continue;
      }
      const allDepsDone = sub.dependsOn.every((dep) => completed.has(dep));
      if (allDepsDone) {
        wave.push(id);
      }
    }
    if (wave.length === 0) {
      throw new Error('Cycle detected in sub-question dependency graph');
    }
    for (const id of wave) {
      remaining.delete(id);
      completed.add(id);
    }
    waves.push(Object.freeze(wave));
  }

  return Object.freeze(waves);
}

/**
 * Validate a plan returned by the LLM-as-planner against shape +
 * bound rules. Returns either the validated plan or a list of issues.
 */
export function validatePlan(
  plan: ReadonlyArray<SubQuestion>,
  depth: 'quick' | 'standard' | 'deep',
  maxWorkers?: number,
): { readonly ok: true; readonly plan: ReadonlyArray<SubQuestion> } | { readonly ok: false; readonly issues: ReadonlyArray<string> } {
  const issues: string[] = [];

  if (plan.length === 0) {
    issues.push('Plan is empty');
    return { ok: false, issues };
  }

  const ids = new Set<string>();
  for (const sub of plan) {
    if (ids.has(sub.id)) {
      issues.push(`Duplicate sub-question id ${sub.id}`);
    }
    ids.add(sub.id);
    if (sub.question.length < 3) {
      issues.push(`Sub-question ${sub.id} has too short a question`);
    }
    if (sub.preferredProviders.length === 0) {
      issues.push(`Sub-question ${sub.id} has no preferred providers`);
    }
  }

  const clamped = clampWorkerCount(plan.length, depth, maxWorkers);
  if (plan.length > clamped) {
    issues.push(`Plan has ${plan.length} sub-questions but cap is ${clamped}`);
  }

  try {
    toposortSubQuestions(plan);
  } catch (e) {
    issues.push(`Dependency graph invalid: ${(e as Error).message}`);
  }

  if (issues.length > 0) {
    return { ok: false, issues: Object.freeze(issues) };
  }
  return { ok: true, plan: Object.freeze(plan) };
}

/**
 * Suggest a worker count given the question shape. Used as a heuristic
 * fallback when the planner LLM returns garbage.
 */
export function suggestWorkerCount(
  question: string,
  depth: 'quick' | 'standard' | 'deep',
): number {
  const lower = question.toLowerCase();
  const isComparison =
    lower.includes(' vs ') ||
    lower.includes('compare') ||
    lower.includes('versus') ||
    lower.includes('between');
  const isMultiFacet =
    lower.includes(' and ') ||
    lower.split('?').filter((s) => s.trim().length > 0).length > 1;

  if (depth === 'quick') {
    return 1;
  }
  if (depth === 'standard') {
    return isComparison ? 4 : isMultiFacet ? 3 : 2;
  }
  return isComparison ? 5 : isMultiFacet ? 6 : 4;
}
