/**
 * @bossnyumba/acquisition-advisor — public surface.
 *
 * Veteran-expert real-estate acquisition + due-diligence advisor.
 * Composes deal sourcing + comp-sale triangulation + LOI/PSA risk
 * scoring + ASTM Phase I/II environmental + ALTA 2021 title +
 * ALTA/NSPS 2021 survey + entitlement-path + geotech (seismic +
 * flood + slope) + financial DD (T-12/T-3 + rent-roll + expenses) +
 * ALTA title-insurance endorsements + East-Africa jurisdictional
 * (KE Land Act 2012, TZ Land Act 1999, UG LRA 1922, ancestral
 * claim) into a defensible go/no-go acquisition recommendation.
 *
 * All math lives in pure functions; orchestration is via injected
 * ports — the package itself does not perform any I/O.
 */

// Types
export * from './types.js';

// Sourcing
export { scoreBroker, rankBrokers } from './sourcing/broker-network-scorer.js';
export {
  scoreOffMarketTrigger,
  rankTriggers,
  OFF_MARKET_CONVERSION_PRIORS,
} from './sourcing/off-market-trigger-miner.js';
export {
  getOutreachTemplate,
  listOutreachTemplates,
  OUTREACH_RESPONSE_RATES,
} from './sourcing/owner-outreach-personalizer.js';

// Comps
export { triangulateSales } from './comps/sale-triangulator.js';
export type { SaleTriangulationFilters } from './comps/sale-triangulator.js';
export { computeCapRateDerivative } from './comps/cap-rate-derivative.js';
export type { CapRateDerivativeInputs } from './comps/cap-rate-derivative.js';
export { triangulateRents } from './comps/rent-comp-triangulator.js';
export type { RentTriangulationFilters } from './comps/rent-comp-triangulator.js';

// LOI / PSA
export { scoreLOI, emptyLOI, LOI_AXES } from './loi-psa/loi-25-axis-scorer.js';
export { flagPSAClauses, PSA_CLAUSE_SPECS } from './loi-psa/psa-clause-flagger.js';
export type { PSAFlaggerInputs } from './loi-psa/psa-clause-flagger.js';
export {
  modelCasualtyCondemnation,
  buyerMayTerminate,
} from './loi-psa/casualty-and-condemnation-modeler.js';
export type { CasualtyConfigInputs } from './loi-psa/casualty-and-condemnation-modeler.js';

// Environmental
export {
  scopePhase1,
  PHASE1_SEVERITY_BY_CATEGORY,
  PHASE1_HIGH_CONCERN_CONTAMINANTS,
} from './environmental/phase1-scoping.js';
export type { Phase1ScopingInputs } from './environmental/phase1-scoping.js';
export { triggerPhase2 } from './environmental/phase2-trigger.js';
export type { Phase2TriggerInputs } from './environmental/phase2-trigger.js';
export { modelVaporIntrusion } from './environmental/vapor-intrusion-modeler.js';
export type { VaporIntrusionInputs } from './environmental/vapor-intrusion-modeler.js';

// Title
export { readAltaCommitment, DEFAULT_IMPACT_BY_TYPE } from './title/alta-commitment-reader.js';
export type { AltaCommitmentInputs } from './title/alta-commitment-reader.js';
export { modelEasementImpact } from './title/easement-encumbrance-modeler.js';
export type { EasementImpactInputs } from './title/easement-encumbrance-modeler.js';
export {
  modelCovenantImpact,
  COVENANT_BASELINE_COSTS,
} from './title/restrictive-covenant-impact.js';
export type { CovenantInputs } from './title/restrictive-covenant-impact.js';

// Survey
export { readAltaSurvey } from './survey/alta-survey-reader.js';
export type { AltaSurveyInputs } from './survey/alta-survey-reader.js';

// Zoning
export {
  analyzeEntitlementPath,
  ENTITLEMENT_PATH_PROFILES,
} from './zoning/entitlement-path-analyzer.js';
export type { EntitlementInputs } from './zoning/entitlement-path-analyzer.js';
export { scoreOpposition } from './zoning/opposition-scorer.js';

// Geo risk
export {
  scoreSeismicRisk,
  SEISMIC_SITE_CLASS_AMPLIFICATION,
} from './geo-risk/seismic-risk.js';
export {
  scoreFloodRisk,
  FLOOD_FEMA_TO_BAND,
  FLOOD_EA_TO_BAND,
} from './geo-risk/flood-zone-risk.js';
export { scoreSlopeStability } from './geo-risk/slope-stability.js';

// Financial DD
export { validateT12T3 } from './financial/t12-t3-validator.js';
export { checkRentRollIntegrity } from './financial/rent-roll-integrity.js';
export { reconcileExpenses, EXPENSE_BENCHMARKS } from './financial/expense-reconciler.js';
export type {
  ExpenseLineItem,
  ExpenseReconcileInputs,
} from './financial/expense-reconciler.js';

// Insurance
export {
  recommendEndorsements,
  TITLE_ENDORSEMENT_SPECS,
} from './insurance/title-endorsement-recommender.js';
export type { EndorsementContext } from './insurance/title-endorsement-recommender.js';

// EA jurisdictional
export { checkKETitleSearch } from './ea-jurisdictional/ke-title-search-checklist.js';
export { checkTZTitleSearch } from './ea-jurisdictional/tz-title-search-checklist.js';
export { checkUGTitleSearch } from './ea-jurisdictional/ug-title-search-checklist.js';
export {
  scoreAncestralClaim,
  ANCESTRAL_GENESIS_RISK,
} from './ea-jurisdictional/ancestral-claim-risk-scorer.js';

// Advisor (composition)
export { recommendAcquisition } from './advisor/acquisition-recommender.js';
export type { AcquisitionRecommenderInputs } from './advisor/acquisition-recommender.js';
export { decideGoNoGo } from './advisor/go-no-go-decision.js';
export type { MCDAInputs, MCDADecision } from './advisor/go-no-go-decision.js';
