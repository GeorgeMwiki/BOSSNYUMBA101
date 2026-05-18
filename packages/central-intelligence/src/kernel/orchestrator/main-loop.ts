/**
 * Orchestrator main loop — Claude-Code-level while-loop that replaces
 * the kernel's flat 13-step pipeline.
 *
 *   while (budget.remaining() && !plan.isComplete()) {
 *     const tools    = await toolSearch.searchRelevant(plan.currentGoal(), 8)
 *     const memory   = await memoryTool.recall({ scope })
 *     const recent   = await contextBudget.compactIfOver(session.transcript, 0.8)
 *     const decision = await router.call({ system, tools, messages: recent })
 *     const pre      = await hookChain.runPreToolUse(decision, ctx)
 *     // deny → record rejection + continue
 *     // ask-owner → return askForApproval()
 *     // sandbox  → return runSpeculative()
 *     // transform → swap the decision and proceed
 *     const result   = await dispatch(decision, deps)
 *     await hookChain.runPostToolUse(decision, result, ctx)
 *     await sessionStore.checkpoint(session, decision, result, plan, budget)
 *     plan = plan.advance({ goalId, newStatus: 'complete' })
 *     budget = budget.consume(result)
 *     if (decision.kind === 'respond_to_owner') return text
 *     if (decision.kind === 'schedule_wake')    return ack
 *   }
 *   await hookChain.runStop(session, ctx)
 *   return budget.exhausted() ? handoffToHuman() : plan.completedResponse()
 *
 * Both this orchestrator AND the legacy `kernel.ts` coexist on the same
 * package; callers opt into one or the other at the composition root.
 */

import type { ScopeContext, Citation, Artifact } from '../../types.js';
import type { AwarenessTier } from '../kernel-types.js';
import { Budget, type BudgetLimits } from './budget.js';
import type { Decision, DispatchResult } from './decision.js';
import type { HookChain, HookContext, HookResult } from './hook-chain.js';
import type { Plan, PlanStore } from './plan.js';
import type { SessionStore, Session } from './checkpoint.js';
import type { MemoryTool } from './memory-tool.js';
import type { ContextBudget, ToolSearch, ToolDescriptor } from './context-budget.js';

// ─────────────────────────────────────────────────────────────────────
// Public request / response shapes
// ─────────────────────────────────────────────────────────────────────

export interface OrchestratorRequest {
  readonly threadId: string;
  readonly userMessage: string;
  readonly scope: ScopeContext;
  readonly tier: AwarenessTier;
  readonly persona: string;
  readonly grantedScopes?: ReadonlyArray<string>;
  readonly budget?: Partial<BudgetLimits>;
}

export type OrchestratorResponse =
  | {
      readonly kind: 'answer';
      readonly text: string;
      readonly turnsUsed: number;
      readonly citations: ReadonlyArray<Citation>;
      readonly artifacts: ReadonlyArray<Artifact>;
    }
  | {
      readonly kind: 'ask-approval';
      readonly prompt: string;
      readonly channel: 'inline' | 'inbox';
      readonly pendingDecision: Decision;
    }
  | {
      readonly kind: 'speculative';
      readonly sandboxId: string;
      readonly pendingDecision: Decision;
    }
  | {
      readonly kind: 'ack-schedule';
      readonly resumeToken: string;
    }
  | {
      readonly kind: 'budget-exhausted';
      readonly axis: 'turns' | 'tokens' | 'tool-calls' | 'wall-ms';
      readonly partialText: string;
    };

// ─────────────────────────────────────────────────────────────────────
// LLM router port — the orchestrator does NOT couple to a specific
// SDK. Composition root binds either the Anthropic adapter or the
// existing kernel sensors.
// ─────────────────────────────────────────────────────────────────────

export interface LLMRouterCall {
  readonly system: string;
  readonly tools: ReadonlyArray<ToolDescriptor>;
  readonly messages: ReadonlyArray<{ role: 'user' | 'assistant' | 'tool'; content: string }>;
}

export interface LLMRouter {
  call(args: LLMRouterCall): Promise<Decision>;
}

// ─────────────────────────────────────────────────────────────────────
// Dispatcher port — actuates each Decision variant.
// ─────────────────────────────────────────────────────────────────────

export interface Dispatcher {
  dispatch(decision: Decision, ctx: HookContext): Promise<DispatchResult>;
}

// ─────────────────────────────────────────────────────────────────────
// Orchestrator deps
// ─────────────────────────────────────────────────────────────────────

export interface OrchestratorDeps {
  readonly router: LLMRouter;
  readonly toolSearch: ToolSearch;
  readonly hookChain: HookChain;
  readonly planStore: PlanStore;
  readonly sessionStore: SessionStore;
  readonly memoryTool: MemoryTool;
  readonly contextBudget: ContextBudget;
  readonly dispatcher: Dispatcher;
  readonly clock?: () => number;
  readonly logger?: {
    info(msg: string, meta?: Record<string, unknown>): void;
    warn(msg: string, meta?: Record<string, unknown>): void;
  };
}

// ─────────────────────────────────────────────────────────────────────
// Public entry point — the orchestrator's `think()`.
// ─────────────────────────────────────────────────────────────────────

