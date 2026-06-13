/**
 * Research tool adapters + brain-LLM plan/synthesize seams (BossNyumba).
 *
 * This is the thin seam that turns BossNyumba's already-shipped primitives
 * into the three things the deep-research engine consumes:
 *
 *   1. a `webSearch` adapter — REAL live web search (Brave → Tavily →
 *      Serper precedence, the same provider ladder `@bossnyumba/truth-
 *      engine` uses). Recency-biased (`freshness=py` / advanced depth),
 *      SSRF-safe (provider hosts are fixed, not user-supplied). Returns []
 *      (never throws) when no provider key is configured.
 *
 *   2. a `corpus` adapter — REAL pgvector ANN retrieval over
 *      `intelligence_corpus_chunks` (the always-current ground-truth
 *      corpus, `tenant_id IS NULL` global + the caller's private chunks),
 *      RECENCY/FRESHNESS-WEIGHTED: candidates are pulled by vector distance
 *      then re-ranked by `0.85·similarity + 0.15·freshness` where freshness
 *      decays over `ingested_at`. Degrades to an ILIKE keyword path when no
 *      embedding is available, and to [] when no DB is wired.
 *
 *   3. `llmPlan` / `llmSynthesize` — backed by the `@bossnyumba/brain-llm-
 *      router` Anthropic adapter (the canonical universal client). The
 *      planner turns an owner intent into an ordered, grounded step list;
 *      the synthesizer renders a citation-anchored markdown answer over the
 *      scored sources and asks for explicit cross-reference / disagreement
 *      notes. Both THROW on a missing provider / malformed reply so the
 *      engine's own try/catch falls back to its deterministic rule-based
 *      path — a run never fails to materialise.
 *
 * Boundaries: web-search keys are read through each provider's own
 * documented degradation seam (`readProviderKey`, mirroring truth-engine /
 * Borjie's research-tools) — never `process.env` scattered through logic.
 * The embed key + Anthropic key are read once at construction via the
 * existing shared helpers. Pino-only logging. Immutable returns.
 */

import { sql } from 'drizzle-orm';

import {
  AnthropicAdapter,
  type BrainLLMRequest,
  type BrainLLMResponse,
  type ContentBlock,
} from '@bossnyumba/brain-llm-router';

import { createOpenAIEmbedder } from '../../services/brain-ingestion/embedder.js';
import { logger } from '../../utils/logger.js';
import type {
  CorpusHit,
  CorpusSearchAdapter,
  LlmPlanFn,
  LlmSynthesizeFn,
  PlanStep,
  ResearchTool,
  WebSearchAdapter,
  WebSearchHit,
} from './research-engine.js';

// ────────────────────────────────────────────────────────────────────
// Env seams — read each external key through a single documented helper.
// These are the ONLY env reads in this module and they mirror the existing
// truth-engine / embedder degradation seams (a missing key = graceful []).
// ────────────────────────────────────────────────────────────────────

function readProviderKey(name: string): string | null {
  const v = process.env[name];
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;
}

// ────────────────────────────────────────────────────────────────────
// web search — Brave → Tavily → Serper precedence (first key wins). The
// provider hosts are fixed constants (no user-supplied URL), so this is
// SSRF-safe by construction. Recency-biased. Always returns [] on any soft
// failure rather than throwing — a key-less / offline run still completes.
// ────────────────────────────────────────────────────────────────────

const WEB_TIMEOUT_MS = 12_000;

interface RawWebResult {
  readonly url: string;
  readonly title: string;
  readonly snippet: string;
  readonly publishedAt: string | null;
}

async function searchBrave(
  key: string,
  query: string,
  max: number,
): Promise<ReadonlyArray<RawWebResult>> {
  const url = new URL('https://api.search.brave.com/res/v1/web/search');
  url.searchParams.set('q', query);
  url.searchParams.set('count', String(Math.min(max, 20)));
  url.searchParams.set('safesearch', 'moderate');
  url.searchParams.set('freshness', 'py'); // recency bias: past year
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'X-Subscription-Token': key },
    signal: AbortSignal.timeout(WEB_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`brave_http_${res.status}`);
  const json = (await res.json()) as {
    web?: { results?: Array<{ url?: string; title?: string; description?: string; age?: string }> };
  };
  const rows = json.web?.results ?? [];
  return rows.slice(0, max).map((r) => ({
    url: String(r.url ?? ''),
    title: String(r.title ?? ''),
    snippet: String(r.description ?? ''),
    publishedAt: typeof r.age === 'string' ? r.age : null,
  }));
}

