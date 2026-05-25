/**
 * retention-tactic-ranker — concession / upgrade / amenity ranking.
 *
 * Per JTurner 2024 retention study. $-effect / $-spent ratios.
 */

export type RetentionLever =
  | 'rent-reduction'
  | 'smart-home-upgrade'
  | 'in-unit-w-d'
  | 'reserved-parking'
  | 'free-wifi'
  | 'gym-pool-refresh'
  | 'resident-events';

export interface LeverScore {
  readonly lever: RetentionLever;
  readonly roiLow: number;
  readonly roiHigh: number;
  readonly avgRoi: number;
  readonly note: string;
  readonly source: string;
}

export const RETENTION_LEVERS: Readonly<Record<RetentionLever, LeverScore>> = {
  'rent-reduction': {
    lever: 'rent-reduction',
    roiLow: 1.8,
    roiHigh: 2.4,
    avgRoi: 2.1,
    note: 'Lasts only as long as offered; sticky downward bias on future rents.',
    source: 'JTurner 2024',
  },
  'smart-home-upgrade': {
    lever: 'smart-home-upgrade',
    roiLow: 2.2,
    roiHigh: 3.1,
    avgRoi: 2.65,
    note: 'One-time spend, durable; attracts millennials/Gen-Z.',
    source: 'JTurner 2024',
  },
  'in-unit-w-d': {
    lever: 'in-unit-w-d',
    roiLow: 3.5,
    roiHigh: 4.8,
    avgRoi: 4.15,
    note: 'Highest ROI upgrade per NMHC 2024 + JTurner.',
    source: 'NMHC + JTurner 2024',
  },
  'reserved-parking': {
    lever: 'reserved-parking',
    roiLow: 2.0,
    roiHigh: 2.8,
    avgRoi: 2.4,
    note: 'Material where parking is scarce; muted in suburban properties.',
    source: 'JTurner 2024',
  },
  'free-wifi': {
    lever: 'free-wifi',
    roiLow: 1.5,
    roiHigh: 2.2,
    avgRoi: 1.85,
    note: 'Now table-stakes; absent is a churn driver, present is just expected.',
    source: 'JTurner 2024',
  },
  'gym-pool-refresh': {
    lever: 'gym-pool-refresh',
    roiLow: 1.2,
    roiHigh: 1.8,
    avgRoi: 1.5,
    note: 'Aging amenities hurt more than refreshed amenities help.',
    source: 'JTurner 2024',
  },
  'resident-events': {
    lever: 'resident-events',
    roiLow: 0.9,
    roiHigh: 1.4,
    avgRoi: 1.15,
    note: 'Social fit; soft signal; rewards lifestyle communities.',
    source: 'JTurner 2024',
  },
};

export interface RankingInput {
  readonly budgetUsd: number;
  readonly costPerLeverUsd: Partial<Record<RetentionLever, number>>;
  readonly excludedLevers?: ReadonlyArray<RetentionLever>;
}

export interface RankedLever {
  readonly lever: RetentionLever;
  readonly costUsd: number;
  readonly expectedReturnUsd: number;
  readonly avgRoi: number;
  readonly funded: boolean;
}

export function rankRetentionTactics(input: RankingInput): ReadonlyArray<RankedLever> {
  const excluded = new Set(input.excludedLevers ?? []);
  const allLevers = (Object.keys(RETENTION_LEVERS) as Array<RetentionLever>).filter(
    (l) => !excluded.has(l),
  );
  const sorted = allLevers
    .map((l) => {
      const cost = input.costPerLeverUsd[l] ?? 0;
      const meta = RETENTION_LEVERS[l];
      return {
        lever: l,
        costUsd: cost,
        avgRoi: meta.avgRoi,
        expectedReturnUsd: cost * meta.avgRoi,
      };
    })
    .filter((r) => r.costUsd > 0)
    .sort((a, b) => b.avgRoi - a.avgRoi);

  let spent = 0;
  const result: RankedLever[] = sorted.map((r) => {
    const funded = spent + r.costUsd <= input.budgetUsd;
    if (funded) spent += r.costUsd;
    return { ...r, funded };
  });
  return result;
}
