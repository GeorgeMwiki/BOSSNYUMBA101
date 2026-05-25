/**
 * @bossnyumba/brain-llm-router — Phase N-C top-level exports.
 *
 * The LLM-as-Soul brain layer. Models are interchangeable; this package
 * owns accuracy via DSPy compile + Self-Consistency vote + CoVe verify +
 * provider fallback + cost cascade.
 *
 * Single entry point: `brainCall({task, prompt, tenantId, options?}, ctx)`.
 */

export * from './types.js';

// Universal client
export {
  AnthropicAdapter,
  OpenAIAdapter,
  GoogleAdapter,
  OllamaAdapter,
  VLLMAdapter,
} from './universal-client/index.js';

// Task ladder
export {
  TASK_LADDER,
  ALL_TASK_KINDS,
  resolveLadder,
  selectAtDepth,
} from './task-ladder/index.js';
export type { TenantLadderMap, TenantLadderOverride } from './task-ladder/index.js';

// Provider fallback
export {
  CircuitBreaker,
  exponentialBackoffMs,
  runFallback,
} from './provider-fallback/index.js';
export type {
  FallbackAttempt,
  FallbackResult,
  FallbackConfig,
  ProviderLadderEntry,
} from './provider-fallback/index.js';

// Cost cascade
export { runCascade, computeCost, getPricing, MODEL_PRICING, normaliseModel } from './cost-cascade/index.js';
export type { CascadeStep, CascadeConfig, CascadeResult, EvalFn } from './cost-cascade/index.js';

// DSPy compile
export {
  defineSignature,
  hashSignature,
  compileSignature,
  formatSystem,
  PromptCache,
  PromptCacheMissError,
  InMemoryCacheStore,
  normaliseModelKey,
} from './dspy-compile/index.js';
export type {
  Signature,
  SignatureField,
  FewShotExample,
  CompiledPrompt,
  CompileOptions,
  CacheReader,
  CacheWriter,
} from './dspy-compile/index.js';

// Hedged requests
export { hedgedInvoke } from './hedged-requests/index.js';
export type { HedgedInvokeConfig, HedgedResult } from './hedged-requests/index.js';

// Prompt portability
export {
  renderXml,
  renderForProvider,
  parseXml,
  lintPortability,
  semanticSimilarity,
  ALL_XML_SECTIONS,
} from './prompt-portability/index.js';
export type { XmlPrompt } from './prompt-portability/index.js';

// Cost cap
export { preflightCostCheck, postflightCharge, InMemorySpendLedger } from './cost-cap/index.js';
export type {
  CostCapConfig,
  CostCapEvent,
  SpendLedger,
  TenantBudget,
  TenantBudgetReader,
  TenantKillSwitch,
} from './cost-cap/index.js';

// Eval-drift logger
export {
  fnv1a,
  logDrift,
  passRate,
  regressionTriggered,
  InMemoryEvalDriftSink,
} from './eval-drift-logger/index.js';
export type {
  EvalDriftEvent,
  EvalDriftSink,
  LogDriftArgs,
  PassRateWindow,
} from './eval-drift-logger/index.js';

// Brain-call orchestrator (THE entry point)
export {
  brainCall,
  projectCallCost,
  majorityVote,
  runCove,
} from './brain-call-orchestrator/index.js';
export type {
  BrainCallContext,
  BrainCallResult,
  ModelClientRegistry,
  VoteResult,
  CoveConfig,
  CoveResult,
} from './brain-call-orchestrator/index.js';
