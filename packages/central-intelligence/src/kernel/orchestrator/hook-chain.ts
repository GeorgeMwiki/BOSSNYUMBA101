/**
 * Hook chain — Claude-Code-style lifecycle substrate.
 *
 * The original substrate exposed three stages (`pre-tool-use`,
 * `post-tool-use`, `stop`) with five `HookResult` outcomes. Phase E.6
 * widened both axes to match Claude Code's full hook surface:
 *
 *   9 stages — `session-start`, `user-prompt-submit`, `pre-tool-use`,
 *   `post-tool-use`, `pre-compact`, `post-compact`, `subagent-start`,
 *   `subagent-stop`, `stop`.
 *
 *   9 outcomes — `allow`, `deny`, `ask-owner`, `sandbox`, `transform`,
 *   `updated-input`, `additional-context`, `defer`, `stop`.
 *
 * Phase K-A (this file) extends the stage axis from 9 to **22** to
 * close R1 parity-gap #1 (".research/r1-claude-code-parity-audit.md").
 * The 13 new stages map one-to-one to the Claude Code TypeScript SDK
 * v0.3.144 hook surface:
 *
 *   `post-tool-use-failure` — fires after a tool dispatch ERROR
 *   `post-tool-batch`       — once per batch of parallel tool calls
 *   `user-prompt-expansion` — slash-command expansion to a prompt
 *   `stop-failure`          — turn ended due to provider/api error
 *   `permission-request`    — approval dialog about to show
 *   `permission-denied`     — auto-classifier denied
 *   `session-end`           — session terminates
 *   `notification`          — auth/elicitation/idle/permission events
 *   `setup`                 — --init / --maintenance bootstrap
 *   `teammate-idle`         — teammate became idle (multi-agent loops)
 *   `task-completed`        — background task finished
 *   `worktree-create`       — git worktree spun up for isolation
 *   `worktree-remove`       — git worktree torn down
 *
 * It also widens the `HookResult` ADT by two outcomes:
 *
 *   `updated-tool-output`  — post-tool-use mutator: rewrites the tool
 *                            result the model will see (sibling of the
 *                            existing pre-tool-use `updated-input`).
 *                            Composes across multiple post hooks just
 *                            like `updated-input` composes pre.
 *
 *   `defer` (extended)     — gains an OPTIONAL `resumeToken` field so a
 *                            long-running approval flow (CFO sign-off,
 *                            regulator confirmation) can mint a stable
 *                            token, persist it to the SessionStore, and
 *                            re-enter `think()` with the same token
 *                            after the external decision lands. The
 *                            existing `resumeAfterMs` is retained for
 *                            simple time-based deferrals.
 *
 * Each Hook is a pure function (with optional async I/O) that returns a
 * `HookResult` ADT. The chain runner short-circuits on the FIRST
 * non-allow / non-side-effect result so a deny / ask / sandbox / stop
 * decision halts further chain evaluation.
 *
 * `updated-input`, `updated-tool-output`, and `additional-context` are
 * SIDE-EFFECT outcomes: they mutate the rolling Decision / pending-
 * context list but the chain continues running so multiple hooks can
 * compose (e.g. PII-scrub plus a policy-reminder injection plus a
 * permission gate).
 *
 * Persistence (audit emission, ledger seal) happens via injected ports
 * the hook closes over, never via shared mutable state.
 */

import type { ScopeContext } from '../../types.js';
import type { Decision, DispatchResult } from './decision.js';

// ─────────────────────────────────────────────────────────────────────
// Chat message shape — minimal, provider-agnostic. Matches the shape
// the main-loop already passes to `router.call({ messages })`.
// ─────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  readonly role: 'user' | 'assistant' | 'tool' | 'system';
  readonly content: string;
}