export async function think(
  req: OrchestratorRequest,
  deps: OrchestratorDeps,
): Promise<OrchestratorResponse> {
  const clock = deps.clock ?? Date.now;
  const session = await deps.sessionStore.resumeOrCreate(req.threadId);
  let plan = await deps.planStore.load(req.threadId);
  let budget = Budget.of(req.budget ?? {}, clock);
  let lastText = '';

  const ctx: HookContext = {
    threadId: req.threadId,
    scope: req.scope,
    tier: req.tier,
    userMessage: req.userMessage,
    tickStartedAt: clock(),
    ...(req.grantedScopes ? { grantedScopes: req.grantedScopes } : {}),
  };

  while (budget.remaining() && !plan.isComplete()) {
    const goal = plan.currentGoal();
    const tools = await deps.toolSearch.searchRelevant(
      goal?.description ?? req.userMessage,
      8,
    );
    const memory = await deps.memoryTool.recall({ scope: req.scope });
    const compaction = await deps.contextBudget.compactIfOver(
      session.transcript,
      0.8,
    );

    const decision = await deps.router.call({
      system: assembleSystem(req.persona, plan, memory.totalBytes),
      tools,
      messages: compaction.turns.map((t) => ({ role: t.role, content: t.content })),
    });

    const pre = await deps.hookChain.runPreToolUse(decision, ctx);
    const effectiveDecision = await resolvePreHook(
      pre,
      decision,
      plan,
      goal?.id,
    );
    if (effectiveDecision === 'deny') {
      plan = plan;
      budget = budget.consume({
        kind: 'tool_error',
        callId: 'denied',
        message: 'pre-hook denied',
        latencyMs: 0,
      });
      continue;
    }
    if (effectiveDecision === 'ask') {
      return {
        kind: 'ask-approval',
        prompt: (pre as HookResult & { kind: 'ask-owner' }).prompt,
        channel: (pre as HookResult & { kind: 'ask-owner' }).channel,
        pendingDecision: decision,
      };
    }
    if (effectiveDecision === 'sandbox') {
      return {
        kind: 'speculative',
        sandboxId: (pre as HookResult & { kind: 'sandbox' }).sandboxId,
        pendingDecision: decision,
      };
    }

    const toRun: Decision =
      pre.kind === 'transform' ? pre.replacement : decision;
    const result = await deps.dispatcher.dispatch(toRun, ctx);
    await deps.hookChain.runPostToolUse(toRun, result, ctx);
    await deps.sessionStore.checkpoint(
      session,
      toRun,
      result,
      plan.state(),
      budget.snapshot(),
    );

    if (goal) {
      plan = plan.advance({ goalId: goal.id, newStatus: 'complete' });
    }
    budget = budget.consume(result);

    if (result.kind === 'response') {
      lastText = result.text;
    }

    if (toRun.kind === 'respond_to_owner' || toRun.kind === 'final') {
      await deps.hookChain.runStop(
        {
          threadId: req.threadId,
          turnCount: budget.snapshot().usage.turns,
          finalText: toRun.kind === 'respond_to_owner' ? toRun.text : toRun.text,
          exhaustedAxis: null,
        },
        ctx,
      );
      return {
        kind: 'answer',
        text: toRun.text,
        turnsUsed: budget.snapshot().usage.turns,
        citations: [],
        artifacts: [],
      };
    }
    if (toRun.kind === 'schedule_wake') {
      return {
        kind: 'ack-schedule',
        resumeToken: toRun.wake.resumeToken ?? toRun.wake.wakeAt,
      };
    }
  }

  const snapshot = budget.snapshot();
  await deps.hookChain.runStop(
    {
      threadId: req.threadId,
      turnCount: snapshot.usage.turns,
      finalText: lastText,
      exhaustedAxis: snapshot.exhaustionAxis,
    },
    ctx,
  );

  if (snapshot.exhausted && snapshot.exhaustionAxis) {
    return {
      kind: 'budget-exhausted',
      axis: snapshot.exhaustionAxis,
      partialText: lastText,
    };
  }

  return {
    kind: 'answer',
    text: lastText,
    turnsUsed: snapshot.usage.turns,
    citations: [],
    artifacts: [],
  };
}

// ─────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────

type PreOutcome = 'allow' | 'transform' | 'deny' | 'ask' | 'sandbox';

async function resolvePreHook(
  result: HookResult,
  _decision: Decision,
  _plan: Plan,
  _goalId: string | undefined,
): Promise<PreOutcome> {
  switch (result.kind) {
    case 'allow':
      return 'allow';
    case 'transform':
      return 'transform';
    case 'deny':
      return 'deny';
    case 'ask-owner':
      return 'ask';
    case 'sandbox':
      return 'sandbox';
  }
}

function assembleSystem(persona: string, plan: Plan, memoryBytes: number): string {
  const goal = plan.currentGoal();
  return [
    `Persona: ${persona}`,
    goal ? `Current goal: ${goal.description}` : 'No active goal.',
    `Memory bytes loaded: ${memoryBytes}`,
  ].join('\n');
}

// Re-export the Session type for callers wiring custom dispatchers.
export type { Session };
