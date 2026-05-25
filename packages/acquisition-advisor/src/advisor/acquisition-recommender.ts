/**
 * Acquisition recommender — composes every DD subsystem into a
 * single veteran-expert acquisition recommendation.
 *
 * Pure function. The caller is responsible for assembling each
 * subsystem's *output* and passing it here. The composer maps each
 * subsystem to a 0..1 MCDA score, runs go/no-go, computes the
 * pricing recommendation, and produces a defensible narrative.
 */

import type {
  AcquisitionRecommendation,
  AltaCommitmentReading,
  AltaSurveyReading,
  AncestralClaimRiskScore,
  CapRateDerivative,
  DDFinding,
  DealSnapshot,
  EndorsementRecommendation,
  EntitlementAnalysis,
  FloodRisk,
  KETitleSearchResult,
  LOIRiskScore,
  MCDAWeights,
  Phase1ScopingResult,
  PSAClauseFlag,
  RentRollIntegrity,
  SaleTriangulation,
  SeismicRisk,
  SlopeStability,
  T12T3Validation,
  TZTitleSearchResult,
  UGTitleSearchResult,
} from '../types.js';
import { decideGoNoGo } from './go-no-go-decision.js';

export interface AcquisitionRecommenderInputs {
  readonly deal: DealSnapshot;
  readonly saleTriangulation: SaleTriangulation;
  readonly capRateDerivative: CapRateDerivative;
  readonly loi?: LOIRiskScore;
  readonly psaFlags?: ReadonlyArray<PSAClauseFlag>;
  readonly phase1?: Phase1ScopingResult;
  readonly altaCommitment?: AltaCommitmentReading;
  readonly survey?: AltaSurveyReading;
  readonly entitlement?: EntitlementAnalysis;
  readonly seismic?: SeismicRisk;
  readonly flood?: FloodRisk;
  readonly slope?: SlopeStability;
  readonly t12t3?: T12T3Validation;
  readonly rentRoll?: RentRollIntegrity;
  readonly endorsements?: ReadonlyArray<EndorsementRecommendation>;
  readonly keTitle?: KETitleSearchResult;
  readonly tzTitle?: TZTitleSearchResult;
  readonly ugTitle?: UGTitleSearchResult;
  readonly ancestralClaim?: AncestralClaimRiskScore;
  /** Replacement cost less depreciation — Marshall & Swift basis. */
  readonly replacementCostValue?: number;
  /** Market cap rate to capitalise NOI for income approach. */
  readonly marketCapRate: number;
  readonly mcdaWeights?: MCDAWeights;
}

