/**
 * Opportunity matcher — turns a ProjectProfile into a ranked
 * list of GreenOpportunity entries.
 *
 * Scoring (deterministic):
 *   base   = 0.5  if the opportunity is applicable
 *   bonus  = 0.1 per matched bonusSignal (max 0.3)
 *   hot    = 0.1 if the opportunity is on the project-type's hotAngleIds
 *   biome  = 0.05 per matched biome among the opportunity's required biomes
 *   sigjac = up to 0.15 Jaccard of (profile signals ∩ required+bonus)
 *
 * Final score clamped to [0, 1].
 *
 * Pure. No I/O. No LLM.
 */

import { profileForType } from '../project-typer/project-taxonomy.js';
import type { GreenOpportunity, ProjectProfile } from '../types.js';
import {
  isOpportunityApplicable,
  OPPORTUNITY_CATALOG,
  type OpportunityDescriptor,
} from './opportunity-catalog.js';

export interface MatchOptions {
  /** Minimum score required to be returned. Default: 0.5. */
  readonly minScore?: number;
  /** Max results returned. Default: unlimited. */
  readonly maxResults?: number;
}

export function matchOpportunities(
  profile: ProjectProfile,
  options: MatchOptions = {},
): readonly GreenOpportunity[] {
  const minScore = options.minScore ?? 0.5;

  const hotIds = new Set<string>(
    profile.projectTypes.flatMap((t) => profileForType(t).hotAngleIds),
  );

  const scored = OPPORTUNITY_CATALOG.filter((d) => isOpportunityApplicable(d, profile)).map(
    (desc) => {
      const score = scoreOpportunity(desc, profile, hotIds);
      const opportunity: GreenOpportunity = {
        id: desc.id,
        title: desc.title,
        category: desc.category,
        oneLiner: desc.oneLiner,
        rationale: buildRationale(desc, profile, hotIds),
        score,
        estimatedTCO2ePerYear: estimateAbatement(desc, profile),
        sdgTargets: desc.sdgTargets,
        references: desc.references,
      };
      return opportunity;
    },
  );

  const filtered = scored.filter((o) => o.score >= minScore);
  const sorted = [...filtered].sort((a, b) => b.score - a.score);
  return options.maxResults !== undefined ? sorted.slice(0, options.maxResults) : sorted;
}

function scoreOpportunity(
  desc: OpportunityDescriptor,
  profile: ProjectProfile,
  hotIds: ReadonlySet<string>,
): number {
  const base = 0.5;

  const matchedBonus = desc.bonusSignals.filter((s) => profile.signals.includes(s)).length;
  const bonus = Math.min(0.3, matchedBonus * 0.1);

  const hot = hotIds.has(desc.id) ? 0.1 : 0;

  const matchedBiomes = desc.requiredBiomes.filter((b) => profile.biomes.includes(b)).length;
  const biome = matchedBiomes * 0.05;

  // signal-Jaccard against required + bonus
  const wantedArr = [...desc.requiredSignals, ...desc.bonusSignals];
  const haveArr = [...profile.signals];
  const haveSet = new Set<string>(haveArr);
  const inter = wantedArr.filter((s) => haveSet.has(s)).length;
  const unionSize = new Set<string>([...wantedArr, ...haveArr]).size;
  const sigjac = unionSize === 0 ? 0 : Math.min(0.15, (inter / unionSize) * 0.15);

  return Math.min(1, base + bonus + hot + biome + sigjac);
}

function estimateAbatement(desc: OpportunityDescriptor, profile: ProjectProfile): number {
  const factor = desc.defaultAbatementFactor;
  if (factor === 0) return 0;

  // Linear corridors → scale by lengthKm if provided
  if (desc.requiredSignals.includes('linear-corridor') && profile.lengthKm && profile.lengthKm > 0) {
    // 1 MW per 5 km of ROW for corridor solar, etc.
    if (desc.id === 'corridor-solar') {
      const mw = profile.lengthKm / 5;
      return Math.round(factor * mw);
    }
    // Modal-shift scales sub-linearly with corridor length
    if (desc.id === 'modal-shift-freight') {
      return Math.round(factor * (profile.lengthKm / 450));
    }
  }
  // Point assets → scale by areaHa if provided
  if (profile.areaHa && profile.areaHa > 0) {
    if (desc.id === 'solar-pv-roof') {
      // 1 MWp per 1 ha rough proxy for tropical-climate self-supply
      return Math.round(factor * profile.areaHa);
    }
    if (desc.id === 'mangrove-restoration' || desc.id === 'seagrass-restoration') {
      return Math.round(factor * profile.areaHa);
    }
    if (desc.id === 'regen-ag-corridor') {
      return Math.round(factor * profile.areaHa);
    }
  }
  return factor;
}

function buildRationale(
  desc: OpportunityDescriptor,
  profile: ProjectProfile,
  hotIds: ReadonlySet<string>,
): string {
  const reasons: string[] = [];
  reasons.push(`Applies to ${desc.applicableProjectTypes.join('/')}.`);
  if (hotIds.has(desc.id)) reasons.push('Hot angle for this project type.');
  const matchedBonus = desc.bonusSignals.filter((s) => profile.signals.includes(s));
  if (matchedBonus.length > 0) reasons.push(`Bonus signals: ${matchedBonus.join(', ')}.`);
  return reasons.join(' ');
}
