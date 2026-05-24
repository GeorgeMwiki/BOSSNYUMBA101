/**
 * @bossnyumba/expansion-advisor — public surface.
 *
 * Veteran-expert real-estate expansion advisor. Composes
 * Appraisal-Institute HBU + market absorption + capital stack +
 * lease-up curves + value-add scoring + gentrification index +
 * zoning leverage + comparable-sales triangulation + optional
 * land-banking forecast into a defensible recommendation report.
 *
 * All math lives in pure functions; orchestration is via injected
 * ports — the package itself does not perform any I/O.
 */

// Types
export * from './types.js';

// HBU
export { analyzeHBU } from './hbu/hbu-analyzer.js';
export type { HBUInputs } from './hbu/hbu-analyzer.js';
export { legallyPermissible } from './hbu/legally-permissible.js';
export type { LegalityRules } from './hbu/legally-permissible.js';
export { physicallyPossible } from './hbu/physically-possible.js';
export type { PhysicalRules } from './hbu/physically-possible.js';
export { financiallyFeasible } from './hbu/financially-feasible.js';
export type {
  FinancialRules,
  FinancialEvaluation,
} from './hbu/financially-feasible.js';
export { maximallyProductive } from './hbu/maximally-productive.js';
export type {
  ProductivityInputs,
  ProductivityRanked,
} from './hbu/maximally-productive.js';

// Market
export { forecastAbsorption } from './market/absorption-forecaster.js';
export type { AbsorptionInputs } from './market/absorption-forecaster.js';
export { computeGentrificationIndex } from './market/gentrification-index.js';
export { triangulate } from './market/comparable-sales-triangulator.js';
export type { TriangulationFilters } from './market/comparable-sales-triangulator.js';
export { zoningLeverageScore } from './market/zoning-leverage.js';
export { forecastLandBanking } from './market/land-banking.js';
export type { LandBankingOptions } from './market/land-banking.js';
export {
  reitMultiples,
  SECTOR_AFFO_MULTIPLE,
  SECTOR_NOI_MULTIPLE,
} from './market/reit-comparables.js';
export type { ReitFinancials, ReitMultiples } from './market/reit-comparables.js';

// Capital
export { optimiseCapitalStack } from './capital/capital-stack-optimizer.js';
export { yieldOnCost } from './capital/yield-on-cost.js';
export type { YieldOnCostInputs, YieldOnCostResult } from './capital/yield-on-cost.js';
export { irr, npv, irrNpv } from './capital/irr-npv.js';

// Leasing
export { leaseUpCurve } from './leasing/lease-up-curves.js';
export type { LeaseUpInputs } from './leasing/lease-up-curves.js';
export { scoreValueAdd } from './leasing/value-add-scorer.js';

// Advisor
export { recommendExpansion } from './advisor/expansion-recommender.js';
export type { AdvisorRules } from './advisor/expansion-recommender.js';