export function recommendAcquisition(
  inputs: AcquisitionRecommenderInputs,
): AcquisitionRecommendation {
  const deal = inputs.deal;

  // 1) Pricing anchors
  const compTriangulatedValue =
    inputs.saleTriangulation.weightedMedianPerSqm * deal.nlaSqm;
  const stabilisedNoi = deal.t12EGI - deal.t12Opex;
  const incomeCapValue =
    inputs.marketCapRate > 0 ? stabilisedNoi / inputs.marketCapRate : 0;
  const replacementCostValue =
    inputs.replacementCostValue ?? compTriangulatedValue * 0.95;

  const blendedRecommendedOffer =
    0.50 * compTriangulatedValue +
    0.30 * incomeCapValue +
    0.20 * replacementCostValue;
  // Final offer: -8% to triangulated; walk-away +10%
  const negotiationFloor = blendedRecommendedOffer * 0.92;
  const walkAwayCeiling = compTriangulatedValue * 1.10;

  // 2) Sub-system scores (0..1)
  const compScore = inputs.saleTriangulation.confidence;
  const financialFitScore = scoreFinancialFit(
    deal.askingPrice,
    blendedRecommendedOffer,
    stabilisedNoi,
    inputs.marketCapRate,
  );
  const environmentalScore = scoreEnvironmental(inputs.phase1);
  const titleScore = scoreTitle(inputs.altaCommitment);
  const surveyScore = scoreSurvey(inputs.survey);
  const zoningScore = scoreZoning(inputs.entitlement);
  const geotechScore = scoreGeotech(inputs.seismic, inputs.flood, inputs.slope);
  const financialDDScore = scoreFinancialDD(inputs.t12t3, inputs.rentRoll);
  const eaJurisdictionalScore = scoreEAJurisdictional(
    inputs.keTitle,
    inputs.tzTitle,
    inputs.ugTitle,
    inputs.ancestralClaim,
  );

  // 3) MCDA
  const decision = decideGoNoGo({
    financialFitScore,
    compTriangulationScore: compScore,
    environmentalScore,
    titleScore,
    surveyScore,
    zoningScore,
    geotechScore,
    financialDDScore,
    eaJurisdictionalScore,
    ...(inputs.mcdaWeights ? { weights: inputs.mcdaWeights } : {}),
  });

  // 4) Findings aggregation
  const findings: DDFinding[] = [];
  collectLOIFindings(findings, inputs.loi);
  collectPSAFindings(findings, inputs.psaFlags);
  collectEnvFindings(findings, inputs.phase1);
  collectTitleFindings(findings, inputs.altaCommitment);
  collectSurveyFindings(findings, inputs.survey);
  collectZoningFindings(findings, inputs.entitlement);
  collectGeotechFindings(
    findings,
    inputs.seismic,
    inputs.flood,
    inputs.slope,
  );
  collectFinDDFindings(findings, inputs.t12t3, inputs.rentRoll);
  collectEAFindings(
    findings,
    inputs.keTitle,
    inputs.tzTitle,
    inputs.ugTitle,
    inputs.ancestralClaim,
  );

  // 5) Closing checklist (must-cure items)
  const closingChecklist = findings
    .filter((f) => f.mustCureBeforeClose)
    .map((f) => `${f.domain}: ${f.summary}`);

  if (inputs.endorsements) {
    for (const e of inputs.endorsements.filter((x) => x.mandatory)) {
      closingChecklist.push(
        `titleInsurance: bind ALTA endorsement ${e.code} — ${e.reason}`,
      );
    }
  }

  // 6) Confidence (blend of comp confidence + critical-finding count)
  const criticalFindings = findings.filter(
    (f) => f.severity === 'critical' || f.severity === 'deal-killer',
  ).length;
  const confidence = clamp01(
    0.6 * inputs.saleTriangulation.confidence +
      0.4 * Math.max(0, 1 - criticalFindings * 0.10),
  );

  const narrative = buildNarrative({
    deal,
    decision,
    blendedRecommendedOffer,
    walkAwayCeiling,
    negotiationFloor,
    confidence,
    findings,
    compValuePerSqm: inputs.saleTriangulation.weightedMedianPerSqm,
    spreadBps: inputs.capRateDerivative.spreadBps,
  });

  return {
    dealId: deal.id,
    verdict: decision.verdict,
    composite: decision.composite,
    pricingRecommendation: {
      compTriangulatedValue,
      incomeCapValue,
      replacementCostValue,
      blendedRecommendedOffer: Math.round(blendedRecommendedOffer),
      walkAwayCeiling: Math.round(walkAwayCeiling),
    },
    findings,
    closingChecklist,
    narrative,
    confidence,
  };
}

// ---------------------------------------------------------------------------
// Sub-system scoring helpers
// ---------------------------------------------------------------------------

