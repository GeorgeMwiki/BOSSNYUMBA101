/**
 * Multi-LLM router (Wave 11)
 *
 * Ported from LitFin's multi-provider substrate. Picks the right AI provider
 * per task given:
 *
 *   - task-type         (analysis | conversation | batch | reasoning …)
 *   - cost-budget       (cheap | balanced | premium)
 *   - latency-budget    (fast | normal | slow-ok)
 *   - tenant-tier       (free | growth | enterprise)
 *
 * Rules (most-specific-first):
 *
 *   analysis / reasoning / tool_use  → Anthropic (Sonnet/Opus)
 *   conversation / summarization     → OpenAI    (gpt-4o-mini)
 *   batch / bulk-extraction          → DeepSeek  (deepseek-chat)
 *
 * Fallback: if the preferred provider isn't registered (key missing or
 * previous call failed) the router walks a deterministic fallback chain
 * until one succeeds.
 *
 * Every successful call is logged to the Wave 10 `CostLedger` (per tenant,
 * per provider, per model). `assertWithinBudget()` is called up-front so
 * a runaway tenant can't rack up charges across multiple providers.
 */

import type { CostLedger } from '../cost-ledger.js';
import type {
  AIProvider,
  AICompletionRequest,
  AICompletionResponse,
  AIProviderError,
} from './ai-provider.js';
import type { AIResult } from '../types/core.types.js';
import { aiErr } from '../types/core.types.js';

export type TaskType =
  | 'analysis'
  | 'reasoning'
  | 'tool_use'
  | 'conversation'
  | 'summarization'
  | 'batch'
  | 'bulk_extraction';

export type CostBudget = 'cheap' | 'balanced' | 'premium';
export type LatencyBudget = 'fast' | 'normal' | 'slow_ok';
export type TenantTier = 'free' | 'growth' | 'enterprise';

export interface RouteHints {
  taskType: TaskType;
  costBudget?: CostBudget;
  latencyBudget?: LatencyBudget;
  tenantTier?: TenantTier;
}

export interface MultiLLMContext {
  readonly tenantId: string;
  readonly operation?: string;
  readonly correlationId?: string;
}

export interface ProviderRegistration {
  readonly provider: AIProvider;
  /** Which model IDs this provider should be invoked with (by task type). */
  readonly preferredModels: Partial<Record<TaskType, string>>;
  /**
   * Cost-per-1k pricing table keyed by model — used to estimate USD micro
   * cost for the ledger. If omitted, cost is logged as 0.
   */
  readonly pricing?: Record<
    string,
    { promptPer1k: number; completionPer1k: number }
  >;
}

export interface MultiLLMRouterDeps {
  /** Registered providers keyed by providerId (e.g. 'anthropic'). */
  readonly providers: Record<string, ProviderRegistration>;
  /** Cost ledger — every call recorded. */
  readonly ledger: CostLedger;
  /**
   * Fallback chain for each task type — ordered by preference. First entry
   * is the primary, remaining are fallbacks (same shape as BOSSNYUMBA
   * Wave 10 "preferred/fallback" pattern).
   */
  readonly fallbackChains?: Partial<Record<TaskType, string[]>>;
}

export interface RouteDecision {
  readonly providerId: string;
  readonly modelId: string;
  readonly reason: string;
}

/** Default fallback chains if the caller doesn't override. */
export const DEFAULT_FALLBACK_CHAINS: Record<TaskType, string[]> = {
  analysis: ['anthropic', 'openai', 'deepseek'],
  reasoning: ['anthropic', 'openai', 'deepseek'],
  tool_use: ['anthropic', 'openai', 'deepseek'],
  conversation: ['openai', 'anthropic', 'deepseek'],
  summarization: ['openai', 'deepseek', 'anthropic'],
  batch: ['deepseek', 'openai', 'anthropic'],
  bulk_extraction: ['deepseek', 'openai', 'anthropic'],
};

export interface MultiLLMRouter {
  /** Deterministic decision — no side effects. */
  pick(hints: RouteHints): RouteDecision | null;
  /** Execute the completion, logging every call to the ledger. */
  complete(params: {
    context: MultiLLMContext;
    hints: RouteHints;
    request: AICompletionRequest;
  }): Promise<
    AIResult<AICompletionResponse & { providerId: string }, AIProviderError>
  >;
}