// ─────────────────────────────────────────────────────────────────────
// HookResult ADT — nine outcomes a hook can return.
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
  | { readonly kind: 'transform'; readonly replacement: Decision }
  /**
   * `updated-input` — the hook returns a sanitised / rewritten copy of
   * the Decision that the chain should use going forward. Distinct from
   * `transform` because the chain CONTINUES evaluating subsequent
   * hooks against the replacement (so PII-scrub + permission-gate can
   * compose: scrub first, then check perms on the scrubbed payload).
   */
  | { readonly kind: 'updated-input'; readonly replacement: Decision }
  /**
   * `additional-context` — the hook injects extra messages (e.g. a
   * policy reminder, a freshly-fetched citation) that the main-loop
   * folds into the next `router.call({ messages })`. The chain
   * continues; messages accumulate.
   */
  | {
      readonly kind: 'additional-context';
      readonly messages: ReadonlyArray<ChatMessage>;
    }
  /**
   * `updated-tool-output` — Phase K-A. Sibling of `updated-input` for
   * the post-tool-use stage. The hook returns a rewritten tool result
   * that downstream post hooks AND the model will see. Composes across
   * multiple post hooks (e.g. redact PII from the output then sign it
   * for audit). The chain CONTINUES evaluating subsequent post hooks
   * against the replacement, mirroring `updated-input`'s contract.
   *
   * Ignored on stages other than `post-tool-use` (treated as `allow`).
   */
  | {
      readonly kind: 'updated-tool-output';
      readonly replacement: DispatchResult;
    }
  /**
   * `defer` — pause the decision, resume after `resumeAfterMs` OR when
   * the caller re-enters with `resumeToken`. The main-loop schedules
   * a wake (time-based) and/or emits an `ack-defer` envelope carrying
   * the resumeToken to the caller, who is responsible for persisting
   * it and re-entering after the external event lands.
   *
   * `resumeToken` is OPTIONAL — a hook may return only `resumeAfterMs`
   * for a simple time-based defer, only `resumeToken` for an open-
   * ended external-event defer, or both for a deadline-with-token
   * pattern. The orchestrator surface returns the token to the caller
   * via the `ack-defer` envelope so the SessionStore can key the
   * paused snapshot by `resumeToken`. (R1 #1.)
   */
  | {
      readonly kind: 'defer';
      readonly resumeAfterMs: number;
      readonly reason: string;
      readonly resumeToken?: string;
    }
  /**
   * `stop` — abort the whole turn immediately. Equivalent to Claude
   * Code's `continue:false`. The main-loop returns a terminal response
   * to the caller without dispatching anything else.
   */
  | { readonly kind: 'stop'; readonly reason: string };

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
// Hook stages — 22 lifecycle moments the substrate fires on.
//
// The first 9 stages are the original Phase E.6 surface. The 13 stages
// after the `// --- Phase K-A ---` marker mirror the Claude Code TS
// SDK v0.3.144 hook surface and close R1 parity gap #1.
// ─────────────────────────────────────────────────────────────────────

export type HookStage =
  | 'session-start'
  | 'user-prompt-submit'
  | 'pre-tool-use'
  | 'post-tool-use'
  | 'pre-compact'
  | 'post-compact'
  | 'subagent-start'
  | 'subagent-stop'
  | 'stop'
  // --- Phase K-A — 13 new Claude-Code-parity stages -------------------
  | 'post-tool-use-failure'
  | 'post-tool-batch'
  | 'user-prompt-expansion'
  | 'stop-failure'
  | 'permission-request'
  | 'permission-denied'
  | 'session-end'
  | 'notification'
  | 'setup'
  | 'teammate-idle'
  | 'task-completed'
  | 'worktree-create'
  | 'worktree-remove';

// ─────────────────────────────────────────────────────────────────────
// Stage-specific payloads
// ─────────────────────────────────────────────────────────────────────

/** Snapshot a `session-start` hook can inspect to seed the session. */
export interface SessionStartPayload {
  readonly threadId: string;
  readonly tier: HookContext['tier'];
  readonly resumed: boolean;
}

/** Wrapped user prompt the `user-prompt-submit` hook may scrub / reject. */
export interface UserPromptPayload {
  readonly text: string;
}

/** Compaction inputs surfaced to `pre-compact`. */
export interface PreCompactPayload {
  readonly currentTokens: number;
  readonly windowTokens: number;
  readonly ratio: number;
}

/** Compaction outcome surfaced to `post-compact`. */
export interface PostCompactPayload {
  readonly originalTokens: number;
  readonly finalTokens: number;
  readonly droppedTurnCount: number;
}

/** Sub-MD descriptor surfaced to `subagent-start` / `subagent-stop`. */
export interface SubagentPayload {
  readonly subMdId: string;
  readonly persona: string;
  readonly parentThreadId: string;
  /** Populated on stop only. */
  readonly outcome?: DispatchResult;
}

// ─────────────────────────────────────────────────────────────────────
// Phase K-A — payloads for the 13 new Claude-Code-parity stages.
//
// Each payload is the minimal shape a hook needs to make a useful
// decision. Field names mirror the Claude Code TS SDK where it is
// reasonable to do so (e.g. `trigger` on PostToolBatch, `kind` on
// Notification) so the mental model transfers.
// ─────────────────────────────────────────────────────────────────────

/**
 * `post-tool-use-failure` payload — fired after a tool dispatch that
 * returned a `tool_error` DispatchResult. Separate from `post-tool-use`
 * (which fires on success) so retry / circuit-break logic can hook
 * failures without parsing the result union.
 */
export interface PostToolUseFailurePayload {
  readonly decision: Decision;
  readonly error: DispatchResult & { readonly kind: 'tool_error' };
}

