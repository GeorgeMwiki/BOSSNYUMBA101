/**
 * Detector registry.
 *
 * Maps anomaly + opportunity *kinds* (string tags from cadence specs)
 * to the actual pure detector function. The tick-runner uses this
 * registry to dispatch; cadences declare what runs, the registry
 * declares how.
 *
 * Keeping this map central makes it trivial to add a detector — drop a
 * file under `detectors/` (or `opportunities/`), import the function,
 * register it here, and add the kind to a cadence.
 */
import type { AnomalyEvent, OpportunityEvent } from '../contracts/events.js';
import type { TickContext } from './tick-context.js';

// Anomaly detectors
import { detectCashflowDip } from '../detectors/cashflow-dip.detector.js';
import { detectArrearsSpike } from '../detectors/arrears-spike.detector.js';
import { detectChurnRisk } from '../detectors/churn-risk.detector.js';
import { detectCostAnomaly } from '../detectors/cost-anomaly.detector.js';
import { detectSloBreach } from '../detectors/slo-breach.detector.js';
import { detectComplianceDeadlineNear } from '../detectors/compliance-deadline-near.detector.js';
import { detectVendorReliabilityDrop } from '../detectors/vendor-reliability-drop.detector.js';

// Opportunity detectors
import { detectVendorRateArbitrage } from '../opportunities/vendor-rate-arbitrage.opportunity.js';
import { detectPolicyTightening } from '../opportunities/policy-tightening.opportunity.js';
import { detectRentVsMarket } from '../opportunities/rent-vs-market.opportunity.js';

export type AnomalyDetectorFn = (ctx: TickContext) => ReadonlyArray<AnomalyEvent>;
export type OpportunityDetectorFn = (
  ctx: TickContext,
) => ReadonlyArray<OpportunityEvent>;

export const ANOMALY_DETECTORS: Readonly<Record<string, AnomalyDetectorFn>> = {
  'cashflow-dip': detectCashflowDip,
  'arrears-spike': detectArrearsSpike,
  'churn-risk': detectChurnRisk,
  'cost-anomaly': detectCostAnomaly,
  'slo-breach': detectSloBreach,
  'compliance-deadline-near': detectComplianceDeadlineNear,
  'vendor-reliability-drop': detectVendorReliabilityDrop,
} as const;

export const OPPORTUNITY_DETECTORS: Readonly<
  Record<string, OpportunityDetectorFn>
> = {
  'vendor-rate-arbitrage': detectVendorRateArbitrage,
  'policy-tightening': detectPolicyTightening,
  'rent-vs-market': detectRentVsMarket,
} as const;
