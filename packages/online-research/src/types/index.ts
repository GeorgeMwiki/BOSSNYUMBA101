/**
 * @bossnyumba/online-research — shared type vocabulary.
 *
 * Phase M-D closes:
 *
 *   L1 #10 — Anthropic Multi-Agent Research orchestrator-worker
 *            (lead Opus + parallel Sonnet workers; +90.2% on internal
 *            research eval at ~15x token cost vs single agent).
 *
 *   L2 #6  — Web Search + Web Fetch + Code Execution composition
 *            (Anthropic code execution is FREE when paired with web
 *            search/fetch).
 *
 *   L2 #8  — Inngest AgentKit durable execution (preferred over Temporal
 *            for TS-native projects per L2 §8.2).
 *
 *   L2 #12 — Browser-Use OSS cheap-loop fallback (89.1% WebVoyager;
 *            Haiku 4.5-driven Playwright extraction; no PI defense
 *            so wrap with our own input shield).
 *
 *   L2 #13 — Tavily `/research` deep-research endpoint.
 *
 *   L2 #14 — Exa Neural semantic search.
 *
 * Everything in this file is TYPES ONLY — no runtime, no side-effects.
 * Runtime ports live in `../ports/`. Wiring lives in subpackage
 * `index.ts` files.
 */

import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────
// Scope — propagated from `@bossnyumba/central-intelligence` so a
// `ScopeContext` from anywhere in the brain is directly assignable
// here. We re-declare locally to avoid a peer-dep cycle; structurally
// identical.
// ─────────────────────────────────────────────────────────────────────

export type ScopeContext =
  | {
      readonly kind: 'tenant';
      readonly tenantId: string;
      readonly actorUserId: string;
      readonly roles: ReadonlyArray<string>;
      readonly personaId: string;
    }
  | {
      readonly kind: 'platform';
      readonly actorUserId: string;
      readonly roles: ReadonlyArray<string>;
      readonly personaId: string;
    };

export const ScopeContextSchema: z.ZodType<ScopeContext> = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('tenant'),
    tenantId: z.string().min(1),
    actorUserId: z.string().min(1),
    roles: z.array(z.string()).readonly(),
    personaId: z.string().min(1),
  }),
  z.object({
    kind: z.literal('platform'),
    actorUserId: z.string().min(1),
    roles: z.array(z.string()).readonly(),
    personaId: z.string().min(1),
  }),
]);

// ─────────────────────────────────────────────────────────────────────
// Depth + freshness — common search knobs that all aggregator
// providers share.
// ─────────────────────────────────────────────────────────────────────

/**
 * `quick` = single-shot keyword. `standard` = multi-source dedupe +
 * synthesis. `deep` = Tavily /research-class call OR multi-agent
 * orchestration. We map each onto provider-native parameters at
 * runtime.
 */
export type SearchDepth = 'quick' | 'standard' | 'deep';

/**
 * `any` = no time bound. `day` / `week` / `month` / `year` = restrict
 * to documents within the window. `live` = require sources published
 * in the last 24h (news monitoring use-case).
 */
export type Freshness = 'any' | 'day' | 'week' | 'month' | 'year' | 'live';

// ─────────────────────────────────────────────────────────────────────
// SearchHit — a single result from any provider after normalisation.
// All three providers (Tavily, Exa, Anthropic web search) flow through
// this shape so dedupe + ranking can be provider-agnostic.
// ─────────────────────────────────────────────────────────────────────

export interface SearchHit {
  /** Canonical absolute URL of the source. Used as the dedup key. */
  readonly url: string;
  /** Page or article title. */
  readonly title: string;
  /** 0-512 char snippet for ranking + UI preview. */
  readonly snippet: string;
  /** ISO-8601 publication or last-modified date when available. */
  readonly publishedAt?: string;
  /** Provider that returned this hit. */
  readonly provider: 'tavily' | 'exa' | 'anthropic' | 'browser-use';
  /** Provider-native relevance score in [0, 1]. */
  readonly score: number;
  /** Optional full extracted text — only present for /research-class. */
  readonly fullText?: string;
  /** Provider-specific raw payload, kept opaque so callers may inspect. */
  readonly raw?: unknown;
}

export const SearchHitSchema = z.object({
  url: z.string().url(),
  title: z.string(),
  snippet: z.string().max(2048),
  publishedAt: z.string().optional(),
  provider: z.enum(['tavily', 'exa', 'anthropic', 'browser-use']),
  score: z.number().min(0).max(1),
  fullText: z.string().optional(),
  raw: z.unknown().optional(),
});

