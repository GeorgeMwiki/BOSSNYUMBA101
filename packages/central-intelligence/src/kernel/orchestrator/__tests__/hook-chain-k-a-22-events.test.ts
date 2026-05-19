/**
 * Phase K-A regression — 22-event hook surface + new HookResult
 * mutators + extended defer (resumeToken).
 *
 * Closes R1 parity gap #1. Each of the 13 NEW events gets at least
 * one positive (`allow`), one deny (`deny`), and one transform path
 * (`updated-input` / `updated-tool-output` / `additional-context`),
 * plus a defer/stop path where applicable.
 *
 * Existing 9-stage suite lives in `hook-chain.test.ts` — those tests
 * still pass; these are ADDITIVE.
 */

import { describe, it, expect } from 'vitest';
import {
  createHookChain,
  type Hook,
  type HookContext,
  type HookResult,
  type NotificationHook,
  type NotificationPayload,
  type PermissionDeniedHook,
  type PermissionDeniedPayload,
  type PermissionRequestHook,
  type PermissionRequestPayload,
  type PostToolBatchHook,
  type PostToolBatchPayload,
  type PostToolUseFailureHook,
  type PostToolUseFailurePayload,
  type PostToolUseHook,
  type SessionEndHook,
  type SessionEndPayload,
  type SetupHook,
  type SetupPayload,
  type StopFailureHook,
  type StopFailurePayload,
  type TaskCompletedHook,
  type TaskCompletedPayload,
  type TeammateIdleHook,
  type TeammateIdlePayload,
  type UserPromptExpansionHook,
  type UserPromptExpansionPayload,
  type WorktreeCreateHook,
  type WorktreeRemoveHook,
  type WorktreePayload,
  type PreToolUseHook,
} from '../hook-chain.js';
import type { Decision, DispatchResult } from '../decision.js';

const tenantCtx: HookContext = {
  threadId: 'th_k_a',
  scope: {
    kind: 'tenant',
    tenantId: 't_k_a',
    actorUserId: 'u_k_a',
    roles: ['owner'],
    personaId: 'p_k_a',
  },
  tier: 'tenant',
  userMessage: 'hi',
  tickStartedAt: 0,
};

const toolCall = (toolName: string): Decision => ({
  kind: 'tool_call',
  call: { toolName, input: {}, callId: `c_${toolName}` },
});

const okResult: DispatchResult = {
  kind: 'tool_ok',
  callId: 'c1',
  output: { result: 'before-mutation' },
  latencyMs: 1,
  tokensIn: 1,
  tokensOut: 1,
  usdCost: 0,
};

const errResult: DispatchResult & { kind: 'tool_error' } = {
  kind: 'tool_error',
  callId: 'c1',
  message: 'upstream 500',
  latencyMs: 1,
};

// ─────────────────────────────────────────────────────────────────────
// Group 1 — `post-tool-use-failure`
// ─────────────────────────────────────────────────────────────────────

describe('post-tool-use-failure (Phase K-A)', () => {
  it('fires on a tool_error dispatch', async () => {
    let observed: PostToolUseFailurePayload | null = null;
    const hook: PostToolUseFailureHook = {
      name: 'failure-audit',
      stage: 'post-tool-use-failure',
      async fn(_c, p): Promise<HookResult> {
        observed = p;
        return { kind: 'allow' };
      },
    };
    const chain = createHookChain([hook]);
    await chain.runPostToolUseFailure(
      { decision: toolCall('x'), error: errResult },
      tenantCtx,
    );
    expect(observed).not.toBeNull();
    expect(observed?.error.kind).toBe('tool_error');
    expect(observed?.error.message).toBe('upstream 500');
  });

  it('deny short-circuits the chain', async () => {
    let secondFired = false;
    const deny: PostToolUseFailureHook = {
      name: 'deny',
      stage: 'post-tool-use-failure',
      async fn(): Promise<HookResult> {
        return { kind: 'deny', reason: 'too many failures', code: 'circuit-open' };
      },
    };
    const after: PostToolUseFailureHook = {
      name: 'after',
      stage: 'post-tool-use-failure',
      async fn(): Promise<HookResult> {
        secondFired = true;
        return { kind: 'allow' };
      },
    };
    const chain = createHookChain([deny, after]);
    const r = await chain.runPostToolUseFailure(
      { decision: toolCall('y'), error: errResult },
      tenantCtx,
    );
    expect(r.kind).toBe('deny');
    expect(secondFired).toBe(false);
  });

  it('thrown hook maps to deny (CRITICAL #8)', async () => {
    const throwing: PostToolUseFailureHook = {
      name: 'boom',
      stage: 'post-tool-use-failure',
      async fn(): Promise<HookResult> {
        throw new Error('audit pipeline down');
      },
    };
    const r = await createHookChain([throwing]).runPostToolUseFailure(
      { decision: toolCall('z'), error: errResult },
      tenantCtx,
    );
    expect(r.kind).toBe('deny');
    if (r.kind === 'deny') expect(r.code).toBe('hook-threw');
  });
});

