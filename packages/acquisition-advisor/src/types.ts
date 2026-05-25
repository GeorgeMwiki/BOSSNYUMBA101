/**
 * @bossnyumba/acquisition-advisor — shared types.
 *
 * Types are narrow + immutable per repo convention. All advisor
 * functions take these as `Readonly<...>` and return brand-new
 * objects (no mutation).
 */

// ---------------------------------------------------------------------------
// Asset class + jurisdiction
// ---------------------------------------------------------------------------

export type AssetClass =
  | 'multifamily'
  | 'office'
  | 'retail'
  | 'industrial'
  | 'mixed-use'
  | 'hotel'
  | 'land';

export type Jurisdiction = 'KE' | 'UG' | 'TZ' | 'NG' | 'ZA' | 'US' | string;

export type OwnerArchetype =
  | 'agingBoutique'
  | 'familyOfficeGen3'
  | 'distressedSponsor'
  | 'outOfStateHeir'
  | 'capitalStackTiredGP'
  | 'eaGenerationalFamily';

// ---------------------------------------------------------------------------
// DealSnapshot — the universal subject of the advisor
// ---------------------------------------------------------------------------

export interface DealSnapshot {
  readonly id: string;
  readonly subMarket: string;
  readonly jurisdiction: Jurisdiction;
  readonly assetClass: AssetClass;
  readonly askingPrice: number;
  /** Currency code: 'USD' | 'KES' | 'TZS' | 'UGX' | ... */
  readonly currency: string;
  /** Net leasable area in square metres. */
  readonly nlaSqm: number;
  /** Site area in square metres. */
  readonly siteAreaSqm: number;
  /** Latitude (decimal degrees). */
  readonly lat: number;
  /** Longitude (decimal degrees). */
  readonly lng: number;
  /** Trailing 12 months effective gross income. */
  readonly t12EGI: number;
  /** Trailing 12 months operating expenses. */
  readonly t12Opex: number;
  /** Number of units (multifamily) or NLA-equivalent (commercial). */
  readonly units: number;
  /** Year built. */
  readonly yearBuilt: number;
  /** Last renovation year (optional). */
  readonly yearRenovated?: number;
  /** Current zoning code. */
  readonly zoning: string;
}

// ---------------------------------------------------------------------------
// Sourcing — brokers, off-market triggers, owner outreach
// ---------------------------------------------------------------------------

export interface BrokerProfile {
  readonly id: string;
  readonly name: string;
  readonly tier: 1 | 2 | 3;
  /** Trailing 24-month deal-close ratio (0..1). */
  readonly closeRatio: number;
  /** Median days to close. */
  readonly daysToClose: number;
  /** Share of listings that repriced > 5% during marketing (0..1). */
  readonly repricingRate: number;
  /** Median executed CAs per listing. */
  readonly buyerPoolDepth: number;
  /** Share of last 24mo closed deals that never went to BOV (0..1). */
  readonly offMarketShare: number;
}

export interface BrokerScore {
  readonly broker: BrokerProfile;
  readonly composite: number;
  readonly breakdown: Readonly<{
    closeRatioContribution: number;
    daysToCloseContribution: number;
    repricingContribution: number;
    poolDepthContribution: number;
    offMarketContribution: number;
  }>;
  readonly tier: 'tier-1' | 'tier-2' | 'tier-3';
}

export type OffMarketTriggerType =
  | 'probate'
  | 'foreclosure'
  | 'taxLien'
  | 'codeViolation'
  | 'loanMaturity'
  | 'divorce';

export interface OffMarketTriggerSignal {
  readonly type: OffMarketTriggerType;
  readonly ownerId: string;
  readonly detectedAt: number; // unix ms
  readonly leadTimeMonths: number;
  /** Estimated probability of conversion to closed deal (0..1). */
  readonly conversionPriorPct: number;
  /** Extra confidence weight (e.g. recency, source quality). */
  readonly evidenceConfidence: number;
}

export interface OffMarketTriggerScored extends OffMarketTriggerSignal {
  readonly expectedValue: number;
  readonly priorityBand: 'hot' | 'warm' | 'cold';
}

export interface OutreachTemplate {
  readonly archetype: OwnerArchetype;
  readonly subject: string;
  readonly bodyTemplate: string;
  readonly hook: string;
  readonly expectedResponseRate: number;
  readonly channel: 'email' | 'mail' | 'whatsapp' | 'handwritten' | 'phone';
}

