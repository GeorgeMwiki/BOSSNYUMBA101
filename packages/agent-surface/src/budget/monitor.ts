/**
 * `BudgetMonitor` — real-time spend tracking with hard caps and
 * per-action cost preview.
 *
 * State is immutable. Each `record()` / `approve()` returns a NEW
 * monitor instance — same pattern as Redux.
 *
 * Token-pricing is injected via `TokenPricing` so the monitor stays
 * agnostic to which Anthropic / OpenAI model is in play.
 */

import { err, ok } from '../types.js';
import type { CostLine } from '../types.js';
import type {
  ActionEstimate,
  ApproveSpendResult,
  BudgetCaps,
  BudgetError,
  BudgetEvent,
  BudgetState,
} from './types.js';

export interface TokenPricing {
  /** Dollars per million input tokens. */
  readonly inputPerMillion: number;
  /** Dollars per million output tokens. */
  readonly outputPerMillion: number;
  /** Dollars per million cached input tokens (e.g. Claude prompt cache).
   *  Lower than inputPerMillion; we use this when `cacheHit` is true. */
  readonly cachedInputPerMillion: number;
}

export interface EstimateInput {
  readonly description: string;
  readonly expectedInputTokens: number;
  readonly expectedOutputTokens: number;
  readonly expectedSeconds: number;
  /** Optional extra fixed cost lines (tool calls, SMS, etc). */
  readonly extras?: ReadonlyArray<CostLine>;
}

export interface BudgetMonitorConfig {
  readonly tenantId: string;
  readonly caps: BudgetCaps;
  readonly pricing: TokenPricing;
  /** Function returning current wall-time. Injectable for tests. */
  readonly now?: () => Date;
  /** Initial state — used when re-hydrating from storage. */
  readonly initialState?: BudgetState;
  /** Initial cache-hit-rate sample (default 0). */
  readonly initialCacheHitRate?: number;
}

export interface BudgetMonitor {
  readonly state: BudgetState;
  readonly events: ReadonlyArray<BudgetEvent>;

  /**
   * Project the cost + time of an upcoming action. The estimate uses
   * the current observed cache-hit-rate to discount input tokens — so
   * a tenant with high cache locality sees lower projections.
   */
  estimate(input: EstimateInput): ActionEstimate;

  /**
   * Approve (or deny) an estimate. If approved AND it would breach the
   * cap, returns an error WITHOUT mutating state — the caller must
   * either ask the tenant to raise the cap, or split the work.
   */
  approve(
    conversationId: string,
    estimate: ActionEstimate,
  ): ApproveSpendResult;

  /**
   * Record actual spend after an action completes. Updates running
   * cache-hit-rate sample.
   */
  recordSpend(
    conversationId: string,
    costUsd: number,
    cacheHitRate: number,
  ): BudgetMonitor;

  /** Convenience — has the tenant burned its monthly cap? */
  isTenantCapReached(): boolean;
  /** Convenience — has this conversation burned its cap (if set)? */
  isConversationCapReached(conversationId: string): boolean;

  /** Observed cache-hit-rate, used by `estimate`. */
  observedCacheHitRate(): number;
}

export function createBudgetMonitor(config: BudgetMonitorConfig): BudgetMonitor {
  const now = config.now ?? (() => new Date());
  return buildMonitor(
    config,
    config.initialState ?? initialState(config.tenantId, config.caps, now()),
    [],
    config.initialCacheHitRate ?? 0,
  );
}

