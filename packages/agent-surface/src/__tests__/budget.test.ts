/**
 * Budget unit tests.
 *
 * Asserts:
 *   - Monthly cap hard-stops at threshold.
 *   - Per-action preview correct within ±10% (after we plug
 *     reasonable token counts).
 *   - Cache hit rate observed correctly via EMA.
 */

import { describe, expect, it } from 'vitest';
import {
  buildBudgetPreviewCard,
  createBudgetMonitor,
  type TokenPricing,
} from '../budget/index.js';

const pricing: TokenPricing = {
  inputPerMillion: 3, // $3 per 1M input
  outputPerMillion: 15, // $15 per 1M output
  cachedInputPerMillion: 0.3, // 10× cheaper cached
};

describe('createBudgetMonitor — estimate', () => {
  it('estimates LLM cost from tokens at the configured pricing', () => {
    const mon = createBudgetMonitor({
      tenantId: 't-1',
      caps: { tenantMonthlyUsd: 10 },
      pricing,
    });
    const est = mon.estimate({
      description: 'send 14 SMS late-rent notices',
      expectedInputTokens: 1_000,
      expectedOutputTokens: 200,
      expectedSeconds: 5,
    });
    // input: 1000 * 3 / 1e6 = 0.003
    // output: 200 * 15 / 1e6 = 0.003
    // total ≈ 0.006
    expect(est.costUsd).toBeCloseTo(0.006, 5);
    expect(est.seconds).toBe(5);
    expect(est.breakdown[0]!.label).toBe('LLM tokens');
  });

  it('discounts cached input tokens at the cached-rate', () => {
    const mon = createBudgetMonitor({
      tenantId: 't-1',
      caps: { tenantMonthlyUsd: 10 },
      pricing,
      initialCacheHitRate: 0.5,
    });
    const est = mon.estimate({
      description: 'cached-friendly action',
      expectedInputTokens: 1_000,
      expectedOutputTokens: 200,
      expectedSeconds: 1,
    });
    // 500 uncached input @ 3/M = 0.0015
    // 500 cached input   @ 0.3/M = 0.00015
    // output 200 @ 15/M  = 0.003
    // total = 0.00465
    expect(est.costUsd).toBeCloseTo(0.00465, 5);
    expect(est.breakdown[0]!.tokens!.cached).toBe(500);
  });

  it('per-action preview is correct within ±10%', () => {
    const mon = createBudgetMonitor({
      tenantId: 't-1',
      caps: { tenantMonthlyUsd: 100 },
      pricing,
    });
    const est = mon.estimate({
      description: 'multi-step plan',
      expectedInputTokens: 8_000,
      expectedOutputTokens: 1_500,
      expectedSeconds: 12,
    });
    // input 8000 @ 3/M  = 0.024
    // output 1500 @ 15/M = 0.0225
    // total = 0.0465
    const expected = 0.0465;
    const ratio = est.costUsd / expected;
    expect(ratio).toBeGreaterThanOrEqual(0.9);
    expect(ratio).toBeLessThanOrEqual(1.1);
  });

  it('includes extra cost lines (SMS sends, etc) in the total', () => {
    const mon = createBudgetMonitor({
      tenantId: 't-1',
      caps: { tenantMonthlyUsd: 10 },
      pricing,
    });
    const est = mon.estimate({
      description: 'send 14 SMS',
      expectedInputTokens: 1_000,
      expectedOutputTokens: 200,
      expectedSeconds: 5,
      extras: [{ label: 'SMS x 14 @ $0.04', costUsd: 0.56 }],
    });
    expect(est.costUsd).toBeCloseTo(0.006 + 0.56, 5);
    expect(est.breakdown.length).toBe(2);
  });
});

describe('createBudgetMonitor — caps + approve', () => {
  it('approves when within tenant cap', () => {
    const mon = createBudgetMonitor({
      tenantId: 't-1',
      caps: { tenantMonthlyUsd: 1 },
      pricing,
    });
    const est = mon.estimate({
      description: 'small action',
      expectedInputTokens: 100,
      expectedOutputTokens: 50,
      expectedSeconds: 1,
    });
    const r = mon.approve('conv-1', est);
    expect(r.ok).toBe(true);
  });

  it('rejects with tenant-cap-reached when projected spend exceeds cap', () => {
    const mon = createBudgetMonitor({
      tenantId: 't-1',
      caps: { tenantMonthlyUsd: 0.001 },
      pricing,
    });
    const est = mon.estimate({
      description: 'expensive action',
      expectedInputTokens: 100_000,
      expectedOutputTokens: 10_000,
      expectedSeconds: 30,
    });
    const r = mon.approve('conv-1', est);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error('unreachable');
    expect(r.error.kind).toBe('tenant-cap-reached');
  });

  it('rejects with conversation-cap-reached when conv cap would be exceeded', () => {
    const mon = createBudgetMonitor({
      tenantId: 't-1',
      caps: { tenantMonthlyUsd: 10, conversationUsd: 0.001 },
      pricing,
    });
    const est = mon.estimate({
      description: 'expensive in conv',
      expectedInputTokens: 100_000,
      expectedOutputTokens: 10_000,
      expectedSeconds: 30,
    });
    const r = mon.approve('conv-1', est);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error('unreachable');
    expect(r.error.kind).toBe('conversation-cap-reached');
  });
});