// ---------------------------------------------------------------------------
// Comps — sale + rent
// ---------------------------------------------------------------------------

export interface ComparableSale {
  readonly id: string;
  readonly salePricePerSqm: number;
  readonly distanceMetres: number;
  readonly monthsAgo: number;
  readonly sizeSqm: number;
  readonly assetClass: AssetClass;
  /** Quality similarity (0..1). */
  readonly qualitySimilarity: number;
  /** Cap rate at trade. */
  readonly capRate: number;
  /** Adjustment factor for time + condition + location (default 1.0). */
  readonly adjustmentFactor?: number;
}

export interface ComparableLease {
  readonly id: string;
  readonly rentPerSqmPerYear: number;
  readonly distanceMetres: number;
  readonly monthsAgo: number;
  readonly sizeSqm: number;
  readonly assetClass: AssetClass;
  readonly qualitySimilarity: number;
  readonly termYears: number;
  readonly tenantCovenant: 'IG' | 'NIG' | 'SME' | 'gov';
}

export interface SaleTriangulation {
  readonly used: ReadonlyArray<ComparableSale>;
  readonly droppedOutliers: ReadonlyArray<ComparableSale>;
  readonly weightedMedianPerSqm: number;
  readonly lowerCi: number;
  readonly upperCi: number;
  readonly confidence: number;
}

export interface RentTriangulation {
  readonly used: ReadonlyArray<ComparableLease>;
  readonly droppedOutliers: ReadonlyArray<ComparableLease>;
  readonly weightedMedianRentPerSqm: number;
  readonly confidence: number;
}

export interface CapRateDerivative {
  readonly trimmedMean: number;
  readonly median: number;
  readonly sigma: number;
  /** Spread to 10-yr risk-free rate (decimal). */
  readonly spreadBps: number;
  readonly compCount: number;
}

// ---------------------------------------------------------------------------
// LOI / PSA risk
// ---------------------------------------------------------------------------

export type LOIAxisKey =
  | 'purchasePrice'
  | 'earnestMoney'
  | 'ddPeriod'
  | 'ddExtension'
  | 'financingContingency'
  | 'titleCommitmentDeadline'
  | 'surveyDeadline'
  | 'estoppels'
  | 'snda'
  | 'serviceContracts'
  | 'casualtyCondemnation'
  | 'environmentalIndemnity'
  | 'repWarrantySurvival'
  | 'repWarrantyCap'
  | 'closingDate'
  | 'prorations'
  | 'closingCostAllocation'
  | 'brokerage'
  | 'sellerReps'
  | 'operatingCovenants'
  | 'rofoRofr'
  | 'confidentiality'
  | 'exclusivity'
  | 'taxCooperation'
  | 'governingLaw';

export type LOIAxisScore = 0 | 1 | 2 | 3 | 4 | 5;

export interface LOIAxisRating {
  readonly key: LOIAxisKey;
  readonly score: LOIAxisScore;
  readonly notes: string;
}

export interface LOIRiskScore {
  readonly axes: ReadonlyArray<LOIAxisRating>;
  /** sum / 125 normalized (0..1). */
  readonly normalized: number;
  readonly verdict: 'do-not-sign' | 'redraft' | 'acceptable' | 'strong';
  readonly criticalGaps: ReadonlyArray<LOIAxisKey>;
}

export type PSAClauseKey =
  | 'titleObjectionMechanic'
  | 'permittedExceptions'
  | 'surveyObjection'
  | 'opStatementAudit'
  | 'serviceContractSchedule'
  | 'personalPropSchedule'
  | 'intangibleAssignment'
  | 'tenantDepositTransfer'
  | 'prepaidRentTransfer'
  | 'taxProration'
  | 'utilityTransfer'
  | 'insuranceTransfer'
  | 'lenderSideLetters'
  | 'loanAssumptionFee'
  | 'defeasanceAllocation'
  | 'casualtyTrigger'
  | 'condemnationTrigger'
  | 'hazardInsurance'
  | 'rwiProcurement'
  | 'indemnityBasket'
  | 'holdbackEscrow'
  | 'brokersLienWaiver'
  | 'constructionWarranty'
  | 'roofHvacWarranty'
  | 'soilsDisclosure'
  | 'moldDisclosure'
  | 'lbpDisclosure'
  | 'asbestosDisclosure'
  | 'radonDisclosure'
  | 'melloRoosDisclosure'
  | 'spousalConsentKE'
  | 'familyTrustTZ'
  | 'customaryReleaseUG'
  | 'ancestralRelease';

