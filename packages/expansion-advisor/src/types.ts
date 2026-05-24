/**
 * @bossnyumba/expansion-advisor — shared types.
 *
 * Types are kept narrow and immutable. All advisor functions take
 * these as `Readonly<...>` and return brand-new objects (no
 * mutation) per repo convention.
 */

// ---------------------------------------------------------------------------
// Parcel / asset-class basics
// ---------------------------------------------------------------------------

export type AssetClass =
  | 'multifamily'
  | 'office'
  | 'retail'
  | 'industrial'
  | 'mixed-use'
  | 'land';

export type Jurisdiction = 'KE' | 'UG' | 'TZ' | 'NG' | 'ZA' | string;

export interface Parcel {
  readonly id: string;
  readonly lat: number;
  readonly lng: number;
  /** Site area in square metres. */
  readonly siteAreaSqm: number;
  /** Current zoning code (e.g. 'R3', 'C2', 'I1'). */
  readonly zoning: string;
  /** Allowable Floor Area Ratio (FAR). */
  readonly far: number;
  /** Maximum height in metres. */
  readonly maxHeightM: number;
  /** Setbacks in metres — front, side, rear. */
  readonly setbacksM: {
    readonly front: number;
    readonly side: number;
    readonly rear: number;
  };
  readonly jurisdiction: Jurisdiction;
  /** Optional slope grade percent (0 = flat). */
  readonly slopePct?: number;
  /** Optional soil bearing capacity (kPa). */
  readonly soilBearingKpa?: number;
  /** Optional utilities-on-site flags. */
  readonly utilities?: {
    readonly power: boolean;
    readonly water: boolean;
    readonly sewer: boolean;
  };
  /** Optional metres to nearest mass-transit stop. */
  readonly transitMetres?: number;
  /** Optional metres to nearest trunk road. */
  readonly trunkRoadMetres?: number;
}

// ---------------------------------------------------------------------------
// HBU
// ---------------------------------------------------------------------------

/** A candidate use (programme) to evaluate against HBU tests. */
export interface CandidateUse {
  readonly id: string;
  readonly label: string;
  readonly assetClass: AssetClass;
  /** Required floor area in sqm (built-up). */
  readonly programmeSqm: number;
  /** Required building height in metres. */
  readonly heightM: number;
  /** Required FAR. */
  readonly far: number;
  /** Estimated unit count (multifamily) or NLA (commercial). */
  readonly units?: number;
  /** Net-leasable / sellable area in sqm. */
  readonly nlaSqm: number;
  /** Stabilised rent per sqm per month (local currency). */
  readonly stabilisedRentPerSqm: number;
  /** Operating expense ratio (decimal, e.g. 0.35 = 35%). */
  readonly operatingExpenseRatio: number;
  /** Going-in capitalisation rate (decimal, e.g. 0.085 = 8.5%). */
  readonly capRate: number;
  /** All-in build cost per built-up sqm (local currency). */
  readonly buildCostPerSqm: number;
  /** Land basis (local currency). */
  readonly landBasis: number;
  /** Build duration in months. */
  readonly buildMonths: number;
  /** Required entitlements (variance, upzone, etc.). */
  readonly requiredEntitlements?: ReadonlyArray<string>;
}

export type GateOutcome = 'pass' | 'fail';

export interface GateResult<TUse = CandidateUse> {
  readonly use: TUse;
  readonly gate: 'legallyPermissible' | 'physicallyPossible' | 'financiallyFeasible';
  readonly outcome: GateOutcome;
  readonly reasons: ReadonlyArray<string>;
}

export interface HBUResult {
  readonly parcelId: string;
  /** All survivors of the first three gates, ranked by productivity. */
  readonly ranked: ReadonlyArray<{
    readonly use: CandidateUse;
    readonly residualLandValue: number;
    readonly yieldOnCost: number;
    readonly irr: number;
    readonly npv: number;
    readonly productivityScore: number;
  }>;
  readonly gateLog: ReadonlyArray<GateResult>;
  readonly winner?: CandidateUse;
}

// ---------------------------------------------------------------------------
// Market / absorption
// ---------------------------------------------------------------------------

export interface MarketSnapshot {
  readonly assetClass: AssetClass;
  readonly subMarket: string;
  readonly activeInventoryUnits: number;
  readonly monthlyAbsorptionUnits: number;
  readonly comparableRentPerSqm: number;
  readonly comparableSalePsfPerSqm: number;
  readonly capRate: number;
}

export interface AbsorptionForecast {
  readonly subMarket: string;
  readonly assetClass: AssetClass;
  /** Months of supply. */
  readonly mos: number;
  /** Velocity (units per month). */
  readonly velocity: number;
  /** Curve points, t in months (0..N), p = cumulative absorption share. */
  readonly curve: ReadonlyArray<{ readonly t: number; readonly p: number }>;
  /** Months to reach 95% absorption. */
  readonly leaseUpMonthsTo95: number;
}

// ---------------------------------------------------------------------------
// Capital stack
// ---------------------------------------------------------------------------

export type StackTier = 'seniorDebt' | 'mezzanine' | 'preferredEquity' | 'commonEquity';

export interface StackTierSlice {
  readonly tier: StackTier;
  readonly amount: number;
  readonly rate: number;
  readonly term?: number;
}

export interface CapitalStack {
  readonly tiers: ReadonlyArray<StackTierSlice>;
  readonly totalCost: number;
  readonly weightedCost: number;
  readonly dscr: number;
  readonly icr: number;
  readonly ltc: number;
  readonly ltv: number;
  readonly yieldOnCost: number;
}

