/**
 * Evaluator Isolation Gate — module barrel.
 */
export type {
  EvaluatorContext,
  BrainContext,
  AccessDecision,
  IsolationViolation,
  IsolationViolationKind,
} from './types.js';
export {
  PROTECTED_PATHS,
  decideRead,
  decideWrite,
  unsafeClaimEvaluatorContext,
  renderViolation,
} from './gate.js';
export type { ToolUseEvent, HookDecision } from './pretool-hook.js';
export { FORBIDDEN_WRITE_PREFIXES, evaluatorIsolationPreToolUse } from './pretool-hook.js';