/**
 * `post-tool-batch` payload — fires once after a parallel batch of tool
 * calls resolves, before the next model call. `parentDecisions` are the
 * decisions in the batch; `results` are their resolved DispatchResults
 * in the SAME order. The hook is the right place to inject conventions
 * once-per-batch rather than per-tool (e.g. "remind the model about
 * row-level security after every read batch").
 */
export interface PostToolBatchPayload {
  readonly batchId: string;
  readonly decisions: ReadonlyArray<Decision>;
  readonly results: ReadonlyArray<DispatchResult>;
}

/**
 * `user-prompt-expansion` payload — fires when a slash-command expands
 * into a prompt. The `original` is the raw slash invocation; `expanded`
 * is the prompt the substrate will route. Hooks can deny the expansion
 * (e.g. block an unsanctioned command) or transform it.
 */
export interface UserPromptExpansionPayload {
  readonly original: string;
  readonly expanded: string;
  readonly commandName: string;
}

/**
 * `stop-failure` payload — fires when a turn aborts due to a provider
 * / API error rather than a clean stop (e.g. model-not-found, upstream
 * 5xx, structured-output retry exhaustion). Use it to surface a loud
 * operator-visible signal (PagerDuty, Slack) so an outage is noticed.
 */
export interface StopFailurePayload {
  readonly threadId: string;
  readonly turnCount: number;
  readonly errorCode: string;
  readonly errorMessage: string;
}

/**
 * `permission-request` payload — fires when an approval dialog is about
 * to show. Hook can short-circuit with a Slack / email / push approval
 * + external decision (returning `allow` or `deny` from the hook).
 */
export interface PermissionRequestPayload {
  readonly decision: Decision;
  readonly suggestedRules: ReadonlyArray<string>;
  /** Free-form prompt the substrate would have shown the user. */
  readonly prompt: string;
}

/**
 * `permission-denied` payload — fires when the auto-mode classifier
 * (or a `deny` rule) blocks a tool call. Used for retry policy +
 * compliance audit.
 */
export interface PermissionDeniedPayload {
  readonly decision: Decision;
  readonly reason: string;
  readonly source: 'classifier' | 'rule' | 'hook';
}

/**
 * `session-end` payload — fires when a session terminates. The
 * `terminationReason` mirrors Claude Code's `clear | resume | logout |
 * prompt_input_exit | timeout | error` enumeration.
 */
export interface SessionEndPayload {
  readonly threadId: string;
  readonly terminationReason:
    | 'clear'
    | 'resume'
    | 'logout'
    | 'prompt_input_exit'
    | 'timeout'
    | 'error';
}

/**
 * `notification` payload — fires on `permission_prompt`,
 * `idle_prompt`, `auth_success`, `elicitation_dialog`,
 * `elicitation_response`, `elicitation_complete` events. Hook surface
 * for routing notifications to Slack / PagerDuty / SMS.
 */
