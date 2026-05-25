/**
 * @bossnyumba/lifecycle-advisor — shared types.
 *
 * All types are immutable (Readonly / ReadonlyArray) per repo
 * convention. Every advisor function takes Readonly inputs and
 * returns a brand-new object (no mutation).
 *
 * Citations are embedded in the file headers of the individual
 * modules; this file only carries type-shape definitions.
 */

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

export type AssetClass =
  | 'multifamily'
  | 'office'
  | 'retail'
  | 'industrial'
  | 'mixed-use'
  | 'land';

export type Jurisdiction = 'KE' | 'UG' | 'TZ' | 'NG' | 'ZA' | 'US' | 'UK' | string;

export type Currency = 'USD' | 'KES' | 'TZS' | 'UGX' | 'NGN' | 'ZAR' | 'GBP' | string;

export type LifecycleStage =
  | 'pre-development'
  | 'under-construction'
  | 'lease-up'
  | 'stabilised-hold'
  | 'refi-window'
  | 'disposition-window';

// ---------------------------------------------------------------------------
// Development — feasibility
// ---------------------------------------------------------------------------

/** USPAP Std 9 §9-2 (b) inputs for a development feasibility test. */
export interface FeasibilityInputs {
  readonly assetId: string;
  /** All-in development cost (land + hard + soft + financing + contingency). */
  readonly totalDevelopmentCost: number;
  /** Stabilised net-operating-income (annual). */
  readonly stabilisedNOI: number;
  /** Going-in capitalisation rate (decimal, e.g. 0.075). */
  readonly goingInCapRate: number;
  /** Owner's hurdle IRR (decimal). */
  readonly hurdleIRR: number;
  /** Project IRR computed elsewhere (decimal). */
  readonly projectIRR: number;
  /** Peak equity required at any point in the development. */
  readonly peakEquity: number;
  /** Owner's available equity pocket. */
  readonly ownerEquityCapacity: number;
  /** Hard-cost contingency as decimal of hard cost (e.g. 0.075). */
  readonly hardContingencyPct: number;
  /** Soft-cost contingency as decimal of soft cost (e.g. 0.10). */
  readonly softContingencyPct: number;
  /** Loan-to-cost (decimal). */
  readonly ltc: number;
  /** Loan-to-stabilised-value (decimal). */
  readonly ltv: number;
}

export type FeasibilityVerdict = 'go' | 'conditional-go' | 'redesign';

export interface FeasibilityResult {
  readonly assetId: string;
  readonly verdict: FeasibilityVerdict;
  readonly untrendedYieldOnCost: number;
  readonly yieldSpreadVsCapBps: number;
  readonly irrSpreadVsHurdleBps: number;
  readonly equityHeadroomPct: number;
  readonly gateResults: ReadonlyArray<{
    readonly gate: string;
    readonly passed: boolean;
    readonly threshold: string;
    readonly actual: string;
  }>;
  readonly failingGates: ReadonlyArray<string>;
}

// ---------------------------------------------------------------------------
// Development — GC selection
// ---------------------------------------------------------------------------

export type DeliveryMethod = 'design-bid-build' | 'cmar' | 'design-build' | 'ipd';

export interface ProjectAttributes {
  readonly complexity: 'low' | 'medium' | 'high' | 'extreme';
  readonly drawingsCompletePct: number; // 0..1
  readonly speedRequired: 'normal' | 'fast-track' | 'aggressive';
  readonly innovationLevel: 'standard' | 'custom' | 'first-of-kind';
  readonly riskTolerance: 'low' | 'medium' | 'high';
}

export interface GCBid {
  readonly contractorId: string;
  readonly name: string;
  /** 0..1 normalised history of similar successful projects. */
  readonly trackRecord: number;
  /** 0..1 strength of proposed PM + superintendent. */
  readonly teamStrength: number;
  /** 0..1 — closer to 1 means more realistic schedule. */
  readonly scheduleRealism: number;
  /** Bid price in local currency. */
  readonly price: number;
  /** Lowest bid in the field (for normalisation). */
  readonly lowestBidPrice: number;
  /** DART safety incident rate. */
  readonly dartRate: number;
  /** 0..1 commitment to disadvantaged-business / local hire. */
  readonly localHireScore: number;
  /** Optional licence / class (e.g. NCA-1 in Kenya). */
  readonly licenceClass?: string;
}

