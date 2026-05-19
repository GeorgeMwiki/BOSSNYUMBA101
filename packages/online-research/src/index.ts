/**
 * @bossnyumba/online-research — public surface.
 *
 * Phase M-D — online research subagent + durable execution.
 *
 * Closes:
 *
 *   L1 #10 — Anthropic Multi-Agent Research orchestrator-worker.
 *            Lead Opus + parallel Sonnet workers; +90.2% on internal
 *            research eval at ~15x token cost.
 *
 *   L2 #6  — Web search + web fetch + code execution composition.
 *
 *   L2 #8  — Inngest AgentKit durable execution (preferred over
 *            Temporal per L2 §8.2).
 *
 *   L2 #12 — Browser-Use OSS cheap-loop fallback driven by Haiku 4.5
 *            for headless extraction. No PI defense ships natively;
 *            we wrap with a regex shield (M-E supersedes).
 *
 *   L2 #13 — Tavily `/research` deep-research endpoint.
 *
 *   L2 #14 — Exa Neural semantic search.
 *
 * Typical composition:
 *
 *     import {
 *       runResearchTask,
 *       createSearchAggregator,
 *       createInMemoryReceiptStore,
 *       createInMemoryBudgetMonitor,
 *       createInMemoryDeferHook,
 *       createInMemorySubAgentRunner,
 *       createInMemoryLLMOrchestrator,
 *     } from '@bossnyumba/online-research';
 *
 *     const result = await runResearchTask({...}, {
 *       subAgentRunner,
 *       searchAggregator,
 *       budgetMonitor,
 *       deferHook,
 *       receiptStore,
 *       llmOrchestrator,
 *       clock: { nowMs: () => Date.now() },
 *       correlationIdGen: randomUUID,
 *     });
 */

// ─────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────
export * from './types/index.js';

// ─────────────────────────────────────────────────────────────────────
// Ports + in-memory adapters
// ─────────────────────────────────────────────────────────────────────
export * from './ports/index.js';

// ─────────────────────────────────────────────────────────────────────
// Orchestrator-worker
// ─────────────────────────────────────────────────────────────────────
export {
  runResearchTask,
  type RunResearchTaskInput,
} from './orchestrator-worker/run.js';
export {
  clampWorkerCount,
  suggestWorkerCount,
  toposortSubQuestions,
  validatePlan,
} from './orchestrator-worker/decompose.js';
export {
  buildWorkerSpec,
  buildWorkerInput,
} from './orchestrator-worker/worker-spec.js';

// ─────────────────────────────────────────────────────────────────────
// Search aggregator
// ─────────────────────────────────────────────────────────────────────
export {
  createSearchAggregator,
  type SearchAggregator,
  type SearchAggregatorDeps,
} from './search-aggregator/aggregator.js';
export { dedupeHits, type DedupeResult } from './search-aggregator/dedupe.js';
export { normaliseUrl } from './search-aggregator/url-normalise.js';
export {
  createInMemoryProvider,
  type InMemoryProviderConfig,
  type InMemoryCatalogEntry,
} from './search-aggregator/in-memory-provider.js';

// ─────────────────────────────────────────────────────────────────────
// Browser-Use fallback
// ─────────────────────────────────────────────────────────────────────
export {
  createSafeBrowserUseDriver,
  type SafeBrowserUseDeps,
} from './browser-use-fallback/safety-wrap.js';
export {
  createRegexInputShield,
  createNoopInputShield,
} from './browser-use-fallback/input-shield.js';
export {
  createInMemoryBrowserDriver,
  type InMemoryBrowserDriverConfig,
  type InMemoryBrowserScript,
} from './browser-use-fallback/in-memory-driver.js';

// ─────────────────────────────────────────────────────────────────────
// Durable execution
// ─────────────────────────────────────────────────────────────────────
export { defineDurableFlow } from './durable/define.js';
export {
  createInMemoryDurableEngine,
  type InMemoryDurableEngineDeps,
} from './durable/in-memory-engine.js';
export {
  buildLeaseRenewalFlow,
  buildEvictionFlow,
  buildKraFilingFlow,
  buildOnboardingFlow,
  type LeaseRenewalArgs,
  type EvictionArgs,
  type KraArgs,
  type OnboardingArgs,
  type FlowCallbacks,
} from './durable/flows.js';

// ─────────────────────────────────────────────────────────────────────
// Receipts
// ─────────────────────────────────────────────────────────────────────
export { createInMemoryReceiptStore } from './receipts/in-memory-store.js';