function scoreFinancialFit(
  askingPrice: number,
  recommendedOffer: number,
  stabilisedNoi: number,
  marketCapRate: number,
): number {
  if (recommendedOffer <= 0) return 0;
  const overpayPct = (askingPrice - recommendedOffer) / recommendedOffer;
  let priceScore: number;
  if (overpayPct <= -0.05) priceScore = 1; // asking under recommended
  else if (overpayPct <= 0.05) priceScore = 0.8;
  else if (overpayPct <= 0.15) priceScore = 0.55;
  else if (overpayPct <= 0.25) priceScore = 0.30;
  else priceScore = 0.10;

  const goingInCap =
    askingPrice > 0 ? stabilisedNoi / askingPrice : 0;
  const capScore = goingInCap >= marketCapRate ? 1 : Math.max(0, goingInCap / Math.max(0.001, marketCapRate));

  return 0.6 * priceScore + 0.4 * capScore;
}

function scoreEnvironmental(p?: Phase1ScopingResult): number {
  if (!p) return 0.5;
  if (p.severity >= 0.8) return 0;
  if (p.severity >= 0.6) return 0.25;
  if (p.severity >= 0.4) return 0.50;
  if (p.severity >= 0.2) return 0.75;
  return 1;
}

function scoreTitle(t?: AltaCommitmentReading): number {
  if (!t) return 0.5;
  switch (t.verdict) {
    case 'clean':
      return 1;
    case 'workable':
      return 0.75;
    case 'requires-cure':
      return 0.45;
    case 'unworkable':
      return 0;
  }
}

function scoreSurvey(s?: AltaSurveyReading): number {
  if (!s) return 0.5;
  switch (s.verdict) {
    case 'clean':
      return 1;
    case 'minor':
      return 0.80;
    case 'material':
      return 0.40;
    case 'unworkable':
      return 0;
  }
}

function scoreZoning(e?: EntitlementAnalysis): number {
  if (!e) return 0.5;
  return e.probabilityOfApproval;
}

function scoreGeotech(
  s?: SeismicRisk,
  f?: FloodRisk,
  sl?: SlopeStability,
): number {
  if (!s && !f && !sl) return 0.5;
  const seismicS = s ? bandTo01(s.band) : 0.8;
  const floodS = f ? floodBandTo01(f.band) : 0.8;
  const slopeS = sl ? slopeBandTo01(sl.band) : 0.8;
  return (seismicS + floodS + slopeS) / 3;
}

function bandTo01(b: SeismicRisk['band']): number {
  switch (b) {
    case 'very-low':
      return 1;
    case 'low':
      return 0.9;
    case 'moderate':
      return 0.7;
    case 'high':
      return 0.45;
    case 'very-high':
      return 0.20;
  }
}

function floodBandTo01(b: FloodRisk['band']): number {
  switch (b) {
    case 'minimal':
      return 1;
    case 'low':
      return 0.9;
    case 'moderate':
      return 0.65;
    case 'high':
      return 0.35;
    case 'very-high':
      return 0.10;
  }
}

function slopeBandTo01(b: SlopeStability['band']): number {
  switch (b) {
    case 'flat':
      return 1;
    case 'gentle':
      return 0.9;
    case 'moderate':
      return 0.7;
    case 'steep':
      return 0.45;
    case 'very-steep':
      return 0.20;
  }
}

function scoreFinancialDD(
  t?: T12T3Validation,
  r?: RentRollIntegrity,
): number {
  let s = 1;
  if (t) {
    if (!t.pass) s -= 0.5;
    const warnCount = t.findings.filter((f) => f.severity === 'warn').length;
    s -= 0.1 * warnCount;
  } else {
    s = 0.5;
  }
  if (r) {
    if (!r.pass) s -= 0.5;
  }
  return Math.max(0, Math.min(1, s));
}

function scoreEAJurisdictional(
  ke?: KETitleSearchResult,
  tz?: TZTitleSearchResult,
  ug?: UGTitleSearchResult,
  anc?: AncestralClaimRiskScore,
): number {
  const verdicts: string[] = [];
  if (ke) verdicts.push(ke.verdict);
  if (tz) verdicts.push(tz.verdict);
  if (ug) verdicts.push(ug.verdict);
  if (verdicts.length === 0 && !anc) return 0.5;

  const verdictScore =
    verdicts.length === 0
      ? 0.8
      : verdicts.reduce((s, v) => s + verdictTo01(v), 0) / verdicts.length;

  const ancestralScore = anc
    ? Math.max(0, 1 - anc.score / 100)
    : 0.8;
  return 0.6 * verdictScore + 0.4 * ancestralScore;
}

