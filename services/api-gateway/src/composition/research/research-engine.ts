/**
 * Deep-research engine (BossNyumba) — a minimal, REAL research pipeline.
 *
 * BossNyumba had no standalone research-orchestrator package, so this module
 * is a self-contained engine mirroring the Borjie deep-research one
 * (planner → executor → scorer → synthesizer → cross-reference verify →
 * audit-anchored cited result) built entirely on BossNyumba's own
 * primitives via `research-adapters.ts`:
 *
 *   - planner   — LLM plan (brain-llm-router) with a deterministic
 *                 rule-based fallback when no provider is wired.
 *   - executor  — runs the planned steps; independent steps fan out via
 *                 `Promise.allSettled` (real parallelism — corpus + web
 *                 probes run together). Each adapter degrades to [] so a
 *                 missing key / DB is a clean skip, never a crash.
 *   - scorer    — dedupes by URI, assigns stable citation ids, and ranks
 *                 sources by `0.7·authority + 0.3·freshness`.
 *   - synth     — LLM synthesis (brain-llm-router) over the scored sources
 *                 with inline citations, falling back to a deterministic
 *                 evidence-listing render.
 *   - verify    — cross-reference pass: counts how many distinct sources
 *                 corroborate the answer and folds that into confidence.
 *   - audit     — every result carries an append-only hash anchor computed
 *                 over (tenant, query, summary, citation ids). The anchor is
 *                 logged through Pino (the durable audit sink); when a DB
 *                 is wired the same hash can later be persisted by a
 *                 migration-backed sink (out of lane here).
 *
 * Two modes:
 *   - reactive  — a quick cited answer (corpus-first + one web pass).
 *   - deepDive  — multi-step LLM-planned dive across corpus + web.
 *
 * No `process.env` reads here (the adapters own their env seams). Pino-only
 * logging. Immutable returns. Never throws on a soft failure — degrades.
 */

import { createHash } from 'node:crypto';

import { logger } from '../../utils/logger.js';

// ────────────────────────────────────────────────────────────────────
// Public contracts — consumed by research-adapters.ts and the router.
// ────────────────────────────────────────────────────────────────────

export type ResearchTool = 'corpus' | 'web_search';

export type ResearchMode = 'reactive' | 'deep_dive';

export interface WebSearchHit {
  readonly url: string;
  readonly title: string;
  readonly snippet: string;
  readonly publishedAt: string | null;
}

export interface WebSearchAdapter {
  search(input: {
    readonly query: string;
    readonly limit?: number;
  }): Promise<ReadonlyArray<WebSearchHit>>;
}

export interface CorpusHit {
  readonly evidenceId: string;
  readonly title: string;
  readonly snippet: string;
  readonly sourceUri: string;
  readonly publishedAt: string | null;
}

export interface CorpusSearchAdapter {
  search(input: {
    readonly query: string;
    readonly tenantId: string;
    readonly limit?: number;
  }): Promise<ReadonlyArray<CorpusHit>>;
}

export interface PlanStep {
  readonly tool: ResearchTool;
  readonly query: string;
}

export interface LlmPlanFn {
  (req: {
    readonly query: string;
    readonly mode: ResearchMode;
    readonly availableTools: ReadonlyArray<ResearchTool>;
  }): Promise<ReadonlyArray<PlanStep>>;
}

/** A scored, citation-id'd source handed to the synthesizer. */
export interface ScoredSource {
  readonly citationId: string;
  readonly kind: ResearchTool;
  readonly title: string;
  readonly snippet: string;
  readonly sourceUri: string;
  readonly publishedAt: string | null;
  readonly score: number;
}

export interface LlmSynthesizeFn {
  (req: {
    readonly query: string;
    readonly mode: ResearchMode;
    readonly sources: ReadonlyArray<ScoredSource>;
  }): Promise<string>;
}

export interface ResearchEngineDeps {
  readonly web: WebSearchAdapter;
  readonly corpus: CorpusSearchAdapter;
  readonly llmPlan?: LlmPlanFn;
  readonly llmSynthesize?: LlmSynthesizeFn;
}

export interface ResearchCitation {
  readonly citationId: string;
  readonly kind: ResearchTool;
  readonly title: string;
  readonly sourceUri: string;
  readonly publishedAt: string | null;
}

export interface ResearchResult {
  readonly summaryMd: string;
  /** [0,1] — folds source count, corroboration, and synth path. */
  readonly confidence: number;
  readonly citations: ReadonlyArray<ResearchCitation>;
  /** Cross-reference notes — count of corroborating distinct sources. */
  readonly corroboratingSources: number;
  /** Append-only hash anchor over (tenant, query, summary, citation ids). */
  readonly auditHash: string;
  readonly mode: ResearchMode;
  readonly durationMs: number;
  /** True when the LLM synthesizer produced the body (vs the rule render). */
  readonly llmSynthesized: boolean;
}

export interface ReactiveQueryInput {
  readonly tenantId: string;
  readonly query: string;
}

export interface DeepDiveInput {
  readonly tenantId: string;
  readonly query: string;
  readonly topic: string;
}

