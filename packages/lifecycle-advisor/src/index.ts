/**
 * @bossnyumba/lifecycle-advisor — public surface.
 *
 * Veteran-expert real-estate lifecycle advisor for the four stages
 * NOT covered elsewhere: development, disposition, refinancing,
 * investor-relations.
 *
 * Pure-math core (no I/O); optional LLM narrative via injected
 * MultiLLMSynthesizer port. Citations live in module headers.
 */

export * from './types.js';

// Development
export { analyzeFeasibility } from './development/feasibility-analyzer.js';
export { selectGC, scoreGCBids, recommendDeliveryMethod } from './development/gc-selector.js';
export { benchmarkCost, listKnownRegions } from './development/cost-benchmarker.js';
export { runScheduleRisk } from './development/schedule-risk-modeler.js';
export type { ScheduleRiskOptions } from './development/schedule-risk-modeler.js';
export { scoreChangeOrderRisk } from './development/change-order-risk-scorer.js';
export {
  evaluateSubstantialCompletion,
  evaluateFinalAcceptance,
} from './development/punch-list-acceptance.js';

// Disposition
export { adviseExitTiming } from './disposition/exit-timing-advisor.js';
export {
  buildBuyerPipeline,
  scoreBuyers,
} from './disposition/buyer-pipeline-builder.js';
export { selectBroker, scoreBrokers } from './disposition/broker-selector.js';
export { designOM } from './disposition/om-design-advisor.js';
export { modelSellerFinancing } from './disposition/seller-financing-modeler.js';
export { adviseTaxDeferredExchange } from './disposition/tax-deferred-exchange-advisor.js';

// Refinancing
export { optimiseLTV } from './refinancing/ltv-optimizer.js';
export { selectLender } from './refinancing/lender-selector.js';
export { adviseRateLock } from './refinancing/rate-lock-timing.js';
export { compareDefeasanceVsYM } from './refinancing/defeasance-vs-yield-maint.js';
export { scanCovenants } from './refinancing/covenant-compliance-scanner.js';
export { optimiseRefiProceeds } from './refinancing/refi-proceeds-optimizer.js';

// Investor relations
export { structureCapitalRaise } from './investor-relations/capital-raise-structurer.js';
export { runSubscriptionDocChecklist } from './investor-relations/subscription-doc-checklist.js';
export { adviseReportingCadence } from './investor-relations/reporting-cadence-advisor.js';
export { forecastDistributions } from './investor-relations/distribution-forecaster.js';
export { buildCapitalCallMessage } from './investor-relations/capital-call-communicator.js';
export { buildILPAReport } from './investor-relations/ilpa-report-builder.js';
export { draftLPAnswer, draftLPAnswers } from './investor-relations/lp-qa-drafter.js';

// Orchestrator
export { orchestrateLifecycle } from './advisor/lifecycle-orchestrator.js';
