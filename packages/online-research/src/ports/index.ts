/**
 * @bossnyumba/online-research — runtime ports.
 *
 * Every side-effect in this package goes through a port defined here.
 * Callers wire concrete adapters that translate to the actual K-A
 * defer hook, K-B receipt store, K-C subagent runner, and K-F
 * budget monitor.
 *
 * The package ships in-memory adapters for tests + dev so the rest
 * of BOSSNYUMBA can integrate against stable contracts before the
 * K-* packages merge into main.
 */

import type {
  SearchHits,
  SearchDepth,
  Freshness,
  BrowserTask,
  BrowserTaskResult,
  WorkerOutput,
  SubQuestion,
  DurableFlowRun,
  Result,
} from '../types/index.js';

// ─────────────────────────────────────────────────────────────────────
// SearchProviderPort — one per provider (Tavily, Exa, Anthropic web).
// The aggregator parallel-fans-out and merges the results.
// ─────────────────────────────────────────────────────────────────────

export interface SearchProviderPort {
  readonly name: 'tavily' | 'exa' | 'anthropic';
  readonly search: (input: SearchProviderInput) => Promise<SearchHits>;
  /**
   * `/research`-class deep call. Only Tavily supports this natively;
   * Exa and Anthropic providers SHOULD return `kind: 'unsupported'`
   * in that case so the aggregator falls back to standard search.
   */
  readonly deepResearch?: (input: SearchProviderInput) => Promise<DeepResearchResult>;
}

export interface SearchProviderInput {
  readonly query: string;
  readonly depth: SearchDepth;
  readonly freshness: Freshness;
  /** Max hits to return. Provider clamps to its own cap. */
  readonly maxHits: number;
  /** Optional domain restrictor (e.g. `kra.go.ke`). */
  readonly includeDomains?: ReadonlyArray<string>;
  /** Optional domain blocklist. */
  readonly excludeDomains?: ReadonlyArray<string>;
}

export interface DeepResearchResult {
  readonly kind: 'ok';
  readonly hits: SearchHits;
  readonly synthesized: string;
}

// ─────────────────────────────────────────────────────────────────────
// SubAgentRunnerPort — K-C subagent isolation contract.
//
// Mirrors `@bossnyumba/skill-library/subagent-spawn` so the M-D
// orchestrator can use the same isolation guarantees the rest of
// the brain already relies on.
// ─────────────────────────────────────────────────────────────────────

export interface SubAgentRunnerPort {
  readonly spawnSubAgent: <TOutput = unknown>(
    spec: SubAgentSpec,
    input: SubAgentInput,
  ) => Promise<SubAgentResult<TOutput>>;
}

export interface SubAgentSpec {
  readonly name: string;
  readonly description: string;
  readonly allowed_tools: ReadonlyArray<string>;
  readonly system_prompt: string;
  readonly max_turns: number;
  /** TRUE always — the contract requires fresh context. We throw on false. */
  readonly isolated_context: true;
  readonly model?: 'haiku' | 'sonnet' | 'opus' | 'inherit';
  readonly effort?: 'low' | 'medium' | 'high';
  readonly worktree_isolation?: {
    readonly branch: string;
    readonly base_ref: string;
    readonly path: string;
    readonly cleanup_on_exit: boolean;
  };
}

export interface SubAgentInput<TStructured = unknown> {
  readonly prompt: string;
  readonly structured_input?: TStructured;
  readonly correlation_id: string;
}

export interface SubAgentResult<TOutput = unknown> {
  readonly name: string;
  readonly status: 'ok' | 'error' | 'budget_exceeded' | 'turn_limit';
  readonly output: TOutput;
  readonly turns_used: number;
  readonly cost_usd: number;
  readonly correlation_id: string;
  readonly error?: { readonly code: string; readonly message: string };
}

// ─────────────────────────────────────────────────────────────────────
// BudgetMonitorPort — K-F budget cap.
// ─────────────────────────────────────────────────────────────────────

export interface BudgetMonitorPort {
  /**
   * Pre-flight check. Returns approval verdict for an estimated
   * spend. Caller MUST honour `denied` verdicts (do not proceed).
   */
  readonly preflight: (input: BudgetPreflightInput) => Promise<BudgetVerdict>;
  /**
   * Post-flight record. Called after spend is committed so the
   * monitor can update its rolling tally.
   */
  readonly record: (input: BudgetRecordInput) => Promise<void>;
}

