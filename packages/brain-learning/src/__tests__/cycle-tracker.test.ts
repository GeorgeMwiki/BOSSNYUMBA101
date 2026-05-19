/**
 * 90-day-cycle-tracker tests.
 *
 * Covers digest aggregation + capability-card payload rendering.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  buildWeeklyDigest,
  renderCapabilityCardPayload,
  type CycleTrackerPorts,
} from '../cycle-tracker/index.js';

function mkSources(overrides?: Partial<CycleTrackerPorts['sources']>) {
  return {
    weekIso: '2026-W20',
    preferencePairs: vi.fn(async () => ({
      dpo: 5,
      kto: 7,
      simpo: 3,
      prmStepDpo: 1,
    })),
    activeLearning: vi.fn(async () => ({
      queueDepth: 12,
      labelRate: 0.75,
    })),
    inspectPassRateTrend: vi.fn(async () => [0.7, 0.75, 0.8, 0.82, 0.85]),
    skillCuration: vi.fn(async () => ({
      promotions: 2,
      quarantines: 1,
    })),
    kgGrowth: vi.fn(async () => ({ added: 50, pruned: 10 })),
    npsDelta: vi.fn(async () => 0.5),
    costPerConversationDelta: vi.fn(async () => -0.35),
    ...overrides,
  };
}

describe('buildWeeklyDigest', () => {
  it('aggregates from all 7 sources', async () => {
    const sources = mkSources();
    const digest = await buildWeeklyDigest({ sources });
    expect(digest.weekIso).toBe('2026-W20');
    expect(digest.pairsCollected.dpo).toBe(5);
    expect(digest.pairsCollected.kto).toBe(7);
    expect(digest.pairsCollected.simpo).toBe(3);
    expect(digest.pairsCollected.prmStepDpo).toBe(1);
    expect(digest.activeLearningQueueDepth).toBe(12);
    expect(digest.activeLearningLabelRate).toBeCloseTo(0.75);
    expect(digest.inspectPassRateTrend.length).toBe(5);
    expect(digest.skillPromotions).toBe(2);
    expect(digest.skillQuarantines).toBe(1);
    expect(digest.kgGrowth.added).toBe(50);
    expect(digest.kgGrowth.pruned).toBe(10);
    expect(digest.npsDelta).toBe(0.5);
    expect(digest.costPerConversationDelta).toBe(-0.35);
  });

  it('result is frozen (immutability)', async () => {
    const digest = await buildWeeklyDigest({ sources: mkSources() });
    expect(Object.isFrozen(digest)).toBe(true);
    expect(Object.isFrozen(digest.pairsCollected)).toBe(true);
    expect(Object.isFrozen(digest.inspectPassRateTrend)).toBe(true);
  });

  it('runs sources in parallel', async () => {
    const sources = mkSources();
    await buildWeeklyDigest({ sources });
    expect(sources.preferencePairs).toHaveBeenCalledTimes(1);
    expect(sources.activeLearning).toHaveBeenCalledTimes(1);
    expect(sources.skillCuration).toHaveBeenCalledTimes(1);
    expect(sources.kgGrowth).toHaveBeenCalledTimes(1);
  });
});

describe('renderCapabilityCardPayload', () => {
  it('renders 6 metrics + a line chart with the trend', async () => {
    const digest = await buildWeeklyDigest({ sources: mkSources() });
    const payload = renderCapabilityCardPayload(digest);
    expect(payload.weekIso).toBe('2026-W20');
    expect(payload.metrics.length).toBe(6);
    expect(payload.chart.type).toBe('line');
    expect(payload.chart.data.length).toBe(5);
  });

  it('headlineText contains pairs + skill + NPS + cost', async () => {
    const digest = await buildWeeklyDigest({ sources: mkSources() });
    const payload = renderCapabilityCardPayload(digest);
    expect(payload.headlineText).toContain('16'); // 5+7+3+1
    expect(payload.headlineText).toContain('2'); // promotions
    expect(payload.headlineText).toContain('NPS');
    expect(payload.headlineText).toContain('cost');
  });

  it('cost metric trend=up when cost dropped (negative delta)', async () => {
    const sources = mkSources({
      costPerConversationDelta: vi.fn(async () => -0.5),
    });
    const digest = await buildWeeklyDigest({ sources });
    const payload = renderCapabilityCardPayload(digest);
    const costMetric = payload.metrics.find((m) =>
      m.label.includes('Cost / conversation'),
    )!;
    expect(costMetric.trend).toBe('up');
  });

  it('cost metric trend=down when cost rose (positive delta)', async () => {
    const sources = mkSources({
      costPerConversationDelta: vi.fn(async () => 0.1),
    });
    const digest = await buildWeeklyDigest({ sources });
    const payload = renderCapabilityCardPayload(digest);
    const costMetric = payload.metrics.find((m) =>
      m.label.includes('Cost / conversation'),
    )!;
    expect(costMetric.trend).toBe('down');
  });

  it('active-learning trend=down when label-rate < 60%', async () => {
    const sources = mkSources({
      activeLearning: vi.fn(async () => ({
        queueDepth: 30,
        labelRate: 0.4,
      })),
    });
    const digest = await buildWeeklyDigest({ sources });
    const payload = renderCapabilityCardPayload(digest);
    const al = payload.metrics.find((m) =>
      m.label.includes('Active-learning'),
    )!;
    expect(al.trend).toBe('down');
  });
});
