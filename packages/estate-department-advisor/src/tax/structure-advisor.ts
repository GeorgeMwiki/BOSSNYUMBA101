/**
 * structure-advisor — entity-structure recommendation.
 *
 * Maps portfolio scale + owner intent → REIT / LLC / Trust / GP-LP / C-Corp.
 *
 * EA REIT references:
 *   - Kenya CMA D-REIT / I-REIT / P-REIT
 *   - Tanzania CMSA REITs (5 registered since 2021)
 *   - Nigeria SEC REIT (4 listed)
 */

import type { Jurisdiction, OwnerArchetype, TaxOpportunity } from '../types.js';

export type EntityStructure = 'c-corp' | 'llc' | 'reit' | 'trust' | 'gp-lp';

export interface StructureInput {
  readonly portfolioGavUsd: number;
  readonly ownerArchetype: OwnerArchetype;
  readonly jurisdiction: Jurisdiction;
  readonly hasExternalInvestors: boolean;
  readonly hasGenerationalPlanning: boolean;
  readonly numProperties: number;
}

export interface StructureAdvice {
  readonly recommended: EntityStructure;
  readonly alternative?: EntityStructure;
  readonly rationale: string;
  readonly jurisdictionNote: string;
  readonly citation: string;
  readonly taxOpportunity?: TaxOpportunity;
}

function eaReitNote(j: Jurisdiction): string {
  switch (j) {
    case 'KE':
      return 'Kenya CMA REITs (D/I/P-REIT classes) — CMA Capital Markets Act Cap 485A.';
    case 'TZ':
      return 'Tanzania CMSA REITs registered since 2021 — Capital Markets and Securities Act.';
    case 'NG':
      return 'Nigeria SEC REIT framework — Investment & Securities Act 2007.';
    case 'ZA':
      return 'South African REITs under JSE listing requirements (Section 13quat).';
    case 'US':
      return 'US REIT — 90% distribution rule per IRC §856.';
    case 'UG':
    case 'RW':
      return `${j}: no developed REIT framework — use trust + share structure.`;
    default:
      return `${j} REIT framework — case-by-case.`;
  }
}

export function adviseStructure(input: StructureInput): StructureAdvice {
  const note = eaReitNote(input.jurisdiction);

  if (input.portfolioGavUsd > 250_000_000 && input.hasExternalInvestors) {
    return {
      recommended: 'reit',
      alternative: 'gp-lp',
      rationale: `> $250M GAV + external investors → REIT delivers institutional capital access with pass-through tax (90% distribution rule); GP-LP is the workhorse alternative.`,
      jurisdictionNote: note,
      citation: 'NAREIT structure-comparison + jurisdictional REIT frameworks',
    };
  }
  if (input.hasGenerationalPlanning) {
    return {
      recommended: 'trust',
      alternative: 'llc',
      rationale: 'Generational holding favours trust structures for estate-planning continuity and step-up basis benefits.',
      jurisdictionNote: note,
      citation: 'AICPA Trust & Estate planning standards 2024',
    };
  }
  if (input.hasExternalInvestors) {
    return {
      recommended: 'gp-lp',
      alternative: 'llc',
      rationale: 'Co-investor structures favour GP-LP for promote-and-waterfall tax efficiency.',
      jurisdictionNote: note,
      citation: 'PERE private-fund structuring 2024',
    };
  }
  if (input.numProperties <= 1) {
    return {
      recommended: 'llc',
      rationale: 'Single-asset hold: LLC provides liability isolation with pass-through tax — simplest structure.',
      jurisdictionNote: note,
      citation: 'AICPA RE entity-choice 2024',
    };
  }
  return {
    recommended: 'llc',
    alternative: 'gp-lp',
    rationale: 'Mid-scale multi-asset hold: LLC with internal sleeves preserves flexibility without REIT compliance burden.',
    jurisdictionNote: note,
    citation: 'AICPA + ULI entity-choice frameworks',
  };
}

export const __test__ = { eaReitNote };