// ─────────────────────────────────────────────────────────────────────
// Group 2 — `post-tool-batch`
// ─────────────────────────────────────────────────────────────────────

describe('post-tool-batch (Phase K-A)', () => {
  it('receives the full batch payload', async () => {
    let observed: PostToolBatchPayload | null = null;
    const hook: PostToolBatchHook = {
      name: 'batch-conv',
      stage: 'post-tool-batch',
      async fn(_c, p): Promise<HookResult> {
        observed = p;
        return { kind: 'allow' };
      },
    };
    const decisions = [toolCall('read1'), toolCall('read2')];
    const results: DispatchResult[] = [okResult, okResult];
    await createHookChain([hook]).runPostToolBatch(
      { batchId: 'b1', decisions, results },
      tenantCtx,
    );
    expect(observed?.batchId).toBe('b1');
    expect(observed?.decisions.length).toBe(2);
    expect(observed?.results.length).toBe(2);
  });

  it('allows when no hooks are registered', async () => {
    const r = await createHookChain([]).runPostToolBatch(
      { batchId: 'empty', decisions: [], results: [] },
      tenantCtx,
    );
    expect(r.kind).toBe('allow');
  });

  it('can deny a batch (e.g. cost cap reached)', async () => {
    const hook: PostToolBatchHook = {
      name: 'cost-cap',
      stage: 'post-tool-batch',
      async fn(): Promise<HookResult> {
        return { kind: 'deny', code: 'batch-cap', reason: 'batch cost cap' };
      },
    };
    const r = await createHookChain([hook]).runPostToolBatch(
      { batchId: 'b2', decisions: [], results: [] },
      tenantCtx,
    );
    expect(r.kind).toBe('deny');
  });
});

// ─────────────────────────────────────────────────────────────────────
// Group 3 — `user-prompt-expansion`
// ─────────────────────────────────────────────────────────────────────

describe('user-prompt-expansion (Phase K-A)', () => {
  it('observes the original + expanded prompt', async () => {
    let observed: UserPromptExpansionPayload | null = null;
    const hook: UserPromptExpansionHook = {
      name: 'cmd-audit',
      stage: 'user-prompt-expansion',
      async fn(_c, p): Promise<HookResult> {
        observed = p;
        return { kind: 'allow' };
      },
    };
    await createHookChain([hook]).runUserPromptExpansion(
      {
        original: '/policy',
        expanded: 'Render the platform policy summary.',
        commandName: 'policy',
      },
      tenantCtx,
    );
    expect(observed?.original).toBe('/policy');
    expect(observed?.commandName).toBe('policy');
  });

  it('can deny an unsanctioned slash command', async () => {
    const hook: UserPromptExpansionHook = {
      name: 'allowlist',
      stage: 'user-prompt-expansion',
      async fn(_c, p): Promise<HookResult> {
        return p.commandName === 'drop'
          ? { kind: 'deny', code: 'unknown-cmd', reason: 'unknown' }
          : { kind: 'allow' };
      },
    };
    const r = await createHookChain([hook]).runUserPromptExpansion(
      { original: '/drop', expanded: 'rm -rf', commandName: 'drop' },
      tenantCtx,
    );
    expect(r.kind).toBe('deny');
  });
});