describe('createBudgetMonitor — recordSpend + hard-stop', () => {
  it('records spend immutably and accumulates per conversation', () => {
    const mon0 = createBudgetMonitor({
      tenantId: 't-1',
      caps: { tenantMonthlyUsd: 10 },
      pricing,
    });
    const mon1 = mon0.recordSpend('conv-1', 0.25, 0.5);
    const mon2 = mon1.recordSpend('conv-1', 0.5, 0.5);
    expect(mon0.state.tenantSpentUsd).toBe(0);
    expect(mon1.state.tenantSpentUsd).toBeCloseTo(0.25, 6);
    expect(mon2.state.tenantSpentUsd).toBeCloseTo(0.75, 6);
    expect(mon2.state.conversations['conv-1']).toBeCloseTo(0.75, 6);
  });

  it('hard-stops at the monthly cap', () => {
    const mon0 = createBudgetMonitor({
      tenantId: 't-1',
      caps: { tenantMonthlyUsd: 1 },
      pricing,
    });
    const mon1 = mon0.recordSpend('c-1', 1, 0.5);
    expect(mon1.isTenantCapReached()).toBe(true);
    expect(mon1.state.tenantOver).toBe(true);
    // a `cap-reached` event was emitted.
    const capEvents = mon1.events.filter((e) => e.kind === 'cap-reached');
    expect(capEvents.length).toBe(1);
  });

  it('cap enforcement is monotonic — once hit, approve fails forever', () => {
    let mon = createBudgetMonitor({
      tenantId: 't-1',
      caps: { tenantMonthlyUsd: 0.1 },
      pricing,
    });
    mon = mon.recordSpend('c-1', 0.1, 0.5);
    const est = mon.estimate({
      description: 'one more',
      expectedInputTokens: 100,
      expectedOutputTokens: 50,
      expectedSeconds: 1,
    });
    const r = mon.approve('c-1', est);
    expect(r.ok).toBe(false);
  });

  it('observedCacheHitRate is updated via EMA across samples', () => {
    let mon = createBudgetMonitor({
      tenantId: 't-1',
      caps: { tenantMonthlyUsd: 10 },
      pricing,
    });
    expect(mon.observedCacheHitRate()).toBe(0);
    mon = mon.recordSpend('c-1', 0.01, 1.0);
    expect(mon.observedCacheHitRate()).toBeCloseTo(0.2, 6); // 0*(0.8) + 1*(0.2) = 0.2
    mon = mon.recordSpend('c-1', 0.01, 1.0);
    expect(mon.observedCacheHitRate()).toBeCloseTo(0.36, 4); // 0.2*0.8 + 1*0.2 = 0.36
  });

  it('observedCacheHitRate stays clamped to [0, 1]', () => {
    let mon = createBudgetMonitor({
      tenantId: 't-1',
      caps: { tenantMonthlyUsd: 10 },
      pricing,
    });
    mon = mon.recordSpend('c-1', 0.01, 2.0); // out-of-range sample
    expect(mon.observedCacheHitRate()).toBeLessThanOrEqual(1);
    mon = mon.recordSpend('c-1', 0.01, -1.0);
    expect(mon.observedCacheHitRate()).toBeGreaterThanOrEqual(0);
  });

  it('isConversationCapReached returns false when no conv cap set', () => {
    const mon = createBudgetMonitor({
      tenantId: 't-1',
      caps: { tenantMonthlyUsd: 10 },
      pricing,
    });
    expect(mon.isConversationCapReached('c-1')).toBe(false);
  });
});

describe('buildBudgetPreviewCard', () => {
  it('emits a budget-preview-card AG-UI part with approve/deny actions', () => {
    const mon = createBudgetMonitor({
      tenantId: 't-1',
      caps: { tenantMonthlyUsd: 5 },
      pricing,
    });
    const est = mon.estimate({
      description: 'preview',
      expectedInputTokens: 100,
      expectedOutputTokens: 50,
      expectedSeconds: 1,
    });
    const card = buildBudgetPreviewCard({
      estimate: est,
      monthlyRemainingUsd: 4.5,
      approveAction: 'budget.approve',
      denyAction: 'budget.deny',
      title: 'Approve this action?',
    });
    expect(card.kind).toBe('budget-preview-card');
    expect(card.approveAction).toBe('budget.approve');
    expect(card.denyAction).toBe('budget.deny');
    expect(card.costUsd).toBe(est.costUsd);
    expect(card.monthlyRemainingUsd).toBe(4.5);
  });
});