export interface StackConstraints {
  readonly minDscr: number;
  readonly minIcr: number;
  readonly maxLtc: number;
  readonly maxLtv: number;
  readonly minYieldOnCost: number;
}

export interface StackInputs {
  readonly totalCost: number;
  readonly stabilisedNOI: number;
  readonly stabilisedValue: number;
  readonly tiers: ReadonlyArray<{
    readonly tier: StackTier;
    readonly maxShareOfCost: number;
    readonly rate: number;
  }>;
  readonly constraints: StackConstraints;
}

// ---------------------------------------------------------------------------
// Lease-up + value-add
// ---------------------------------------------------------------------------

export interface LeaseUpCurve {
  readonly assetClass: AssetClass;
  readonly midpointMonths: number;
  readonly steepness: number;
  readonly stabilisedVacancy: number;
  readonly points: ReadonlyArray<{ readonly t: number; readonly occupied: number }>;
}

export interface ValueAddInputs {
  readonly compRentPerSqm: number;
  readonly inPlaceRentPerSqm: number;
  readonly annualTurnoverPct: number;
  readonly compOperatingExpenseRatio: number;
  readonly actualOperatingExpenseRatio: number;
  readonly capexCatchUpScore: number; // 0..1
}

export interface ValueAddScore {
  readonly rentGapScore: number;
  readonly turnoverScore: number;
  readonly expenseEfficiencyScore: number;
  readonly capexScore: number;
  readonly total: number;
}

// ---------------------------------------------------------------------------
// Gentrification + zoning leverage + comps
// ---------------------------------------------------------------------------

export interface GentrificationAxes {
  readonly medianIncomeTrajectory: number;
  readonly educationalAttainment: number;
  readonly newBuildPermitDensity: number;
  readonly cafeDensity: number;
  readonly crimeRateDecline: number;
  readonly rentGrowthVelocity: number;
  readonly ownerOccupierShare: number;
  readonly transitAccessibility: number;
}

export interface GentrificationIndex {
  readonly score: number;
  readonly contribution: Readonly<Record<keyof GentrificationAxes, number>>;
  readonly verdict: 'low' | 'emerging' | 'advancing' | 'mature' | 'late';
}

export interface ZoningLeverageInputs {
  readonly currentFar: number;
  readonly corridorTargetFar: number;
  readonly varianceApprovalRate: number; // 0..1
  readonly varianceUpliftPct: number; // 0..1
  readonly mixedUsePremiumPct: number; // 0..1
}

export interface ZoningLeverage {
  readonly variance: number;
  readonly upzone: number;
  readonly mixedUse: number;
  readonly composite: number;
  readonly bestLever: 'variance' | 'upzone' | 'mixedUse';
}

export interface ComparableSale {
  readonly id: string;
  readonly salePricePerSqm: number;
  readonly distanceMetres: number;
  readonly monthsAgo: number;
  readonly sizeSqm: number;
  readonly assetClass: AssetClass;
  readonly qualitySimilarity: number; // 0..1
}

export interface TriangulationResult {
  readonly used: ReadonlyArray<ComparableSale>;
  readonly droppedOutliers: ReadonlyArray<ComparableSale>;
  readonly weightedMedianPerSqm: number;
  readonly lowerCi: number;
  readonly upperCi: number;
  readonly confidence: number;
}

// ---------------------------------------------------------------------------
// Land banking
// ---------------------------------------------------------------------------

export interface LandBankingInputs {
  readonly distanceCbdKm: number;
  readonly distanceTrunkRoadKm: number;
  readonly infraPipeline5yrOverlap: number; // 0..1
  readonly infraPipeline10yrOverlap: number; // 0..1
  readonly zoningElasticity: number; // 0..1 (higher = more upzonable)
}

export interface LandBankingForecast {
  readonly years: ReadonlyArray<{ readonly year: number; readonly indexValue: number }>;
  readonly cagrPct: number;
  readonly verdict: 'avoid' | 'watch' | 'accumulate' | 'aggressive';
}

// ---------------------------------------------------------------------------
// Final composed report
// ---------------------------------------------------------------------------

export interface ExpansionInputs {
  readonly parcel: Parcel;
  readonly candidates: ReadonlyArray<CandidateUse>;
  readonly market: MarketSnapshot;
  readonly comparables: ReadonlyArray<ComparableSale>;
  readonly gentrification: GentrificationAxes;
  readonly zoningLeverage: ZoningLeverageInputs;
  readonly stack: StackInputs;
  readonly landBanking?: LandBankingInputs;
  /** EA-style market overrides (multipliers applied to base outputs). */
  readonly marketOverrides?: {
    readonly capRateAdjustment?: number;
    readonly rentMultiplier?: number;
    readonly costMultiplier?: number;
  };
}

export interface ExpansionOpportunity {
  readonly parcelId: string;
  readonly recommendedUse: CandidateUse;
  readonly hbu: HBUResult;
  readonly absorption: AbsorptionForecast;
  readonly leaseUp: LeaseUpCurve;
  readonly stack: CapitalStack;
  readonly valueAdd?: ValueAddScore;
  readonly gentrification: GentrificationIndex;
  readonly zoningLeverage: ZoningLeverage;
  readonly triangulation: TriangulationResult;
  readonly landBanking?: LandBankingForecast;
  readonly narrative: string;
  readonly confidence: number; // 0..1
}

export interface IrrNpvInputs {
  readonly cashflows: ReadonlyArray<number>;
  readonly discountRatePerPeriod: number;
}

export interface IrrNpvResult {
  readonly npv: number;
  readonly irr: number;
}