export interface SearchHits {
  readonly hits: ReadonlyArray<SearchHit>;
  /** Wall-clock ms spent across all providers (parallel max). */
  readonly elapsedMs: number;
  /** Per-provider counts pre-dedupe, for observability. */
  readonly providerCounts: Readonly<Record<string, number>>;
  /** How many duplicates were collapsed during dedupe. */
  readonly duplicatesCollapsed: number;
  /** Approximate USD cost of the aggregator call. */
  readonly costUsd: number;
}

// ─────────────────────────────────────────────────────────────────────
// ResearchQuestion + Sub-question — orchestrator-worker decomposition.
// ─────────────────────────────────────────────────────────────────────

export interface ResearchQuestion {
  /** The user's original question, verbatim. */
  readonly question: string;
  /** Depth knob — drives planner branching and budget. */
  readonly depth: SearchDepth;
  /**
   * Hard deadline (ms-since-epoch). Orchestrator returns whatever it
   * has by this time, even if some workers haven't finished.
   */
  readonly deadlineMs: number;
  /** Optional scope hint (kept on tenant for compliance). */
  readonly scope?: ScopeContext;
  /**
   * Maximum number of workers the planner may fan out to. Default 5.
   * The L1 §6 #10 audit cites 3-7 as the sweet spot.
   */
  readonly maxWorkers?: number;
}

export const ResearchQuestionSchema = z.object({
  question: z.string().min(3),
  depth: z.enum(['quick', 'standard', 'deep']),
  deadlineMs: z.number().int().positive(),
  scope: ScopeContextSchema.optional(),
  maxWorkers: z.number().int().min(1).max(10).optional(),
});

/**
 * A single sub-question the planner emits.
 *
 * `dependsOn` lets the planner express dependencies — workers may
 * run in waves (we run dependency-free ones in parallel, then the
 * ones that depend on them in the next wave).
 */
export interface SubQuestion {
  readonly id: string;
  readonly question: string;
  readonly rationale: string;
  /** Which providers should this worker prefer. */
  readonly preferredProviders: ReadonlyArray<'tavily' | 'exa' | 'anthropic' | 'browser-use'>;
  /** IDs of other sub-questions this one depends on. */
  readonly dependsOn: ReadonlyArray<string>;
}

export const SubQuestionSchema = z.object({
  id: z.string().min(1),
  question: z.string().min(3),
  rationale: z.string(),
  preferredProviders: z.array(z.enum(['tavily', 'exa', 'anthropic', 'browser-use'])).readonly(),
  dependsOn: z.array(z.string()).readonly(),
});

// ─────────────────────────────────────────────────────────────────────
// Citation — every textual claim in a synthesized report carries one
// or more. Schema matches `@bossnyumba/central-intelligence`'s
// citation shape so the UI can render them with the existing renderer.
// ─────────────────────────────────────────────────────────────────────

export interface Citation {
  readonly url: string;
  readonly title: string;
  readonly snippet: string;
  /** Sub-question that produced this citation. */
  readonly fromSubQuestion: string;
  readonly provider: 'tavily' | 'exa' | 'anthropic' | 'browser-use';
}

// ─────────────────────────────────────────────────────────────────────
// ResearchResult — what the orchestrator returns to the caller.
// ─────────────────────────────────────────────────────────────────────

export interface ResearchResult {
  readonly question: string;
  /** The plan the lead produced — emitted for explainability. */
  readonly plan: ReadonlyArray<SubQuestion>;
  /** Final synthesized report from the synthesizer (Opus). */
  readonly report: string;
  /** Sources cited inline in `report`, in citation order. */
  readonly citations: ReadonlyArray<Citation>;
  /** Per-worker raw outputs (typed; no raw transcripts leak). */
  readonly workerOutputs: ReadonlyArray<WorkerOutput>;
  /** Total USD across plan + all workers + synthesis. */
  readonly costUsd: number;
  /** Wall-clock ms total. */
  readonly elapsedMs: number;
  /** Whether the deadline interrupted some workers. */
  readonly deadlineHit: boolean;
  /** J1 receipt id (when receipts are wired). */
  readonly receiptId?: string;
}

