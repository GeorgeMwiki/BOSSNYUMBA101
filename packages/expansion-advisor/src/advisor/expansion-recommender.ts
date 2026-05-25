/**
 * Expansion recommender — composes HBU, market, capital, lease-up,
 * value-add, gentrification, zoning, comps, and (optionally) land-
 * banking into a single veteran-expert narrative report.
 */

import { optimiseCapitalStack } from '../capital/capital-stack-optimizer.js';
import { analyzeHBU } from '../hbu/hbu-analyzer.js';
import type { FinancialRules } from '../hbu/financially-feasible.js';
import type { LegalityRules } from '../hbu/legally-permissible.js';
import type { PhysicalRules } from '../hbu/physically-possible.js';
import { leaseUpCurve } from '../leasing/lease-up-curves.js';
import { forecastAbsorption } from '../market/absorption-forecaster.js';
import { triangulate } from '../market/comparable-sales-triangulator.js';
import { computeGentrificationIndex } from '../market/gentrification-index.js';
import { forecastLandBanking } from '../market/land-banking.js';
import { zoningLeverageScore } from '../market/zoning-leverage.js';
import type {
  ExpansionInputs,
  ExpansionOpportunity,
  ValueAddInputs,
} from '../types.js';
import { scoreValueAdd } from '../leasing/value-add-scorer.js';

export interface AdvisorRules {
  readonly legality: LegalityRules;
  readonly physical: PhysicalRules;
  readonly financial: FinancialRules;
  readonly horizonMonths: number;
  readonly valueAdd?: ValueAddInputs;
  readonly landBankingHorizonYears?: number;
}

export function recommendExpansion(
  inputs: ExpansionInputs,
  rules: AdvisorRules,
): ExpansionOpportunity {
  const adjustedCandidates = inputs.candidates.map((c) => {
    const o = inputs.marketOverrides;
    if (!o) return c;
    return {
      ...c,
      stabilisedRentPerSqm:
        c.stabilisedRentPerSqm * (o.rentMultiplier ?? 1),
      buildCostPerSqm: c.buildCostPerSqm * (o.costMultiplier ?? 1),
      capRate: c.capRate + (o.capRateAdjustment ?? 0),
    };
  });

  const hbu = analyzeHBU({
    parcel: inputs.parcel,
    uses: adjustedCandidates,
    legality: rules.legality,
    physical: rules.physical,
    financial: rules.financial,
  });

  if (!hbu.winner) {
    throw new Error(
      `recommendExpansion: no candidate survives HBU gates for parcel ${inputs.parcel.id}`,
    );
  }

  const winner = hbu.winner;
  const winnerNoi =
    winner.nlaSqm *
    winner.stabilisedRentPerSqm *
    12 *
    (1 - winner.operatingExpenseRatio);
  const totalCost = winner.buildCostPerSqm * winner.programmeSqm + winner.landBasis;
  const stabilisedValue = winnerNoi / winner.capRate;

  const stack = optimiseCapitalStack({
    totalCost,
    stabilisedNOI: winnerNoi,
    stabilisedValue,
    tiers: inputs.stack.tiers,
    constraints: inputs.stack.constraints,
  });

  const absorption = forecastAbsorption({
    market: inputs.market,
    newSupplyUnits: winner.units ?? Math.round(winner.nlaSqm / 75),
    horizonMonths: rules.horizonMonths,
  });

  const leaseUp = leaseUpCurve({
    assetClass: winner.assetClass,
    horizonMonths: rules.horizonMonths,
  });

  const gentrification = computeGentrificationIndex(inputs.gentrification);
  const zoningLev = zoningLeverageScore(inputs.zoningLeverage);
  const triangulation = triangulate(inputs.comparables, {
    maxMonthsAgo: 18,
    maxDistanceMetres: 1600,
    assetClass: winner.assetClass,
    subjectSizeSqm: winner.nlaSqm,
    sizeTolerance: 0.25,
  });

  const valueAdd = rules.valueAdd ? scoreValueAdd(rules.valueAdd) : undefined;
  const landBanking =
    inputs.landBanking && rules.landBankingHorizonYears
      ? forecastLandBanking(inputs.landBanking, {
          horizonYears: rules.landBankingHorizonYears,
        })
      : undefined;

  const confidence = composeConfidence({
    triangulationConfidence: triangulation.confidence,
    probNpvPos: hbu.ranked[0]?.productivityScore ?? 0,
    stackHeadroom: stack.yieldOnCost - inputs.stack.constraints.minYieldOnCost,
  });

  const narrative = buildNarrative({
    parcelId: inputs.parcel.id,
    winnerLabel: winner.label,
    yieldOnCost: stack.yieldOnCost,
    dscr: stack.dscr,
    leaseUpMonths: absorption.leaseUpMonthsTo95,
    gentrification: gentrification.verdict,
    bestLever: zoningLev.bestLever,
    triangulationValuePerSqm: triangulation.weightedMedianPerSqm,
    landBankingVerdict: landBanking?.verdict ?? 'n/a',
    confidence,
  });

  return {
    parcelId: inputs.parcel.id,
    recommendedUse: winner,
    hbu,
    absorption,
    leaseUp,
    stack,
    ...(valueAdd ? { valueAdd } : {}),
    gentrification,
    zoningLeverage: zoningLev,
    triangulation,
    ...(landBanking ? { landBanking } : {}),
    narrative,
    confidence,
  };
}

function composeConfidence(p: {
  readonly triangulationConfidence: number;
  readonly probNpvPos: number;
  readonly stackHeadroom: number;
}): number {
  const headroomScore = Math.min(1, Math.max(0, p.stackHeadroom * 20));
  const blended = 0.4 * p.triangulationConfidence + 0.4 * p.probNpvPos + 0.2 * headroomScore;
  return Math.max(0, Math.min(1, blended));
}

function buildNarrative(p: {
  readonly parcelId: string;
  readonly winnerLabel: string;
  readonly yieldOnCost: number;
  readonly dscr: number;
  readonly leaseUpMonths: number;
  readonly gentrification: string;
  readonly bestLever: string;
  readonly triangulationValuePerSqm: number;
  readonly landBankingVerdict: string;
  readonly confidence: number;
}): string {
  return (
    `Parcel ${p.parcelId} — recommend ${p.winnerLabel}. ` +
    `Stabilised yield-on-cost ${(p.yieldOnCost * 100).toFixed(2)}%, ` +
    `DSCR ${p.dscr.toFixed(2)}, lease-up to 95% in ${p.leaseUpMonths.toFixed(1)} months. ` +
    `Neighbourhood gentrification: ${p.gentrification}. ` +
    `Best zoning lever: ${p.bestLever}. ` +
    `Comp-triangulated value $${p.triangulationValuePerSqm.toFixed(0)}/sqm. ` +
    `Land-banking verdict: ${p.landBankingVerdict}. ` +
    `Overall confidence ${(p.confidence * 100).toFixed(0)}%.`
  );
}