export interface BudgetPreflightInput {
  readonly tenantId: string;
  readonly conversationId: string;
  readonly description: string;
  readonly estimatedCostUsd: number;
  /** Wall-time the action will take, in seconds. */
  readonly estimatedSeconds: number;
  /** Action receives a budget-preview-card requiring user approval? */
  readonly requiresApproval: boolean;
}

export type BudgetVerdict =
  | { readonly kind: 'allowed'; readonly remainingUsd: number }
  | { readonly kind: 'approval_required'; readonly remainingUsd: number; readonly previewToken: string }
  | { readonly kind: 'denied'; readonly reason: 'tenant_cap' | 'conversation_cap' | 'rejected' };

export interface BudgetRecordInput {
  readonly tenantId: string;
  readonly conversationId: string;
  readonly actualCostUsd: number;
  readonly description: string;
}

// ─────────────────────────────────────────────────────────────────────
// DeferHookPort — K-A defer hook surface.
//
// `requestDefer` returns a resumeToken the caller persists alongside
// the paused state. When the external event lands, the caller
// invokes the orchestrator again with that resumeToken to continue.
// ─────────────────────────────────────────────────────────────────────

export interface DeferHookPort {
  readonly requestDefer: (input: DeferRequest) => Promise<DeferResponse>;
  readonly resume: (token: string) => Promise<DeferResumePayload | null>;
}

export interface DeferRequest {
  readonly tenantId: string;
  readonly correlationId: string;
  readonly reason: string;
  /** When set, the orchestrator wakes itself after this many ms. */
  readonly resumeAfterMs?: number;
  /** Opaque blob persisted with the defer; returned on resume. */
  readonly payload: unknown;
}

export interface DeferResponse {
  readonly resumeToken: string;
  readonly scheduledWakeAt?: string;
}

export interface DeferResumePayload {
  readonly tenantId: string;
  readonly correlationId: string;
  readonly payload: unknown;
  readonly approvedBy?: string;
  readonly approvedAt?: string;
}

// ─────────────────────────────────────────────────────────────────────
// ReceiptStorePort — K-B action receipts.
//
// Every research task emits a `research_session` entity captured by
// this port. The shape is intentionally narrower than the full K-B
// `ReceiptEntity` — research sessions are NOT mutations so they have
// no rollback. We just record them in the J1 entity-store under
// `type: 'research_session'`.
// ─────────────────────────────────────────────────────────────────────

export interface ReceiptStorePort {
  readonly recordResearchSession: (input: ResearchSessionEntity) => Promise<{ readonly id: string }>;
  readonly findResearchSession: (id: string) => Promise<ResearchSessionEntity | null>;
  readonly searchResearchSessions: (input: ResearchSessionSearch) => Promise<ReadonlyArray<ResearchSessionEntity>>;
}

export interface ResearchSessionEntity {
  readonly id: string;
  readonly type: 'research_session';
  readonly tenantId: string;
  readonly question: string;
  readonly subQuestions: ReadonlyArray<SubQuestion>;
  readonly sourcesFetched: ReadonlyArray<{ readonly url: string; readonly provider: string }>;
  readonly citations: ReadonlyArray<{ readonly url: string; readonly title: string }>;
  readonly costUsd: number;
  readonly elapsedMs: number;
  readonly startedAt: string;
  readonly endedAt: string;
  readonly initiatedBy: string;
  readonly status: 'completed' | 'partial' | 'failed';
  readonly tags: ReadonlyArray<string>;
}

export interface ResearchSessionSearch {
  readonly tenantId: string;
  /** Free-text match against `question` + `tags`. */
  readonly textQuery?: string;
  /** Restrict to sessions started after this ISO-8601 date. */
  readonly since?: string;
  /** Restrict to sessions started before this ISO-8601 date. */
  readonly until?: string;
  /** Max results. Default 20. */
  readonly limit?: number;
}

// ─────────────────────────────────────────────────────────────────────
// BrowserUseDriverPort — the thin layer over Playwright + Haiku that
// the cheap-loop fallback uses. Production implementations wrap the
// open-source `browser-use` package and pin to Haiku 4.5.
// ─────────────────────────────────────────────────────────────────────

export interface BrowserUseDriverPort {
  readonly runTask: (task: BrowserTask) => Promise<BrowserTaskResult>;
}

// ─────────────────────────────────────────────────────────────────────
// DurableEnginePort — Inngest AgentKit adapter.
//
// Production wraps `inngest`'s `step.run`, `step.sleep`, and
// `step.waitForEvent`. The in-memory adapter (for tests) drives the
// same control flow without the queue.
// ─────────────────────────────────────────────────────────────────────