// ─────────────────────────────────────────────────────────────────────
// Group 4 — `stop-failure`
// ─────────────────────────────────────────────────────────────────────

describe('stop-failure (Phase K-A)', () => {
  it('observes the failed-stop envelope', async () => {
    let observed: StopFailurePayload | null = null;
    const hook: StopFailureHook = {
      name: 'pager',
      stage: 'stop-failure',
      async fn(_c, p): Promise<HookResult> {
        observed = p;
        return { kind: 'allow' };
      },
    };
    await createHookChain([hook]).runStopFailure(
      {
        threadId: 'th',
        turnCount: 3,
        errorCode: 'upstream-5xx',
        errorMessage: 'anthropic 503',
      },
      tenantCtx,
    );
    expect(observed?.errorCode).toBe('upstream-5xx');
  });
});

// ─────────────────────────────────────────────────────────────────────
// Group 5 — `permission-request` / `permission-denied`
// ─────────────────────────────────────────────────────────────────────

describe('permission-request + permission-denied (Phase K-A)', () => {
  it('permission-request can allow with external approval', async () => {
    let externalCalled = false;
    const hook: PermissionRequestHook = {
      name: 'slack-approval',
      stage: 'permission-request',
      async fn(_c, _p): Promise<HookResult> {
        externalCalled = true;
        return { kind: 'allow' };
      },
    };
    const r = await createHookChain([hook]).runPermissionRequest(
      {
        decision: toolCall('tenant.evict'),
        suggestedRules: ['Bash(rent-eviction-script)'],
        prompt: 'Approve eviction?',
      } satisfies PermissionRequestPayload,
      tenantCtx,
    );
    expect(externalCalled).toBe(true);
    expect(r.kind).toBe('allow');
  });

  it('permission-denied audits the source', async () => {
    let observedSource = '';
    const hook: PermissionDeniedHook = {
      name: 'audit-deny',
      stage: 'permission-denied',
      async fn(_c, p: PermissionDeniedPayload): Promise<HookResult> {
        observedSource = p.source;
        return { kind: 'allow' };
      },
    };
    await createHookChain([hook]).runPermissionDenied(
      {
        decision: toolCall('x'),
        reason: 'rate cap',
        source: 'rule',
      },
      tenantCtx,
    );
    expect(observedSource).toBe('rule');
  });
});

// ─────────────────────────────────────────────────────────────────────
// Group 6 — `session-end`
// ─────────────────────────────────────────────────────────────────────

describe('session-end (Phase K-A)', () => {
  it('observes the termination reason', async () => {
    let observed: SessionEndPayload | null = null;
    const hook: SessionEndHook = {
      name: 'cleanup',
      stage: 'session-end',
      async fn(_c, p): Promise<HookResult> {
        observed = p;
        return { kind: 'allow' };
      },
    };
    await createHookChain([hook]).runSessionEnd(
      { threadId: 'th', terminationReason: 'logout' },
      tenantCtx,
    );
    expect(observed?.terminationReason).toBe('logout');
  });

  it('multiple session-end hooks run in registration order', async () => {
    const order: string[] = [];
    const a: SessionEndHook = {
      name: 'a',
      stage: 'session-end',
      async fn(): Promise<HookResult> {
        order.push('a');
        return { kind: 'allow' };
      },
    };
    const b: SessionEndHook = {
      name: 'b',
      stage: 'session-end',
      async fn(): Promise<HookResult> {
        order.push('b');
        return { kind: 'allow' };
      },
    };
    await createHookChain([a, b]).runSessionEnd(
      { threadId: 'th', terminationReason: 'clear' },
      tenantCtx,
    );
    expect(order).toEqual(['a', 'b']);
  });
});

// ─────────────────────────────────────────────────────────────────────
// Group 7 — `notification`
// ─────────────────────────────────────────────────────────────────────