export interface GCBidScore {
  readonly contractorId: string;
  readonly trackRecordScore: number;
  readonly teamStrengthScore: number;
  readonly scheduleRealismScore: number;
  readonly priceScore: number;
  readonly safetyScore: number;
  readonly localHireScore: number;
  readonly total: number;
  readonly rank: number;
}

export interface GCSelection {
  readonly method: DeliveryMethod;
  readonly rationale: string;
  readonly rankedBids: ReadonlyArray<GCBidScore>;
  readonly recommended: GCBidScore;
}

// ---------------------------------------------------------------------------
// Development — cost benchmarking
// ---------------------------------------------------------------------------

export interface CostBenchmarkInputs {
  readonly region:
    | 'us-tier-1'
    | 'us-tier-2'
    | 'london'
    | 'lagos'
    | 'nairobi'
    | 'dar-es-salaam'
    | 'kampala';
  readonly assetClass: AssetClass;
  readonly floors: number;
  readonly grossSqm: number;
  /** Quote in USD / sqm (after FX conversion). */
  readonly quoteUsdPerSqm: number;
}

export interface CostBenchmarkResult {
  readonly region: string;
  readonly indexUsdPerSqm: number;
  readonly quoteUsdPerSqm: number;
  readonly variancePct: number;
  readonly verdict: 'within-band' | 'high-flag' | 'low-flag' | 'reject';
  readonly source: string;
}

// ---------------------------------------------------------------------------
// Development — schedule risk
// ---------------------------------------------------------------------------

export interface ScheduleTask {
  readonly id: string;
  readonly label: string;
  /** Optimistic duration in days (10th percentile). */
  readonly optimisticDays: number;
  /** Most-likely duration in days (50th percentile). */
  readonly mostLikelyDays: number;
  /** Pessimistic duration in days (90th percentile). */
  readonly pessimisticDays: number;
  /** Whether on the critical path (per CPM). */
  readonly onCriticalPath: boolean;
}

export interface ScheduleRiskAnalysis {
  readonly iterations: number;
  readonly p50TotalDays: number;
  readonly p80TotalDays: number;
  readonly p90TotalDays: number;
  readonly contingencyWeeks: number; // (p90-p50) / 7
  readonly criticalityIndex: ReadonlyArray<{
    readonly taskId: string;
    readonly probability: number;
  }>;
}

// ---------------------------------------------------------------------------
// Development — change-order risk
// ---------------------------------------------------------------------------

export type ChangeOrderRootCause =
  | 'owner-scope-change'
  | 'drawing-errors'
  | 'differing-site-conditions'
  | 'permit-changes'
  | 'material-substitution'
  | 'schedule-acceleration'
  | 'sub-default'
  | 'weather'
  | 'labour-shortage'
  | 'coordination-conflicts'
  | 'ofe-delay'
  | 'inspection-failure';

export interface ChangeOrderRiskInputs {
  /** 0..1 — design completeness at GMP lock. */
  readonly designCompleteness: number;
  /** 0..1 — owner scope-discipline (1 = locked, 0 = unstable). */
  readonly scopeDiscipline: number;
  /** Pre-bid geotech completed (boolean → 0/1). */
  readonly preBidGeotech: boolean;
  /** Independent CD peer-review completed. */
  readonly peerReviewedCD: boolean;
  /** BIM Level (0-3). */
  readonly bimLevel: 0 | 1 | 2 | 3;
  /** Bonding required > USD 5M trades. */
  readonly bondedLargeTrades: boolean;
  /** Critical-path weather model in use. */
  readonly weatherModelInUse: boolean;
  /** Schedule committed at P80 (true) or P50 (false). */
  readonly committedAtP80: boolean;
  /** Spec backups present in CD. */
  readonly specBackupsPresent: boolean;
  /** Labour pre-procurement locks in place. */
  readonly labourLocksInPlace: boolean;
  /** OFE schedule audited at 60% CD. */
  readonly ofeScheduleAudited: boolean;
  /** 3rd-party QA programme active. */
  readonly thirdPartyQA: boolean;
}

