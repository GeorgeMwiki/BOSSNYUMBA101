/**
 * Opportunity prioritizer — MCDA over (IRR vs. ESG vs. urgency).
 *
 * IRR proxy:        log(1 + abatement tons / 1000) — bigger is better
 * ESG proxy:        opportunity.score (already in [0, 1])
 * Urgency proxy:    1.0 if 'pollution-prevention' or 'climate-adaptation'
 *                   category; 0.6 if 'renewable-energy'; 0.4 otherwise.
 *
 * Weights default to DEFAULT_MCDA_WEIGHTS; tenant-tunable.
 *
 * Pure. No I/O.
 */

import {
  DEFAULT_MCDA_WEIGHTS,
  type GreenOpportunity,
  type MCDAWeights,
} from '../types.js';

export interface Priority {
  readonly opportunityId: string;
  readonly rank: number;
  readonly mcdaScore: number;
  readonly reasoning: string;
}

export function prioritizeOpportunities(
  opportunities: readonly GreenOpportunity[],
  weights: MCDAWeights = DEFAULT_MCDA_WEIGHTS,
): readonly Priority[] {
  const sum = weights.irr + weights.esg + weights.urgency;
  if (Math.abs(sum - 1) > 0.01) {
    throw new Error(`MCDA weights must sum to 1.0 (got ${sum.toFixed(3)})`);
  }

  const scored = opportunities.map((o) => {
    const irrProxy = Math.min(1, Math.log10(1 + o.estimatedTCO2ePerYear / 1000));
    const urgency = urgencyScore(o.category);
    const mcda = weights.irr * irrProxy + weights.esg * o.score + weights.urgency * urgency;
    return { opportunity: o, mcda };
  });

  const sorted = [...scored].sort((a, b) => b.mcda - a.mcda);

  return sorted.map((entry, i) => ({
    opportunityId: entry.opportunity.id,
    rank: i + 1,
    mcdaScore: Math.round(entry.mcda * 1000) / 1000,
    reasoning: `IRR=${entry.opportunity.estimatedTCO2ePerYear} tCO2e/yr; ESG=${entry.opportunity.score.toFixed(2)}; urgency=${urgencyScore(entry.opportunity.category).toFixed(1)}`,
  }));
}

function urgencyScore(category: GreenOpportunity['category']): number {
  if (category === 'pollution-prevention' || category === 'climate-adaptation') return 1.0;
  if (category === 'renewable-energy' || category === 'transport-emissions') return 0.6;
  if (category === 'biodiversity' || category === 'land-use') return 0.5;
  return 0.4;
}
