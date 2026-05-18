/**
 * Hook chain — Claude-Code-style PreToolUse / PostToolUse / Stop substrate.
 *
 * Each Hook is a pure function (with optional async I/O) that runs at one
 * of the three lifecycle stages and returns a `HookResult` ADT. The chain
 * runner short-circuits on the FIRST non-`allow` result so a deny / ask /
 * sandbox decision halts further chain evaluation.
 *
 * Hooks are designed to be small, composable, and side-effect-free
 * outside their declared scope. Persistence (audit emission, ledger seal)
 * happens via injected ports the hook closes over, never via shared
 * mutable state.
 *
 * Why this lives next to (not inside) `kernel.ts`:
 *   - The legacy 13-step kernel pipeline runs hard-wired checks
 *     (inviolable, policy-gate, drift). The new main-loop orchestrator
 *     replaces those bespoke checks with the generic HookChain so any
 *     site that calls the orchestrator inherits the same governance
 *     surface without re-implementing it.
 */

import type { ScopeContext } from '../../types.js';
import type { Decision, DispatchResult } from './decision.js';

// ─────────────────────────────────────────────────────────────────────
// HookResult ADT — five outcomes the hook can return.
// ─────────────────────────────────────────────────────────────────────

export type HookResult =
  | { readonly kind: 'allow' }
  | { readonly kind: 'deny'; readonly reason: string; readonly code: string }
  | {
      readonly kind: 'ask-owner';
      readonly prompt: string;
      readonly channel: 'inline' | 'inbox';
    }
  | { readonly kind: 'sandbox'; readonly sandboxId: string }
  | { readonly kind: 'transform'; readonly replacement: Decision };

// ─────────────────────────────────────────────────────────────────────
// HookContext — read-only request scope passed to every hook.
// ─────────────────────────────────────────────────────────────────────

export interface HookContext {
  readonly threadId: string;
  readonly scope: ScopeContext;
  readonly tier:
    | 'tenant'
    | 'lease'
    | 'unit'
    | 'block'
    | 'property'
    | 'portfolio'
    | 'org'
    | 'industry';
  readonly userMessage: string;
  /** Wall-clock at which the orchestrator entered the current tick. */
  readonly tickStartedAt: number;
  /** Caller-supplied granted scope set (defence-in-depth for permission hook). */
  readonly grantedScopes?: ReadonlyArray<string>;
}

// ─────────────────────────────────────────────────────────────────────
// Scope filter — optional gate so a hook only fires for matching ticks.
// ─────────────────────────────────────────────────────────────────────

export interface ScopeFilter {
  readonly toolNames?: ReadonlyArray<string>;
  readonly tiers?: ReadonlyArray<HookContext['tier']>;
  readonly surfaces?: ReadonlyArray<string>;
}

// ─────────────────────────────────────────────────────────────────────
// Hook interface — three stages distinguished by signature shape.
// ─────────────────────────────────────────────────────────────────────

export interface PreToolUseHook {
  readonly name: string;
  readonly stage: 'pre-tool-use';
  readonly scope?: ScopeFilter;
  fn(ctx: HookContext, decision: Decision): Promise<HookResult>;
}

export interface PostToolUseHook {
  readonly name: string;
  readonly stage: 'post-tool-use';
  readonly scope?: ScopeFilter;
  fn(
    ctx: HookContext,
    decision: Decision,
    result: DispatchResult,
  ): Promise<HookResult>;
}

export interface StopHook {
  readonly name: string;
  readonly stage: 'stop';
  fn(ctx: HookContext, session: StopSession): Promise<HookResult>;
}

export type Hook = PreToolUseHook | PostToolUseHook | StopHook;

// ─────────────────────────────────────────────────────────────────────
// Stop session — supplied to stop-stage hooks so a ledger-seal hook
// can compute terminal hashes across the whole transcript.
// ─────────────────────────────────────────────────────────────────────

export interface StopSession {
  readonly threadId: string;
  readonly turnCount: number;
  readonly finalText: string | null;
  readonly exhaustedAxis:
    | 'turns'
    | 'tokens'
    | 'tool-calls'
    | 'wall-ms'
    | null;
}

// ─────────────────────────────────────────────────────────────────────
// HookChain — orchestration over a registered hook set.
// ─────────────────────────────────────────────────────────────────────

export interface HookChain {
  runPreToolUse(decision: Decision, ctx: HookContext): Promise<HookResult>;
  runPostToolUse(
    decision: Decision,
    result: DispatchResult,
    ctx: HookContext,
  ): Promise<HookResult>;
  runStop(session: StopSession, ctx: HookContext): Promise<HookResult>;
  /** Read-only inventory for self-awareness / telemetry. */
  list(): ReadonlyArray<{ name: string; stage: Hook['stage'] }>;
}

// ─────────────────────────────────────────────────────────────────────
// Factory — `createHookChain(hooks)` returns a HookChain. Hooks run in
// registration order; the chain stops at the first non-`allow` result.
// ─────────────────────────────────────────────────────────────────────

export function createHookChain(hooks: ReadonlyArray<Hook>): HookChain {
  const pre = hooks.filter(
    (h): h is PreToolUseHook => h.stage === 'pre-tool-use',
  );
  const post = hooks.filter(
    (h): h is PostToolUseHook => h.stage === 'post-tool-use',
  );
  const stop = hooks.filter((h): h is StopHook => h.stage === 'stop');

  async function runPreToolUse(
    decision: Decision,
    ctx: HookContext,
  ): Promise<HookResult> {
    for (const h of pre) {
      if (!matchesScope(h.scope, decision, ctx)) continue;
      const out = await h.fn(ctx, decision);
      if (out.kind !== 'allow') return out;
    }
    return { kind: 'allow' };
  }

  async function runPostToolUse(
    decision: Decision,
    result: DispatchResult,
    ctx: HookContext,
  ): Promise<HookResult> {
    for (const h of post) {
      if (!matchesScope(h.scope, decision, ctx)) continue;
      const out = await h.fn(ctx, decision, result);
      if (out.kind !== 'allow') return out;
    }
    return { kind: 'allow' };
  }

  async function runStop(
    session: StopSession,
    ctx: HookContext,
  ): Promise<HookResult> {
    for (const h of stop) {
      const out = await h.fn(ctx, session);
      if (out.kind !== 'allow') return out;
    }
    return { kind: 'allow' };
  }

  function list(): ReadonlyArray<{ name: string; stage: Hook['stage'] }> {
    return hooks.map((h) => ({ name: h.name, stage: h.stage }));
  }

  return { runPreToolUse, runPostToolUse, runStop, list };
}

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

function matchesScope(
  scope: ScopeFilter | undefined,
  decision: Decision,
  ctx: HookContext,
): boolean {
  if (!scope) return true;
  if (scope.toolNames && decision.kind === 'tool_call') {
    if (!scope.toolNames.includes(decision.call.toolName)) return false;
  }
  if (scope.tiers && !scope.tiers.includes(ctx.tier)) return false;
  return true;
}