export interface ChangeOrderRiskResult {
  readonly perCauseRisk: ReadonlyArray<{
    readonly cause: ChangeOrderRootCause;
    readonly medianImpactPct: number;
    readonly probabilityOfOccurrence: number;
    readonly riskWeightedImpactPct: number;
  }>;
  /** Total risk-weighted impact (sum across causes). */
  readonly totalExpectedCOImpactPct: number;
  readonly top3Causes: ReadonlyArray<ChangeOrderRootCause>;
}

// ---------------------------------------------------------------------------
// Development — punch-list
// ---------------------------------------------------------------------------

export interface PunchListInputs {
  readonly grossSqm: number;
  readonly assetClass: AssetClass;
  readonly items: ReadonlyArray<{
    readonly category: 'cosmetic' | 'mechanical' | 'life-safety';
    readonly count: number;
  }>;
}

export interface PunchListResult {
  readonly stage: 'substantial-completion' | 'final-acceptance';
  readonly per100SqmCosmetic: number;
  readonly per100SqmMechanical: number;
  readonly per100SqmLifeSafety: number;
  readonly per100SqmTotal: number;
  readonly accepted: boolean;
  readonly blockers: ReadonlyArray<string>;
}

// ---------------------------------------------------------------------------
// Disposition — exit timing
// ---------------------------------------------------------------------------

export interface ExitTimingInputs {
  readonly assetId: string;
  /** Forward IRR over next 24-month hold (decimal). */
  readonly forwardIRR24mo: number;
  /** Owner's hurdle on the position (decimal). */
  readonly holdingHurdle: number;
  /** Current market cap-rate for the asset class / submarket. */
  readonly marketCapRate: number;
  /** Cap-rate at entry. */
  readonly entryCapRate: number;
  /** Current tax basis. */
  readonly taxBasis: number;
  /** Estimated depreciation-recapture rate (decimal). */
  readonly depreciationRecapture: number;
  /** Outstanding debt balance. */
  readonly debtPaydown: number;
  /** RCA velocity z-score (deviations from 12-month avg). */
  readonly rcaVelocityZ: number;
  /** Trepp CMBS issuance z-score. */
  readonly cmbsIssuanceZ: number;
}

export type ExitVerdict = 'sell-now' | 'soft-test' | 'continue-hold';

export interface ExitTimingResult {
  readonly assetId: string;
  readonly verdict: ExitVerdict;
  readonly score: number; // 0..5 (number of triggers met)
  readonly triggers: ReadonlyArray<{
    readonly name: string;
    readonly met: boolean;
    readonly threshold: string;
    readonly actual: string;
  }>;
}

// ---------------------------------------------------------------------------
// Disposition — buyer pipeline
// ---------------------------------------------------------------------------

export type BuyerTier =
  | 'institutional'
  | 'private-investor'
  | '1031-exchange'
  | 'owner-occupier'
  | 'international-piri';

export interface BuyerProfile {
  readonly id: string;
  readonly name: string;
  readonly tier: BuyerTier;
  /** 0..1 fit on asset class. */
  readonly assetClassFit: number;
  /** 0..1 fit on cap-rate appetite. */
  readonly capRateAppetiteFit: number;
  /** 0..1 fit on ticket size. */
  readonly ticketSizeFit: number;
  /** 0..1 buyer activity level (recent trades). */
  readonly buyerPoolActivity: number;
}

export interface BuyerScore {
  readonly id: string;
  readonly name: string;
  readonly tier: BuyerTier;
  readonly matchScore: number; // 0..1
  readonly pricingPower: 'high' | 'medium' | 'low' | 'variable';
  readonly typicalCloseDays: number;
}

