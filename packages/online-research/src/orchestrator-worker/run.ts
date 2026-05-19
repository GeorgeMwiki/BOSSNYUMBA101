/**
 * `runResearchTask` — the orchestrator-worker entry point.
 *
 *   1. Lead (Opus) decomposes the question into 1-7 sub-questions.
 *   2. Workers (Sonnet × N) each tackle one sub-question via the K-C
 *      isolation contract — fresh context, tool allowlist, typed result.
 *   3. Synthesizer (Opus) merges worker outputs into a final report
 *      with inline citations.
 *
 * Budget cap is enforced by K-F: a preflight estimate is required;
 * deny verdicts abort the run; approval_required defers via K-A.
 *
 * Receipts: every completed (or failed) run writes a
 * `research_session` entity via K-B.
 *
 * Cost model (per L1 §4.2):
 *   - Single chat:    ~1x
 *   - Single research: ~4x
 *   - Multi-agent:    ~15x
 *
 * BOSSNYUMBA gates multi-agent runs behind explicit budget approval.
 */

import { type OnlineResearchDeps } from '../ports/index.js';
import type {
  ResearchQuestion,
  ResearchResult,
  SubQuestion,
  WorkerOutput,
} from '../types/index.js';
import { clampWorkerCount, suggestWorkerCount, toposortSubQuestions, validatePlan } from './decompose.js';
import { buildWorkerInput, buildWorkerSpec } from './worker-spec.js';

export interface RunResearchTaskInput extends ResearchQuestion {
  /** Conversation id flowing through budget + receipts. */
  readonly conversationId: string;
  /** Tenant id (overrides scope when explicit). */
  readonly tenantId: string;
  /** Initiator user id (for receipts). */
  readonly initiatedBy: string;
  /** Optional tags written to the research_session receipt. */
  readonly tags?: ReadonlyArray<string>;
}

const EST_LEAD_COST = 0.05; // USD - Opus 4.7 ~5k tokens for planning
const EST_SYNTH_COST = 0.15; // USD - Opus 4.7 ~10k for synthesis
const EST_WORKER_COST = 0.20; // USD per worker (Sonnet 4.6 with web search)

