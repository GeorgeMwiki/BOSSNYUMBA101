/**
 * Phase 2 — EXECUTE (Sonnet 4.7, inside scoped worktree).
 *
 * Writes are auto-approved (`acceptEdits`) but ONLY within the worktree cwd
 * and ONLY for paths matching `allowedGlobs`. Anything else is rejected.
 */

import {
  type EditableSpec,
  type ExecutionPhaseRequest,
  type ExecutionResult,
  type WriteContext,
  type WriteTool,
} from './types.js';

const ALLOWED_EXEC_TOOLS: readonly WriteTool[] = [
  'Read',
  'Grep',
  'Glob',
  'Bash',
  'Write',
  'Edit',
];

/**
 * Convert a glob pattern (* and **) into a regex. Conservative
 * implementation: supports the patterns we actually emit in N-B.
 */
export function globToRegex(glob: string): RegExp {
  // Translate the glob in a single regex pass so `**` and `*` are
  // handled without a sentinel control character (avoids no-control-
  // regex and the fragility of a NUL placeholder colliding with input).
  // `**` -> `.*` (cross-segment), `*` -> `[^/]*` (single segment),
  // every regex metachar -> escaped literal.
  const escaped = glob.replace(
    /(\*\*)|(\*)|([.+^${}()|[\]\\])/g,
    (_m, doubleStar, _singleStar, meta) => {
      if (doubleStar) return '.*';
      if (meta) return `\\${meta}`;
      return '[^/]*';
    },
  );
  // eslint-disable-next-line security/detect-non-literal-regexp -- reason: escaped is produced by deterministic glob-to-regex translation from a trusted internal allowlist, not user-supplied input
  return new RegExp(`^${escaped}$`);
}

export function pathMatchesAllowedGlobs(
  path: string,
  allowedGlobs: readonly string[],
): boolean {
  if (allowedGlobs.length === 0) return false;
  return allowedGlobs.some((g) => globToRegex(g).test(path));
}

export function createWriteContext(args: {
  cwd: string;
  allowedGlobs: readonly string[];
  executor: {
    read: (p: string) => Promise<string>;
    write: (p: string, c: string) => Promise<void>;
    edit: (p: string, o: string, n: string) => Promise<void>;
    bash: (c: string) => Promise<string>;
  };
}): WriteContext {
  const { cwd, allowedGlobs, executor } = args;

  const guardPath = (p: string): string => {
    if (p.includes('..')) {
      throw new Error(
        `Execute phase rejected path "${p}": traversal not allowed.`,
      );
    }
    if (!pathMatchesAllowedGlobs(p, allowedGlobs)) {
      throw new Error(
        `Execute phase rejected path "${p}": outside allowedGlobs ` +
          `${JSON.stringify(allowedGlobs)}.`,
      );
    }
    return p;
  };

  return Object.freeze({
    mode: 'execute' as const,
    model: 'claude-sonnet-4-7' as const,
    cwd,
    allowedGlobs,
    allowedTools: ALLOWED_EXEC_TOOLS,
    read: (p: string): Promise<string> => executor.read(p),
    // The guard call MUST be inside the async body so that any throw
    // surfaces as a rejected promise (matches the documented `await
    // ctx.write(...)` contract).
    write: async (p: string, c: string): Promise<void> => {
      const guarded = guardPath(p);
      await executor.write(guarded, c);
    },
    edit: async (p: string, o: string, n: string): Promise<void> => {
      const guarded = guardPath(p);
      await executor.edit(guarded, o, n);
    },
    bash: (c: string): Promise<string> => executor.bash(c),
  });
}

export type ExecutorFn = (
  spec: EditableSpec,
  ctx: WriteContext,
) => Promise<ExecutionResult>;

export async function runExecutePhase(
  request: ExecutionPhaseRequest,
  ctx: WriteContext,
  executor: ExecutorFn,
): Promise<ExecutionResult> {
  if (ctx.mode !== 'execute') {
    throw new Error(`Expected WriteContext.mode === 'execute', got "${ctx.mode}"`);
  }
  if (ctx.cwd !== request.cwd) {
    throw new Error(
      `Execute phase cwd mismatch: ctx="${ctx.cwd}" request="${request.cwd}"`,
    );
  }
  const result = await executor(request.spec, ctx);
  if (!result || !result.status) {
    throw new Error('Executor returned an invalid result (missing status).');
  }
  return Object.freeze({ ...result });
}
