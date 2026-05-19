/**
 * Integration tests for `runResearchTask` across the 4 demanded
 * scenarios: vendor due-diligence, regulation lookup, market-rate
 * survey, compliance gap.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { runResearchTask } from '../run.js';
import type {
  OnlineResearchDeps,
  WorkerSimulator,
} from '../../ports/index.js';
import {
  createInMemoryBudgetMonitor,
  createInMemoryDeferHook,
  createInMemoryLLMOrchestrator,
  createInMemorySubAgentRunner,
} from '../../ports/index.js';
import { createInMemoryReceiptStore } from '../../receipts/in-memory-store.js';
import { createSearchAggregator } from '../../search-aggregator/aggregator.js';
import { createInMemoryProvider } from '../../search-aggregator/in-memory-provider.js';
import type {
  SearchHit,
  SearchProviderInput,
} from '../../types/index.js';

const NOW = 1747632000000; // 2026-05-19 fixed for deterministic tests
let clockMs = NOW;
const clock = { nowMs: () => clockMs };

let counter = 0;
const correlationIdGen = () => `corr_${++counter}`;
const tokenGen = () => `tok_${++counter}`;

function makeDeps(overrides?: Partial<OnlineResearchDeps>): OnlineResearchDeps {
  const budgetMonitor = createInMemoryBudgetMonitor({
    tenantMonthlyCapUsd: 100,
  });
  const deferHook = createInMemoryDeferHook({ clock, tokenGen });
  const receiptStore = createInMemoryReceiptStore();
  const llmOrchestrator = createInMemoryLLMOrchestrator({ clock });
  const aggregatorBundle = createSearchAggregator({
    providers: [
      createInMemoryProvider({
        name: 'tavily',
        supportsDeep: true,
        catalog: [
          {
            url: 'https://kra.go.ke/rental-income',
            title: 'KRA Rental Income 2026',
            snippet: 'WHT on rental income is 7.5% for residential.',
            keywords: ['kra', 'rental', 'income', 'wht', 'tax'],
            score: 0.95,
            publishedAt: '2026-03-15',
            fullText: 'The full text of the KRA rental income page.',
          },
        ],
      }),
      createInMemoryProvider({
        name: 'exa',
        catalog: [
          {
            url: 'https://example.com/vendor-jumia',
            title: 'Jumia Pricing for Cleaning Services',
            snippet: 'KES 3,500 per visit on Jumia.',
            keywords: ['vendor', 'jumia', 'cleaning', 'price'],
            score: 0.88,
          },
        ],
      }),
      createInMemoryProvider({
        name: 'anthropic',
        catalog: [
          {
            url: 'https://parliament.go.ke/bills/rent-control-2026',
            title: 'Rent Control Bill 2026',
            snippet: 'Bill caps annual rent increase at 7% in urban centres.',
            keywords: ['rent', 'control', 'bill', 'regulation', 'kenya'],
            score: 0.92,
            publishedAt: '2026-04-10',
          },
        ],
      }),
    ],
    clock,
  });

  const defaultSimulator: WorkerSimulator<{
    readonly summary: string;
    readonly hits: ReadonlyArray<SearchHit>;
  }> = async (spec, input) => {
    // Simulator calls the search aggregator with the sub-question.
    const searchResult = await aggregatorBundle.searchUnified({
      query: input.prompt,
      depth: 'standard',
      freshness: 'any',
      maxHits: 5,
    } as SearchProviderInput);
    const summary =
      searchResult.hits.length === 0
        ? `No findings for "${input.prompt}"`
        : `Found ${searchResult.hits.length} relevant sources for "${input.prompt}"`;
    return {
      output: { summary, hits: searchResult.hits },
      turns_used: 4,
      cost_usd: 0.18,
    };
  };

  const subAgentRunner = createInMemorySubAgentRunner({
    simulator: defaultSimulator as WorkerSimulator<unknown>,
  });

  return {
    subAgentRunner,
    searchAggregator: { searchUnified: aggregatorBundle.searchUnified },
    budgetMonitor,
    deferHook,
    receiptStore,
    llmOrchestrator,
    clock,
    correlationIdGen,
    ...overrides,
  };
}

beforeEach(() => {
  clockMs = NOW;
  counter = 0;
});

describe('runResearchTask — 4 BOSSNYUMBA scenarios', () => {
  it('vendor due-diligence — comparison question fans out to 2-4 workers', async () => {
    const deps = makeDeps();
    const result = await runResearchTask(
      {
        tenantId: 'tnt_acme',
        conversationId: 'cnv_1',
        initiatedBy: 'usr_george',
        question: 'Compare cleaning vendor pricing on Jumia vs direct quotes for 12 units',
        depth: 'standard',
        deadlineMs: NOW + 60_000,
        tags: ['vendor', 'due-diligence'],
      },
      deps,
    );
    expect(result.plan.length).toBeGreaterThanOrEqual(2);
    expect(result.workerOutputs.length).toBe(result.plan.length);
    expect(result.receiptId).toBeDefined();
    expect(result.report).toContain('Compare cleaning vendor');
    expect(result.costUsd).toBeGreaterThan(0);
  });

  it('regulation lookup — quick depth uses 1 worker', async () => {
    const deps = makeDeps();
    const result = await runResearchTask(
      {
        tenantId: 'tnt_acme',
        conversationId: 'cnv_1',
        initiatedBy: 'usr_george',
        question: 'Current KRA WHT rate on residential rental income',
        depth: 'quick',
        deadlineMs: NOW + 30_000,
        tags: ['regulation', 'kra'],
      },
      deps,
    );
    expect(result.plan.length).toBe(1);
    expect(result.workerOutputs[0]?.status).toBe('ok');
    expect(result.citations.length).toBeGreaterThan(0);
  });

  it('market-rate survey — deep depth gates on budget approval', async () => {
    const deps = makeDeps();
    const result = await runResearchTask(
      {
        tenantId: 'tnt_acme',
        conversationId: 'cnv_1',
        initiatedBy: 'usr_george',
        question: 'Average 2-bed rent in Westlands Nairobi for May 2026',
        depth: 'deep',
        deadlineMs: NOW + 120_000,
        tags: ['market-rate'],
      },
      deps,
    );
    // Deep depth triggers approval_required; the orchestrator records
    // the defer + bails. Caller resumes via K-A.
    expect(result.plan).toHaveLength(0);
    expect(result.report).toMatch(/approval/iu);
    expect(result.receiptId).toBeDefined();
  });

  it('compliance gap — fans out, dedupes citations across workers', async () => {
    const deps = makeDeps();
    const result = await runResearchTask(
      {
        tenantId: 'tnt_acme',
        conversationId: 'cnv_1',
        initiatedBy: 'usr_george',
        question: 'What KRA filings and rent control rules apply to our 12-unit residential block?',
        depth: 'standard',
        deadlineMs: NOW + 90_000,
        tags: ['compliance'],
      },
      deps,
    );
    expect(result.plan.length).toBeGreaterThanOrEqual(2);
    // Citations are unique by URL even when multiple workers hit the
    // same source.
    const urls = result.citations.map((c) => c.url);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it('records a research_session receipt for every run', async () => {
    const deps = makeDeps();
    const result = await runResearchTask(
      {
        tenantId: 'tnt_acme',
        conversationId: 'cnv_1',
        initiatedBy: 'usr_george',
        question: 'KRA rental WHT rate',
        depth: 'quick',
        deadlineMs: NOW + 30_000,
        tags: ['receipt-check'],
      },
      deps,
    );
    expect(result.receiptId).toBeDefined();
    const stored = await deps.receiptStore.findResearchSession(result.receiptId!);
    expect(stored).not.toBeNull();
    expect(stored!.tags).toContain('receipt-check');
    expect(stored!.tenantId).toBe('tnt_acme');
  });

  it('denies on tenant budget cap exceeded', async () => {
    const deps = makeDeps({
      budgetMonitor: createInMemoryBudgetMonitor({
        tenantMonthlyCapUsd: 100,
        initialTenantSpentUsd: 99.95,
      }),
    });
    const result = await runResearchTask(
      {
        tenantId: 'tnt_acme',
        conversationId: 'cnv_1',
        initiatedBy: 'usr_george',
        question: 'Test budget denial',
        depth: 'standard',
        deadlineMs: NOW + 30_000,
      },
      deps,
    );
    expect(result.plan).toHaveLength(0);
    expect(result.report).toMatch(/budget denied/iu);
  });

  it('records cost via budgetMonitor.record after success', async () => {
    const budgetMonitor = createInMemoryBudgetMonitor({ tenantMonthlyCapUsd: 100 });
    const deps = makeDeps({ budgetMonitor });
    await runResearchTask(
      {
        tenantId: 'tnt_acme',
        conversationId: 'cnv_1',
        initiatedBy: 'usr_george',
        question: 'Quick lookup',
        depth: 'quick',
        deadlineMs: NOW + 30_000,
      },
      deps,
    );
    expect(budgetMonitor.tenantSpentUsd()).toBeGreaterThan(0);
  });

  it('marks status partial when deadline is reached', async () => {
    // Deadline is in the past
    const deps = makeDeps();
    const result = await runResearchTask(
      {
        tenantId: 'tnt_acme',
        conversationId: 'cnv_1',
        initiatedBy: 'usr_george',
        question: 'Test deadline trigger',
        depth: 'standard',
        deadlineMs: NOW - 1, // already passed
      },
      deps,
    );
    expect(result.deadlineHit).toBe(true);
  });
});
