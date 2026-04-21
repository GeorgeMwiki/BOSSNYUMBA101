/**
 * AI Providers
 */

export * from './ai-provider.js';
export * from './anthropic.js';
export * from './advisor.js';
export * from './anthropic-client.js';

// Wave-26 Agent Z4 — public exports for the three previously-unwired AI
// brain utilities so the api-gateway composition root can import them
// without reaching into deep module paths.
export {
  buildMultiLLMRouter,
  buildMultiLLMRouterFromEnv,
  type BuildRouterOptions,
} from './router.js';

export {
  createMultiLLMRouter,
  DEFAULT_FALLBACK_CHAINS,
  type MultiLLMRouter,
  type MultiLLMRouterDeps,
  type MultiLLMContext,
  type RouteHints,
  type RouteDecision,
  type TaskType,
  type CostBudget,
  type LatencyBudget,
  type TenantTier,
  type ProviderRegistration,
} from './multi-llm-router.js';

export {
  withBudgetGuard,
  type BudgetGuardContext,
  type BudgetGuardOptions,
  type BudgetGuardedAnthropicClient,
  type PriceEstimator,
} from './budget-guard.js';