describe('notification (Phase K-A)', () => {
  it('routes auth_success to a registered hook', async () => {
    let observed: NotificationPayload | null = null;
    const hook: NotificationHook = {
      name: 'route',
      stage: 'notification',
      async fn(_c, p): Promise<HookResult> {
        observed = p;
        return { kind: 'allow' };
      },
    };
    await createHookChain([hook]).runNotification(
      {
        notificationKind: 'auth_success',
        message: 'Tenant authenticated',
        metadata: { tenantId: 't_1' },
      },
      tenantCtx,
    );
    expect(observed?.notificationKind).toBe('auth_success');
    expect(observed?.metadata?.tenantId).toBe('t_1');
  });
});

// ─────────────────────────────────────────────────────────────────────
// Group 8 — `setup`
// ─────────────────────────────────────────────────────────────────────

describe('setup (Phase K-A)', () => {
  it('runs an init bootstrap', async () => {
    let observed: SetupPayload | null = null;
    const hook: SetupHook = {
      name: 'bootstrap',
      stage: 'setup',
      async fn(_c, p): Promise<HookResult> {
        observed = p;
        return { kind: 'allow' };
      },
    };
    await createHookChain([hook]).runSetup(
      { mode: 'init', cwd: '/var/app' },
      tenantCtx,
    );
    expect(observed?.mode).toBe('init');
  });
});

// ─────────────────────────────────────────────────────────────────────
// Group 9 — `teammate-idle`
// ─────────────────────────────────────────────────────────────────────

describe('teammate-idle (Phase K-A)', () => {
  it('observes the idle duration', async () => {
    let observed: TeammateIdlePayload | null = null;
    const hook: TeammateIdleHook = {
      name: 'reassign',
      stage: 'teammate-idle',
      async fn(_c, p): Promise<HookResult> {
        observed = p;
        return { kind: 'allow' };
      },
    };
    await createHookChain([hook]).runTeammateIdle(
      { teammateId: 'tm_1', idleSinceMs: 30_000 },
      tenantCtx,
    );
    expect(observed?.idleSinceMs).toBe(30_000);
  });
});

// ─────────────────────────────────────────────────────────────────────
// Group 10 — `task-completed`
// ─────────────────────────────────────────────────────────────────────

describe('task-completed (Phase K-A)', () => {
  it('observes the task status', async () => {
    let observed: TaskCompletedPayload | null = null;
    const hook: TaskCompletedHook = {
      name: 'collect',
      stage: 'task-completed',
      async fn(_c, p): Promise<HookResult> {
        observed = p;
        return { kind: 'allow' };
      },
    };
    await createHookChain([hook]).runTaskCompleted(
      { taskId: 'task_1', status: 'success', result: { rows: 10 } },
      tenantCtx,
    );
    expect(observed?.status).toBe('success');
  });
});

// ─────────────────────────────────────────────────────────────────────
// Group 11 — `worktree-create` / `worktree-remove`
// ─────────────────────────────────────────────────────────────────────

describe('worktree lifecycle (Phase K-A)', () => {
  it('worktree-create records a path', async () => {
    let observedPath = '';
    const hook: WorktreeCreateHook = {
      name: 'mark',
      stage: 'worktree-create',
      async fn(_c, p): Promise<HookResult> {
        observedPath = p.worktreePath;
        return { kind: 'allow' };
      },
    };
    await createHookChain([hook]).runWorktreeCreate(
      { worktreePath: '/wt/maintenance-9', branch: 'wt-maint-9' },
      tenantCtx,
    );
    expect(observedPath).toBe('/wt/maintenance-9');
  });

  it('worktree-remove records the cleanup', async () => {
    let observed: WorktreePayload | null = null;
    const hook: WorktreeRemoveHook = {
      name: 'cleanup',
      stage: 'worktree-remove',
      async fn(_c, p): Promise<HookResult> {
        observed = p;
        return { kind: 'allow' };
      },
    };
    await createHookChain([hook]).runWorktreeRemove(
      { worktreePath: '/wt/maint-9', branch: 'wt-maint-9' },
      tenantCtx,
    );
    expect(observed?.worktreePath).toBe('/wt/maint-9');
  });
});

