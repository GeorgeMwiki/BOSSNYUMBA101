/**
 * @bossnyumba/estate-auto-management — public surface.
 *
 * Veteran-expert auto-management advisor. Predictive maintenance +
 * vendor selection + automated rent collection + multi-channel
 * comms + lease workflows + cadence reporting + RPA orchestration.
 *
 * All math + scheduling logic is pure; I/O happens through the
 * injected ports declared in `./types`.
 */

// Types
export * from './types.js';

// Predictive
export { forecastFailure } from './predictive/failure-forecaster.js';
export { maybeTriggerDispatch } from './predictive/vendor-trigger.js';
export type { TriggerPolicy } from './predictive/vendor-trigger.js';

// Vendor
export { scoreVendor } from './vendor/vendor-scorer.js';
export type { ScorerWeights, ScoringInputs } from './vendor/vendor-scorer.js';
export { syntheticBids, bidExtremes } from './vendor/vendor-bidder.js';
export type { SyntheticBidOptions } from './vendor/vendor-bidder.js';
export { selectVendor } from './vendor/vendor-selector.js';
export type { SelectionInputs } from './vendor/vendor-selector.js';

// Collection
export { planAttempts, DEFAULT_RETRY_POLICY } from './collection/collection-orchestrator.js';
export type { RetryPolicy } from './collection/collection-orchestrator.js';
export {
  escalationPlan,
  stepsDueToday,
  planChannels,
} from './collection/escalation-policy.js';
export type { EscalationPolicyOptions } from './collection/escalation-policy.js';

// Communication
export { reachabilityScores, bestChannel } from './communication/reachability-scorer.js';
export { routeChannels } from './communication/multi-channel-router.js';
export type { RouteOptions } from './communication/multi-channel-router.js';

// Workflows
export { planRenewalWorkflow } from './workflows/lease-renewal-workflow.js';
export { planTerminationWorkflow } from './workflows/lease-termination-workflow.js';
export type { TerminationOptions } from './workflows/lease-termination-workflow.js';
export { planMonthlyClose } from './workflows/monthly-close-workflow.js';
export type { MonthlyCloseOptions } from './workflows/monthly-close-workflow.js';

// Reporting
export { nextRunDates } from './reporting/cadence-engine.js';
export {
  withDefaults as defaultStakeholderPrefs,
  validate as validateStakeholderPrefs,
} from './reporting/stakeholder-prefs.js';

// RPA
export { orchestrate } from './rpa/bot-orchestrator.js';
export type { OrchestratorOptions } from './rpa/bot-orchestrator.js';