export interface BuyerPipeline {
  readonly assetId: string;
  readonly scored: ReadonlyArray<BuyerScore>;
  readonly top2Tiers: ReadonlyArray<BuyerTier>;
  readonly suggestedMarketingChannels: ReadonlyArray<string>;
}

// ---------------------------------------------------------------------------
// Disposition — broker selection
// ---------------------------------------------------------------------------

export interface BrokerCandidate {
  readonly id: string;
  readonly firm: string;
  /** Number of comparable closed deals in last 24 months. */
  readonly comparableClosedDeals: number;
  /** Maximum comparable-closed across the field (for normalisation). */
  readonly maxComparableClosedDeals: number;
  /** Share of book in same asset class (0..1). */
  readonly assetClassBookShare: number;
  /** Share of buyer rolodex in top-2 tiers (0..1). */
  readonly buyerPoolMatch: number;
  /** Marketing budget as share of expected fee (0..1). */
  readonly marketingBudgetShare: number;
  /** Years in the submarket. */
  readonly submarketYears: number;
  /** Willing to co-broker. */
  readonly coBrokerWilling: boolean;
}

export interface BrokerScore {
  readonly id: string;
  readonly firm: string;
  readonly total: number;
  readonly rank: number;
}

export interface BrokerSelection {
  readonly assetId: string;
  readonly ranked: ReadonlyArray<BrokerScore>;
  readonly bovBakeOff: ReadonlyArray<BrokerScore>;
}

// ---------------------------------------------------------------------------
// Disposition — OM design + seller financing + tax-deferred exchange
// ---------------------------------------------------------------------------

export type OMSection =
  | 'executive-summary'
  | 'investment-highlights'
  | 'property-description'
  | 'location-demographics'
  | 'market-overview'
  | 'financial-analysis'
  | 'tenant-profiles'
  | 'capital-plan'
  | 'comparable-sales'
  | 'title-zoning-environmental'
  | 'tour-offer-process'
  | 'disclaimers';

export interface OMOutline {
  readonly assetId: string;
  readonly sections: ReadonlyArray<{
    readonly section: OMSection;
    readonly required: boolean;
    readonly notes: string;
  }>;
  readonly estimatedPages: number;
}

export interface SellerFinancingInputs {
  readonly purchasePrice: number;
  readonly bankRatePct: number; // decimal
  readonly buyerCreditTier: 'IG' | 'sub-IG' | 'unrated';
  readonly desiredTaxDeferral: boolean;
}

export interface SellerFinancingTerms {
  readonly recommendedLTV: number;
  readonly termYears: number;
  readonly amortYears: number;
  readonly rateSpreadBps: number;
  readonly recommendedRate: number;
  readonly personalGuarantee: boolean;
  readonly crossCollateralisation: boolean;
  readonly installmentSaleApplicable: boolean;
}

export type ExchangeStructure =
  | 'forward-1031'
  | 'reverse-1031'
  | 'improvement-1031'
  | 'tz-land-act-47'
  | 'ke-spv-rollover'
  | 'not-applicable';

export interface TaxDeferredExchangeInputs {
  readonly jurisdiction: Jurisdiction;
  readonly equityInRelinquished: number;
  readonly replacementPurchase: number;
  readonly daysSinceParking?: number;
  readonly developedProperty: boolean;
  readonly daysToReplacementID?: number;
}

export interface TaxDeferredExchangeResult {
  readonly structure: ExchangeStructure;
  readonly feasible: boolean;
  readonly blockers: ReadonlyArray<string>;
  readonly maxEATFeePct?: number;
  readonly statutoryDeadlines: ReadonlyArray<string>;
}

// ---------------------------------------------------------------------------
// Refinancing
// ---------------------------------------------------------------------------

export type LenderType =
  | 'agency'
  | 'life-co'
  | 'cmbs'
  | 'bank'
  | 'debt-fund'
  | 'mezz'
  | 'ea-tier-1-bank';

export interface DebtTranche {
  readonly type: LenderType;
  readonly amount: number;
  readonly ratePct: number;
  readonly termYears: number;
  readonly amortYears: number;
  readonly maxLTV: number;
}

