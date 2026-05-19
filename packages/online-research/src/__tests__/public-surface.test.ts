/**
 * Smoke test asserting the public surface stays stable. If anything
 * here breaks, it's a deliberate API-shape change and the audit doc
 * should be updated.
 */

import { describe, it, expect } from 'vitest';
import * as M from '../index.js';

describe('@bossnyumba/online-research public surface', () => {
  it('exports orchestrator-worker', () => {
    expect(typeof M.runResearchTask).toBe('function');
    expect(typeof M.clampWorkerCount).toBe('function');
    expect(typeof M.toposortSubQuestions).toBe('function');
    expect(typeof M.validatePlan).toBe('function');
    expect(typeof M.buildWorkerSpec).toBe('function');
    expect(typeof M.buildWorkerInput).toBe('function');
  });
  it('exports search-aggregator', () => {
    expect(typeof M.createSearchAggregator).toBe('function');
    expect(typeof M.dedupeHits).toBe('function');
    expect(typeof M.normaliseUrl).toBe('function');
    expect(typeof M.createInMemoryProvider).toBe('function');
  });
  it('exports browser-use-fallback', () => {
    expect(typeof M.createSafeBrowserUseDriver).toBe('function');
    expect(typeof M.createRegexInputShield).toBe('function');
    expect(typeof M.createNoopInputShield).toBe('function');
    expect(typeof M.createInMemoryBrowserDriver).toBe('function');
  });
  it('exports durable execution', () => {
    expect(typeof M.defineDurableFlow).toBe('function');
    expect(typeof M.createInMemoryDurableEngine).toBe('function');
    expect(typeof M.buildLeaseRenewalFlow).toBe('function');
    expect(typeof M.buildEvictionFlow).toBe('function');
    expect(typeof M.buildKraFilingFlow).toBe('function');
    expect(typeof M.buildOnboardingFlow).toBe('function');
  });
  it('exports receipts', () => {
    expect(typeof M.createInMemoryReceiptStore).toBe('function');
  });
  it('exports in-memory port adapters', () => {
    expect(typeof M.createInMemoryBudgetMonitor).toBe('function');
    expect(typeof M.createInMemoryDeferHook).toBe('function');
    expect(typeof M.createInMemoryLLMOrchestrator).toBe('function');
    expect(typeof M.createInMemorySubAgentRunner).toBe('function');
  });
  it('exports Result helpers', () => {
    expect(typeof M.ok).toBe('function');
    expect(typeof M.err).toBe('function');
    const r = M.ok(42);
    expect(r).toEqual({ ok: true, value: 42 });
    const e = M.err('bad');
    expect(e).toEqual({ ok: false, error: 'bad' });
  });
  it('exports types schemas', () => {
    expect(M.SearchHitSchema).toBeDefined();
    expect(M.ResearchQuestionSchema).toBeDefined();
    expect(M.SubQuestionSchema).toBeDefined();
    expect(M.ScopeContextSchema).toBeDefined();
  });
});