export async function runResearchTask(
  input: RunResearchTaskInput,
  deps: OnlineResearchDeps,
): Promise<ResearchResult> {
  const startedAtMs = deps.clock.nowMs();
  const correlationId = deps.correlationIdGen();
  const tags = input.tags ?? [];
  const maxWorkers = input.maxWorkers ?? clampWorkerCount(7, input.depth, input.maxWorkers);

  // ─── 1. Budget preflight ──────────────────────────────────────────
  const estimatedWorkers = suggestWorkerCount(input.question, input.depth);
  const estimatedCost =
    EST_LEAD_COST + EST_SYNTH_COST + estimatedWorkers * EST_WORKER_COST;

  const preflight = await deps.budgetMonitor.preflight({
    tenantId: input.tenantId,
    conversationId: input.conversationId,
    description: `Online research: ${truncate(input.question, 80)}`,
    estimatedCostUsd: estimatedCost,
    estimatedSeconds: estimatedSeconds(input.depth, estimatedWorkers),
    requiresApproval: input.depth === 'deep',
  });

  if (preflight.kind === 'denied') {
    return assembleFailed({
      input,
      correlationId,
      startedAtMs,
      deps,
      tags,
      reason: `Budget denied: ${preflight.reason}`,
    });
  }

  if (preflight.kind === 'approval_required') {
    // Caller is responsible for resuming after approval lands via K-A.
    // We persist a defer marker + bail with deadline_hit semantics so
    // the parent can re-enter on approval.
    await deps.deferHook.requestDefer({
      tenantId: input.tenantId,
      correlationId,
      reason: 'Research task requires budget approval',
      payload: input,
    });

    return assembleFailed({
      input,
      correlationId,
      startedAtMs,
      deps,
      tags,
      reason: `Deferred: awaiting budget approval (preview ${preflight.previewToken})`,
    });
  }

  // ─── 2. Lead — plan ───────────────────────────────────────────────
  const planStart = deps.clock.nowMs();
  const planResp = await deps.llmOrchestrator.plan({
    question: input.question,
    depth: input.depth,
    maxWorkers,
  });
  const planValidation = validatePlan(planResp.subQuestions, input.depth, maxWorkers);
  if (!planValidation.ok) {
    return assembleFailed({
      input,
      correlationId,
      startedAtMs,
      deps,
      tags,
      reason: `Planner produced invalid plan: ${planValidation.issues.join('; ')}`,
    });
  }

  const plan = planValidation.plan;
  const planMs = deps.clock.nowMs() - planStart;

  // ─── 3. Workers — execute waves in dependency order ───────────────
  const waves = toposortSubQuestions(plan);
  const outputs: WorkerOutput[] = [];
  let deadlineHit = false;

  for (const wave of waves) {
    const now = deps.clock.nowMs();
    if (now >= input.deadlineMs) {
      deadlineHit = true;
      // Emit synthetic deadline outputs for remaining wave items so the
      // synthesizer can still produce a partial report.
      for (const id of wave) {
        const sub = plan.find((s) => s.id === id);
        if (sub === undefined) {
          continue;
        }
        outputs.push({
          subQuestionId: id,
          summary: '',
          hits: [],
          costUsd: 0,
          elapsedMs: 0,
          status: 'deadline',
          error: { code: 'deadline_hit', message: 'Deadline reached before worker started' },
        });
      }
      continue;
    }

    const waveOutputs = await Promise.all(
      wave.map((id) => {
        const sub = plan.find((s) => s.id === id);
        if (sub === undefined) {
          throw new Error(`Toposort emitted unknown id ${id}`);
        }
        return runOneWorker({ sub, depth: input.depth, deps, correlationId, deadlineMs: input.deadlineMs });
      }),
    );
    for (const o of waveOutputs) {
      outputs.push(o);
    }
  }

  // ─── 4. Synthesizer — assemble report ─────────────────────────────
  const synthStart = deps.clock.nowMs();
  const synth = await deps.llmOrchestrator.synthesize({
    question: input.question,
    workerOutputs: outputs,
  });
  const synthMs = deps.clock.nowMs() - synthStart;

  const totalCostUsd =
    planResp.costUsd +
    outputs.reduce((acc, o) => acc + o.costUsd, 0) +
    synth.costUsd;
  const totalElapsedMs = deps.clock.nowMs() - startedAtMs;

  // ─── 5. Receipts — write research_session ────────────────────────
  const sourcesFetched = collectSources(outputs);
  const { id: receiptId } = await deps.receiptStore.recordResearchSession({
    id: correlationId,
    type: 'research_session',
    tenantId: input.tenantId,
    question: input.question,
    subQuestions: plan,
    sourcesFetched,
    citations: synth.citations.map((c) => ({ url: c.url, title: c.title })),
    costUsd: totalCostUsd,
    elapsedMs: totalElapsedMs,
    startedAt: new Date(startedAtMs).toISOString(),
    endedAt: new Date(deps.clock.nowMs()).toISOString(),
    initiatedBy: input.initiatedBy,
    status: deadlineHit ? 'partial' : 'completed',
    tags,
  });

  // ─── 6. Budget record (post-flight) ──────────────────────────────
  await deps.budgetMonitor.record({
    tenantId: input.tenantId,
    conversationId: input.conversationId,
    actualCostUsd: totalCostUsd,
    description: `Online research: ${truncate(input.question, 80)}`,
  });

  // Side-channel timing markers as comments for tracing
  void planMs;
  void synthMs;

  return Object.freeze({
    question: input.question,
    plan,
    report: synth.report,
    citations: Object.freeze([...synth.citations]),
    workerOutputs: Object.freeze([...outputs]),
    costUsd: totalCostUsd,
    elapsedMs: totalElapsedMs,
    deadlineHit,
    receiptId,
  });
}