async function searchTavily(
  key: string,
  query: string,
  max: number,
): Promise<ReadonlyArray<RawWebResult>> {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: key,
      query,
      search_depth: 'advanced', // deeper extraction for research
      max_results: Math.min(max, 20),
      include_answer: false,
    }),
    signal: AbortSignal.timeout(WEB_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`tavily_http_${res.status}`);
  const json = (await res.json()) as {
    results?: Array<{ url?: string; title?: string; content?: string; published_date?: string }>;
  };
  const rows = json.results ?? [];
  return rows.slice(0, max).map((r) => ({
    url: String(r.url ?? ''),
    title: String(r.title ?? ''),
    snippet: String(r.content ?? '').slice(0, 500),
    publishedAt: typeof r.published_date === 'string' ? r.published_date : null,
  }));
}

async function searchSerper(
  key: string,
  query: string,
  max: number,
): Promise<ReadonlyArray<RawWebResult>> {
  const res = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-KEY': key },
    body: JSON.stringify({ q: query, num: Math.min(max, 20) }),
    signal: AbortSignal.timeout(WEB_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`serper_http_${res.status}`);
  const json = (await res.json()) as {
    organic?: Array<{ link?: string; title?: string; snippet?: string; date?: string }>;
  };
  const rows = json.organic ?? [];
  return rows.slice(0, max).map((r) => ({
    url: String(r.link ?? ''),
    title: String(r.title ?? ''),
    snippet: String(r.snippet ?? ''),
    publishedAt: typeof r.date === 'string' ? r.date : null,
  }));
}

/**
 * Build the live web-search adapter. Provider precedence mirrors
 * truth-engine: Brave (privacy + generous free tier) → Tavily (research-
 * tuned, returns extracted content) → Serper (Google-backed). When no key
 * is set the adapter returns [] so a run still completes on corpus alone.
 */
export function createWebSearchAdapter(): WebSearchAdapter {
  return {
    async search({ query, limit = 8 }): Promise<ReadonlyArray<WebSearchHit>> {
      const q = query.trim();
      if (q.length === 0) return [];
      const max = Math.max(1, Math.min(20, limit));

      const brave = readProviderKey('BRAVE_SEARCH_API_KEY');
      const tavily = readProviderKey('TAVILY_API_KEY');
      const serper = readProviderKey('SERPER_API_KEY');

      let rows: ReadonlyArray<RawWebResult> = [];
      try {
        if (brave) rows = await searchBrave(brave, q, max);
        else if (tavily) rows = await searchTavily(tavily, q, max);
        else if (serper) rows = await searchSerper(serper, q, max);
        else return []; // no provider configured — corpus-only run
      } catch (err) {
        logger.warn('research: web search failed — returning []', {
          wiring: 'research',
          adapter: 'web-search',
          provider: brave ? 'brave' : tavily ? 'tavily' : 'serper',
          err: err instanceof Error ? err.message : String(err),
        });
        return [];
      }

      return rows
        .filter((r) => r.url.length > 0)
        .map((r) => ({
          url: r.url,
          title: r.title || r.url,
          snippet: r.snippet,
          publishedAt: r.publishedAt,
        }));
    },
  };
}

// ────────────────────────────────────────────────────────────────────
// corpus — pgvector ANN over intelligence_corpus_chunks, recency-reranked.
// Embeds the query (OpenAI, 1024-d to match the column), pulls a candidate
// window by vector distance, then re-ranks by similarity + ingested-at
// freshness so the freshest authoritative chunk wins ties. ILIKE fallback
// when no embedding is available; [] when no DB is wired.
// ────────────────────────────────────────────────────────────────────

