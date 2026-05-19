/**
 * 90-day-cycle weekly digest builder (§10 R-LEARNING).
 *
 * Aggregates per-week stats from each upstream module:
 *   - preference pairs collected  (Module 3)
 *   - active-learning depth/rate  (Module 4)
 *   - Inspect pass-rate trend     (Module 5, 12-week chart)
 *   - skill promotions/quarantines (Module 6)
 *   - KG growth/pruning           (Module 7)
 *   - NPS delta + cost-per-conv   (kernel-side ports)
 *
 * Renders via N-A's chat / capability-card UI — see
 * `renderCapabilityCardPayload`.
 */

import type { WeeklyDigest } from '../types.js';

/**
 * Sources of digest data. Each method is delegated to a wire-side port.
 */
export interface CycleTrackerSources {
  readonly weekIso: string;
  readonly preferencePairs: () => Promise<{
    dpo: number;
    kto: number;
    simpo: number;
    prmStepDpo: number;
  }>;
  readonly activeLearning: () => Promise<{
    queueDepth: number;
    labelRate: number;
  }>;
  readonly inspectPassRateTrend: () => Promise<ReadonlyArray<number>>;
  readonly skillCuration: () => Promise<{
    promotions: number;
    quarantines: number;
  }>;
  readonly kgGrowth: () => Promise<{ added: number; pruned: number }>;
  readonly npsDelta: () => Promise<number>;
  readonly costPerConversationDelta: () => Promise<number>;
}

export interface CycleTrackerPorts {
  readonly sources: CycleTrackerSources;
}

/**
 * Builds a frozen WeeklyDigest by reading from each source.
 */
export async function buildWeeklyDigest(
  ports: CycleTrackerPorts,
): Promise<WeeklyDigest> {
  const [
    pairs,
    al,
    trend,
    skills,
    kg,
    nps,
    cost,
  ] = await Promise.all([
    ports.sources.preferencePairs(),
    ports.sources.activeLearning(),
    ports.sources.inspectPassRateTrend(),
    ports.sources.skillCuration(),
    ports.sources.kgGrowth(),
    ports.sources.npsDelta(),
    ports.sources.costPerConversationDelta(),
  ]);

  return Object.freeze({
    weekIso: ports.sources.weekIso,
    pairsCollected: Object.freeze({
      dpo: pairs.dpo,
      kto: pairs.kto,
      simpo: pairs.simpo,
      prmStepDpo: pairs.prmStepDpo,
    }),
    activeLearningQueueDepth: al.queueDepth,
    activeLearningLabelRate: al.labelRate,
    inspectPassRateTrend: Object.freeze([...trend]),
    skillPromotions: skills.promotions,
    skillQuarantines: skills.quarantines,
    kgGrowth: Object.freeze({ added: kg.added, pruned: kg.pruned }),
    npsDelta: nps,
    costPerConversationDelta: cost,
  });
}