function verdictTo01(v: string): number {
  switch (v) {
    case 'clean':
      return 1;
    case 'workable':
      return 0.75;
    case 'requires-cure':
      return 0.40;
    case 'unworkable':
      return 0;
    default:
      return 0.5;
  }
}

// ---------------------------------------------------------------------------
// Findings collectors
// ---------------------------------------------------------------------------

function collectLOIFindings(
  findings: DDFinding[],
  loi?: LOIRiskScore,
): void {
  if (!loi) return;
  if (loi.verdict === 'do-not-sign') {
    findings.push({
      id: 'loi-do-not-sign',
      domain: 'loi',
      severity: 'deal-killer',
      summary: 'LOI is buyer-unfriendly — do not counter-sign',
      detail: `Critical gaps: ${loi.criticalGaps.join(', ')}`,
      mustCureBeforeClose: true,
    });
  } else if (loi.verdict === 'redraft') {
    findings.push({
      id: 'loi-redraft',
      domain: 'loi',
      severity: 'critical',
      summary: `LOI normalized score ${(loi.normalized * 100).toFixed(0)}% — re-draft before counter-sign`,
      detail: `Critical gaps: ${loi.criticalGaps.join(', ')}`,
      mustCureBeforeClose: true,
    });
  }
}

function collectPSAFindings(
  findings: DDFinding[],
  psa?: ReadonlyArray<PSAClauseFlag>,
): void {
  if (!psa) return;
  for (const f of psa) {
    if (f.riskLevel === 'critical') {
      findings.push({
        id: `psa-${f.key}`,
        domain: 'psa',
        severity: 'critical',
        summary: `PSA clause ${f.key} missing or seller-favorable`,
        detail: f.recommendation,
        mustCureBeforeClose: true,
      });
    } else if (f.riskLevel === 'high') {
      findings.push({
        id: `psa-${f.key}`,
        domain: 'psa',
        severity: 'warn',
        summary: `PSA clause ${f.key} weak`,
        detail: f.recommendation,
        mustCureBeforeClose: false,
      });
    }
  }
}

function collectEnvFindings(
  findings: DDFinding[],
  phase1?: Phase1ScopingResult,
): void {
  if (!phase1) return;
  for (const f of phase1.findings) {
    if (f.category === 'REC') {
      findings.push({
        id: `env-${f.id}`,
        domain: 'environmental',
        severity: 'critical',
        summary: `Phase I REC: ${f.contaminant}`,
        detail: `Historical use: ${f.historicalUse}; distance ${f.distanceMetres}m; next step: ${f.recommendedNextStep}`,
        mustCureBeforeClose: f.recommendedNextStep !== 'noAction',
      });
    } else if (f.category === 'CREC') {
      findings.push({
        id: `env-${f.id}`,
        domain: 'environmental',
        severity: 'warn',
        summary: `Phase I CREC: ${f.contaminant} (controlled)`,
        detail: `Confirm AUL / deed restriction in place; distance ${f.distanceMetres}m`,
        mustCureBeforeClose: false,
      });
    }
  }
  if (phase1.recommendPhase2) {
    findings.push({
      id: 'env-phase2-recommended',
      domain: 'environmental',
      severity: 'warn',
      summary: 'Phase II ESA recommended',
      detail: `Priority contaminants: ${phase1.priorityContaminants.join(', ') || '(none)'}`,
      mustCureBeforeClose: true,
    });
  }
}

