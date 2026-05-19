/**
 * Evaluator Isolation Gate types.
 *
 * Two-layer enforcement: TYPE-level + RUNTIME-level. The brain cannot
 * obtain an `EvaluatorContext` from its own `BrainContext` (nominal
 * type), and the worktree sandbox (N-B) denies any read on the
 * golden-set directory from brain-driven actions at runtime.
 *
 * Defense thesis: an evaluator the brain can read is an evaluator the
 * brain can train against (Goodhart). An evaluator the brain can
 * modify is no longer an evaluator at all.
 */

/**
 * Nominal-typed brand. `BrainContext` cannot be cast into
 * `EvaluatorContext` without going through `claimEvaluatorContext`
 * which lives in a module the brain is forbidden from importing.
 */
declare const EvaluatorContextBrand: unique symbol;
declare const BrainContextBrand: unique symbol;

export interface EvaluatorContext {
  readonly [EvaluatorContextBrand]: 'evaluator';
  readonly trace_id: string;
  readonly invoked_by: 'external-nightly-auditor' | 'red-team-rotation' | 'ci-gate';
  readonly key_id: string;
}

export interface BrainContext {
  readonly [BrainContextBrand]: 'brain';
  readonly trace_id: string;
  readonly tenant_id: string;
  readonly autonomy_level: string;
}

export type IsolationViolationKind =
  | 'brain-attempted-golden-read'
  | 'brain-attempted-evaluator-mutation'
  | 'brain-attempted-cap-elevation'
  | 'brain-attempted-constitution-edit'
  | 'brain-spawned-evaluator-context';

export interface IsolationViolation {
  readonly kind: IsolationViolationKind;
  readonly path: string;
  readonly actor_trace_id: string;
  readonly detected_at: string;
}

export interface AccessDecision {
  readonly allowed: boolean;
  readonly reason: string;
  readonly violation?: IsolationViolation;
}
