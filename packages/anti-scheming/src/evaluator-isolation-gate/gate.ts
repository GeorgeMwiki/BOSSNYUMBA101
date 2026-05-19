/**
 * Runtime enforcement of evaluator isolation.
 *
 * Combines with the N-B worktree-sandbox PreToolUse hook to deny all
 * write/delete on `packages/anti-scheming/**` and `.claude/golden-set/**`
 * regardless of caller — and read on those paths from any brain-driven
 * context.
 *
 * Type-level enforcement is in `types.ts` (nominal types).
 */

import type {
  AccessDecision,
  BrainContext,
  EvaluatorContext,
  IsolationViolation,
  IsolationViolationKind,
} from './types.js';

/**
 * Paths the brain may NEVER read, write, or delete.
 *
 * Order matters: most-specific first so we can deny with the right
 * reason in audit logs.
 */
export const PROTECTED_PATHS: ReadonlyArray<{ readonly prefix: string; readonly kind: 'read+write' | 'write-only' }> = [
  { prefix: 'packages/anti-scheming/golden-set/', kind: 'read+write' },
  { prefix: 'packages/anti-scheming/src/immutable-golden-eval/', kind: 'write-only' },
  { prefix: 'packages/anti-scheming/src/external-nightly-auditor/', kind: 'write-only' },
  { prefix: '.claude/golden-set/', kind: 'read+write' },
  { prefix: 'Docs/BOSSNYUMBA_CONSTITUTION', kind: 'write-only' },
];

function normalise(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.\/+/, '');
}

/**
 * Runtime read decision — used by the brain's tool-call dispatcher
 * before any file read.
 *
 * Allows reads only when:
 *  - the caller presents an `EvaluatorContext` (impossible from brain), or
 *  - the path is NOT inside a read-protected prefix.
 */
export function decideRead(path: string, ctx: BrainContext | EvaluatorContext): AccessDecision {
  const p = normalise(path);
  const protectedMatch = PROTECTED_PATHS.find(rule => p.startsWith(rule.prefix) && rule.kind === 'read+write');
  if (!protectedMatch) return { allowed: true, reason: 'unprotected-path' };
  if (isEvaluatorContext(ctx)) {
    return { allowed: true, reason: `evaluator-bypass; key_id=${ctx.key_id}` };
  }
  const violation: IsolationViolation = {
    kind: 'brain-attempted-golden-read',
    path: p,
    actor_trace_id: (ctx as BrainContext).trace_id,
    detected_at: new Date().toISOString(),
  };
  return { allowed: false, reason: `denied: ${violation.kind}`, violation };
}

/**
 * Runtime write/delete decision — always denied for the brain on any
 * protected prefix, regardless of read rules.
 */
export function decideWrite(path: string, ctx: BrainContext | EvaluatorContext): AccessDecision {
  const p = normalise(path);
  const protectedMatch = PROTECTED_PATHS.find(rule => p.startsWith(rule.prefix));
  if (!protectedMatch) return { allowed: true, reason: 'unprotected-path' };
  // Even evaluators don't write here from runtime; signing happens
  // OFFLINE. Runtime writes to protected prefixes are forbidden full stop.
  const kind: IsolationViolationKind = isEvaluatorContext(ctx)
    ? 'brain-attempted-evaluator-mutation'
    : 'brain-attempted-evaluator-mutation';
  const violation: IsolationViolation = {
    kind,
    path: p,
    actor_trace_id: isEvaluatorContext(ctx) ? `evaluator:${ctx.key_id}` : ctx.trace_id,
    detected_at: new Date().toISOString(),
  };
  return { allowed: false, reason: `denied: ${kind} (runtime writes forbidden on ${protectedMatch.prefix})`, violation };
}

/**
 * Type-level guard. Crucially, the brain has no constructor for the
 * `EvaluatorContext` brand, so `claimEvaluatorContext` is `unsafe` and
 * lives in a module the brain is not allowed to import.
 *
 * (Enforced via tsconfig path exclusion + the N-B PreToolUse file
 * hook that denies write/edit on `evaluator-isolation-gate/factory.ts`.)
 */
function isEvaluatorContext(ctx: BrainContext | EvaluatorContext): ctx is EvaluatorContext {
  return 'invoked_by' in ctx && typeof (ctx as EvaluatorContext).invoked_by === 'string';
}

/**
 * UNSAFE — must be invoked only by the external auditor or red-team
 * harness, never by the brain. The N-B PreToolUse hook denies write
 * on this file so the brain can't add a new caller.
 */
export function unsafeClaimEvaluatorContext(args: {
  readonly trace_id: string;
  readonly invoked_by: EvaluatorContext['invoked_by'];
  readonly key_id: string;
}): EvaluatorContext {
  return Object.freeze({
    [Symbol.for('EvaluatorContextBrand') as never]: 'evaluator',
    trace_id: args.trace_id,
    invoked_by: args.invoked_by,
    key_id: args.key_id,
  } as unknown as EvaluatorContext);
}

/**
 * Convenience: render an isolation violation for the alignment auditor.
 */
export function renderViolation(v: IsolationViolation): string {
  return `[${v.detected_at}] ${v.kind} on ${v.path} by ${v.actor_trace_id}`;
}