export interface WorkerOutput {
  readonly subQuestionId: string;
  readonly summary: string;
  readonly hits: ReadonlyArray<SearchHit>;
  readonly costUsd: number;
  readonly elapsedMs: number;
  readonly status: 'ok' | 'error' | 'budget_exceeded' | 'turn_limit' | 'deadline';
  readonly error?: { readonly code: string; readonly message: string };
}

// ─────────────────────────────────────────────────────────────────────
// Browser-Use task — for the cheap-loop fallback.
// ─────────────────────────────────────────────────────────────────────

export interface BrowserTask {
  readonly id: string;
  /** Plain-English task description, e.g. "Find current 2-bed rent on Booking.com for Westlands, Nairobi". */
  readonly description: string;
  /** Allowlist of URLs the headless browser may navigate to. */
  readonly allowedHosts: ReadonlyArray<string>;
  /** Hard timeout in ms. */
  readonly timeoutMs: number;
  /** Maximum LLM steps. Default 20. */
  readonly maxSteps?: number;
  /**
   * Input-shield mode. M-E will provide a richer port; the local
   * default applies a built-in regex shield for the most common
   * injection patterns.
   */
  readonly inputShield?: 'none' | 'regex' | 'm-e';
}

export interface BrowserTaskResult {
  readonly taskId: string;
  readonly status: 'ok' | 'timeout' | 'denied' | 'injection_blocked' | 'error';
  readonly extracted: ReadonlyArray<Readonly<Record<string, string | number | boolean>>>;
  readonly screenshotPaths: ReadonlyArray<string>;
  readonly stepsUsed: number;
  readonly elapsedMs: number;
  readonly costUsd: number;
  readonly error?: { readonly code: string; readonly message: string };
}

// ─────────────────────────────────────────────────────────────────────
// Durable flow — Inngest AgentKit-style step definitions.
// ─────────────────────────────────────────────────────────────────────

/**
 * A single step in a durable flow. `idempotencyKey` MUST be unique
 * within the flow run — Inngest uses it to detect replays.
 */
export interface DurableStep<TInput = unknown, TOutput = unknown> {
  readonly name: string;
  readonly idempotencyKey: string;
  /** Optional retry policy override. */
  readonly retries?: number;
  /** Optional max wall-time for the step in ms. */
  readonly timeoutMs?: number;
  /** Optional approval gate — if set, defers via K-A defer hook. */
  readonly requiresApproval?: {
    readonly approverRole: string;
    readonly description: string;
  };
  readonly run: (input: TInput, ctx: DurableStepContext) => Promise<TOutput>;
}

export interface DurableStepContext {
  readonly runId: string;
  readonly tenantId: string;
  readonly correlationId: string;
  /** Step index (0-based). */
  readonly stepIndex: number;
  /** Logger that flows into J1/observability. */
  readonly log: (msg: string, extra?: Readonly<Record<string, unknown>>) => void;
  /**
   * `sleep` — durable sleep that survives crashes. The wrapper
   * translates this into `step.sleep` on Inngest.
   */
  readonly sleep: (ms: number) => Promise<void>;
}

export interface DurableFlowDefinition<TArgs = unknown> {
  readonly name: string;
  readonly version: string;
  /** Max total wall-time across all steps. Default 60 days. */
  readonly maxRunHours?: number;
  /** Steps in deterministic order. */
  readonly steps: ReadonlyArray<DurableStep>;
  /** Initial args validation. */
  readonly argsSchema: z.ZodType<TArgs>;
}

export interface DurableFlowRun {
  readonly runId: string;
  readonly flowName: string;
  readonly version: string;
  readonly status: 'running' | 'completed' | 'failed' | 'paused' | 'cancelled';
  readonly startedAt: string;
  readonly endedAt?: string;
  /** Per-step status snapshots. */
  readonly steps: ReadonlyArray<DurableStepSnapshot>;
  /** Final output once status === 'completed'. */
  readonly output?: unknown;
  readonly error?: { readonly code: string; readonly message: string };
}

export interface DurableStepSnapshot {
  readonly name: string;
  readonly status: 'pending' | 'running' | 'completed' | 'failed' | 'awaiting_approval';
  readonly attempts: number;
  readonly startedAt?: string;
  readonly endedAt?: string;
  /** Resume token when status === 'awaiting_approval' (from K-A defer). */
  readonly resumeToken?: string;
}

// ─────────────────────────────────────────────────────────────────────
// Result — small Result ADT used by ports that may fail without
// throwing. Same shape as `@bossnyumba/agent-surface` so the two
// compose cleanly.
// ─────────────────────────────────────────────────────────────────────

export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}
