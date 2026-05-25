/**
 * Lifecycle orchestrator — per-asset, returns prioritised
 * "what to do next" recommendations across development, disposition,
 * refinancing, and investor-relations domains based on the asset's
 * current lifecycle stage.
 *
 * Each domain produces a `DomainRecommendation` with action,
 * priority, confidence, rationale, citations. The orchestrator
 * composes the active domains for the stage and returns the full
 * list (priority-sorted) plus the single nextBestAction.
 */

import { analyzeFeasibility } from '../development/feasibility-analyzer.js';
import { scoreChangeOrderRisk } from '../development/change-order-risk-scorer.js';
import { runScheduleRisk } from '../development/schedule-risk-modeler.js';
import { adviseExitTiming } from '../disposition/exit-timing-advisor.js';
import { buildBuyerPipeline } from '../disposition/buyer-pipeline-builder.js';
import { selectLender } from '../refinancing/lender-selector.js';
import { scanCovenants } from '../refinancing/covenant-compliance-scanner.js';
import { adviseReportingCadence } from '../investor-relations/reporting-cadence-advisor.js';
import { forecastDistributions } from '../investor-relations/distribution-forecaster.js';

import type {
  DomainRecommendation,
  LifecycleAdvisorInputs,
  LifecycleAdvisorOutput,
} from '../types.js';

const PRIORITY_RANK: Record<DomainRecommendation['priority'], number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function priorityFromVerdict(v: string): DomainRecommendation['priority'] {
  if (v === 'redesign' || v === 'do-not-refi') return 'critical';
  if (v === 'sell-now' || v === 'cash-out' || v === 'lock-now-vol') return 'high';
  if (v === 'soft-test' || v === 'conditional-go') return 'medium';
  return 'low';
}

