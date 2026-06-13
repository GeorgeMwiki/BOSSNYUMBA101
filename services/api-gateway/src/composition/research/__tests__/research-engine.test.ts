/**
 * Deep-research engine — pipeline regression.
 *
 * Drives the engine with in-memory fake adapters (no network, no DB) and
 * asserts the full pipeline contract:
 *   - plan → execute corpus + web in PARALLEL → score → cited synthesis →
 *     cross-reference verify → audit-anchored result.
 *   - graceful degradation: a throwing adapter is skipped, not fatal.
 *   - no-source path returns a low-confidence, evidence-honest answer.
 *   - audit hash is deterministic over (tenant, query, summary, citations).
 */

import { describe, it, expect } from 'vitest';

import {
  createResearchEngine,
  type CorpusSearchAdapter,
  type LlmPlanFn,
  type LlmSynthesizeFn,
  type WebSearchAdapter,
} from '../research-engine.js';

const corpusOk: CorpusSearchAdapter = {
  async search({ query, tenantId }) {
    expect(tenantId).toBe('tenant_1');
    expect(query.length).toBeGreaterThan(0);
    return [
      {
        evidenceId: 'chunk_a',
        title: 'TZ Rental Code §12',
        snippet: 'Security deposits are capped at two months rent.',
        sourceUri: 'corpus://tz-rental-code#chunk_a',
        publishedAt: '2026-01-01T00:00:00.000Z',
      },
    ];
  },
};

const webOk: WebSearchAdapter = {
  async search({ query }) {
    expect(query.length).toBeGreaterThan(0);
    return [
      {
        url: 'https://example.gov.tz/deposits',
        title: 'Deposit guidance 2026',
        snippet: 'Latest guidance confirms the two-month cap.',
        publishedAt: '2026-05-01T00:00:00.000Z',
      },
    ];
  },
};

const emptyWeb: WebSearchAdapter = { async search() { return []; } };
const emptyCorpus: CorpusSearchAdapter = { async search() { return []; } };

describe('research-engine', () => {
  it('runs plan → parallel execute → score → cited synth → verify (rule-based, no LLM)', async () => {
    const engine = createResearchEngine({ web: webOk, corpus: corpusOk });
    const out = await engine.reactiveQuery({ tenantId: 'tenant_1', query: 'deposit cap' });

    // Both adapters contributed → 2 deduped citations.
    expect(out.citations.length).toBe(2);
    // Corpus is authoritative → ranked first (src_1).
    expect(out.citations[0]!.kind).toBe('corpus');
    expect(out.citations[0]!.citationId).toBe('src_1');
    // Rule render lists every source; cross-ref counts them.
    expect(out.corroboratingSources).toBe(2);
    expect(out.confidence).toBeGreaterThan(0);
    expect(out.summaryMd).toContain('[src_1]');
    expect(out.auditHash).toMatch(/^[0-9a-f]{64}$/);
    expect(out.mode).toBe('reactive');
    expect(out.llmSynthesized).toBe(false);
  });

  it('uses the LLM plan + synthesizer when provided and folds citations', async () => {
    const llmPlan: LlmPlanFn = async ({ availableTools }) => {
      expect(availableTools).toContain('corpus');
      expect(availableTools).toContain('web_search');
      return [
        { tool: 'corpus', query: 'deposit cap corpus' },
        { tool: 'web_search', query: 'deposit cap latest' },
      ];
    };
    const llmSynthesize: LlmSynthesizeFn = async ({ sources }) => {
      // Reference exactly one source so cross-ref corroboration = 1.
      return `Deposits capped at two months [${sources[0]!.citationId}].`;
    };

    const engine = createResearchEngine({ web: webOk, corpus: corpusOk, llmPlan, llmSynthesize });
    const out = await engine.deepDive({
      tenantId: 'tenant_1',
      query: 'deposit cap',
      topic: 'deposits',
    });

    expect(out.llmSynthesized).toBe(true);
    expect(out.mode).toBe('deep_dive');
    expect(out.summaryMd).toContain('[src_1]');
    expect(out.corroboratingSources).toBe(1);
  });

  it('degrades gracefully: a throwing adapter is skipped, the other still answers', async () => {
    const throwingWeb: WebSearchAdapter = {
      async search() {
        throw new Error('web provider down');
      },
    };
    const engine = createResearchEngine({ web: throwingWeb, corpus: corpusOk });
    const out = await engine.reactiveQuery({ tenantId: 'tenant_1', query: 'deposit cap' });

    // Only corpus survived → 1 citation, no crash.
    expect(out.citations.length).toBe(1);
    expect(out.citations[0]!.kind).toBe('corpus');
  });

  it('no sources → low-confidence, evidence-honest answer (never fabricates)', async () => {
    const engine = createResearchEngine({ web: emptyWeb, corpus: emptyCorpus });
    const out = await engine.reactiveQuery({ tenantId: 'tenant_1', query: 'obscure topic' });

    expect(out.citations.length).toBe(0);
    expect(out.confidence).toBeLessThanOrEqual(0.2);
    expect(out.summaryMd.toLowerCase()).toContain('could not find');
  });

  it('audit hash is deterministic for identical inputs', async () => {
    const engine = createResearchEngine({ web: webOk, corpus: corpusOk });
    const a = await engine.reactiveQuery({ tenantId: 'tenant_1', query: 'deposit cap' });
    const b = await engine.reactiveQuery({ tenantId: 'tenant_1', query: 'deposit cap' });
    expect(a.auditHash).toBe(b.auditHash);
  });
});
