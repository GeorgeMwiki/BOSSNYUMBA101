/**
 * @bossnyumba/estate-department-advisor — public surface.
 *
 * Veteran-expert "head of estate-department" strategic advisor.
 * Decides WHICH operations to run, HOW to staff them, WHEN to act
 * on signals, and HOW to position the department against industry
 * benchmarks.
 *
 * Not the mechanical layer — that's @bossnyumba/estate-auto-management
 * (predictive maintenance + RPA).
 *
 * All advisor functions are pure. LLM synthesis is OPTIONAL via the
 * injected MultiLLMSynthesizer port.
 *
 * Tenant-scoped at the type level: every input carries a TenantId.
 */

// Types
export * from './types.js';

// Portfolio
export {
  analyzePortfolioComposition,
  ASSET_MIX_TARGETS,
  HHI_THRESHOLDS,
} from './portfolio/portfolio-composition-advisor.js';
export type { CompositionReport } from './portfolio/portfolio-composition-advisor.js';
export { decideAssetCycle } from './portfolio/asset-cycle-decider.js';
export type {
  AssetCycleAction,
  AssetCycleInput,
  AssetCycleDecision,
} from './portfolio/asset-cycle-decider.js';
export { prioritizeCapex } from './portfolio/capex-prioritizer.js';
export type {
  CapexUrgency,
  CapexLine,
  PrioritizedCapex,
} from './portfolio/capex-prioritizer.js';
export { optimizeTenantMix } from './portfolio/tenant-mix-optimizer.js';
export type {
  TenantMixEntry,
  TenantMixReport,
} from './portfolio/tenant-mix-optimizer.js';

// Operations
export {
  benchmarkBoma,
  BOMA_OFFICE_2024,
} from './operations/boma-benchmarker.js';
export type { BomaBenchmark } from './operations/boma-benchmarker.js';
export {
  benchmarkIrem,
  IREM_MULTIFAMILY_2024,
} from './operations/irem-benchmarker.js';
export type { IremBenchmark, IremReport } from './operations/irem-benchmarker.js';
export { disaggregateOpex } from './operations/opex-disaggregator.js';
export type {
  OpexCategory,
  OpexLine,
  OpexDisaggregation,
} from './operations/opex-disaggregator.js';
export { benchmarkUtilities } from './operations/utility-benchmarker.js';
export type {
  UtilityInput,
  UtilityReport,
} from './operations/utility-benchmarker.js';
export {
  benchmarkSatisfaction,
  KINGSLEY_P50,
} from './operations/satisfaction-benchmarker.js';
export type {
  SatisfactionInput,
  SatisfactionReport,
} from './operations/satisfaction-benchmarker.js';

// Org
export {
  adviseStaffing,
  MF_STAFFING_BANDS,
  OFFICE_STAFFING_BANDS,
  SPAN_OF_CONTROL,
} from './org/staffing-model-advisor.js';
export type {
  StaffingBand,
  OfficeStaffingBand,
} from './org/staffing-model-advisor.js';
export { decideSourcing } from './org/insource-outsource-decider.js';
export type {
  SourceableFunction,
  SourcingInput,
  SourcingDecision,
  SourcingResult,
} from './org/insource-outsource-decider.js';
export {
  checkCompensation,
  CEL_2024_US,
  EA_FACTORS,
} from './org/compensation-benchmarker.js';
export type {
  CompBand,
  CompCheckInput,
  CompCheckResult,
} from './org/compensation-benchmarker.js';

// Vendor
export {
  adviseVendorPortfolio,
  CONCENTRATION_CAP,
  RFP_TRIGGER,
  RECOMMENDED_STRUCTURE,
  SLA_RESPONSE_HOURS_BY_CATEGORY,
} from './vendor/vendor-portfolio-advisor.js';
export type { VendorReport } from './vendor/vendor-portfolio-advisor.js';

// Risk
export {
  scoreCoverageAdequacy,
  AXIS_REQUIREMENTS,
} from './risk/coverage-adequacy-scorer.js';
export { optimizeDeductible } from './risk/deductible-optimizer.js';
export type {
  DeductibleInput,
  DeductibleAdvice,
} from './risk/deductible-optimizer.js';
export { modelCatastrophe } from './risk/catastrophe-modeler.js';
export type { CatastropheExposure } from './risk/catastrophe-modeler.js';

// Tax
export { estimateCostSeg } from './tax/cost-seg-advisor.js';
export type { CostSegInput } from './tax/cost-seg-advisor.js';
export { scan1031Opportunity } from './tax/1031-scanner.js';
export type { ExchangeInput } from './tax/1031-scanner.js';
export { adviseAppeal } from './tax/property-tax-appeal-advisor.js';
export type { AppealInput } from './tax/property-tax-appeal-advisor.js';
export { adviseStructure } from './tax/structure-advisor.js';
export type {
  EntityStructure,
  StructureInput,
  StructureAdvice,
} from './tax/structure-advisor.js';

// Owner relations
export {
  OWNER_COMM_PATTERNS,
  commPatternFor,
} from './owner-relations/comm-pattern-playbook.js';
export { adviseDistribution } from './owner-relations/distribution-advisor.js';
export type {
  DistributionInput,
  DistributionAdvice,
} from './owner-relations/distribution-advisor.js';
export {
  CRISIS_COMM_TEMPLATES,
  templateFor,
} from './owner-relations/crisis-comm-templates.js';
export type {
  CrisisIncidentType,
  CrisisCommTemplate,
} from './owner-relations/crisis-comm-templates.js';

// Tenant strategy
export { analyzeAcqRetention } from './tenant-strategy/acquisition-vs-retention-econ.js';
export type {
  AcqRetentionInput,
  AcqRetentionReport,
} from './tenant-strategy/acquisition-vs-retention-econ.js';
export {
  rankRetentionTactics,
  RETENTION_LEVERS,
} from './tenant-strategy/retention-tactic-ranker.js';
export type {
  RetentionLever,
  LeverScore,
  RankingInput,
  RankedLever,
} from './tenant-strategy/retention-tactic-ranker.js';
export { scoreDemographicFit } from './tenant-strategy/demographic-fit-scorer.js';
export type {
  DemographicInput,
  DemographicFitReport,
} from './tenant-strategy/demographic-fit-scorer.js';

// Crisis
export {
  getCrisisPlaybook,
  listCrisisIncidents,
} from './crisis/crisis-playbook-registry.js';
export { firstSeventyTwoHours } from './crisis/72hr-triage.js';
export { thirtyDayRecovery } from './crisis/30day-recovery.js';
export { POSTMORTEM_TEMPLATE } from './crisis/post-mortem-template.js';

// Regulatory
export {
  REGULATORY_CALENDAR,
  upcomingFilings,
  listEntriesByJurisdiction,
} from './regulatory/jurisdictional-calendar.js';
export type {
  UpcomingFilingsInput,
  UpcomingFiling,
} from './regulatory/jurisdictional-calendar.js';
export { scanCompliance } from './regulatory/compliance-scanner.js';
export type {
  ComplianceScanInput,
  ComplianceScanReport,
} from './regulatory/compliance-scanner.js';

// Advisor composer
export {
  prioritizeRecommendations,
  topNRecommendations,
} from './advisor/strategic-recommendation-prioritizer.js';
export {
  buildDepartmentHealthReport,
  buildDepartmentHealthReportWithNarrative,
} from './advisor/department-health-report.js';
export type {
  BuildReportInput,
  BuildReportWithNarrative,
} from './advisor/department-health-report.js';
