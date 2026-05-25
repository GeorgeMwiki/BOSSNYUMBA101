/**
 * Veteran-expert report composer.
 *
 * Sequence (pure, deterministic):
 *
 *   1. classifyProject(description)         → ProjectProfile
 *   2. matchOpportunities(profile)          → GreenOpportunity[]
 *   3. matchFinancing(profile, opps)        → FinancingMatch[]
 *   4. matchMethodologies(profile, opps)    → CarbonMethodology[]
 *      + estimateOffsetVolume + forecastCreditValue per match
 *                                          → CarbonProjectMatch[]
 *   5. scoreCoBenefits(opps)                → ImpactScore
 *   6. prioritizeOpportunities(opps)        → Priority[]
 *   7. composeNarrative(*)                  → string (default heuristic)
 *
 * Optional final step: if an injected MultiLLMSynthesizerPort is
 * supplied via `deps.synthesizer`, the heuristic narrative is passed
 * to it as a draft + the structured payload as context; the
 * synthesizer returns a polished narrative.
 *
 * The PURE path (no synthesizer) always works and is fully tested.
 *
 * Reference: `.audit/sota-2026-05-24/05-green-angle-advisor.md` §10.
 */

import {
  classifyProject,
} from '../project-typer/project-classifier.js';
import { matchOpportunities } from '../opportunities/opportunity-matcher.js';
import { matchFinancing } from '../financing/financing-matcher.js';
import {
  matchMethodologies,
} from '../carbon-credits/methodology-matcher.js';
import { estimateOffsetVolume } from '../carbon-credits/offset-volume-estimator.js';
import { forecastCreditValue } from '../carbon-credits/credit-value-forecaster.js';
import { scoreCoBenefits } from '../impact/co-benefits-scorer.js';
import { prioritizeOpportunities } from './opportunity-prioritizer.js';

import {
  type CarbonProjectMatch,
  type GreenOpportunity,
  type FinancingMatch,
  type MCDAWeights,
  type MultiLLMSynthesizerPort,
  type ProjectDescription,
  type ProjectProfile,
  type VeteranExpertReport,
  DEFAULT_MCDA_WEIGHTS,
} from '../types.js';

export interface VeteranExpertOptions {
  readonly mcdaWeights?: MCDAWeights;
  readonly synthesizer?: MultiLLMSynthesizerPort;
  /** Min score for opportunities. Default 0.5. */
  readonly minOpportunityScore?: number;
  /** Max opportunities returned. Default unlimited. */
  readonly maxOpportunities?: number;
  /** Min score for financing. Default 0.5. */
  readonly minFinancingScore?: number;
  /** Max financing matches returned. Default unlimited. */
  readonly maxFinancing?: number;
}

export async function generateVeteranExpertReport(
  description: ProjectDescription,
  options: VeteranExpertOptions = {},
): Promise<VeteranExpertReport> {
  const profile = classifyProject(description);
  const opportunities = matchOpportunities(profile, {
    ...(options.minOpportunityScore !== undefined ? { minScore: options.minOpportunityScore } : {}),
    ...(options.maxOpportunities !== undefined ? { maxResults: options.maxOpportunities } : {}),
  });
  const financing = matchFinancing(profile, opportunities, {
    ...(options.minFinancingScore !== undefined ? { minScore: options.minFinancingScore } : {}),
    ...(options.maxFinancing !== undefined ? { maxResults: options.maxFinancing } : {}),
  });
  const methodologies = matchMethodologies(profile, opportunities);
  const carbon = buildCarbonMatches(profile, methodologies);
  const impact = scoreCoBenefits(opportunities);
  const priorities = prioritizeOpportunities(opportunities, options.mcdaWeights ?? DEFAULT_MCDA_WEIGHTS);

  const heuristic = composeHeuristicNarrative(profile, opportunities, financing, carbon, impact);

  let narrative = heuristic;
  if (options.synthesizer) {
    try {
      const synth = await options.synthesizer.synthesize({
        prompt: heuristic,
        context: {
          profile,
          opportunities,
          financing,
          carbon,
          impact,
          priorities,
        },
      });
      // Honour the synthesizer ONLY if it returns a meaningful answer.
      if (synth?.answer && synth.answer.trim().length > 0) {
        narrative = synth.answer;
      }
    } catch (error) {
      // Fall back to heuristic; never throw from synth path.
      // We intentionally swallow `error` here: it may contain raw prompt
      // text or context bytes that include tenant PII. Callers needing
      // structured visibility should wrap the synthesizer with their own
      // logging layer before injecting it via `options.synthesizer`.
      void error;
    }
  }

  return {
    profile,
    opportunities,
    financing,
    carbon,
    impact,
    narrative,
    priorities,
  };
}