export interface DurableEnginePort {
  /**
   * Register the flow definition with the durable engine.
   * Idempotent — calling twice with the same `{name, version}` is a
   * no-op.
   */
  readonly register: <TArgs>(definition: import('../types/index.js').DurableFlowDefinition<TArgs>) => Promise<void>;
  /** Start a new run for a registered flow. */
  readonly invoke: <TArgs>(
    flowName: string,
    args: TArgs,
    opts: { readonly tenantId: string; readonly idempotencyKey: string },
  ) => Promise<DurableFlowRun>;
  /** Resume a paused run after an external event (approval, webhook). */
  readonly resume: (runId: string, payload: unknown) => Promise<DurableFlowRun>;
  /** Snapshot the current state of a run. */
  readonly snapshot: (runId: string) => Promise<DurableFlowRun | null>;
  /** For tests: simulate a crash mid-run. Production no-op. */
  readonly simulateCrash?: (runId: string) => Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────
// InputShieldPort — M-E will provide a richer shield, but Browser-Use
// has no native PI defense so we ship a basic regex-based fallback
// for the M-D milestone.
// ─────────────────────────────────────────────────────────────────────

export interface InputShieldPort {
  readonly scan: (text: string) => Promise<InputShieldVerdict>;
}

export type InputShieldVerdict =
  | { readonly kind: 'clean' }
  | { readonly kind: 'suspicious'; readonly matches: ReadonlyArray<string> }
  | { readonly kind: 'blocked'; readonly matches: ReadonlyArray<string>; readonly reason: string };

// ─────────────────────────────────────────────────────────────────────
// LLMOrchestratorPort — abstracts the lead + synthesizer LLM calls
// (Opus) so the orchestrator-worker is testable without burning
// Anthropic tokens in CI.
// ─────────────────────────────────────────────────────────────────────

export interface LLMOrchestratorPort {
  readonly plan: (input: PlannerInput) => Promise<PlannerOutput>;
  readonly synthesize: (input: SynthesizerInput) => Promise<SynthesizerOutput>;
}

export interface PlannerInput {
  readonly question: string;
  readonly depth: SearchDepth;
  readonly maxWorkers: number;
}

export interface PlannerOutput {
  readonly subQuestions: ReadonlyArray<SubQuestion>;
  readonly costUsd: number;
  readonly elapsedMs: number;
}

export interface SynthesizerInput {
  readonly question: string;
  readonly workerOutputs: ReadonlyArray<WorkerOutput>;
}

export interface SynthesizerOutput {
  readonly report: string;
  readonly citations: ReadonlyArray<{
    readonly url: string;
    readonly title: string;
    readonly snippet: string;
    readonly fromSubQuestion: string;
    readonly provider: 'tavily' | 'exa' | 'anthropic' | 'browser-use';
  }>;
  readonly costUsd: number;
  readonly elapsedMs: number;
}

// ─────────────────────────────────────────────────────────────────────
// Aggregated dep bundle for the orchestrator-worker. Consumers wire
// once and pass to `runResearchTask`.
// ─────────────────────────────────────────────────────────────────────

export interface OnlineResearchDeps {
  readonly subAgentRunner: SubAgentRunnerPort;
  readonly searchAggregator: { readonly searchUnified: (input: SearchProviderInput) => Promise<SearchHits> };
  readonly budgetMonitor: BudgetMonitorPort;
  readonly deferHook: DeferHookPort;
  readonly receiptStore: ReceiptStorePort;
  readonly llmOrchestrator: LLMOrchestratorPort;
  readonly clock: { readonly nowMs: () => number };
  readonly correlationIdGen: () => string;
}

// Re-export Result helpers for ergonomic imports.
export type { Result };
export {
  type SearchHits,
  type ResearchQuestion,
  type ResearchResult,
  type SubQuestion,
  type WorkerOutput,
  type BrowserTask,
  type BrowserTaskResult,
  type DurableFlowRun,
} from '../types/index.js';

// In-memory adapters (test + dev only).
export { createInMemoryBudgetMonitor, type InMemoryBudgetMonitorConfig } from './in-memory-budget.js';
export { createInMemoryDeferHook, type InMemoryDeferHookDeps } from './in-memory-defer.js';
export {
  createInMemorySubAgentRunner,
  type InMemorySubAgentRunnerConfig,
  type WorkerSimulator,
} from './in-memory-subagent.js';
export {
  createInMemoryLLMOrchestrator,
  type InMemoryLLMOrchestratorConfig,
} from './in-memory-llm.js';