export function orchestrateLifecycle(
  inputs: Readonly<LifecycleAdvisorInputs>,
): LifecycleAdvisorOutput {
  const recs: DomainRecommendation[] = [];

  // ---- Development ----
  if (
    inputs.stage === 'pre-development' &&
    inputs.feasibility !== undefined
  ) {
    const feas = analyzeFeasibility(inputs.feasibility);
    recs.push({
      domain: 'development',
      action: feas.verdict === 'go'
        ? 'proceed to GC RFP and lender shortlist'
        : feas.verdict === 'conditional-go'
          ? `proceed with mitigation for: ${feas.failingGates.join(', ')}`
          : `redesign — failing gates: ${feas.failingGates.join(', ')}`,
      priority: priorityFromVerdict(feas.verdict),
      confidence: feas.verdict === 'go' ? 0.85 : feas.verdict === 'conditional-go' ? 0.65 : 0.45,
      rationale: `untrendedYoC ${(feas.untrendedYieldOnCost * 100).toFixed(2)}%, yield spread ${feas.yieldSpreadVsCapBps.toFixed(0)} bps, IRR spread ${feas.irrSpreadVsHurdleBps.toFixed(0)} bps`,
      citations: ['USPAP Standard 9 (2024)', 'ULI IDM ProForma'],
    });
  }
  if (
    inputs.stage === 'under-construction' &&
    inputs.changeOrderRisk !== undefined
  ) {
    const co = scoreChangeOrderRisk(inputs.changeOrderRisk);
    recs.push({
      domain: 'development',
      action: `mitigate top-3 change-order risks: ${co.top3Causes.join(', ')}`,
      priority: co.totalExpectedCOImpactPct > 0.05 ? 'high' : 'medium',
      confidence: 0.80,
      rationale: `expected CO impact ${(co.totalExpectedCOImpactPct * 100).toFixed(2)}% of contract`,
      citations: ['CII RT-43 Final Report 2024'],
    });
  }
  if (
    inputs.stage === 'under-construction' &&
    inputs.schedule !== undefined &&
    inputs.schedule.length > 0
  ) {
    const sched = runScheduleRisk(inputs.schedule, { seed: 1 });
    recs.push({
      domain: 'development',
      action: `commit to P80 schedule (${sched.p80TotalDays.toFixed(0)} days), reserve ${sched.contingencyWeeks.toFixed(1)} wks contingency`,
      priority: 'medium',
      confidence: 0.80,
      rationale: `P50=${sched.p50TotalDays.toFixed(0)}d, P80=${sched.p80TotalDays.toFixed(0)}d, P90=${sched.p90TotalDays.toFixed(0)}d`,
      citations: ['PMI Practice Std for Project Risk Mgmt 2024', 'CMAA Cost & Schedule Risk Assessment Guide 2023'],
    });
  }

  // ---- Disposition ----
  if (
    inputs.stage === 'disposition-window' &&
    inputs.exitTiming !== undefined
  ) {
    const exit = adviseExitTiming(inputs.exitTiming);
    recs.push({
      domain: 'disposition',
      action: exit.verdict === 'sell-now'
        ? 'list now with top-2 brokers (BOV bake-off)'
        : exit.verdict === 'soft-test'
          ? 'soft-test market via discreet broker outreach; do not yet list'
          : 'continue hold; re-evaluate quarterly',
      priority: priorityFromVerdict(exit.verdict),
      confidence: 0.50 + 0.10 * exit.score,
      rationale: `${exit.score}/5 triggers met`,
      citations: ['NCREIF NPI Q1-2026', 'RCA US Trends 2026', 'Trepp CMBS Issuance 2026'],
    });
  }
  if (
    inputs.stage === 'disposition-window' &&
    inputs.buyerPipeline !== undefined
  ) {
    const pipeline = buildBuyerPipeline(inputs.assetId, inputs.buyerPipeline.buyers);
    recs.push({
      domain: 'disposition',
      action: `prioritise marketing to top-2 buyer tiers: ${pipeline.top2Tiers.join(', ')} via ${pipeline.suggestedMarketingChannels.slice(0, 3).join('; ')}`,
      priority: 'high',
      confidence: 0.75,
      rationale: `${pipeline.scored.length} buyers scored; top-${pipeline.top2Tiers.length} tiers selected`,
      citations: ['Knight Frank PIRI Q1-2026', 'JLL Capital Tracker 2026'],
    });
  }

  // ---- Refinancing ----
  if (
    inputs.stage === 'refi-window' &&
    inputs.lenderSelection !== undefined
  ) {
    const sel = selectLender(inputs.lenderSelection);
    const top = sel.recommendedTop2;
    recs.push({
      domain: 'refinancing',
      action: top.length === 0
        ? 'no suitable lender match — broaden parameters'
        : `engage top-2 lenders: ${top.map((t) => t.type).join(', ')}`,
      priority: top.length === 0 ? 'critical' : 'high',
      confidence: top.length === 0 ? 0.40 : 0.75,
      rationale: top.length === 0
        ? 'no lender passes suitability gates'
        : `top match: ${top[0]!.type} (score ${top[0]!.suitabilityScore.toFixed(2)}, ${top[0]!.notes})`,
      citations: ['MBA 2026 Commercial / Multifamily Origination Survey', 'Trepp CMBS Q1-2026'],
    });
  }
  if (
    inputs.covenantStatus !== undefined &&
    (inputs.stage === 'stabilised-hold' ||
      inputs.stage === 'refi-window' ||
      inputs.stage === 'lease-up')
  ) {
    const cov = scanCovenants(inputs.covenantStatus);
    if (cov.hasActiveBreach || cov.springingLockboxTriggered) {
      recs.push({
        domain: 'refinancing',
        action: cov.springingLockboxTriggered
          ? 'springing lockbox triggered — engage lender immediately on cash management'
          : `active covenant breach: ${cov.breaches.filter((b) => b.breached).map((b) => b.covenant).join(', ')}`,
        priority: 'critical',
        confidence: 0.90,
        rationale: `breaches: ${cov.breaches.filter((b) => b.breached).length}; distributionLockbox=${cov.distributionLockboxTriggered}, springing=${cov.springingLockboxTriggered}`,
        citations: ['CMSA / CREFC IRP 2024'],
      });
    } else {
      const upcoming = cov.breaches.find((b) => b.monthsToBreach !== undefined && b.monthsToBreach < 12);
      if (upcoming) {
        recs.push({
          domain: 'refinancing',
          action: `proactive intervention — ${upcoming.covenant} projected to breach in ${upcoming.monthsToBreach!.toFixed(1)} months`,
          priority: 'high',
          confidence: 0.70,
          rationale: `trailing-12-month NOI trend points to ${upcoming.covenant} cure`,
          citations: ['CMSA / CREFC IRP 2024'],
        });
      }
    }
  }

  // ---- Investor relations ----
  if (
    (inputs.stage === 'stabilised-hold' ||
      inputs.stage === 'refi-window' ||
      inputs.stage === 'disposition-window') &&
    inputs.reportingCadence !== undefined
  ) {
    const cad = adviseReportingCadence(inputs.reportingCadence);
    recs.push({
      domain: 'investor-relations',
      action: `apply ${cad.recommendedTemplate} on a ${cad.writtenCadenceMonths}-month written cadence with ${cad.callCadenceMonths !== undefined ? `${cad.callCadenceMonths}-month` : 'annual'} call cadence`,
      priority: 'low',
      confidence: 0.85,
      rationale: `tier=${cad.tier}; recipients=${cad.recipients}`,
      citations: ['ILPA Reporting Template v1.1 (2024)', 'NCREIF Reporting Standards 2024'],
    });
  }
  if (
    inputs.distributionForecast !== undefined &&
    (inputs.stage === 'stabilised-hold' ||
      inputs.stage === 'refi-window' ||
      inputs.stage === 'disposition-window')
  ) {
    const dist = forecastDistributions(inputs.distributionForecast);
    recs.push({
      domain: 'investor-relations',
      action: `signal LP IRR ${(dist.lpIRR * 100).toFixed(1)}% / MOIC ${dist.lpMOIC.toFixed(2)}x at projection — schedule distribution communication`,
      priority: 'medium',
      confidence: 0.70,
      rationale: `forecast across ${dist.perPeriod.length} periods using ${inputs.distributionForecast.tiers.length}-tier waterfall`,
      citations: ['PERE Waterfall Survey 2024'],
    });
  }

  const sorted = [...recs].sort(
    (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority],
  );
  const nextBest =
    sorted[0] ?? {
      domain: 'investor-relations',
      action: 'no domain inputs provided for this lifecycle stage — gather data',
      priority: 'low',
      confidence: 0.20,
      rationale: 'orchestrator received insufficient inputs',
      citations: [],
    };

  return {
    assetId: inputs.assetId,
    stage: inputs.stage,
    recommendations: sorted,
    nextBestAction: nextBest,
  };
}