function buildCarbonMatches(
  profile: ProjectProfile,
  methodologies: readonly import('../types.js').CarbonMethodology[],
): readonly CarbonProjectMatch[] {
  return methodologies.map((m) => {
    const vol = estimateOffsetVolume(profile, m);
    const value = forecastCreditValue(m, vol.creditingPeriodYears);
    const lifetimeValue = vol.lifetimeTCO2e * value.forwardAverageUsdPerTon;
    const result: CarbonProjectMatch = {
      methodology: m,
      estimatedTCO2ePerYear: vol.tCO2ePerYear,
      creditingPeriodYears: vol.creditingPeriodYears,
      forwardValueUsdPerTon: value.forwardAverageUsdPerTon,
      estimatedLifetimeValueUsd: Math.round(lifetimeValue),
      gatesToClear: gatesForMethodology(m.id),
    };
    return result;
  });
}

function gatesForMethodology(id: string): readonly string[] {
  const gates: string[] = ['Methodology registration with registry'];
  if (id.startsWith('VCS-')) {
    gates.push('VCS validation + verification body engagement');
    gates.push('Project Design Document (PDD)');
  }
  if (id.startsWith('GS-')) {
    gates.push('Gold Standard project preliminary review');
  }
  if (id.startsWith('PACM')) {
    gates.push('Host-country Article 6.4 authorisation');
    gates.push('Corresponding adjustment letter');
  }
  if (id === 'VCS-VM0033' || id === 'VCS-VM0035') {
    gates.push('Coastal land-tenure clearance');
    gates.push('Baseline coastal ecosystem survey');
  }
  if (id === 'VCS-VMR0006') {
    gates.push('Baseline modal-split study');
    gates.push('Tonne-km monitoring system');
  }
  return gates;
}

function composeHeuristicNarrative(
  profile: ProjectProfile,
  opportunities: readonly GreenOpportunity[],
  financing: readonly FinancingMatch[],
  carbon: readonly CarbonProjectMatch[],
  impact: ReturnType<typeof scoreCoBenefits>,
): string {
  const lines: string[] = [];
  lines.push('--- Veteran-Expert Green-Angle Report ---');
  lines.push('');
  lines.push(`Project profile: ${profile.projectTypes.join(', ') || 'unclassified'} in ${profile.jurisdictions.join(', ')}.`);
  lines.push(`Classification confidence: ${(profile.confidence * 100).toFixed(0)}%.`);
  lines.push('');
  lines.push(`Top opportunities (${opportunities.length} matched):`);
  opportunities.slice(0, 8).forEach((o, i) => {
    const tons = o.estimatedTCO2ePerYear > 0 ? ` (~${o.estimatedTCO2ePerYear.toLocaleString()} tCO2e/yr)` : '';
    lines.push(`  ${i + 1}. ${o.title}${tons}`);
  });
  lines.push('');
  lines.push(`Financing instruments (${financing.length} matched):`);
  financing.slice(0, 5).forEach((f, i) => {
    lines.push(`  ${i + 1}. ${f.instrument.name} — score ${f.score.toFixed(2)}`);
  });
  lines.push('');
  lines.push(`Carbon methodologies (${carbon.length} matched):`);
  carbon.slice(0, 5).forEach((c, i) => {
    lines.push(
      `  ${i + 1}. ${c.methodology.title} — ${c.estimatedTCO2ePerYear.toLocaleString()} tCO2e/yr @ USD ${c.forwardValueUsdPerTon}/t over ${c.creditingPeriodYears} y → USD ${(c.estimatedLifetimeValueUsd / 1_000_000).toFixed(1)} m lifetime value`,
    );
  });
  lines.push('');
  lines.push(`Impact: ${impact.sdgCount}/17 SDGs touched; co-benefits score ${impact.coBenefitsScore.toFixed(2)}.`);
  return lines.join('\n');
}