export interface LTVOptimizationInputs {
  readonly stabilisedValue: number;
  readonly stabilisedNOI: number;
  readonly targetDSCR: number;
  readonly targetDebtYield: number;
  readonly tranches: ReadonlyArray<{
    readonly type: LenderType;
    readonly maxLTVShare: number;
    readonly ratePct: number;
    readonly termYears: number;
    readonly amortYears: number;
  }>;
}

export interface LTVOptimizationResult {
  readonly allocatedTranches: ReadonlyArray<DebtTranche>;
  readonly weightedRate: number;
  readonly totalDebt: number;
  readonly totalLTV: number;
  readonly dscr: number;
  readonly debtYield: number;
  readonly feasible: boolean;
  readonly violatedConstraints: ReadonlyArray<string>;
}

export interface LenderSelectionInputs {
  readonly assetClass: AssetClass;
  readonly jurisdiction: Jurisdiction;
  readonly dealSize: number;
  readonly desiredLTV: number;
  readonly desiredTermYears: number;
  readonly transitional: boolean;
  readonly trophyAsset: boolean;
}

export interface LenderCandidate {
  readonly type: LenderType;
  readonly suitabilityScore: number;
  readonly typicalLTV: [number, number];
  readonly typicalSpreadBps: [number, number];
  readonly prepayPenalty: string;
  readonly notes: string;
}

export interface LenderSelectionResult {
  readonly ranked: ReadonlyArray<LenderCandidate>;
  readonly recommendedTop2: ReadonlyArray<LenderCandidate>;
}

export interface RateLockInputs {
  /** Current 10Y Treasury yield (decimal). */
  readonly spot10Y: number;
  /** Forward 10Y Treasury yield in 6 months (decimal). */
  readonly forward10Y6mo: number;
  /** 1-month implied volatility (bps). */
  readonly impliedVolBps: number;
  /** Lock-fee for 6 months (decimal of loan amount). */
  readonly lockFee6mo: number;
}

export type LockAdvice = 'lock-now' | 'lock-now-vol' | 'wait';

export interface RateLockResult {
  readonly advice: LockAdvice;
  readonly forwardPremiumBps: number;
  readonly rationale: string;
}

export interface DefeasanceVsYMInputs {
  /** Original loan rate (decimal). */
  readonly originalRatePct: number;
  /** Current Treasury rate matching maturity (decimal). */
  readonly currentTreasuryPct: number;
  /** Remaining loan balance. */
  readonly remainingBalance: number;
  /** Remaining years to maturity. */
  readonly remainingYears: number;
}

export interface DefeasanceVsYMResult {
  readonly defeasanceCost: number;
  readonly yieldMaintenanceCost: number;
  readonly cheaperOption: 'defeasance' | 'yield-maintenance';
  readonly delta: number;
}

export interface LoanCovenants {
  readonly minDSCR: number;
  readonly minDebtYield: number;
  readonly minOccupancyPct: number;
  readonly minCapexReservePerSqftPerYr: number;
  readonly distributionLockboxDSCR: number;
  readonly springingLockboxDSCR: number;
}

export interface CovenantStatusInputs {
  readonly actualDSCR: number;
  readonly actualDebtYield: number;
  readonly actualOccupancyPct: number;
  readonly actualCapexReservePerSqftPerYr: number;
  readonly trailing12MoNOITrend: number; // pct
  readonly grossSqft: number;
  readonly debtBalance: number;
  readonly covenants: LoanCovenants;
}

export interface CovenantBreach {
  readonly covenant: string;
  readonly required: number;
  readonly actual: number;
  readonly breached: boolean;
  readonly monthsToBreach?: number;
  readonly cureCost?: number;
}

export interface CovenantStatusResult {
  readonly breaches: ReadonlyArray<CovenantBreach>;
  readonly hasActiveBreach: boolean;
  readonly springingLockboxTriggered: boolean;
  readonly distributionLockboxTriggered: boolean;
}