function collectTitleFindings(
  findings: DDFinding[],
  alta?: AltaCommitmentReading,
): void {
  if (!alta) return;
  for (const e of alta.exceptions) {
    if (e.impactScore >= 8) {
      findings.push({
        id: `title-${e.id}`,
        domain: 'title',
        severity: e.impactScore >= 9 ? 'deal-killer' : 'critical',
        summary: `Schedule B exception: ${e.type}`,
        detail: e.description,
        mustCureBeforeClose: e.curableAtClose,
      });
    }
  }
}

function collectSurveyFindings(
  findings: DDFinding[],
  survey?: AltaSurveyReading,
): void {
  if (!survey) return;
  for (const e of survey.encroachments) {
    if (e.severityScore >= 7) {
      findings.push({
        id: `survey-${e.id}`,
        domain: 'survey',
        severity: e.severityScore >= 9 ? 'deal-killer' : 'critical',
        summary: `Survey encroachment: ${e.direction}`,
        detail: `${e.affectedAreaSqm} sqm affected; ${e.curableAtClose ? 'curable' : 'NOT curable'} at close`,
        mustCureBeforeClose: e.curableAtClose,
      });
    }
  }
  for (const v of survey.setbackViolations) {
    if (v.redevelopmentTrigger || !v.grandfathered) {
      findings.push({
        id: `survey-setback-${v.id}`,
        domain: 'survey',
        severity: 'critical',
        summary: `Setback violation: ${v.side}`,
        detail: `Required ${v.requiredMetres}m, actual ${v.actualMetres}m; grandfathered: ${v.grandfathered}; redevelopment-triggered: ${v.redevelopmentTrigger}`,
        mustCureBeforeClose: false,
      });
    }
  }
}

function collectZoningFindings(
  findings: DDFinding[],
  entitlement?: EntitlementAnalysis,
): void {
  if (!entitlement) return;
  if (entitlement.probabilityOfApproval < 0.5) {
    findings.push({
      id: 'zoning-low-approval-prob',
      domain: 'zoning',
      severity: 'critical',
      summary: `Entitlement path ${entitlement.path} approval probability ${(entitlement.probabilityOfApproval * 100).toFixed(0)}%`,
      detail: `Months ${entitlement.estimatedMonths.toFixed(1)}; opposition ${entitlement.oppositionScore.toFixed(0)}; cost USD ${entitlement.cost.toFixed(0)}`,
      mustCureBeforeClose: false,
    });
  }
}

function collectGeotechFindings(
  findings: DDFinding[],
  seismic?: SeismicRisk,
  flood?: FloodRisk,
  slope?: SlopeStability,
): void {
  if (seismic && (seismic.band === 'high' || seismic.band === 'very-high')) {
    findings.push({
      id: 'geo-seismic',
      domain: 'geotech',
      severity: seismic.band === 'very-high' ? 'critical' : 'warn',
      summary: `Seismic risk: ${seismic.band}`,
      detail: `Design cost uplift ${(seismic.designUpliftPct * 100).toFixed(1)}%; insurance uplift ${(seismic.insurancePremiumUpliftPct * 100).toFixed(1)}%`,
      mustCureBeforeClose: false,
    });
  }
  if (flood && (flood.band === 'high' || flood.band === 'very-high')) {
    findings.push({
      id: 'geo-flood',
      domain: 'geotech',
      severity: flood.band === 'very-high' ? 'critical' : 'warn',
      summary: `Flood risk: ${flood.band}`,
      detail: `Insurance required: ${flood.insuranceRequired}; design uplift ${(flood.designUpliftPct * 100).toFixed(1)}%`,
      mustCureBeforeClose: false,
    });
  }
  if (slope && (slope.band === 'steep' || slope.band === 'very-steep')) {
    findings.push({
      id: 'geo-slope',
      domain: 'geotech',
      severity: 'warn',
      summary: `Slope stability: ${slope.band}`,
      detail: `Design uplift ${(slope.designUpliftPct * 100).toFixed(1)}%; retaining walls required: ${slope.engineeredRetainingRequired}`,
      mustCureBeforeClose: false,
    });
  }
}

