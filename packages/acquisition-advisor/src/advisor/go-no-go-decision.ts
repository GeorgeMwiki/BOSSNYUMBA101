/**
 * Go / no-go MCDA decision — applies the weighted multi-criteria
 * decision rule used by Carmel Partners / Greystar / SL Green tier
 * acquisitions IC memos.
 *
 * Each criterion scored 0..1 (1 = fully passes). Composite ≥ 0.75
 * = "go". 0.60-0.75 = "proceed with conditions". 0.45-0.60 =
 * "renegotiate". < 0.45 = "no-go".
 */

import type { AcquisitionRecommendation, MCDAWeights } from '../types.js';
import { DEFAULT_MCDA_WEIGHTS } from '../types.js';

export interface MCDAInputs {
  readonly financialFitScore: number;
  readonly compTriangulationScore: number;
  readonly environmentalScore: number;
  readonly titleScore: number;
  readonly surveyScore: number;
  readonly zoningScore: number;
  readonly geotechScore: number;
  readonly financialDDScore: number;
  readonly eaJurisdictionalScore: number;
  readonly weights?: MCDAWeights;
}

export interface MCDADecision {
  readonly composite: number;
  readonly verdict: AcquisitionRecommendation['verdict'];
  readonly breakdown: Readonly<{
    financialFit: number;
    compTriangulation: number;
    environmental: number;
    title: number;
    survey: number;
    zoning: number;
    geotech: number;
    financialDD: number;
    eaJurisdictional: number;
  }>;
}

export function decideGoNoGo(inputs: MCDAInputs): MCDADecision {
  validate01(inputs.financialFitScore, 'financialFitScore');
  validate01(inputs.compTriangulationScore, 'compTriangulationScore');
  validate01(inputs.environmentalScore, 'environmentalScore');
  validate01(inputs.titleScore, 'titleScore');
  validate01(inputs.surveyScore, 'surveyScore');
  validate01(inputs.zoningScore, 'zoningScore');
  validate01(inputs.geotechScore, 'geotechScore');
  validate01(inputs.financialDDScore, 'financialDDScore');
  validate01(inputs.eaJurisdictionalScore, 'eaJurisdictionalScore');

  const w = inputs.weights ?? DEFAULT_MCDA_WEIGHTS;

  const breakdown = {
    financialFit: w.financial * inputs.financialFitScore,
    compTriangulation: w.comps * inputs.compTriangulationScore,
    environmental: w.environmental * inputs.environmentalScore,
    title: w.title * inputs.titleScore,
    survey: w.survey * inputs.surveyScore,
    zoning: w.zoning * inputs.zoningScore,
    geotech: w.geotech * inputs.geotechScore,
    financialDD: w.financialDD * inputs.financialDDScore,
    eaJurisdictional: w.eaJurisdictional * inputs.eaJurisdictionalScore,
  };
  const composite =
    breakdown.financialFit +
    breakdown.compTriangulation +
    breakdown.environmental +
    breakdown.title +
    breakdown.survey +
    breakdown.zoning +
    breakdown.geotech +
    breakdown.financialDD +
    breakdown.eaJurisdictional;

  let verdict: AcquisitionRecommendation['verdict'];
  if (composite >= 0.75) verdict = 'go';
  else if (composite >= 0.60) verdict = 'proceed-with-conditions';
  else if (composite >= 0.45) verdict = 'renegotiate';
  else verdict = 'no-go';

  return { composite, verdict, breakdown };
}

function validate01(v: number, name: string): void {
  if (!Number.isFinite(v) || v < 0 || v > 1) {
    throw new Error(`${name} must be a finite number in [0, 1]`);
  }
}