export interface PSAClauseFlag {
  readonly key: PSAClauseKey;
  readonly present: boolean;
  readonly buyerFavorable: boolean;
  readonly riskLevel: 'low' | 'medium' | 'high' | 'critical';
  readonly recommendation: string;
}

export interface CasualtyCondemnationModel {
  readonly thresholdSharePct: number;
  readonly thresholdDollar: number;
  readonly buyerTerminationTrigger: boolean;
  readonly insuranceProceedsCredit: boolean;
  readonly partialCondemnationRule: 'auto-terminate' | 'buyer-elect' | 'price-reduce';
}

// ---------------------------------------------------------------------------
// Environmental
// ---------------------------------------------------------------------------

export type RECCategory = 'REC' | 'HREC' | 'CREC' | 'deMinimis' | 'none';

export interface RECFinding {
  readonly id: string;
  readonly category: RECCategory;
  readonly contaminant: string;
  readonly mediaAffected: ReadonlyArray<'soil' | 'groundwater' | 'soilVapor' | 'surfaceWater' | 'building'>;
  readonly historicalUse: string;
  /** Distance in metres from subject. */
  readonly distanceMetres: number;
  readonly recommendedNextStep: 'noAction' | 'phase2' | 'mitigation' | 'walkAway';
}

export interface Phase1ScopingResult {
  readonly findings: ReadonlyArray<RECFinding>;
  /** Aggregate severity (0..1). */
  readonly severity: number;
  readonly recommendPhase2: boolean;
  readonly priorityContaminants: ReadonlyArray<string>;
  readonly insuranceCarrierWillRequirePhase2: boolean;
}

export interface Phase2Trigger {
  readonly triggered: boolean;
  readonly reasonCodes: ReadonlyArray<string>;
  readonly mediaToSample: ReadonlyArray<'soil' | 'groundwater' | 'soilVapor' | 'surfaceWater' | 'building'>;
  readonly estimatedCostUsd: number;
}

export interface VaporIntrusionModel {
  readonly distanceFromSourceMetres: number;
  readonly contaminant: 'TCE' | 'PCE' | 'benzene' | 'naphthalene' | 'other';
  readonly soilType: 'sand' | 'silt' | 'clay' | 'fill';
  readonly buildingType: 'slab-on-grade' | 'basement' | 'crawlspace';
  readonly attenuationFactor: number;
  readonly mitigationRequired: boolean;
  readonly mitigationCostUsd: number;
}

// ---------------------------------------------------------------------------
// Title
// ---------------------------------------------------------------------------

export type ScheduleBExceptionType =
  | 'utilityEasement'
  | 'accessEasement'
  | 'drainageEasement'
  | 'conservationEasement'
  | 'mineralReservation'
  | 'restrictiveCovenant'
  | 'pendingLitigation'
  | 'boundaryDispute'
  | 'taxLien'
  | 'mechanicLien'
  | 'hoaArrears'
  | 'mortgage'
  | 'lisPendens'
  | 'federalTaxLien';

export interface ScheduleBException {
  readonly id: string;
  readonly type: ScheduleBExceptionType;
  readonly description: string;
  readonly recordedDate?: string;
  readonly amount?: number;
  /** Buyer's score 0..10 (10 = deal killer). */
  readonly impactScore: number;
  readonly curableAtClose: boolean;
}

export interface AltaCommitmentReading {
  readonly exceptions: ReadonlyArray<ScheduleBException>;
  readonly standardExceptionsDeletable: boolean;
  readonly criticalCount: number;
  readonly aggregateImpactScore: number;
  readonly verdict: 'clean' | 'workable' | 'requires-cure' | 'unworkable';
}

export interface EasementImpact {
  readonly easementId: string;
  readonly scope: 'surface' | 'subSurface' | 'aerial' | 'mixed';
  readonly term: 'perpetual' | 'fixed' | 'terminable';
  readonly exclusivity: 'exclusive' | 'shared';
  readonly developableAreaLostSqm: number;
  readonly buildAroundFeasible: boolean;
  readonly compensationOwed: number;
  readonly valuationImpact: number;
}