export interface RefiProceedsInputs {
  readonly existingDebtBalance: number;
  readonly closingCosts: number;
  readonly newDebtAmount: number;
  readonly newDebtRate: number; // decimal
  readonly existingDebtRate: number; // decimal
  readonly sponsorReinvestmentIRR: number; // decimal
  readonly marginalTaxRate: number; // decimal
  readonly newDSCR: number;
}

export type RefiVerdict = 'cash-out' | 'rate-and-term' | 'do-not-refi';

export interface RefiProceedsResult {
  readonly verdict: RefiVerdict;
  readonly cashOutAmount: number;
  readonly extraInterestCostAnnual: number;
  readonly extraInterestCostAfterTax: number;
  readonly reinvestmentReturnAnnual: number;
  readonly netBenefitAnnual: number;
  readonly meetsDSCR: boolean;
}

// ---------------------------------------------------------------------------
// Investor relations
// ---------------------------------------------------------------------------

export type CapitalRaiseStructure =
  | '506-b'
  | '506-c'
  | 'ke-aif'
  | 'ke-private-placement-20'
  | 'tz-private-placement-50';

export interface CapitalRaiseInputs {
  readonly jurisdiction: Jurisdiction;
  readonly wantsGeneralSolicitation: boolean;
  readonly nonAccreditedCount: number;
  readonly accreditedOnly: boolean;
  readonly fundingTarget: number;
  readonly hasRegulatedFundStructure: boolean;
}

export interface CapitalRaiseResult {
  readonly structure: CapitalRaiseStructure;
  readonly rationale: string;
  readonly verificationRequired: 'self-cert' | 'reasonable-steps' | 'regulator';
  readonly marketingAllowed: 'private-only' | 'public';
  readonly maxNonAccredited: number;
  readonly statutoryCitation: string;
}

export interface SubscriptionDocCheck {
  readonly hasAccreditedQuestionnaire: boolean;
  readonly hasSignedSubAgreement: boolean;
  readonly hasW9OrW8: boolean;
  readonly hasBadActorRep: boolean;
  readonly hasAMLKYC: boolean;
  readonly investmentSize: number;
}

export interface SubscriptionDocChecklistResult {
  readonly complete: boolean;
  readonly missing: ReadonlyArray<string>;
  readonly amlRequired: boolean;
}

export type InvestorTier = 'institutional' | 'individual' | 'family-office';

export interface ReportingCadenceInputs {
  readonly tier: InvestorTier;
  readonly fundSize: number;
  readonly investorCount: number;
}

export interface ReportingCadenceResult {
  readonly tier: InvestorTier;
  readonly writtenCadenceMonths: number;
  readonly meetingCadenceMonths: number;
  readonly callCadenceMonths?: number;
  readonly recommendedTemplate: 'ILPA-1.1' | 'ILPA-summary' | 'custom';
  readonly recipients: string;
}

export interface WaterfallTier {
  readonly name: string;
  readonly type: 'return-of-capital' | 'pref' | 'catch-up' | 'split';
  readonly hurdleIRR?: number; // decimal
  readonly lpShare?: number;
  readonly gpShare?: number;
  readonly catchUpToPct?: number; // GP catch-up target promote
}

export interface DistributionForecastInputs {
  /** Per-period total cash flow available for distribution. */
  readonly periodCashflows: ReadonlyArray<number>;
  /** LP capital contributed at t=0 (single contribution model). */
  readonly lpCommitment: number;
  /** Pref return rate (decimal). */
  readonly prefRate: number;
  readonly tiers: ReadonlyArray<WaterfallTier>;
}

export interface DistributionForecastResult {
  readonly perPeriod: ReadonlyArray<{
    readonly period: number;
    readonly lpDist: number;
    readonly gpDist: number;
    readonly cumulativeLP: number;
    readonly cumulativeGP: number;
  }>;
  readonly lpIRR: number;
  readonly gpIRR: number;
  readonly lpMOIC: number;
  readonly gpMOIC: number;
}

export type CapitalCallType =
  | 'standard'
  | 'bridge'
  | 'defaulting-lp-cure'
  | 'final';

