/**
 * Lender selector — ranks lender types against deal attributes.
 *
 * Authority: Fannie Mae DUS Lender Memo 2026, Freddie Mac Optigo
 * 2026, Trepp CMBS Q1-2026, MBA 2026 Commercial / Multifamily
 * Mortgage Origination Survey.
 *
 * Per-lender suitability is a multiplicative score of:
 *   asset-class fit × jurisdiction availability × LTV fit ×
 *   term fit × transitional/trophy fit.
 */

import type {
  LenderCandidate,
  LenderSelectionInputs,
  LenderSelectionResult,
  LenderType,
  AssetClass,
  Jurisdiction,
} from '../types.js';

interface LenderProfile {
  readonly type: LenderType;
  readonly typicalLTV: [number, number];
  readonly typicalSpreadBps: [number, number];
  readonly prepayPenalty: string;
  readonly notes: string;
  readonly bestForAssetClasses: ReadonlyArray<AssetClass>;
  readonly bestForJurisdictions: ReadonlyArray<Jurisdiction | 'US' | 'EA' | 'UK' | 'GLOBAL'>;
  readonly trophyFriendly: boolean;
  readonly transitionalFriendly: boolean;
  readonly minTermYears: number;
}

const LENDERS: ReadonlyArray<LenderProfile> = [
  {
    type: 'agency',
    typicalLTV: [0.65, 0.80],
    typicalSpreadBps: [175, 225],
    prepayPenalty: 'YM or defeasance',
    notes: 'Fannie/Freddie multifamily-only',
    bestForAssetClasses: ['multifamily'],
    bestForJurisdictions: ['US'],
    trophyFriendly: false,
    transitionalFriendly: false,
    minTermYears: 5,
  },
  {
    type: 'life-co',
    typicalLTV: [0.55, 0.65],
    typicalSpreadBps: [150, 225],
    prepayPenalty: 'YM, sometimes open',
    notes: 'Trophy / Class-A only',
    bestForAssetClasses: ['office', 'retail', 'multifamily', 'industrial'],
    bestForJurisdictions: ['US', 'UK'],
    trophyFriendly: true,
    transitionalFriendly: false,
    minTermYears: 10,
  },
  {
    type: 'cmbs',
    typicalLTV: [0.60, 0.75],
    typicalSpreadBps: [250, 350],
    prepayPenalty: 'defeasance',
    notes: 'Mid-sized, broad asset-class coverage',
    bestForAssetClasses: ['office', 'retail', 'industrial', 'multifamily', 'mixed-use'],
    bestForJurisdictions: ['US'],
    trophyFriendly: false,
    transitionalFriendly: false,
    minTermYears: 5,
  },
  {
    type: 'bank',
    typicalLTV: [0.55, 0.75],
    typicalSpreadBps: [250, 400],
    prepayPenalty: 'open',
    notes: 'Construction & bridge specialty',
    bestForAssetClasses: ['office', 'retail', 'industrial', 'multifamily', 'mixed-use', 'land'],
    bestForJurisdictions: ['US', 'UK'],
    trophyFriendly: false,
    transitionalFriendly: true,
    minTermYears: 3,
  },
  {
    type: 'debt-fund',
    typicalLTV: [0.65, 0.80],
    typicalSpreadBps: [400, 700],
    prepayPenalty: 'open + exit fee',
    notes: 'Transitional / value-add, USD-denominated cross-border',
    bestForAssetClasses: ['office', 'retail', 'industrial', 'multifamily', 'mixed-use'],
    bestForJurisdictions: ['US', 'UK', 'KE', 'TZ', 'UG', 'NG', 'ZA'],
    trophyFriendly: false,
    transitionalFriendly: true,
    minTermYears: 2,
  },
  {
    type: 'mezz',
    typicalLTV: [0.65, 0.85],
    typicalSpreadBps: [800, 1200],
    prepayPenalty: 'open',
    notes: 'Top-up to 80-85% incremental LTV',
    bestForAssetClasses: ['office', 'retail', 'industrial', 'multifamily', 'mixed-use'],
    bestForJurisdictions: ['US', 'UK'],
    trophyFriendly: true,
    transitionalFriendly: true,
    minTermYears: 3,
  },
  {
    type: 'ea-tier-1-bank',
    typicalLTV: [0.50, 0.65],
    typicalSpreadBps: [300, 500],
    prepayPenalty: 'open after lockout',
    notes: 'KCB / Equity / Stanbic Kenya, CRDB / NMB Tanzania',
    bestForAssetClasses: ['office', 'retail', 'industrial', 'multifamily', 'mixed-use'],
    bestForJurisdictions: ['KE', 'TZ', 'UG'],
    trophyFriendly: false,
    transitionalFriendly: false,
    minTermYears: 5,
  },
];

function inRange(value: number, range: readonly [number, number]): number {
  const [lo, hi] = range;
  if (value >= lo && value <= hi) return 1;
  const mid = (lo + hi) / 2;
  const span = hi - lo;
  if (span <= 0) return value === lo ? 1 : 0;
  const dev = Math.abs(value - mid) / span;
  return Math.max(0, 1 - dev);
}

function jurisdictionFit(j: Jurisdiction, supported: ReadonlyArray<string>): number {
  if (supported.includes(j)) return 1;
  if (supported.includes('GLOBAL')) return 0.7;
  return 0;
}

export function selectLender(
  inputs: Readonly<LenderSelectionInputs>,
): LenderSelectionResult {
  const scored: LenderCandidate[] = LENDERS.map((p) => {
    const assetFit = p.bestForAssetClasses.includes(inputs.assetClass) ? 1 : 0.2;
    const jurFit = jurisdictionFit(inputs.jurisdiction, p.bestForJurisdictions);
    const ltvFit = inRange(inputs.desiredLTV, p.typicalLTV);
    const termFit = inputs.desiredTermYears >= p.minTermYears ? 1 : inputs.desiredTermYears / p.minTermYears;
    const transFit = inputs.transitional && !p.transitionalFriendly ? 0.3 : 1;
    const trophyFit = inputs.trophyAsset && !p.trophyFriendly ? 0.5 : 1;
    const score = assetFit * jurFit * ltvFit * termFit * transFit * trophyFit;
    return {
      type: p.type,
      suitabilityScore: score,
      typicalLTV: p.typicalLTV,
      typicalSpreadBps: p.typicalSpreadBps,
      prepayPenalty: p.prepayPenalty,
      notes: p.notes,
    };
  });

  const ranked = [...scored].sort((a, b) => b.suitabilityScore - a.suitabilityScore);
  const top2 = ranked.filter((r) => r.suitabilityScore > 0).slice(0, 2);
  return {
    ranked,
    recommendedTop2: top2,
  };
}