export function createMultiLLMRouter(
  deps: MultiLLMRouterDeps
): MultiLLMRouter {
  const providers = deps.providers;
  const chains = {
    ...DEFAULT_FALLBACK_CHAINS,
    ...(deps.fallbackChains ?? {}),
  };

  function pick(hints: RouteHints): RouteDecision | null {
    const chain = chains[hints.taskType] ?? DEFAULT_FALLBACK_CHAINS[hints.taskType];
    if (!chain) return null;

    // Apply cost override — if cheap, bump deepseek / openai to the top.
    const ordered = applyBudgets(chain, hints);
    for (const providerId of ordered) {
      const reg = providers[providerId];
      if (!reg) continue;
      const model = reg.preferredModels[hints.taskType];
      if (!model) continue;
      return {
        providerId,
        modelId: model,
        reason: `task=${hints.taskType} cost=${hints.costBudget ?? 'balanced'} tier=${hints.tenantTier ?? 'growth'}`,
      };
    }
    return null;
  }

  async function complete(params: {
    context: MultiLLMContext;
    hints: RouteHints;
    request: AICompletionRequest;
  }) {
    const { context, hints, request } = params;

    // Budget guard — short-circuits BEFORE any provider is touched.
    await deps.ledger.assertWithinBudget(context.tenantId);

    const chain = chains[hints.taskType] ?? DEFAULT_FALLBACK_CHAINS[hints.taskType];
    const ordered = applyBudgets(chain, hints);

    let lastError: AIProviderError | null = null;
    for (const providerId of ordered) {
      const reg = providers[providerId];
      if (!reg) continue;
      const model = reg.preferredModels[hints.taskType];
      if (!model) continue;

      const scoped: AICompletionRequest = {
        ...request,
        modelOverride: request.modelOverride ?? model,
      };

      const result = await reg.provider.complete(scoped);
      if (!result.success) {
        const err = (result as { success: false; error: AIProviderError }).error;
        lastError = err;
        // Only fail through for genuinely retryable-on-another-provider errors.
        if (!err.retryable) {
          await recordLedger(deps.ledger, context, providerId, model, 0, 0);
          return aiErr(err);
        }
        continue;
      }

      const usage = result.data.usage;
      const micro = estimateMicroCost(reg, model, usage);

      try {
        await deps.ledger.recordUsage({
          tenantId: context.tenantId,
          provider: providerId,
          model,
          inputTokens: usage.promptTokens,
          outputTokens: usage.completionTokens,
          costUsdMicro: micro,
          operation: context.operation,
          correlationId: context.correlationId,
        });
      } catch {
        // Never fail the caller because accounting failed.
      }

      return {
        success: true as const,
        data: { ...result.data, providerId },
      };
    }

    const fallbackErr: AIProviderError = lastError ?? {
      code: 'PROVIDER_ERROR',
      message: 'No provider accepted the route',
      provider: 'multi-llm-router',
      retryable: false,
    };
    return aiErr(fallbackErr);
  }

  return { pick, complete };
}

/**
 * Apply cost/latency overrides to the base chain. This is deterministic —
 * we only re-order, never add providers not already in the chain.
 */
function applyBudgets(base: string[], hints: RouteHints): string[] {
  if (hints.costBudget === 'cheap') {
    return dedupe([
      ...base.filter((p) => p === 'deepseek'),
      ...base.filter((p) => p === 'openai'),
      ...base.filter((p) => p !== 'deepseek' && p !== 'openai'),
    ]);
  }
  if (hints.costBudget === 'premium') {
    return dedupe([
      ...base.filter((p) => p === 'anthropic'),
      ...base.filter((p) => p !== 'anthropic'),
    ]);
  }
  if (hints.latencyBudget === 'fast') {
    // Prefer whichever chain-head is a fast provider (openai / anthropic haiku).
    return dedupe([
      ...base.filter((p) => p === 'openai' || p === 'anthropic'),
      ...base.filter((p) => p === 'deepseek'),
    ]);
  }
  return [...base];
}

function dedupe(xs: string[]): string[] {
  return Array.from(new Set(xs));
}

function estimateMicroCost(
  reg: ProviderRegistration,
  model: string,
  usage: { promptTokens: number; completionTokens: number }
): number {
  const price = reg.pricing?.[model];
  if (!price) return 0;
  const promptUsd = (usage.promptTokens / 1000) * price.promptPer1k;
  const completionUsd =
    (usage.completionTokens / 1000) * price.completionPer1k;
  return Math.max(0, Math.round((promptUsd + completionUsd) * 1_000_000));
}

async function recordLedger(
  ledger: CostLedger,
  ctx: MultiLLMContext,
  providerId: string,
  model: string,
  inputTokens: number,
  outputTokens: number
): Promise<void> {
  try {
    await ledger.recordUsage({
      tenantId: ctx.tenantId,
      provider: providerId,
      model,
      inputTokens,
      outputTokens,
      costUsdMicro: 0,
      operation: ctx.operation,
      correlationId: ctx.correlationId,
    });
  } catch {
    // swallow; accounting failure must not bubble up
  }
}
