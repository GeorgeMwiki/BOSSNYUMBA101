/**
 * Permission validator — confirms that destructive-tier tools used in the AOP
 * are guarded by an `ask-owner` or `4-eye` hook.
 *
 * The registry's optional `tier` function tells us which tier a tool sits in.
 * If the registry doesn't supply tier info we treat every tool as `write` and
 * skip the destructive-guard check (the runtime will catch it at execution).
 */

import type {
  AOP,
  AOPStep,
  BrainToolRegistry,
  ValidationError,
  ValidationResult,
} from '../types.js';

function* walk(steps: ReadonlyArray<AOPStep>): Generator<AOPStep> {
  for (const step of steps) {
    yield step;
    if (step.kind === 'loop') yield* walk(step.body);
  }
}

/**
 * A "guarded" tool step is one whose graph-predecessor is a hook step of
 * kind `ask-owner` or `4-eye` and whose `on_approve` points to this tool.
 */
function findGuards(ast: AOP): Map<string, 'ask-owner' | '4-eye'> {
  const guards = new Map<string, 'ask-owner' | '4-eye'>();
  for (const step of walk(ast.steps)) {
    if (step.kind !== 'hook') continue;
    if (step.hook !== 'ask-owner' && step.hook !== '4-eye') continue;
    if (step.on_approve !== undefined) {
      guards.set(step.on_approve, step.hook);
    }
  }
  return guards;
}

export function validatePermissions(
  ast: AOP,
  registry: BrainToolRegistry,
): ValidationResult {
  if (registry.tier === undefined) return { ok: true, errors: [] };

  const guards = findGuards(ast);
  const errors: ValidationError[] = [];

  for (const step of walk(ast.steps)) {
    if (step.kind !== 'tool') continue;
    const tier = registry.tier(step.tool);
    if (tier !== 'destructive') continue;
    if (!guards.has(step.id)) {
      errors.push({
        code: 'destructive-tool-unguarded',
        message: `Destructive tool "${step.tool}" (step "${step.id}") must be preceded by an ask-owner or 4-eye hook with on_approve pointing at this step`,
        path: ['steps', step.id],
      });
    }
  }

  return { ok: errors.length === 0, errors };
}