function buildMonitor(
  config: BudgetMonitorConfig,
  state: BudgetState,
  events: ReadonlyArray<BudgetEvent>,
  cacheHitRate: number,
): BudgetMonitor {
  const now = config.now ?? (() => new Date());

  function estimate(input: EstimateInput): ActionEstimate {
    const tokens = {
      input: input.expectedInputTokens,
      output: input.expectedOutputTokens,
      cached: Math.floor(input.expectedInputTokens * cacheHitRate),
    } as const;
    const uncachedInput = input.expectedInputTokens - tokens.cached;
    const llmUsd =
      (uncachedInput * config.pricing.inputPerMillion) / 1_000_000 +
      (tokens.cached * config.pricing.cachedInputPerMillion) / 1_000_000 +
      (input.expectedOutputTokens * config.pricing.outputPerMillion) / 1_000_000;

    const llmLine: CostLine = {
      label: 'LLM tokens',
      costUsd: round6(llmUsd),
      tokens,
      cacheHit: tokens.cached > 0,
    };
    const extras = input.extras ?? [];
    const totalUsd = round6(llmUsd + extras.reduce((s, e) => s + e.costUsd, 0));

    return {
      description: input.description,
      costUsd: totalUsd,
      seconds: input.expectedSeconds,
      breakdown: [llmLine, ...extras],
      cacheHitRateUsed: cacheHitRate,
    };
  }

  function approve(
    conversationId: string,
    est: ActionEstimate,
  ): ApproveSpendResult {
    // tenant cap?
    const projTenant = state.tenantSpentUsd + est.costUsd;
    if (projTenant > state.tenantCapUsd) {
      const error: BudgetError = {
        kind: 'tenant-cap-reached',
        capUsd: state.tenantCapUsd,
        spentUsd: state.tenantSpentUsd,
      };
      return err(error);
    }
    // conversation cap?
    const convCap = config.caps.conversationUsd;
    if (typeof convCap === 'number') {
      const prevConv = state.conversations[conversationId] ?? 0;
      if (prevConv + est.costUsd > convCap) {
        const error: BudgetError = {
          kind: 'conversation-cap-reached',
          capUsd: convCap,
          spentUsd: prevConv,
        };
        return err(error);
      }
    }
    // OK to approve — but we don't book spend yet, we wait for
    // `recordSpend` after the action actually completes.
    return ok({ newState: state });
  }

  function recordSpend(
    conversationId: string,
    costUsd: number,
    sampleCacheHitRate: number,
  ): BudgetMonitor {
    const at = now();
    const newConvSpent = (state.conversations[conversationId] ?? 0) + costUsd;
    const newConversations = { ...state.conversations, [conversationId]: newConvSpent };
    const newTenantSpent = state.tenantSpentUsd + costUsd;
    const tenantOver = newTenantSpent >= state.tenantCapUsd;
    const newState: BudgetState = {
      tenantId: state.tenantId,
      periodStartIso: state.periodStartIso,
      tenantSpentUsd: round6(newTenantSpent),
      tenantCapUsd: state.tenantCapUsd,
      conversations: newConversations,
      observedCacheHitRate: state.observedCacheHitRate,
      tenantOver,
    };
    // EMA on cache-hit-rate (alpha=0.2 — biased toward recent samples).
    const alpha = 0.2;
    const newRate = clamp01(cacheHitRate * (1 - alpha) + sampleCacheHitRate * alpha);

    const spendEvent: BudgetEvent = { kind: 'spend', conversationId, costUsd, at };
    const capEvent: BudgetEvent | null = tenantOver
      ? { kind: 'cap-reached', at }
      : null;
    const newEvents: ReadonlyArray<BudgetEvent> = capEvent
      ? [...events, spendEvent, capEvent]
      : [...events, spendEvent];

    return buildMonitor(config, newState, newEvents, newRate);
  }

  function isTenantCapReached(): boolean {
    return state.tenantSpentUsd >= state.tenantCapUsd;
  }

  function isConversationCapReached(conversationId: string): boolean {
    const cap = config.caps.conversationUsd;
    if (typeof cap !== 'number') return false;
    return (state.conversations[conversationId] ?? 0) >= cap;
  }

  function observedCacheHitRate(): number {
    return cacheHitRate;
  }

  return {
    state,
    events,
    estimate,
    approve,
    recordSpend,
    isTenantCapReached,
    isConversationCapReached,
    observedCacheHitRate,
  };
}

function initialState(tenantId: string, caps: BudgetCaps, at: Date): BudgetState {
  // Period starts on the first of the current month, UTC.
  const periodStart = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1));
  return {
    tenantId,
    periodStartIso: periodStart.toISOString(),
    tenantSpentUsd: 0,
    tenantCapUsd: caps.tenantMonthlyUsd,
    conversations: {},
    observedCacheHitRate: 0,
    tenantOver: false,
  };
}

function round6(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000;
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}
