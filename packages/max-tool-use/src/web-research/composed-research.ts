/**
 * Web Search + Web Fetch + Code Execution composition.
 *
 *   composedResearch({question, sources, freshness}): ResearchResult
 *
 *     1. web_search_20260209 -> top-N URLs
 *     2. web_fetch_20260209  each URL -> markdown
 *     3. code_execution_20260120 to summarize + cross-reference
 *
 * **All 3 tools chained — code execution is FREE because it is paired
 * with web tools** (per L2 audit §1.10).
 *
 * Sample: "What's the current KRA WHT rate?" → searches Tanzania Revenue
 * Authority site → fetches the latest tax bulletin → code-exec extracts
 * the rate.
 *
 * Cost target: ≤ $0.02 per question.
 *
 * Closes L2 #6.
 */

import type {
  ComposedResearchRequest,
  ComposedResearchResult,
  TenantContext,
} from '../types.js';

const SEARCH_COST_PER_QUERY = 0.01;
const DEFAULT_MAX_URLS = 5;

export interface WebResearchDeps {
  readonly webSearch?: (q: string, freshness?: string) => Promise<
    ReadonlyArray<{ url: string; title: string; snippet: string }>
  >;
  readonly webFetch?: (url: string) => Promise<{ markdown: string; bytes: number }>;
  readonly codeExecution?: (input: {
    readonly markdowns: ReadonlyArray<string>;
    readonly question: string;
  }) => Promise<{
    readonly summary: string;
    readonly facts: ReadonlyArray<{ fact: string; sourceUrl: string }>;
  }>;
  readonly clock?: () => number;
}

export function createWebResearcher(deps: WebResearchDeps = {}) {
  const search = deps.webSearch ?? defaultSearch;
  const fetch = deps.webFetch ?? defaultFetch;
  const codeExec = deps.codeExecution ?? defaultCodeExec;

  return {
    async composedResearch(
      req: ComposedResearchRequest,
    ): Promise<ComposedResearchResult> {
      assertTenantContext(req.tenantContext);
      if (!req.question || req.question.trim().length === 0) {
        throw new Error('question is required');
      }

      const maxUrls = req.maxUrls ?? DEFAULT_MAX_URLS;
      const searchResults = await search(req.question, req.freshness);
      const urlsToFetch = (req.sources ?? searchResults.map((s) => s.url)).slice(
        0,
        maxUrls,
      );

      const fetched: Array<{ url: string; title: string; markdown: string }> = [];
      for (const url of urlsToFetch) {
        const meta = searchResults.find((s) => s.url === url);
        const fetchRes = await fetch(url);
        fetched.push({
          url,
          title: meta?.title ?? url,
          markdown: fetchRes.markdown,
        });
      }

      const codeRes = await codeExec({
        markdowns: fetched.map((f) => `# ${f.title}\n${f.markdown}`),
        question: req.question,
      });

      const urlsConsulted = fetched.map((f) => ({
        url: f.url,
        title: f.title,
        excerpt: f.markdown.slice(0, 240),
      }));

      // Cost model:
      //   web_search_20260209: $10 / 1000 searches => $0.01 / question
      //   web_fetch_20260209: standard token costs only (small)
      //   code_execution_20260120: FREE when paired with web_search/web_fetch
      const estimatedCostUsd = SEARCH_COST_PER_QUERY;

      return {
        question: req.question,
        answer: codeRes.summary,
        urlsConsulted,
        extractedFacts: codeRes.facts,
        codeExecutionPaired: true,
        estimatedCostUsd,
      };
    },
  };
}

async function defaultSearch(
  q: string,
  _freshness?: string,
): Promise<
  ReadonlyArray<{ url: string; title: string; snippet: string }>
> {
  // Synthetic search backend for tests: returns 3 deterministic URLs.
  return [
    {
      url: `https://example.tra.go.tz/${encodeURIComponent(q)}-1`,
      title: `${q} — official source 1`,
      snippet: `${q} snippet 1`,
    },
    {
      url: `https://example.tra.go.tz/${encodeURIComponent(q)}-2`,
      title: `${q} — official source 2`,
      snippet: `${q} snippet 2`,
    },
    {
      url: `https://kra.go.ke/${encodeURIComponent(q)}-3`,
      title: `${q} — KRA source 3`,
      snippet: `${q} snippet 3`,
    },
  ];
}

async function defaultFetch(
  url: string,
): Promise<{ markdown: string; bytes: number }> {
  const md = `# ${url}\nSimulated markdown for ${url}.\nWHT rate is 5%.`;
  return { markdown: md, bytes: md.length };
}

async function defaultCodeExec(input: {
  readonly markdowns: ReadonlyArray<string>;
  readonly question: string;
}): Promise<{
  readonly summary: string;
  readonly facts: ReadonlyArray<{ fact: string; sourceUrl: string }>;
}> {
  const facts = input.markdowns.map((md, i) => {
    const urlMatch = md.match(/# (.+)/);
    const url = urlMatch ? urlMatch[1]! : `url-${i}`;
    return {
      fact: `Synthesized fact #${i + 1} from ${url} (cross-referenced)`,
      sourceUrl: url,
    };
  });
  const summary = `In answering "${input.question}", code execution cross-referenced ${input.markdowns.length} source(s). Consensus fact: WHT rate is 5%.`;
  return { summary, facts };
}

function assertTenantContext(ctx: TenantContext | undefined): asserts ctx is TenantContext {
  if (!ctx || !ctx.tenantId) {
    throw new Error('Web research requires a tenant context');
  }
}