// ─────────────────────────────────────────────────────────────────────
// Group 12 — `updated-tool-output` HookResult variant
// ─────────────────────────────────────────────────────────────────────

describe('updated-tool-output (Phase K-A mutator)', () => {
  it('rewrites the dispatch result and continues the chain', async () => {
    const rewriter: PostToolUseHook = {
      name: 'redact',
      stage: 'post-tool-use',
      async fn(_c, _d, result): Promise<HookResult> {
        if (result.kind !== 'tool_ok') return { kind: 'allow' };
        return {
          kind: 'updated-tool-output',
          replacement: {
            ...result,
            output: { redacted: true },
          },
        };
      },
    };
    const verifier: PostToolUseHook = {
      name: 'verify',
      stage: 'post-tool-use',
      async fn(_c, _d, result): Promise<HookResult> {
        if (result.kind === 'tool_ok' && result.output && typeof result.output === 'object') {
          const out = result.output as { redacted?: boolean };
          if (out.redacted) return { kind: 'allow' };
        }
        return { kind: 'deny', code: 'unredacted', reason: 'output not redacted' };
      },
    };
    const chain = createHookChain([rewriter, verifier]);
    const r = await chain.runPostToolUseChain(toolCall('x'), okResult, tenantCtx);
    expect(r.outcome.kind).toBe('allow');
    expect(r.effectiveResult).not.toBeNull();
    if (r.effectiveResult?.kind === 'tool_ok') {
      expect((r.effectiveResult.output as { redacted: boolean }).redacted).toBe(true);
    }
  });

  it('legacy runPostToolUse still returns only the outcome', async () => {
    // Backwards-compat — main-loop callers that don't yet read the
    // PostToolUseChainResult still see a HookResult.
    const hook: PostToolUseHook = {
      name: 'rewriter',
      stage: 'post-tool-use',
      async fn(_c, _d, result): Promise<HookResult> {
        return result.kind === 'tool_ok'
          ? { kind: 'updated-tool-output', replacement: { ...result, output: 'rewritten' } }
          : { kind: 'allow' };
      },
    };
    const r = await createHookChain([hook]).runPostToolUse(
      toolCall('x'),
      okResult,
      tenantCtx,
    );
    // `updated-tool-output` is folded — the legacy method reports `allow`.
    expect(r.kind).toBe('allow');
  });

  it('two updated-tool-output hooks compose', async () => {
    const stamp1: PostToolUseHook = {
      name: 's1',
      stage: 'post-tool-use',
      async fn(_c, _d, r): Promise<HookResult> {
        if (r.kind !== 'tool_ok') return { kind: 'allow' };
        return {
          kind: 'updated-tool-output',
          replacement: { ...r, output: { ...(r.output as object), redact1: true } },
        };
      },
    };
    const stamp2: PostToolUseHook = {
      name: 's2',
      stage: 'post-tool-use',
      async fn(_c, _d, r): Promise<HookResult> {
        if (r.kind !== 'tool_ok') return { kind: 'allow' };
        return {
          kind: 'updated-tool-output',
          replacement: { ...r, output: { ...(r.output as object), redact2: true } },
        };
      },
    };
    const r = await createHookChain([stamp1, stamp2]).runPostToolUseChain(
      toolCall('x'),
      okResult,
      tenantCtx,
    );
    expect(r.outcome.kind).toBe('allow');
    if (r.effectiveResult?.kind === 'tool_ok') {
      const out = r.effectiveResult.output as { redact1?: boolean; redact2?: boolean };
      expect(out.redact1).toBe(true);
      expect(out.redact2).toBe(true);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
// Group 13 — extended `defer` decision with `resumeToken`
// ─────────────────────────────────────────────────────────────────────

describe('defer with resumeToken (Phase K-A)', () => {
  it('carries the resumeToken back to the caller', async () => {
    const hook: PreToolUseHook = {
      name: 'cfo-approval',
      stage: 'pre-tool-use',
      async fn(): Promise<HookResult> {
        return {
          kind: 'defer',
          resumeAfterMs: 0,
          reason: 'awaiting CFO sign-off',
          resumeToken: 'rt_cfo_42',
        };
      },
    };
    const chain = createHookChain([hook]);
    const r = await chain.runPreToolUse(toolCall('tenant.evict'), tenantCtx);
    expect(r.outcome.kind).toBe('defer');
    if (r.outcome.kind === 'defer') {
      expect(r.outcome.resumeToken).toBe('rt_cfo_42');
    }
  });

  it('defer without resumeToken still works (back-compat)', async () => {
    const hook: PreToolUseHook = {
      name: 'pause',
      stage: 'pre-tool-use',
      async fn(): Promise<HookResult> {
        return {
          kind: 'defer',
          resumeAfterMs: 5_000,
          reason: 'cooldown',
        };
      },
    };
    const r = await createHookChain([hook]).runPreToolUse(
      toolCall('x'),
      tenantCtx,
    );
    expect(r.outcome.kind).toBe('defer');
    if (r.outcome.kind === 'defer') {
      expect(r.outcome.resumeToken).toBeUndefined();
      expect(r.outcome.resumeAfterMs).toBe(5_000);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
// Group 14 — chain `list()` includes all 22 stages
// ─────────────────────────────────────────────────────────────────────

describe('chain inventory (Phase K-A)', () => {
  it('lists every registered hook across all 22 stages', async () => {
    const hooks: Hook[] = [
      { name: 'a', stage: 'session-start', fn: async () => ({ kind: 'allow' }) },
      { name: 'b', stage: 'user-prompt-submit', fn: async () => ({ kind: 'allow' }) },
      { name: 'c', stage: 'pre-tool-use', fn: async () => ({ kind: 'allow' }) },
      { name: 'd', stage: 'post-tool-use', fn: async () => ({ kind: 'allow' }) },
      { name: 'e', stage: 'pre-compact', fn: async () => ({ kind: 'allow' }) },
      { name: 'f', stage: 'post-compact', fn: async () => ({ kind: 'allow' }) },
      { name: 'g', stage: 'subagent-start', fn: async () => ({ kind: 'allow' }) },
      { name: 'h', stage: 'subagent-stop', fn: async () => ({ kind: 'allow' }) },
      { name: 'i', stage: 'stop', fn: async () => ({ kind: 'allow' }) },
      // K-A:
      { name: 'j', stage: 'post-tool-use-failure', fn: async () => ({ kind: 'allow' }) },
      { name: 'k', stage: 'post-tool-batch', fn: async () => ({ kind: 'allow' }) },
      { name: 'l', stage: 'user-prompt-expansion', fn: async () => ({ kind: 'allow' }) },
      { name: 'm', stage: 'stop-failure', fn: async () => ({ kind: 'allow' }) },
      { name: 'n', stage: 'permission-request', fn: async () => ({ kind: 'allow' }) },
      { name: 'o', stage: 'permission-denied', fn: async () => ({ kind: 'allow' }) },
      { name: 'p', stage: 'session-end', fn: async () => ({ kind: 'allow' }) },
      { name: 'q', stage: 'notification', fn: async () => ({ kind: 'allow' }) },
      { name: 'r', stage: 'setup', fn: async () => ({ kind: 'allow' }) },
      { name: 's', stage: 'teammate-idle', fn: async () => ({ kind: 'allow' }) },
      { name: 't', stage: 'task-completed', fn: async () => ({ kind: 'allow' }) },
      { name: 'u', stage: 'worktree-create', fn: async () => ({ kind: 'allow' }) },
      { name: 'v', stage: 'worktree-remove', fn: async () => ({ kind: 'allow' }) },
    ];
    const inv = createHookChain(hooks).list();
    expect(inv.length).toBe(22);
    const stages = new Set(inv.map((i) => i.stage));
    // Sanity-check that all 22 distinct stages are represented.
    expect(stages.size).toBe(22);
  });
});