export interface CapitalCallInputs {
  readonly type: CapitalCallType;
  readonly callAmount: number;
  readonly cumulativeCalled: number;
  readonly totalCommitment: number;
  readonly daysNotice: number;
  readonly useOfProceeds: string;
}

export interface CapitalCallMessage {
  readonly type: CapitalCallType;
  readonly subject: string;
  readonly body: string;
  readonly compliant: boolean;
  readonly violations: ReadonlyArray<string>;
}

export interface ILPAReportInputs {
  readonly periodLabel: string;
  readonly fundNAV: number;
  readonly fundCalled: number;
  readonly fundDistributed: number;
  readonly fundUnfunded: number;
  readonly netIRR: number;
  readonly grossIRR: number;
  readonly netMOIC: number;
  readonly grossMOIC: number;
  readonly dpi: number;
  readonly rvpi: number;
  readonly tvpi: number;
  readonly topInvestments: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    readonly cost: number;
    readonly fairValue: number;
    readonly unrealizedMOIC: number;
  }>;
  readonly materialEvents: ReadonlyArray<string>;
  readonly outlook: string;
}

export interface ILPAReport {
  readonly periodLabel: string;
  readonly compliantWithTemplate: 'ILPA-1.1';
  readonly sections: ReadonlyArray<{ readonly title: string; readonly content: string }>;
  readonly missingDataFlags: ReadonlyArray<string>;
}

export interface LPQADraftRequest {
  readonly question: string;
  readonly fundContext: {
    readonly coInvestPct: number;
    readonly priorFundNetIRR: number;
    readonly priorFundMOIC: number;
    readonly worstDealIRR: number;
    readonly worstDealDescription: string;
    readonly sourcingChannels: ReadonlyArray<string>;
    readonly feeWaiverPct: number;
    readonly waterfallSummary: string;
    readonly esgPolicy: string;
    readonly cyberPolicy: string;
    readonly auditor: string;
    readonly counsel: string;
  };
}

export interface LPQAAnswer {
  readonly question: string;
  readonly answer: string;
  readonly category:
    | 'sponsor'
    | 'track-record'
    | 'strategy'
    | 'fees'
    | 'governance'
    | 'esg'
    | 'cyber'
    | 'operations'
    | 'risk';
  readonly confidence: number;
}

// ---------------------------------------------------------------------------
// Lifecycle orchestrator
// ---------------------------------------------------------------------------

export interface DomainRecommendation {
  readonly domain: 'development' | 'disposition' | 'refinancing' | 'investor-relations';
  readonly action: string;
  readonly priority: 'critical' | 'high' | 'medium' | 'low';
  readonly confidence: number;
  readonly rationale: string;
  readonly citations: ReadonlyArray<string>;
}

export interface LifecycleAdvisorInputs {
  readonly assetId: string;
  readonly stage: LifecycleStage;
  readonly feasibility?: FeasibilityInputs;
  readonly schedule?: ReadonlyArray<ScheduleTask>;
  readonly changeOrderRisk?: ChangeOrderRiskInputs;
  readonly exitTiming?: ExitTimingInputs;
  readonly buyerPipeline?: {
    readonly buyers: ReadonlyArray<BuyerProfile>;
  };
  readonly refiTimingMonths?: number;
  readonly lenderSelection?: LenderSelectionInputs;
  readonly covenantStatus?: CovenantStatusInputs;
  readonly distributionForecast?: DistributionForecastInputs;
  readonly reportingCadence?: ReportingCadenceInputs;
}

export interface LifecycleAdvisorOutput {
  readonly assetId: string;
  readonly stage: LifecycleStage;
  readonly recommendations: ReadonlyArray<DomainRecommendation>;
  readonly nextBestAction: DomainRecommendation;
}

// ---------------------------------------------------------------------------
// LLM port (optional)
// ---------------------------------------------------------------------------

export interface MultiLLMSynthesizer {
  synthesize(input: {
    readonly bundle: Readonly<Record<string, unknown>>;
    readonly audience: 'lp' | 'lender' | 'internal-ic' | 'gc';
  }): Promise<string>;
}