export interface NotificationPayload {
  readonly notificationKind:
    | 'permission_prompt'
    | 'idle_prompt'
    | 'auth_success'
    | 'elicitation_dialog'
    | 'elicitation_response'
    | 'elicitation_complete';
  readonly message: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * `setup` payload — fires when the CLI / SDK is invoked with `--init`
 * or `--maintenance` (project bootstrap moments). Hook can seed
 * `.claude/` files, write a CLAUDE.md scaffold, etc.
 */
export interface SetupPayload {
  readonly mode: 'init' | 'maintenance';
  readonly cwd: string;
}

/**
 * `teammate-idle` payload — fires when a multi-agent teammate becomes
 * idle. Used for work reassignment in evaluator-optimizer / orchestrator-
 * subagent patterns.
 */
export interface TeammateIdlePayload {
  readonly teammateId: string;
  readonly idleSinceMs: number;
}

/**
 * `task-completed` payload — fires when a background task (Task graph
 * leaf) completes. Aggregates parallel results back into the main loop.
 */
export interface TaskCompletedPayload {
  readonly taskId: string;
  readonly status: 'success' | 'failure' | 'cancelled';
  readonly result?: unknown;
}

/**
 * `worktree-create` / `worktree-remove` payload — fires on git worktree
 * lifecycle. Used to track isolation workspaces (BOSSNYUMBA's
 * `isolation: worktree` sub-MD spawn semantics).
 */
export interface WorktreePayload {
  readonly worktreePath: string;
  readonly branch: string;
  readonly parentBranch?: string;
}

// ─────────────────────────────────────────────────────────────────────
// Hook variants — one interface per stage, each with the appropriate
// payload signature. Discriminated by `stage`.
// ─────────────────────────────────────────────────────────────────────

export interface SessionStartHook {
  readonly name: string;
  readonly stage: 'session-start';
  fn(ctx: HookContext, payload: SessionStartPayload): Promise<HookResult>;
}

export interface UserPromptSubmitHook {
  readonly name: string;
  readonly stage: 'user-prompt-submit';
  fn(ctx: HookContext, payload: UserPromptPayload): Promise<HookResult>;
}

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

export interface PreCompactHook {
  readonly name: string;
  readonly stage: 'pre-compact';
  fn(ctx: HookContext, payload: PreCompactPayload): Promise<HookResult>;
}

export interface PostCompactHook {
  readonly name: string;
  readonly stage: 'post-compact';
  fn(ctx: HookContext, payload: PostCompactPayload): Promise<HookResult>;
}

export interface SubagentStartHook {
  readonly name: string;
  readonly stage: 'subagent-start';
  fn(ctx: HookContext, payload: SubagentPayload): Promise<HookResult>;
}

export interface SubagentStopHook {
  readonly name: string;
  readonly stage: 'subagent-stop';
  fn(ctx: HookContext, payload: SubagentPayload): Promise<HookResult>;
}

export interface StopHook {
  readonly name: string;
  readonly stage: 'stop';
  fn(ctx: HookContext, session: StopSession): Promise<HookResult>;
}

// ─────────────────────────────────────────────────────────────────────
// Phase K-A — Hook interfaces for the 13 new lifecycle stages.
// Each interface follows the existing pattern: name + stage tag +
// async `fn(ctx, payload)` returning a `HookResult`.
// ─────────────────────────────────────────────────────────────────────

export interface PostToolUseFailureHook {
  readonly name: string;
  readonly stage: 'post-tool-use-failure';
  readonly scope?: ScopeFilter;
  fn(ctx: HookContext, payload: PostToolUseFailurePayload): Promise<HookResult>;
}

export interface PostToolBatchHook {
  readonly name: string;
  readonly stage: 'post-tool-batch';
  fn(ctx: HookContext, payload: PostToolBatchPayload): Promise<HookResult>;
}

export interface UserPromptExpansionHook {
  readonly name: string;
  readonly stage: 'user-prompt-expansion';
  fn(
    ctx: HookContext,
    payload: UserPromptExpansionPayload,
  ): Promise<HookResult>;
}

export interface StopFailureHook {
  readonly name: string;
  readonly stage: 'stop-failure';
  fn(ctx: HookContext, payload: StopFailurePayload): Promise<HookResult>;
}

export interface PermissionRequestHook {
  readonly name: string;
  readonly stage: 'permission-request';
  fn(ctx: HookContext, payload: PermissionRequestPayload): Promise<HookResult>;
}

export interface PermissionDeniedHook {
  readonly name: string;
  readonly stage: 'permission-denied';
  fn(ctx: HookContext, payload: PermissionDeniedPayload): Promise<HookResult>;
}

export interface SessionEndHook {
  readonly name: string;
  readonly stage: 'session-end';
  fn(ctx: HookContext, payload: SessionEndPayload): Promise<HookResult>;
}

export interface NotificationHook {
  readonly name: string;
  readonly stage: 'notification';
  fn(ctx: HookContext, payload: NotificationPayload): Promise<HookResult>;
}

export interface SetupHook {
  readonly name: string;
  readonly stage: 'setup';
  fn(ctx: HookContext, payload: SetupPayload): Promise<HookResult>;
}

export interface TeammateIdleHook {
  readonly name: string;
  readonly stage: 'teammate-idle';
  fn(ctx: HookContext, payload: TeammateIdlePayload): Promise<HookResult>;
}

export interface TaskCompletedHook {
  readonly name: string;
  readonly stage: 'task-completed';
  fn(ctx: HookContext, payload: TaskCompletedPayload): Promise<HookResult>;
}

export interface WorktreeCreateHook {
  readonly name: string;
  readonly stage: 'worktree-create';
  fn(ctx: HookContext, payload: WorktreePayload): Promise<HookResult>;
}

export interface WorktreeRemoveHook {
  readonly name: string;
  readonly stage: 'worktree-remove';
  fn(ctx: HookContext, payload: WorktreePayload): Promise<HookResult>;
}

export type Hook =
  | SessionStartHook
  | UserPromptSubmitHook
  | PreToolUseHook
  | PostToolUseHook
  | PreCompactHook
  | PostCompactHook
  | SubagentStartHook
  | SubagentStopHook
  | StopHook
  // --- Phase K-A — 13 new Claude-Code-parity hooks --------------------
  | PostToolUseFailureHook
  | PostToolBatchHook
  | UserPromptExpansionHook
  | StopFailureHook
  | PermissionRequestHook
  | PermissionDeniedHook
  | SessionEndHook
  | NotificationHook
  | SetupHook
  | TeammateIdleHook
  | TaskCompletedHook
  | WorktreeCreateHook
  | WorktreeRemoveHook;

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
// PreToolUseChainResult — extended result carries side-effect outcomes
// the main-loop must thread back through subsequent ticks.
// ─────────────────────────────────────────────────────────────────────

export interface PreToolUseChainResult {
  /**
   * The final terminal outcome of the chain. Always one of `allow`,
   * `deny`, `ask-owner`, `sandbox`, `transform`, `defer`, `stop`.
   * `updated-input` and `additional-context` are folded into the
   * accumulator fields below and never appear here.
   */
  readonly outcome: HookResult;
  /**
   * If any hook returned `updated-input`, this is the final replacement
   * Decision that the dispatcher should run. `null` when no hook
   * rewrote the decision.
   */
  readonly effectiveDecision: Decision | null;
  /**
   * Accumulated `additional-context` injections, in registration order.
   * The main-loop folds these into the next `router.call({ messages })`.
   */
  readonly contextInjections: ReadonlyArray<ChatMessage>;
}

/**
 * Phase K-A — extended result the post-tool-use chain emits so the
 * main-loop can pick up the mutated tool output produced by any
 * `updated-tool-output` hook. Mirrors `PreToolUseChainResult`'s
 * effective-payload-plus-terminal-outcome shape.
 *
 * The legacy `runPostToolUse(...) => HookResult` shim is kept for
 * backwards-compat callers (its return value is the terminal outcome).
 * New callers should switch to `runPostToolUseChain(...)` to receive
 * `effectiveResult` and any `additional-context` injections.
 */
export interface PostToolUseChainResult {
  readonly outcome: HookResult;
  /**
   * Final replacement DispatchResult after every `updated-tool-output`
   * hook has folded into it. `null` when no hook rewrote the output.
   */
  readonly effectiveResult: DispatchResult | null;
  /**
   * Accumulated `additional-context` injections, in registration order.
   * Post-tool-use injections fold into the next router.call payload
   * the same way pre-tool-use injections do.
   */
  readonly contextInjections: ReadonlyArray<ChatMessage>;
}

// ─────────────────────────────────────────────────────────────────────
// HookChain — orchestration over a registered hook set.
// ─────────────────────────────────────────────────────────────────────

export interface HookChain {
  runSessionStart(
    payload: SessionStartPayload,
    ctx: HookContext,
  ): Promise<HookResult>;
  runUserPromptSubmit(
    payload: UserPromptPayload,
    ctx: HookContext,
  ): Promise<HookResult>;
  runPreToolUse(
    decision: Decision,
    ctx: HookContext,
  ): Promise<PreToolUseChainResult>;
  /**
   * Legacy post-tool-use runner. Returns only the terminal outcome.
   * Retained for backwards-compatibility with the main-loop's existing
   * caller. New code should prefer `runPostToolUseChain` which exposes
   * `updated-tool-output` and `additional-context` accumulators.
   */
  runPostToolUse(
    decision: Decision,
    result: DispatchResult,
    ctx: HookContext,
  ): Promise<HookResult>;
  /**
   * Phase K-A — post-tool-use runner that exposes the full chain
   * result including the `effectiveResult` (after `updated-tool-output`
   * mutators have applied) and `contextInjections`.
   */
  runPostToolUseChain(
    decision: Decision,
    result: DispatchResult,
    ctx: HookContext,
  ): Promise<PostToolUseChainResult>;
  runPreCompact(
    payload: PreCompactPayload,
    ctx: HookContext,
  ): Promise<HookResult>;
  runPostCompact(
    payload: PostCompactPayload,
    ctx: HookContext,
  ): Promise<HookResult>;
  runSubagentStart(
    payload: SubagentPayload,
    ctx: HookContext,
  ): Promise<HookResult>;
  runSubagentStop(
    payload: SubagentPayload,
    ctx: HookContext,
  ): Promise<HookResult>;
  runStop(session: StopSession, ctx: HookContext): Promise<HookResult>;
  // --- Phase K-A — 13 new lifecycle stage runners --------------------
  runPostToolUseFailure(
    payload: PostToolUseFailurePayload,
    ctx: HookContext,
  ): Promise<HookResult>;
  runPostToolBatch(
    payload: PostToolBatchPayload,
    ctx: HookContext,
  ): Promise<HookResult>;
  runUserPromptExpansion(
    payload: UserPromptExpansionPayload,
    ctx: HookContext,
  ): Promise<HookResult>;
  runStopFailure(
    payload: StopFailurePayload,
    ctx: HookContext,
  ): Promise<HookResult>;
  runPermissionRequest(
    payload: PermissionRequestPayload,
    ctx: HookContext,
  ): Promise<HookResult>;
  runPermissionDenied(
    payload: PermissionDeniedPayload,
    ctx: HookContext,
  ): Promise<HookResult>;
  runSessionEnd(
    payload: SessionEndPayload,
    ctx: HookContext,
  ): Promise<HookResult>;
  runNotification(
    payload: NotificationPayload,
    ctx: HookContext,
  ): Promise<HookResult>;
  runSetup(payload: SetupPayload, ctx: HookContext): Promise<HookResult>;
  runTeammateIdle(
    payload: TeammateIdlePayload,
    ctx: HookContext,
  ): Promise<HookResult>;
  runTaskCompleted(
    payload: TaskCompletedPayload,
    ctx: HookContext,
  ): Promise<HookResult>;
  runWorktreeCreate(
    payload: WorktreePayload,
    ctx: HookContext,
  ): Promise<HookResult>;
  runWorktreeRemove(
    payload: WorktreePayload,
    ctx: HookContext,
  ): Promise<HookResult>;
  /** Read-only inventory for self-awareness / telemetry. */
  list(): ReadonlyArray<{ name: string; stage: HookStage }>;
}

// ─────────────────────────────────────────────────────────────────────
// Factory — `createHookChain(hooks)` returns a HookChain. Hooks run in
// registration order; the chain stops at the first terminal result.
// ─────────────────────────────────────────────────────────────────────

export function createHookChain(hooks: ReadonlyArray<Hook>): HookChain {
  const sessionStart = hooks.filter(
    (h): h is SessionStartHook => h.stage === 'session-start',
  );
  const userPromptSubmit = hooks.filter(
    (h): h is UserPromptSubmitHook => h.stage === 'user-prompt-submit',
  );
  const pre = hooks.filter(
    (h): h is PreToolUseHook => h.stage === 'pre-tool-use',
  );
  const post = hooks.filter(
    (h): h is PostToolUseHook => h.stage === 'post-tool-use',
  );
  const preCompact = hooks.filter(
    (h): h is PreCompactHook => h.stage === 'pre-compact',
  );
  const postCompact = hooks.filter(
    (h): h is PostCompactHook => h.stage === 'post-compact',
  );
  const subagentStart = hooks.filter(
    (h): h is SubagentStartHook => h.stage === 'subagent-start',
  );
  const subagentStop = hooks.filter(
    (h): h is SubagentStopHook => h.stage === 'subagent-stop',
  );
  const stop = hooks.filter((h): h is StopHook => h.stage === 'stop');
  // --- Phase K-A — partition the 13 new lifecycle chains ------------
  const postToolUseFailure = hooks.filter(
    (h): h is PostToolUseFailureHook => h.stage === 'post-tool-use-failure',
  );
  const postToolBatch = hooks.filter(
    (h): h is PostToolBatchHook => h.stage === 'post-tool-batch',
  );
  const userPromptExpansion = hooks.filter(
    (h): h is UserPromptExpansionHook => h.stage === 'user-prompt-expansion',
  );
  const stopFailure = hooks.filter(
    (h): h is StopFailureHook => h.stage === 'stop-failure',
  );
  const permissionRequest = hooks.filter(
    (h): h is PermissionRequestHook => h.stage === 'permission-request',
  );
  const permissionDenied = hooks.filter(
    (h): h is PermissionDeniedHook => h.stage === 'permission-denied',
  );
  const sessionEnd = hooks.filter(
    (h): h is SessionEndHook => h.stage === 'session-end',
  );
  const notification = hooks.filter(
    (h): h is NotificationHook => h.stage === 'notification',
  );
  const setup = hooks.filter((h): h is SetupHook => h.stage === 'setup');
  const teammateIdle = hooks.filter(
    (h): h is TeammateIdleHook => h.stage === 'teammate-idle',
  );
  const taskCompleted = hooks.filter(
    (h): h is TaskCompletedHook => h.stage === 'task-completed',
  );
  const worktreeCreate = hooks.filter(
    (h): h is WorktreeCreateHook => h.stage === 'worktree-create',
  );
  const worktreeRemove = hooks.filter(
    (h): h is WorktreeRemoveHook => h.stage === 'worktree-remove',
  );

  // CRITICAL #8 — hook throws must NOT unwind the chain. We wrap every
  // hook invocation in try/catch and translate the throw into a typed
  // `{kind:'deny', code:'hook-threw'}` outcome. The module docstring at
  // line 16-18 promises this contract; the implementation now honours it.
  async function safeInvoke<P>(
    hook: {
      readonly name?: string;
      fn: (c: HookContext, p: P) => Promise<HookResult>;
    },
    ctx: HookContext,
    payload: P,
  ): Promise<HookResult> {
    try {
      return await hook.fn(ctx, payload);
    } catch (err) {
      const reason =
        err instanceof Error ? err.message : 'hook threw a non-Error value';
      return {
        kind: 'deny',
        reason: `hook ${hook.name ?? '<anonymous>'} threw: ${reason}`,
        code: 'hook-threw',
      };
    }
  }

  // Generic chain runner for stages whose hooks take a single payload.
  async function runSimple<P>(
    chain: ReadonlyArray<{
      readonly name?: string;
      fn: (c: HookContext, p: P) => Promise<HookResult>;
    }>,
    ctx: HookContext,
    payload: P,
  ): Promise<HookResult> {
    for (const h of chain) {
      const out = await safeInvoke(h, ctx, payload);
      if (out.kind !== 'allow') return out;
    }
    return { kind: 'allow' };
  }

  async function runSessionStart(
    payload: SessionStartPayload,
    ctx: HookContext,
  ): Promise<HookResult> {
    return runSimple(sessionStart, ctx, payload);
  }

  async function runUserPromptSubmit(
    payload: UserPromptPayload,
    ctx: HookContext,
  ): Promise<HookResult> {
    return runSimple(userPromptSubmit, ctx, payload);
  }

  async function runPreToolUse(
    decision: Decision,
    ctx: HookContext,
  ): Promise<PreToolUseChainResult> {
    let currentDecision: Decision = decision;
    let effective: Decision | null = null;
    const injections: ChatMessage[] = [];

    for (const h of pre) {
      if (!matchesScope(h.scope, currentDecision, ctx)) continue;
      // safeInvoke maps any thrown error to a typed `deny` with
      // code `hook-threw` (CRITICAL #8). The decision argument is the
      // payload for pre-tool-use hooks.
      const out = await safeInvoke<Decision>(
        { name: h.name, fn: h.fn },
        ctx,
        currentDecision,
      );

      if (out.kind === 'allow') continue;

      if (out.kind === 'updated-input') {
        currentDecision = out.replacement;
        effective = out.replacement;
        continue;
      }

      if (out.kind === 'additional-context') {
        injections.push(...out.messages);
        continue;
      }

      // Terminal outcome — return immediately with whatever side-effects
      // have already accumulated.
      return {
        outcome: out,
        effectiveDecision: effective,
        contextInjections: injections,
      };
    }

    return {
      outcome: { kind: 'allow' },
      effectiveDecision: effective,
      contextInjections: injections,
    };
  }

  async function runPostToolUseChain(
    decision: Decision,
    result: DispatchResult,
    ctx: HookContext,
  ): Promise<PostToolUseChainResult> {
    // H3 — post-tool-use hooks are observational by contract
    // (audit-emission, ledger-seal, telemetry). Every hook MUST run
    // regardless of whether an earlier hook denied: an audit pipeline
    // that records EVERY dispatch is non-negotiable. We collect failures
    // and return the FIRST non-allow outcome AFTER the full chain has
    // executed, so the caller still gets a visible signal.
    //
    // Phase K-A widens the contract: `updated-tool-output` rewrites the
    // result the model sees, and `additional-context` injects extra
    // messages — both COMPOSE across the full chain (do NOT short-
    // circuit), mirroring the pre-tool-use chain semantics.
    let currentResult: DispatchResult = result;
    let effectiveResult: DispatchResult | null = null;
    const injections: ChatMessage[] = [];
    let firstNonAllow: HookResult | null = null;
    for (const h of post) {
      if (!matchesScope(h.scope, decision, ctx)) continue;
      let out: HookResult;
      try {
        out = await h.fn(ctx, decision, currentResult);
      } catch (err) {
        const reason =
          err instanceof Error ? err.message : 'hook threw a non-Error value';
        out = {
          kind: 'deny',
          reason: `hook ${h.name ?? '<anonymous>'} threw: ${reason}`,
          code: 'hook-threw',
        };
      }
      if (out.kind === 'allow') continue;
      if (out.kind === 'updated-tool-output') {
        currentResult = out.replacement;
        effectiveResult = out.replacement;
        continue;
      }
      if (out.kind === 'additional-context') {
        injections.push(...out.messages);
        continue;
      }
      if (firstNonAllow === null) {
        firstNonAllow = out;
      }
    }
    return {
      outcome: firstNonAllow ?? { kind: 'allow' },
      effectiveResult,
      contextInjections: injections,
    };
  }

  async function runPostToolUse(
    decision: Decision,
    result: DispatchResult,
    ctx: HookContext,
  ): Promise<HookResult> {
    // Legacy shim — delegates to the K-A chain runner and surfaces only
    // the terminal outcome. Backwards-compat for the existing main-loop
    // caller that does not yet read `effectiveResult` or
    // `contextInjections`. New callers should use `runPostToolUseChain`.
    const chain = await runPostToolUseChain(decision, result, ctx);
    return chain.outcome;
  }

  async function runPreCompact(
    payload: PreCompactPayload,
    ctx: HookContext,
  ): Promise<HookResult> {
    return runSimple(preCompact, ctx, payload);
  }

  async function runPostCompact(
    payload: PostCompactPayload,
    ctx: HookContext,
  ): Promise<HookResult> {
    return runSimple(postCompact, ctx, payload);
  }

  async function runSubagentStart(
    payload: SubagentPayload,
    ctx: HookContext,
  ): Promise<HookResult> {
    return runSimple(subagentStart, ctx, payload);
  }

  async function runSubagentStop(
    payload: SubagentPayload,
    ctx: HookContext,
  ): Promise<HookResult> {
    return runSimple(subagentStop, ctx, payload);
  }

  async function runStop(
    session: StopSession,
    ctx: HookContext,
  ): Promise<HookResult> {
    for (const h of stop) {
      const out = await safeInvoke<StopSession>(
        { name: h.name, fn: h.fn },
        ctx,
        session,
      );
      if (out.kind !== 'allow') return out;
    }
    return { kind: 'allow' };
  }

  // --- Phase K-A — runners for the 13 new lifecycle stages -----------
  // Every runner uses `runSimple` so the CRITICAL #8 safety net (thrown
  // hooks → typed deny) and the short-circuit-on-non-allow contract are
  // applied uniformly. `post-tool-use-failure` adds scope filtering on
  // the embedded decision; the others have no scope filter because they
  // fire on system-level events without a per-tool decision attached.

  async function runPostToolUseFailure(
    payload: PostToolUseFailurePayload,
    ctx: HookContext,
  ): Promise<HookResult> {
    for (const h of postToolUseFailure) {
      if (!matchesScope(h.scope, payload.decision, ctx)) continue;
      const out = await safeInvoke<PostToolUseFailurePayload>(
        { name: h.name, fn: h.fn },
        ctx,
        payload,
      );
      if (out.kind !== 'allow') return out;
    }
    return { kind: 'allow' };
  }

  async function runPostToolBatch(
    payload: PostToolBatchPayload,
    ctx: HookContext,
  ): Promise<HookResult> {
    return runSimple(postToolBatch, ctx, payload);
  }

  async function runUserPromptExpansion(
    payload: UserPromptExpansionPayload,
    ctx: HookContext,
  ): Promise<HookResult> {
    return runSimple(userPromptExpansion, ctx, payload);
  }

  async function runStopFailure(
    payload: StopFailurePayload,
    ctx: HookContext,
  ): Promise<HookResult> {
    return runSimple(stopFailure, ctx, payload);
  }

  async function runPermissionRequest(
    payload: PermissionRequestPayload,
    ctx: HookContext,
  ): Promise<HookResult> {
    return runSimple(permissionRequest, ctx, payload);
  }

  async function runPermissionDenied(
    payload: PermissionDeniedPayload,
    ctx: HookContext,
  ): Promise<HookResult> {
    return runSimple(permissionDenied, ctx, payload);
  }

  async function runSessionEnd(
    payload: SessionEndPayload,
    ctx: HookContext,
  ): Promise<HookResult> {
    return runSimple(sessionEnd, ctx, payload);
  }

  async function runNotification(
    payload: NotificationPayload,
    ctx: HookContext,
  ): Promise<HookResult> {
    return runSimple(notification, ctx, payload);
  }

  async function runSetup(
    payload: SetupPayload,
    ctx: HookContext,
  ): Promise<HookResult> {
    return runSimple(setup, ctx, payload);
  }

  async function runTeammateIdle(
    payload: TeammateIdlePayload,
    ctx: HookContext,
  ): Promise<HookResult> {
    return runSimple(teammateIdle, ctx, payload);
  }

  async function runTaskCompleted(
    payload: TaskCompletedPayload,
    ctx: HookContext,
  ): Promise<HookResult> {
    return runSimple(taskCompleted, ctx, payload);
  }

  async function runWorktreeCreate(
    payload: WorktreePayload,
    ctx: HookContext,
  ): Promise<HookResult> {
    return runSimple(worktreeCreate, ctx, payload);
  }

  async function runWorktreeRemove(
    payload: WorktreePayload,
    ctx: HookContext,
  ): Promise<HookResult> {
    return runSimple(worktreeRemove, ctx, payload);
  }

  function list(): ReadonlyArray<{ name: string; stage: HookStage }> {
    return hooks.map((h) => ({ name: h.name, stage: h.stage }));
  }

  return {
    runSessionStart,
    runUserPromptSubmit,
    runPreToolUse,
    runPostToolUse,
    runPostToolUseChain,
    runPreCompact,
    runPostCompact,
    runSubagentStart,
    runSubagentStop,
    runStop,
    // --- Phase K-A — 13 new lifecycle stage runners ------------------
    runPostToolUseFailure,
    runPostToolBatch,
    runUserPromptExpansion,
    runStopFailure,
    runPermissionRequest,
    runPermissionDenied,
    runSessionEnd,
    runNotification,
    runSetup,
    runTeammateIdle,
    runTaskCompleted,
    runWorktreeCreate,
    runWorktreeRemove,
    list,
  };
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