export interface RestrictiveCovenantImpact {
  readonly covenantId: string;
  readonly category: 'use' | 'density' | 'aesthetics' | 'height' | 'buildingLine' | 'architecturalReview';
  readonly probabilityOfBreach: number;
  readonly costOfCure: number;
  readonly probabilityOfEnforcement: number;
  readonly expectedLoss: number;
}

// ---------------------------------------------------------------------------
// Survey
// ---------------------------------------------------------------------------

export interface AltaSurveyReading {
  readonly hasMonuments: boolean;
  readonly hasFloodZone: boolean;
  readonly hasZoningSummary: boolean;
  readonly encroachments: ReadonlyArray<SurveyEncroachment>;
  readonly setbackViolations: ReadonlyArray<SetbackViolation>;
  readonly aggregateEncroachmentScore: number;
  readonly verdict: 'clean' | 'minor' | 'material' | 'unworkable';
}

export interface SurveyEncroachment {
  readonly id: string;
  readonly direction: 'subjectOntoNeighbor' | 'neighborOntoSubject' | 'acrossROW';
  readonly affectedAreaSqm: number;
  readonly severityScore: number;
  readonly curableAtClose: boolean;
}

export interface SetbackViolation {
  readonly id: string;
  readonly side: 'front' | 'side' | 'rear';
  readonly requiredMetres: number;
  readonly actualMetres: number;
  readonly grandfathered: boolean;
  readonly redevelopmentTrigger: boolean;
}

// ---------------------------------------------------------------------------
// Zoning + entitlement
// ---------------------------------------------------------------------------

export type EntitlementPath =
  | 'by-right'
  | 'administrative'
  | 'special-use'
  | 'variance'
  | 'rezoning'
  | 'pud';

export interface EntitlementAnalysis {
  readonly path: EntitlementPath;
  readonly estimatedMonths: number;
  readonly probabilityOfApproval: number;
  readonly oppositionScore: number;
  readonly cost: number;
  readonly riskLevel: 'low' | 'medium' | 'high' | 'very-high';
  readonly notes: ReadonlyArray<string>;
}

export interface OppositionInputs {
  readonly hoaDensityWithin0_8Km: number;
  readonly ownerOccupiedSharePct: number;
  readonly medianHouseholdIncomeUsd: number;
  readonly contestedRezoningCountLast5Yr: number;
  readonly distanceToHistoricDistrictMetres: number;
  readonly transitProximityScore: number;
  readonly educationAttainmentSharePct: number;
}

export interface OppositionScore {
  readonly score: number;
  readonly band: 'low' | 'moderate' | 'high' | 'severe';
  readonly contributionByAxis: Readonly<Record<keyof OppositionInputs, number>>;
}

// ---------------------------------------------------------------------------
// Geo risk
// ---------------------------------------------------------------------------

export interface SeismicRiskInputs {
  readonly pga: number; // peak ground acceleration in g
  readonly siteClass: 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
}

export interface SeismicRisk {
  readonly band: 'very-low' | 'low' | 'moderate' | 'high' | 'very-high';
  readonly amplificationFactor: number;
  readonly designUpliftPct: number;
  readonly insurancePremiumUpliftPct: number;
}

export interface FloodRiskInputs {
  /** FEMA zone or EA risk band. */
  readonly femaZone?: 'X' | 'X-shaded' | 'A' | 'AE' | 'AO' | 'AH' | 'V' | 'VE' | 'D';
  readonly eaRiskBand?: 'low' | 'moderate' | 'high' | 'very-high';
  readonly distanceToWatercourseMetres?: number;
  readonly elevationMetres?: number;
  readonly base100YrFloodElevationMetres?: number;
}

export interface FloodRisk {
  readonly band: 'minimal' | 'low' | 'moderate' | 'high' | 'very-high';
  readonly insuranceRequired: boolean;
  readonly annualPremiumPerSqmUsd: number;
  readonly designUpliftPct: number;
}

export interface SlopeStabilityInputs {
  readonly slopePct: number;
}

export interface SlopeStability {
  readonly band: 'flat' | 'gentle' | 'moderate' | 'steep' | 'very-steep';
  readonly designUpliftPct: number;
  readonly engineeredRetainingRequired: boolean;
}

// ---------------------------------------------------------------------------
// Financial DD
// ---------------------------------------------------------------------------