async function runOneWorker(args: {
  readonly sub: SubQuestion;
  readonly depth: 'quick' | 'standard' | 'deep';
  readonly deps: OnlineResearchDeps;
  readonly correlationId: string;
  readonly deadlineMs: number;
}): Promise<WorkerOutput> {
  const { sub, depth, deps, correlationId, deadlineMs } = args;
  const workerStart = deps.clock.nowMs();

  const spec = buildWorkerSpec({ subQuestion: sub, depth });
  const workerInput = buildWorkerInput({
    subQuestion: sub,
    correlationId: `${correlationId}:${sub.id}`,
  });

  try {
    const result = await deps.subAgentRunner.spawnSubAgent<{
      readonly summary: string;
      readonly hits: ReadonlyArray<import('../types/index.js').SearchHit>;
    }>(spec, workerInput);

    // Wall-clock check — if we crossed the deadline mid-worker, surface
    // it so the synthesizer downgrades the contribution.
    const elapsedMs = deps.clock.nowMs() - workerStart;
    const hitDeadline = deps.clock.nowMs() > deadlineMs;

    if (result.status !== 'ok') {
      return Object.freeze({
        subQuestionId: sub.id,
        summary: '',
        hits: [],
        costUsd: result.cost_usd,
        elapsedMs,
        status: result.status,
        ...(result.error ? { error: result.error } : {}),
      });
    }

    return Object.freeze({
      subQuestionId: sub.id,
      summary: result.output.summary,
      hits: Object.freeze([...result.output.hits]),
      costUsd: result.cost_usd,
      elapsedMs,
      status: hitDeadline ? 'deadline' : 'ok',
      ...(hitDeadline
        ? { error: { code: 'deadline_hit', message: 'Worker exceeded deadline' } }
        : {}),
    });
  } catch (e) {
    const elapsedMs = deps.clock.nowMs() - workerStart;
    return Object.freeze({
      subQuestionId: sub.id,
      summary: '',
      hits: [],
      costUsd: 0,
      elapsedMs,
      status: 'error',
      error: { code: 'worker_threw', message: (e as Error).message },
    });
  }
}

function collectSources(
  outputs: ReadonlyArray<WorkerOutput>,
): ReadonlyArray<{ readonly url: string; readonly provider: string }> {
  const seen = new Set<string>();
  const result: Array<{ readonly url: string; readonly provider: string }> = [];
  for (const o of outputs) {
    for (const h of o.hits) {
      if (seen.has(h.url)) {
        continue;
      }
      seen.add(h.url);
      result.push({ url: h.url, provider: h.provider });
    }
  }
  return Object.freeze(result);
}

function truncate(s: string, n: number): string {
  if (s.length <= n) {
    return s;
  }
  return `${s.slice(0, n - 1)}…`;
}

function estimatedSeconds(
  depth: 'quick' | 'standard' | 'deep',
  workers: number,
): number {
  const baseLead = 8;
  const baseSynth = 12;
  const perWorker = depth === 'deep' ? 45 : depth === 'standard' ? 25 : 12;
  // Workers run in parallel — wall-time is max not sum.
  return baseLead + perWorker + baseSynth + Math.ceil(workers / 4);
}

async function assembleFailed(args: {
  readonly input: RunResearchTaskInput;
  readonly correlationId: string;
  readonly startedAtMs: number;
  readonly deps: OnlineResearchDeps;
  readonly tags: ReadonlyArray<string>;
  readonly reason: string;
}): Promise<ResearchResult> {
  const { input, correlationId, startedAtMs, deps, tags, reason } = args;
  const endedAtMs = deps.clock.nowMs();
  const { id: receiptId } = await deps.receiptStore.recordResearchSession({
    id: correlationId,
    type: 'research_session',
    tenantId: input.tenantId,
    question: input.question,
    subQuestions: [],
    sourcesFetched: [],
    citations: [],
    costUsd: 0,
    elapsedMs: endedAtMs - startedAtMs,
    startedAt: new Date(startedAtMs).toISOString(),
    endedAt: new Date(endedAtMs).toISOString(),
    initiatedBy: input.initiatedBy,
    status: 'failed',
    tags,
  });

  return Object.freeze({
    question: input.question,
    plan: [],
    report: reason,
    citations: [],
    workerOutputs: [],
    costUsd: 0,
    elapsedMs: endedAtMs - startedAtMs,
    deadlineHit: false,
    receiptId,
  });
}