interface DbLike {
  execute(query: unknown): Promise<unknown>;
}

interface CorpusRow {
  readonly id: string;
  readonly source_file: string | null;
  readonly section: string | null;
  readonly url: string | null;
  readonly text: string;
  readonly ingested_at: string | Date | null;
  readonly distance: number | null;
}

const CORPUS_CANDIDATE_WINDOW = 24;
const CORPUS_TOPK = 8;
/** Freshness half-life: a chunk loses half its recency weight per year. */
const CORPUS_FRESHNESS_HALFLIFE_DAYS = 365;
const CORPUS_SIMILARITY_WEIGHT = 0.85;
const CORPUS_FRESHNESS_WEIGHT = 0.15;

function freshnessScore(ingestedAt: string | Date | null): number {
  if (!ingestedAt) return 0;
  const t = ingestedAt instanceof Date ? ingestedAt.getTime() : Date.parse(ingestedAt);
  if (!Number.isFinite(t)) return 0;
  const ageDays = Math.max(0, (Date.now() - t) / 86_400_000);
  return Math.pow(0.5, ageDays / CORPUS_FRESHNESS_HALFLIFE_DAYS);
}

/** Convert pgvector L2 distance into a bounded similarity in [0,1]. */
function similarityFromDistance(distance: number | null): number {
  if (typeof distance !== 'number' || !Number.isFinite(distance)) return 0.5;
  return 1 / (1 + Math.max(0, distance));
}

function mapCorpusRows(
  raw: unknown,
): ReadonlyArray<CorpusRow> {
  const rows: ReadonlyArray<Record<string, unknown>> = Array.isArray(raw)
    ? (raw as ReadonlyArray<Record<string, unknown>>)
    : ((raw as { rows?: ReadonlyArray<Record<string, unknown>> }).rows ?? []);
  return rows
    .map((row) => ({
      id: String(row.id ?? ''),
      source_file: typeof row.source_file === 'string' ? row.source_file : null,
      section: typeof row.section === 'string' ? row.section : null,
      url: typeof row.url === 'string' ? row.url : null,
      text: String(row.text ?? ''),
      ingested_at:
        row.ingested_at instanceof Date
          ? row.ingested_at
          : typeof row.ingested_at === 'string'
            ? row.ingested_at
            : null,
      distance: typeof row.distance === 'number' ? row.distance : null,
    }))
    .filter((r) => r.id.length > 0 && r.text.length > 0);
}