export interface T12T3Inputs {
  readonly t12Egi: number;
  readonly t12Opex: number;
  readonly t12NoiReported: number;
  /** Trailing 3 months EGI annualized. */
  readonly t3EgiAnnualized: number;
  /** Trailing 3 months Opex annualized. */
  readonly t3OpexAnnualized: number;
  readonly t3NoiAnnualizedReported: number;
  readonly rentRollGpr: number;
  readonly rentRollEgi: number;
  readonly hasStudentHousingSeasonality: boolean;
}

export interface T12T3Finding {
  readonly code: string;
  readonly severity: 'info' | 'warn' | 'critical';
  readonly message: string;
}

export interface T12T3Validation {
  readonly t12NoiComputed: number;
  readonly t3NoiComputed: number;
  readonly t12vT3DriftPct: number;
  readonly rentRollEgiVariancePct: number;
  readonly findings: ReadonlyArray<T12T3Finding>;
  readonly pass: boolean;
}

export interface RentRollUnit {
  readonly unitId: string;
  readonly tenant: string;
  readonly leaseStart: string; // ISO date
  readonly leaseEnd: string; // ISO date
  readonly monthlyRent: number;
  readonly marketRent: number;
  readonly securityDeposit: number;
  readonly concessionMonths: number;
  readonly percentageRentBreakpoint?: number;
}

export interface RentRollIntegrityFinding {
  readonly code: string;
  readonly severity: 'info' | 'warn' | 'critical';
  readonly unitId?: string;
  readonly message: string;
}

export interface RentRollIntegrity {
  readonly findings: ReadonlyArray<RentRollIntegrityFinding>;
  readonly markToMarketUpsidePct: number;
  readonly pass: boolean;
}

export interface ExpenseReconciliation {
  readonly category: string;
  readonly t12Reported: number;
  readonly benchmarkLow: number;
  readonly benchmarkHigh: number;
  readonly redFlag: boolean;
  readonly notes: string;
}

// ---------------------------------------------------------------------------
// Title insurance endorsements
// ---------------------------------------------------------------------------

export type EndorsementCode =
  | '3-06'
  | '3.1-06'
  | '9-06'
  | '9.1-06'
  | '9.2-06'
  | '9.3-06'
  | '9.10-06'
  | '13-06'
  | '16-06'
  | '17-06'
  | '18-06'
  | '19-06'
  | '22-06'
  | '22.1-06'
  | '25-06'
  | '25.1-06'
  | '28-06'
  | '28.1-06'
  | '28.2-06'
  | '28.3-06'
  | '35-06';

export interface EndorsementRecommendation {
  readonly code: EndorsementCode;
  readonly reason: string;
  readonly mandatory: boolean;
  readonly estimatedPremiumUsd: number;
}

// ---------------------------------------------------------------------------
// EA jurisdictional
// ---------------------------------------------------------------------------

export interface KETitleSearchInputs {
  readonly lrNumber: string;
  readonly nlimsRegistered: boolean;
  readonly tenureType: 'freehold' | 'leasehold' | 'sectional';
  readonly leaseTermYears?: number;
  readonly mortgageRegistered: boolean;
  readonly caveats: ReadonlyArray<string>;
  readonly restrictionsRegistered: boolean;
  readonly spousalConsentObtained: boolean;
  readonly ratesClearance: boolean;
  readonly landRentClearance: boolean;
  readonly surveyPlanReconciled: boolean;
  readonly lcbConsentRequired: boolean;
  readonly lcbConsentObtained: boolean;
  readonly knownDoubleAllotmentRisk: boolean;
  readonly inPublicLandWatchlist: boolean;
}

export interface KETitleSearchResult {
  readonly checklist: ReadonlyArray<{ key: string; passed: boolean; severity: 'info' | 'warn' | 'critical' }>;
  readonly criticalGaps: ReadonlyArray<string>;
  readonly verdict: 'clean' | 'workable' | 'requires-cure' | 'unworkable';
}

export interface TZTitleSearchInputs {
  readonly titleClass: 'general' | 'village';
  readonly certificateType: 'CT' | 'CCRO';
  readonly issueYear: number;
  readonly termYears: 33 | 66 | 99;
  readonly encumbrancesRegistered: boolean;
  readonly caveats: ReadonlyArray<string>;
  readonly traTaxClearance: boolean;
  readonly surveyDiagramOnFile: boolean;
  readonly plotRentClearance: boolean;
  readonly villageCouncilAttestation: boolean;
  readonly nemcStatusClean: boolean;
  readonly customaryOverlapRisk: boolean;
}