function collectFinDDFindings(
  findings: DDFinding[],
  t?: T12T3Validation,
  r?: RentRollIntegrity,
): void {
  if (t) {
    for (const f of t.findings) {
      if (f.severity === 'critical') {
        findings.push({
          id: `findd-${f.code}`,
          domain: 'financial',
          severity: 'critical',
          summary: `T-12/T-3: ${f.code}`,
          detail: f.message,
          mustCureBeforeClose: true,
        });
      } else if (f.severity === 'warn') {
        findings.push({
          id: `findd-${f.code}`,
          domain: 'financial',
          severity: 'warn',
          summary: `T-12/T-3: ${f.code}`,
          detail: f.message,
          mustCureBeforeClose: false,
        });
      }
    }
  }
  if (r) {
    for (const f of r.findings.filter((x) => x.severity !== 'info')) {
      findings.push({
        id: `findd-rr-${f.code}-${f.unitId ?? 'na'}`,
        domain: 'financial',
        severity: f.severity === 'critical' ? 'critical' : 'warn',
        summary: `Rent-roll: ${f.code}`,
        detail: f.message,
        mustCureBeforeClose: f.severity === 'critical',
      });
    }
  }
}

function collectEAFindings(
  findings: DDFinding[],
  ke?: KETitleSearchResult,
  tz?: TZTitleSearchResult,
  ug?: UGTitleSearchResult,
  anc?: AncestralClaimRiskScore,
): void {
  for (const r of [ke, tz, ug]) {
    if (!r) continue;
    for (const gap of r.criticalGaps) {
      findings.push({
        id: `ea-${gap}`,
        domain: 'eaJurisdictional',
        severity: 'critical',
        summary: `EA title gap: ${gap}`,
        detail: `Verdict: ${r.verdict}`,
        mustCureBeforeClose: true,
      });
    }
  }
  if (anc && (anc.band === 'high' || anc.band === 'severe')) {
    findings.push({
      id: 'ea-ancestral',
      domain: 'eaJurisdictional',
      severity: anc.band === 'severe' ? 'critical' : 'warn',
      summary: `Ancestral-claim risk: ${anc.band} (${anc.score.toFixed(0)})`,
      detail: anc.recommendedActions.join('; '),
      mustCureBeforeClose: anc.band === 'severe',
    });
  }
}

function buildNarrative(p: {
  readonly deal: DealSnapshot;
  readonly decision: { composite: number; verdict: AcquisitionRecommendation['verdict'] };
  readonly blendedRecommendedOffer: number;
  readonly walkAwayCeiling: number;
  readonly negotiationFloor: number;
  readonly confidence: number;
  readonly findings: ReadonlyArray<DDFinding>;
  readonly compValuePerSqm: number;
  readonly spreadBps: number;
}): string {
  const criticalCount = p.findings.filter(
    (f) => f.severity === 'critical' || f.severity === 'deal-killer',
  ).length;
  return (
    `Deal ${p.deal.id} (${p.deal.subMarket}, ${p.deal.jurisdiction}, ${p.deal.assetClass}, ${p.deal.units} units). ` +
    `Verdict: ${p.decision.verdict.toUpperCase()} (composite ${(p.decision.composite * 100).toFixed(0)}%). ` +
    `Recommended offer: ${p.deal.currency} ${Math.round(p.blendedRecommendedOffer).toLocaleString()} ` +
    `(open at ${p.deal.currency} ${Math.round(p.negotiationFloor).toLocaleString()}; walk-away ceiling ${p.deal.currency} ${Math.round(p.walkAwayCeiling).toLocaleString()}). ` +
    `Comp-triangulated $${p.compValuePerSqm.toFixed(0)}/sqm (cap-rate spread ${p.spreadBps} bps to risk-free). ` +
    `${criticalCount} critical/deal-killer findings flagged. ` +
    `Confidence ${(p.confidence * 100).toFixed(0)}%.`
  );
}

function clamp01(x: number): number {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}
