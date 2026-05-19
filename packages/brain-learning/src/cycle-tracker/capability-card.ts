/**
 * Capability-card payload renderer.
 *
 * Phase N-A's `Capability Card UI` renders the brain's self-report.
 * This module produces the JSON payload it consumes — a stable contract
 * so the UI can evolve independently.
 *
 * The payload mirrors §10 R-LEARNING Day-90 dashboard:
 *   - 12-week Inspect pass-rate
 *   - NPS delta vs Day-0
 *   - cost-per-turn delta
 *   - skill promotions/quarantines this week
 *   - active-learning queue health
 *   - "we ran X fine-tune cycles, Y promoted, Z rolled back"
 */

import type { WeeklyDigest } from '../types.js';

/**
 * Stable JSON payload for N-A's capability-card UI.
 */
export interface CapabilityCardPayload {
  readonly weekIso: string;
  readonly headlineText: string;
  readonly metrics: ReadonlyArray<CapabilityCardMetric>;
  readonly chart: CapabilityCardChart;
}

export interface CapabilityCardMetric {
  readonly label: string;
  readonly value: string;
  /** Trend direction relative to last week, for the UI to colour. */
  readonly trend: 'up' | 'down' | 'flat';
}

export interface CapabilityCardChart {
  readonly type: 'line';
  readonly label: string;
  readonly data: ReadonlyArray<number>;
}

/**
 * Render a digest into the capability-card payload.
 */
export function renderCapabilityCardPayload(
  digest: WeeklyDigest,
): CapabilityCardPayload {
  const totalPairs =
    digest.pairsCollected.dpo +
    digest.pairsCollected.kto +
    digest.pairsCollected.simpo +
    digest.pairsCollected.prmStepDpo;

  const metrics: CapabilityCardMetric[] = [
    {
      label: 'Pairs collected (DPO+KTO+SimPO+PRM)',
      value: String(totalPairs),
      trend: totalPairs > 0 ? 'up' : 'flat',
    },
    {
      label: 'Active-learning queue',
      value: `${digest.activeLearningQueueDepth} pending · ${(digest.activeLearningLabelRate * 100).toFixed(0)}% label-rate`,
      trend: digest.activeLearningLabelRate >= 0.6 ? 'up' : 'down',
    },
    {
      label: 'Skill curation',
      value: `+${digest.skillPromotions} promoted · ${digest.skillQuarantines} quarantined`,
      trend: digest.skillPromotions > digest.skillQuarantines ? 'up' : 'flat',
    },
    {
      label: 'Knowledge graph',
      value: `+${digest.kgGrowth.added} nodes · ${digest.kgGrowth.pruned} pruned`,
      trend: digest.kgGrowth.added > 0 ? 'up' : 'flat',
    },
    {
      label: 'NPS delta',
      value: `${digest.npsDelta > 0 ? '+' : ''}${digest.npsDelta.toFixed(2)}`,
      trend: digest.npsDelta > 0 ? 'up' : digest.npsDelta < 0 ? 'down' : 'flat',
    },
    {
      label: 'Cost / conversation Δ',
      value: `${digest.costPerConversationDelta > 0 ? '+' : ''}${(digest.costPerConversationDelta * 100).toFixed(1)}%`,
      // For cost, "down" is good.
      trend:
        digest.costPerConversationDelta < 0
          ? 'up'
          : digest.costPerConversationDelta > 0
            ? 'down'
            : 'flat',
    },
  ];

  return Object.freeze({
    weekIso: digest.weekIso,
    headlineText: buildHeadline(digest, totalPairs),
    metrics: Object.freeze(metrics),
    chart: Object.freeze({
      type: 'line' as const,
      label: 'Inspect pass-rate (12-week trend)',
      data: Object.freeze([...digest.inspectPassRateTrend]),
    }),
  });
}

function buildHeadline(digest: WeeklyDigest, totalPairs: number): string {
  const npsClause =
    digest.npsDelta > 0 ? `NPS +${digest.npsDelta.toFixed(2)}` : 'NPS flat';
  const costClause =
    digest.costPerConversationDelta < 0
      ? `cost ${(digest.costPerConversationDelta * 100).toFixed(1)}%`
      : 'cost flat';
  return `Week ${digest.weekIso}: ${totalPairs} pairs · ${digest.skillPromotions} skill promotions · ${npsClause} · ${costClause}`;
}
