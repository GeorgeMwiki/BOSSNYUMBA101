/**
 * PreToolUse hook extension for evaluator isolation.
 *
 * Extends N-B's worktree sandbox: deny any Write|Edit|Delete on
 * `packages/anti-scheming/**` and `.claude/golden-set/**` regardless
 * of caller. The brain cannot bypass this — the hook runs in the
 * harness, not in the brain.
 */

export const FORBIDDEN_WRITE_PREFIXES: readonly string[] = [
  'packages/anti-scheming/',
  '.claude/golden-set/',
];

export interface ToolUseEvent {
  readonly tool: 'Write' | 'Edit' | 'Delete' | 'Read' | 'Bash' | string;
  readonly path?: string;
  readonly command?: string;
  readonly invoked_by_trace_id: string;
}

export interface HookDecision {
  readonly allow: boolean;
  readonly reason: string;
  readonly matched_prefix?: string;
}

function normalisePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.\/+/, '');
}

/**
 * Decide whether to allow the tool call. Pure function — the harness
 * calls this and consults the boolean.
 *
 * Detects:
 *  - Direct file writes via Write/Edit/Delete on protected prefixes
 *  - Indirect writes via Bash commands containing `rm`, `mv`, `cp`,
 *    `>`, `tee`, `sed -i` on a protected prefix path
 */
export function evaluatorIsolationPreToolUse(evt: ToolUseEvent): HookDecision {
  if (evt.tool === 'Write' || evt.tool === 'Edit' || evt.tool === 'Delete') {
    if (!evt.path) return { allow: true, reason: 'no-path' };
    const p = normalisePath(evt.path);
    const matched = FORBIDDEN_WRITE_PREFIXES.find(prefix => p.startsWith(prefix));
    if (matched) {
      return { allow: false, reason: `evaluator-isolation: ${evt.tool} forbidden under ${matched}`, matched_prefix: matched };
    }
    return { allow: true, reason: 'outside-protected-prefix' };
  }
  if (evt.tool === 'Bash' && evt.command) {
    for (const prefix of FORBIDDEN_WRITE_PREFIXES) {
      const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const writePattern = new RegExp(
        `(?:\\brm\\b[^;]*${escaped})|(?:\\bmv\\b[^;]*${escaped})|(?:\\bcp\\b[^;]*${escaped})|(?:>\\s*${escaped})|(?:\\btee\\b[^;]*${escaped})|(?:\\bsed\\s+-i[^;]*${escaped})`,
        'i',
      );
      if (writePattern.test(evt.command)) {
        return { allow: false, reason: `evaluator-isolation: Bash write pattern on ${prefix}`, matched_prefix: prefix };
      }
    }
  }
  return { allow: true, reason: 'unrelated-or-read-only' };
}