export interface TZTitleSearchResult {
  readonly checklist: ReadonlyArray<{ key: string; passed: boolean; severity: 'info' | 'warn' | 'critical' }>;
  readonly criticalGaps: ReadonlyArray<string>;
  readonly verdict: 'clean' | 'workable' | 'requires-cure' | 'unworkable';
}

export interface UGTitleSearchInputs {
  readonly tenureSystem: 'mailo' | 'freehold' | 'leasehold' | 'customary';
  readonly leaseTermYears?: number;
  readonly whitePageSearchClean: boolean;
  readonly encroachmentSearchClean: boolean;
  readonly bibanjaHoldersPresent: boolean;
  readonly spousalConsentObtained: boolean;
  readonly kccaRatesClearance: boolean;
  readonly nemaStatusClean: boolean;
  readonly demdAuthenticated: boolean;
  readonly overlappingCustomaryClaim: boolean;
}

export interface UGTitleSearchResult {
  readonly checklist: ReadonlyArray<{ key: string; passed: boolean; severity: 'info' | 'warn' | 'critical' }>;
  readonly criticalGaps: ReadonlyArray<string>;
  readonly verdict: 'clean' | 'workable' | 'requires-cure' | 'unworkable';
}

export interface AncestralClaimInputs {
  readonly distanceToCustomaryTenureKm: number;
  readonly titleAgeYears: number;
  readonly titleGenesisPath: 'allotment' | 'adjudication' | 'grant' | 'inheritance' | 'unknown';
  readonly heirCount: number;
  readonly villageElderAttestationObtained: boolean;
  readonly quietTitleDecreeObtained: boolean;
  readonly pendingLandCourtLitigation: boolean;
}

export interface AncestralClaimRiskScore {
  readonly score: number;
  readonly band: 'low' | 'moderate' | 'high' | 'severe';
  readonly recommendedActions: ReadonlyArray<string>;
}

// ---------------------------------------------------------------------------
// DD finding (universal) + composed acquisition recommendation
// ---------------------------------------------------------------------------

export type DDDomain =
  | 'sourcing'
  | 'comps'
  | 'loi'
  | 'psa'
  | 'environmental'
  | 'title'
  | 'survey'
  | 'zoning'
  | 'geotech'
  | 'financial'
  | 'titleInsurance'
  | 'eaJurisdictional';

export type DDSeverity = 'info' | 'warn' | 'critical' | 'deal-killer';

export interface DDFinding {
  readonly id: string;
  readonly domain: DDDomain;
  readonly severity: DDSeverity;
  readonly summary: string;
  readonly detail: string;
  readonly mustCureBeforeClose: boolean;
  readonly estimatedCureCostUsd?: number;
}

export interface AcquisitionRecommendation {
  readonly dealId: string;
  readonly verdict: 'go' | 'proceed-with-conditions' | 'renegotiate' | 'no-go';
  readonly composite: number;
  readonly pricingRecommendation: {
    readonly compTriangulatedValue: number;
    readonly incomeCapValue: number;
    readonly replacementCostValue: number;
    readonly blendedRecommendedOffer: number;
    readonly walkAwayCeiling: number;
  };
  readonly findings: ReadonlyArray<DDFinding>;
  readonly closingChecklist: ReadonlyArray<string>;
  readonly narrative: string;
  readonly confidence: number;
}

// ---------------------------------------------------------------------------
// MCDA weights
// ---------------------------------------------------------------------------

export interface MCDAWeights {
  readonly financial: number;
  readonly comps: number;
  readonly environmental: number;
  readonly title: number;
  readonly survey: number;
  readonly zoning: number;
  readonly geotech: number;
  readonly financialDD: number;
  readonly eaJurisdictional: number;
}

export const DEFAULT_MCDA_WEIGHTS: MCDAWeights = {
  financial: 0.25,
  comps: 0.15,
  environmental: 0.12,
  title: 0.10,
  survey: 0.07,
  zoning: 0.10,
  geotech: 0.06,
  financialDD: 0.10,
  eaJurisdictional: 0.05,
};

// ---------------------------------------------------------------------------
// Optional LLM synthesis port
// ---------------------------------------------------------------------------

export interface MultiLLMSynthesizer {
  /**
   * Synthesise a longer-form narrative summary from the structured
   * recommendation. Implementations are responsible for managing
   * keys, models, redaction, etc.
   */
  synthesizeNarrative(
    rec: AcquisitionRecommendation,
    deal: DealSnapshot,
  ): Promise<string>;
}
