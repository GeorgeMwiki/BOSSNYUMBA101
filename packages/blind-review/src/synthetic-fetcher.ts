/**
 * Synthetic decision fetcher — a reference {@link DecisionFetcher} for CI
 * and local dev.
 *
 * Production wires a real archive-backed fetcher; this one fabricates a
 * deterministic, seedable corpus of marginal real-estate decisions
 * (lease / rent / deposit) split between AI-authored (Mr. Mwikila) and
 * human-authored rationales, so the whole pipeline runs end-to-end with no
 * external I/O. The AI rationales carry tidy structured markers; the human
 * rationales carry casual artefacts — the gap a reviewer would (try to)
 * detect.
 *
 * @module @bossnyumba/blind-review/synthetic-fetcher
 */

import { mulberry32 } from './shuffle.js';
import {
  DEFAULT_SEED,
  type LeaseDecisionOutcome,
  type MarginalDecisionRecord,
} from './types.js';
import type { DecisionFetcher } from './ports.js';

export interface SyntheticFetcherOptions {
  readonly seed?: number;
  readonly humanArtefacts?: boolean;
  readonly aiArtefacts?: boolean;
}

const PROPERTY_TYPE_BUCKETS = [
  'apartment',
  'townhouse',
  'commercial',
  'standalone',
] as const;

const REGION_BUCKETS = [
  'dar',
  'arusha',
  'mwanza',
  'dodoma',
  'mbeya',
] as const;

const DECISIONS: ReadonlyArray<LeaseDecisionOutcome> = [
  'approve',
  'reject',
  'request_more_info',
];

function pick<T>(arr: ReadonlyArray<T>, rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)] as T;
}

export function createSyntheticFetcher(
  options: SyntheticFetcherOptions = {},
): DecisionFetcher {
  const seed = options.seed ?? DEFAULT_SEED;
  const humanArtefacts = options.humanArtefacts ?? true;
  const aiArtefacts = options.aiArtefacts ?? true;

  function build(author: 'ai' | 'human', n: number): MarginalDecisionRecord[] {
    const rng = mulberry32(seed + (author === 'ai' ? 1 : 2));
    const records: MarginalDecisionRecord[] = [];
    for (let i = 0; i < n; i++) {
      const decision = pick(DECISIONS, rng);
      const propertyType = pick(PROPERTY_TYPE_BUCKETS, rng);
      const region = pick(REGION_BUCKETS, rng);
      const conditionScore = (1 + rng() * 6).toFixed(2); // 0..10 inspection score
      const rentCoverage = (rng() * 0.45 + 0.4).toFixed(2); // income-to-rent ratio
      const rationale =
        author === 'ai' && aiArtefacts
          ? `Decision: ${decision}. Inspection: condition ${conditionScore}/10; Affordability: rent coverage ${rentCoverage}; Conditions: ${propertyType} demand cyclicality; Tenancy: lease in good standing; History: 24-month occupancy record. Indicators show ${decision === 'approve' ? 'borderline acceptable' : 'marginal'} suitability.`
          : humanArtefacts
            ? `condition score around ${conditionScore}/10, rent cover ${rentCoverage} -- given the ${propertyType} market in ${region} im leaning ${decision} but want a peer review.`
            : `condition ${conditionScore}, rent cover ${rentCoverage}, type ${propertyType}, region ${region}, decision ${decision}.`;
      records.push({
        id: `${author}-syn-${i}-${Math.floor(rng() * 1e6)}`,
        caseId: `case-${author}-${i}`,
        domain: 'rent',
        decision,
        rationale,
        snapshot: {
          inspection: { conditionScore: Number(conditionScore) },
          affordability: { rentCoverage: Number(rentCoverage) },
          conditions: { propertyType, region },
          tenancy: { inGoodStanding: rng() > 0.4 },
          history: { occupancyMonths: 12 + Math.floor(rng() * 36) },
        },
        author,
        decidedAtIsoYear: '2025',
        propertyTypeBucket: propertyType,
        regionBucket: region,
      });
    }
    return records;
  }

  return {
    async fetchAi(limit: number) {
      return build('ai', limit);
    },
    async fetchHuman(limit: number) {
      return build('human', limit);
    },
  };
}