async function embedQuery(query: string): Promise<ReadonlyArray<number> | null> {
  const key = readProviderKey('OPENAI_API_KEY');
  if (!key) return null;
  try {
    const embedder = createOpenAIEmbedder({ apiKey: key });
    const [vec] = await embedder.embed([query]);
    return Array.isArray(vec) && vec.length > 0 ? vec : null;
  } catch (err) {
    logger.warn('research: query embed failed — falling back to ILIKE keyword path', {
      wiring: 'research',
      adapter: 'corpus',
      err: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

async function fetchCorpusRows(
  db: DbLike,
  tenantId: string,
  query: string,
  embedding: ReadonlyArray<number> | null,
): Promise<ReadonlyArray<CorpusRow>> {
  if (embedding && embedding.length > 0) {
    const vecLiteral = `[${embedding.join(',')}]`;
    const raw = (await db.execute(sql`
      SELECT id,
             source_file,
             section,
             url,
             COALESCE(text, '') AS text,
             ingested_at,
             (embedding <-> ${vecLiteral}::vector) AS distance
        FROM intelligence_corpus_chunks
       WHERE (tenant_id IS NULL OR tenant_id = ${tenantId})
         AND embedding IS NOT NULL
       ORDER BY embedding <-> ${vecLiteral}::vector
       LIMIT ${CORPUS_CANDIDATE_WINDOW}
    `)) as unknown;
    return mapCorpusRows(raw);
  }

  // ILIKE keyword fallback — newest matching chunk first.
  const like = `%${query.slice(0, 200)}%`;
  const raw = (await db.execute(sql`
    SELECT id,
           source_file,
           section,
           url,
           COALESCE(text, '') AS text,
           ingested_at,
           NULL AS distance
      FROM intelligence_corpus_chunks
     WHERE (tenant_id IS NULL OR tenant_id = ${tenantId})
       AND (text ILIKE ${like} OR section ILIKE ${like} OR source_file ILIKE ${like})
     ORDER BY ingested_at DESC
     LIMIT ${CORPUS_CANDIDATE_WINDOW}
  `)) as unknown;
  return mapCorpusRows(raw);
}

/**
 * Build the corpus retrieval adapter. The orchestrator passes a `tenantId`
 * per call so global (`tenant_id IS NULL`) plus the caller's private chunks
 * are both visible. RLS is the DB-side belt; the explicit predicate is
 * belt-and-braces.
 */
export function createCorpusSearchAdapter(db: DbLike | null): CorpusSearchAdapter {
  return {
    async search({ query, tenantId, limit = CORPUS_TOPK }): Promise<ReadonlyArray<CorpusHit>> {
      if (!db) return [];
      const q = query.trim();
      if (q.length === 0) return [];

      const embedding = await embedQuery(q);

      let rows: ReadonlyArray<CorpusRow> = [];
      try {
        rows = await fetchCorpusRows(db, tenantId, q, embedding);
      } catch (err) {
        logger.warn('research: corpus retrieval failed — returning []', {
          wiring: 'research',
          adapter: 'corpus',
          err: err instanceof Error ? err.message : String(err),
        });
        return [];
      }

      const topK = Math.max(1, Math.min(20, limit));
      return [...rows]
        .map((row) => ({
          row,
          score:
            CORPUS_SIMILARITY_WEIGHT * similarityFromDistance(row.distance) +
            CORPUS_FRESHNESS_WEIGHT * freshnessScore(row.ingested_at),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, topK)
        .map(({ row }) => {
          const title =
            row.section && row.section.length > 0
              ? row.section
              : row.source_file && row.source_file.length > 0
                ? row.source_file
                : 'corpus chunk';
          const ingestedIso =
            row.ingested_at instanceof Date
              ? row.ingested_at.toISOString()
              : typeof row.ingested_at === 'string'
                ? row.ingested_at
                : null;
          return {
            evidenceId: row.id,
            title,
            snippet: row.text.slice(0, 600),
            sourceUri:
              row.url && row.url.length > 0
                ? row.url
                : `corpus://${row.source_file ?? 'chunk'}#${row.id}`,
            publishedAt: ingestedIso,
          };
        });
    },
  };
}

// ────────────────────────────────────────────────────────────────────
// LLM seams — single-shot brain caller via the brain-llm-router Anthropic
// adapter (already a gateway dependency; fetch-based, no SDK import). Both
// the planner and synthesizer throw on a missing key / empty reply so the
// engine falls back to its deterministic path.
// ────────────────────────────────────────────────────────────────────

const RESEARCH_MODEL = 'anthropic/claude-haiku-4-5';

function extractText(resp: BrainLLMResponse): string {
  return resp.content
    .filter((b: ContentBlock): b is Extract<ContentBlock, { type: 'text' }> => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
}

async function callBrainOnce(args: {
  readonly system: string;
  readonly user: string;
  readonly maxTokens: number;
}): Promise<string> {
  const key = readProviderKey('ANTHROPIC_API_KEY');
  if (!key) throw new Error('research: ANTHROPIC_API_KEY unset — no LLM provider');
  const adapter = new AnthropicAdapter({ apiKey: key });
  const req: BrainLLMRequest = {
    model: RESEARCH_MODEL,
    system: args.system,
    maxTokens: args.maxTokens,
    temperature: 0.2,
    messages: [{ role: 'user', content: [{ type: 'text', text: args.user }] }],
  };
  const resp = await adapter.invoke(req);
  return extractText(resp);
}

const PLAN_SYSTEM = [
  'You are Mr. Mwikila, the research planner for an AI-native real estate',
  'operating system. Given an owner research query, produce a minimal ordered',
  'list of research steps. Each step picks exactly one tool from the supplied',
  'AVAILABLE_TOOLS list and provides its input.',
  '',
  'Always start with a corpus step (internal ground-truth corpus) when corpus',
  'is available, then add web_search steps for the live, time-sensitive',
  'dimensions. Keep the plan to at most 5 steps.',
  '',
  'Respond with STRICT JSON only — no prose, no code fence — of the shape:',
  '{ "steps": [ { "tool": "<tool>", "query": "<search query>" } ] }',
  'where <tool> is one of the AVAILABLE_TOOLS.',
].join('\n');

interface ParsedPlanStep {
  readonly tool?: unknown;
  readonly query?: unknown;
}

function parsePlanSteps(
  raw: string,
  availableTools: ReadonlyArray<ResearchTool>,
): ReadonlyArray<PlanStep> {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();
  const parsed = JSON.parse(cleaned) as { steps?: ReadonlyArray<ParsedPlanStep> };
  const steps = Array.isArray(parsed.steps) ? parsed.steps : [];
  const allowed = new Set<string>(availableTools);
  const out: PlanStep[] = [];
  for (const s of steps) {
    if (typeof s.tool !== 'string' || !allowed.has(s.tool)) continue;
    const query = typeof s.query === 'string' ? s.query.trim() : '';
    if (query.length === 0) continue;
    out.push({ tool: s.tool as ResearchTool, query });
    if (out.length >= 5) break;
  }
  return out;
}

/**
 * Build the `llmPlan` function. Throws on a missing provider / malformed
 * reply / empty plan so the engine's planner falls back to a rule-based
 * template (it never fails to materialise a plan).
 */
export function createBrainLlmPlan(): LlmPlanFn {
  return async (req): Promise<ReadonlyArray<PlanStep>> => {
    const user = [
      `QUERY: ${req.query}`,
      `MODE: ${req.mode}`,
      `AVAILABLE_TOOLS: ${req.availableTools.join(', ')}`,
    ].join('\n');
    const text = await callBrainOnce({ system: PLAN_SYSTEM, user, maxTokens: 700 });
    const steps = parsePlanSteps(text, req.availableTools);
    if (steps.length === 0) throw new Error('brain plan returned no usable steps');
    return steps;
  };
}

const SYNTH_SYSTEM = [
  'You are Mr. Mwikila, the research synthesizer for an AI-native real estate',
  'operating system. Compose a concise, decision-grade markdown briefing that',
  'answers the owner QUERY using ONLY the supplied SOURCES.',
  '',
  'Rules:',
  '- Cite every claim inline with its bracketed citation id, e.g. [src_1].',
  '- Cross-reference sources: when two sources agree, note the corroboration;',
  '  when they disagree, surface the disagreement explicitly.',
  '- Prefer the most recent and most authoritative sources; flag staleness.',
  '- Never invent facts or citation ids not present in SOURCES.',
  '- If the SOURCES are empty or insufficient, say so plainly and stop.',
  '- Default to English. Keep it tight: a lead summary then key findings.',
].join('\n');

const MAX_SYNTH_SOURCES = 14;

/**
 * Build the `llmSynthesize` function. Throws on a missing provider / empty
 * reply / no sources so the engine's synthesizer falls back to its
 * deterministic rule-based render.
 */
export function createBrainLlmSynthesize(): LlmSynthesizeFn {
  return async (req): Promise<string> => {
    const sources = req.sources.slice(0, MAX_SYNTH_SOURCES);
    if (sources.length === 0) throw new Error('no sources to synthesize');
    const sourceBlock = sources
      .map((s) => {
        const fresh = s.publishedAt ? ` (published: ${s.publishedAt})` : '';
        return [
          `[${s.citationId}] ${s.title} — ${s.sourceUri} (${s.kind})${fresh}`,
          `  ${s.snippet}`,
        ].join('\n');
      })
      .join('\n\n');
    const user = [`QUERY: ${req.query}`, `MODE: ${req.mode}`, '', 'SOURCES:', sourceBlock].join(
      '\n',
    );
    const text = await callBrainOnce({ system: SYNTH_SYSTEM, user, maxTokens: 1400 });
    if (text.length === 0) throw new Error('brain synthesize returned empty body');
    return text;
  };
}