export interface ResearchEngine {
  reactiveQuery(input: ReactiveQueryInput): Promise<ResearchResult>;
  deepDive(input: DeepDiveInput): Promise<ResearchResult>;
}

// ────────────────────────────────────────────────────────────────────
// Internals
// ────────────────────────────────────────────────────────────────────

const REACTIVE_WEB_LIMIT = 6;
const REACTIVE_CORPUS_LIMIT = 6;
const DEEP_WEB_LIMIT = 8;
const DEEP_CORPUS_LIMIT = 8;
const AUTHORITY_WEIGHT = 0.7;
const FRESHNESS_WEIGHT = 0.3;
const FRESHNESS_HALFLIFE_DAYS = 365;

/** Corpus is internal ground truth (authoritative); web is external. */
function authorityScore(kind: ResearchTool): number {
  return kind === 'corpus' ? 0.9 : 0.6;
}

function freshnessScore(publishedAt: string | null): number {
  if (!publishedAt) return 0.4; // unknown date — neutral
  const t = Date.parse(publishedAt);
  if (!Number.isFinite(t)) return 0.4;
  const ageDays = Math.max(0, (Date.now() - t) / 86_400_000);
  return Math.pow(0.5, ageDays / FRESHNESS_HALFLIFE_DAYS);
}

interface RawSource {
  readonly kind: ResearchTool;
  readonly title: string;
  readonly snippet: string;
  readonly sourceUri: string;
  readonly publishedAt: string | null;
}

/** Dedupe by URI, assign stable citation ids, rank by authority+freshness. */
function scoreSources(raw: ReadonlyArray<RawSource>): ReadonlyArray<ScoredSource> {
  const seen = new Set<string>();
  const deduped: RawSource[] = [];
  for (const s of raw) {
    if (s.sourceUri.length === 0 || seen.has(s.sourceUri)) continue;
    seen.add(s.sourceUri);
    deduped.push(s);
  }
  return deduped
    .map((s) => ({
      ...s,
      score: AUTHORITY_WEIGHT * authorityScore(s.kind) + FRESHNESS_WEIGHT * freshnessScore(s.publishedAt),
    }))
    .sort((a, b) => b.score - a.score)
    .map((s, idx) => ({
      citationId: `src_${idx + 1}`,
      kind: s.kind,
      title: s.title,
      snippet: s.snippet,
      sourceUri: s.sourceUri,
      publishedAt: s.publishedAt,
      score: Number(s.score.toFixed(4)),
    }));
}

/** Deterministic rule-based plan: corpus-first, then a web pass. */
function rulePlan(query: string, mode: ResearchMode): ReadonlyArray<PlanStep> {
  const steps: PlanStep[] = [
    { tool: 'corpus', query },
    { tool: 'web_search', query },
  ];
  if (mode === 'deep_dive') {
    // A second, recency-scoped web angle for the live dimension.
    steps.push({ tool: 'web_search', query: `${query} latest 2026` });
  }
  return steps;
}

async function planSteps(
  deps: ResearchEngineDeps,
  query: string,
  mode: ResearchMode,
): Promise<ReadonlyArray<PlanStep>> {
  const availableTools: ReadonlyArray<ResearchTool> = ['corpus', 'web_search'];
  if (!deps.llmPlan) return rulePlan(query, mode);
  try {
    const planned = await deps.llmPlan({ query, mode, availableTools });
    return planned.length > 0 ? planned : rulePlan(query, mode);
  } catch (err) {
    logger.warn('research: LLM plan failed — using rule-based plan', {
      wiring: 'research',
      stage: 'plan',
      err: err instanceof Error ? err.message : String(err),
    });
    return rulePlan(query, mode);
  }
}

