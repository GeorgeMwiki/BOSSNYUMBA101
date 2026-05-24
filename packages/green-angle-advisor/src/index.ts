/**
 * @bossnyumba/green-angle-advisor — public exports.
 *
 * Veteran-expert green opportunity scanner. Given any project
 * description, returns sustainability angles, ESG-linked financing,
 * regulatory grant alignment, carbon-market participation, and
 * jurisdictional alignment.
 *
 * Entry point: {@link generateVeteranExpertReport}.
 *
 * Reference: `.audit/sota-2026-05-24/05-green-angle-advisor.md`.
 */

// Types
export * from './types.js';

// Project typer
export {
  classifyProject,
} from './project-typer/project-classifier.js';
export {
  PROJECT_TYPE_PROFILES,
  profileForType,
  type ProjectTypeProfile,
} from './project-typer/project-taxonomy.js';

// Opportunities
export {
  OPPORTUNITY_CATALOG,
  findOpportunityById,
  isOpportunityApplicable,
  type OpportunityDescriptor,
} from './opportunities/opportunity-catalog.js';
export {
  matchOpportunities,
  type MatchOptions,
} from './opportunities/opportunity-matcher.js';
export { estimateLandBridgeBng, estimateLandBng, type BngEstimate } from './opportunities/bng-opportunity.js';
export { estimateCorridorSolar, type SolarColocationEstimate } from './opportunities/solar-colocation.js';
export { estimateEvHub, type EvHubEstimate } from './opportunities/ev-charging-hub.js';
export { estimateWaterReclaim, type WaterReclaimEstimate } from './opportunities/water-reclaim.js';
export { estimateBlueCarbon, type BlueCarbonEstimate } from './opportunities/blue-carbon.js';
export { estimateRegenAg, type RegenAgEstimate } from './opportunities/regen-ag.js';
export { estimateUrbanForestry, type UrbanForestryEstimate } from './opportunities/urban-forestry.js';

// Financing
export {
  GREEN_FINANCE_CATALOG,
  findInstrumentById,
} from './financing/green-finance-catalog.js';
export {
  matchFinancing,
  type FinancingMatchOptions,
} from './financing/financing-matcher.js';
export {
  modelSll,
  type SllInputs,
  type SllProjection,
} from './financing/sustainability-linked-loan-modeler.js';

// Carbon credits
export {
  CARBON_METHODOLOGY_CATALOG,
  findMethodologyById,
  matchMethodologies,
} from './carbon-credits/methodology-matcher.js';
export {
  estimateOffsetVolume,
  type OffsetVolumeResult,
} from './carbon-credits/offset-volume-estimator.js';
export {
  forecastCreditValue,
  type CreditValueForecast,
} from './carbon-credits/credit-value-forecaster.js';

// Impact
export {
  scoreSdgAlignment,
  type SdgAlignment,
} from './impact/sdg-alignment-scorer.js';
export {
  scoreCoBenefits,
  type CoBenefitsWeights,
} from './impact/co-benefits-scorer.js';

// Advisor
export {
  generateVeteranExpertReport,
  type VeteranExpertOptions,
} from './advisor/veteran-expert-report.js';
export {
  prioritizeOpportunities,
  type Priority,
} from './advisor/opportunity-prioritizer.js';