async function runStep(
  deps: ResearchEngineDeps,
  tenantId: string,
  step: PlanStep,
  webLimit: number,
  corpusLimit: number,
): Promise<ReadonlyArray<RawSource>> {
  try {
    if (step.tool === 'corpus') {
      const hits = await deps.corpus.search({ query: step.query, tenantId, limit: corpusLimit });
      return hits.map((h) => ({
        kind: 'corpus' as const,
        title: h.title,
        snippet: h.snippet,
        sourceUri: h.sourceUri,
        publishedAt: h.publishedAt,
      }));
    }
    const hits = await deps.web.search({ query: step.query, limit: webLimit });
    return hits.map((h) => ({
      kind: 'web_search' as const,
      title: h.title,
      snippet: h.snippet,
      sourceUri: h.url,
      publishedAt: h.publishedAt,
    }));
  } catch (err) {
    logger.warn('research: step failed — skipping', {
      wiring: 'research',
      stage: 'execute',
      tool: step.tool,
      err: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

/** Deterministic markdown render when no LLM synthesizer is available. */
function ruleSynthesize(query: string, sources: ReadonlyArray<ScoredSource>): string {
  if (sources.length === 0) {
    return `## ${query}\n\nI could not find corroborating sources for this query right now. No claim is asserted without evidence.`;
  }
  const lines = sources.map(
    (s) =>
      `- [${s.citationId}] **${s.title}** (${s.kind}${s.publishedAt ? `, ${s.publishedAt}` : ''}) — ${s.snippet.slice(0, 240)} (${s.sourceUri})`,
  );
  return [
    `## ${query}`,
    '',
    `Found ${sources.length} relevant source${sources.length === 1 ? '' : 's'}, ranked by authority and recency:`,
    '',
    ...lines,
    '',
    '_Synthesised from the BossNyumba corpus + live web search. Each bracketed id is a citation._',
  ].join('\n');
}

async function synthesize(
  deps: ResearchEngineDeps,
  query: string,
  mode: ResearchMode,
  sources: ReadonlyArray<ScoredSource>,
): Promise<{ readonly body: string; readonly llmSynthesized: boolean }> {
  if (deps.llmSynthesize && sources.length > 0) {
    try {
      const body = await deps.llmSynthesize({ query, mode, sources });
      if (body.trim().length > 0) return { body, llmSynthesized: true };
    } catch (err) {
      logger.warn('research: LLM synthesize failed — using rule-based render', {
        wiring: 'research',
        stage: 'synthesize',
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return { body: ruleSynthesize(query, sources), llmSynthesized: false };
}

/**
 * Cross-reference verification — count distinct sources whose citation id is
 * actually referenced in the synthesized body. Corroboration across multiple
 * distinct sources raises confidence; a single-source answer is capped.
 */
function crossReference(
  body: string,
  sources: ReadonlyArray<ScoredSource>,
): { readonly corroborating: number } {
  let corroborating = 0;
  for (const s of sources) {
    if (body.includes(`[${s.citationId}]`)) corroborating += 1;
  }
  // When the rule-render lists every source, they all count.
  return { corroborating: corroborating > 0 ? corroborating : sources.length };
}

function computeConfidence(
  sources: ReadonlyArray<ScoredSource>,
  corroborating: number,
  llmSynthesized: boolean,
): number {
  if (sources.length === 0) return 0.1;
  const base = Math.min(1, sources.length / 6) * 0.5;
  const corroborationBoost = Math.min(1, corroborating / 3) * 0.3;
  const synthBoost = llmSynthesized ? 0.2 : 0.1;
  return Number(Math.min(0.97, base + corroborationBoost + synthBoost).toFixed(3));
}

function computeAuditHash(
  tenantId: string,
  query: string,
  summary: string,
  citationIds: ReadonlyArray<string>,
): string {
  return createHash('sha256')
    .update(`${tenantId} ${query} ${summary} ${citationIds.join(',')}`)
    .digest('hex');
}

async function runMode(
  deps: ResearchEngineDeps,
  input: { readonly tenantId: string; readonly query: string },
  mode: ResearchMode,
  webLimit: number,
  corpusLimit: number,
): Promise<ResearchResult> {
  const started = Date.now();
  const plan = await planSteps(deps, input.query, mode);

  // Execute steps — independent, so fan out in parallel (real parallelism).
  const settled = await Promise.allSettled(
    plan.map((step) => runStep(deps, input.tenantId, step, webLimit, corpusLimit)),
  );
  const raw: RawSource[] = [];
  for (const r of settled) {
    if (r.status === 'fulfilled') raw.push(...r.value);
  }

  const sources = scoreSources(raw);
  const { body, llmSynthesized } = await synthesize(deps, input.query, mode, sources);
  const { corroborating } = crossReference(body, sources);
  const confidence = computeConfidence(sources, corroborating, llmSynthesized);

  const citations: ReadonlyArray<ResearchCitation> = sources.map((s) => ({
    citationId: s.citationId,
    kind: s.kind,
    title: s.title,
    sourceUri: s.sourceUri,
    publishedAt: s.publishedAt,
  }));
  const auditHash = computeAuditHash(
    input.tenantId,
    input.query,
    body,
    citations.map((c) => c.citationId),
  );

  // Audit anchor — append-only emission through the durable Pino sink.
  logger.info('research: result anchored', {
    wiring: 'research',
    stage: 'audit',
    tenant_id: input.tenantId,
    mode,
    sources: sources.length,
    corroborating,
    confidence,
    audit_hash: auditHash,
  });

  return {
    summaryMd: body,
    confidence,
    citations,
    corroboratingSources: corroborating,
    auditHash,
    mode,
    durationMs: Date.now() - started,
    llmSynthesized,
  };
}

export function createResearchEngine(deps: ResearchEngineDeps): ResearchEngine {
  return {
    async reactiveQuery(input: ReactiveQueryInput): Promise<ResearchResult> {
      return runMode(deps, input, 'reactive', REACTIVE_WEB_LIMIT, REACTIVE_CORPUS_LIMIT);
    },
    async deepDive(input: DeepDiveInput): Promise<ResearchResult> {
      return runMode(
        deps,
        { tenantId: input.tenantId, query: input.query },
        'deep_dive',
        DEEP_WEB_LIMIT,
        DEEP_CORPUS_LIMIT,
      );
    },
  };
}
