/**
 * @bossnyumba/green-angle-advisor — public types.
 *
 * Pure contracts. No runtime, no I/O, no LLM imports.
 *
 * Implements the SOTA-2026 Green-Angle Advisor stack documented at
 * `.audit/sota-2026-05-24/05-green-angle-advisor.md`:
 *
 *   - ProjectDescription   — free-form prose + optional structured signals
 *   - ProjectProfile       — classifier output (type, scale, location)
 *   - GreenOpportunity     — one of 30+ canonical patterns matched per project
 *   - FinancingMatch       — instrument match with eligibility + indicative terms
 *   - CarbonProjectMatch   — methodology + tCO2e volume + value forecast
 *   - ImpactScore          — SDG vector + co-benefit weighted score
 *   - VeteranExpertReport  — composed advisor output
 *
 * Every public surface is exported here; nothing else.
 */

import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────
// Project taxonomy — 14 canonical project types.
// ─────────────────────────────────────────────────────────────────

export const PROJECT_TYPES = [
  'residential',
  'commercial-office',
  'retail',
  'hospitality',
  'industrial',
  'infrastructure-rail',
  'infrastructure-port',
  'infrastructure-airport',
  'infrastructure-highway',
  'mining',
  'energy',
  'agriculture',
  'water',
  'telecom',
] as const;

export type ProjectType = (typeof PROJECT_TYPES)[number];

// ─────────────────────────────────────────────────────────────────
// Jurisdictions — start with EA + neighbours; extensible enum.
// ─────────────────────────────────────────────────────────────────

export const JURISDICTIONS = [
  'KE',
  'TZ',
  'UG',
  'RW',
  'BI',
  'ET',
  'ZA',
  'NG',
  'GH',
  'EG',
  'EU',
  'UK',
  'US',
  'OTHER',
] as const;

export type Jurisdiction = (typeof JURISDICTIONS)[number];

// ─────────────────────────────────────────────────────────────────
// Biome / landscape signals used by the matcher.
// ─────────────────────────────────────────────────────────────────

export const BIOMES = [
  'coastal',
  'mangrove',
  'wetland',
  'urban',
  'arid',
  'semi-arid',
  'savanna',
  'tropical-forest',
  'highland',
  'agricultural',
  'industrial',
] as const;

export type Biome = (typeof BIOMES)[number];

// ─────────────────────────────────────────────────────────────────
// Sectoral signals — fine-grained tags layered on top of ProjectType.
// ─────────────────────────────────────────────────────────────────

export const SECTOR_SIGNALS = [
  'linear-corridor',
  'point-asset',
  'multi-site',
  'coastal-asset',
  'freight',
  'passenger',
  'mixed-use',
  'critical-habitat-near',
  'protected-area-near',
  'water-stressed',
  'high-insolation',
  'high-wind-resource',
  'high-rainfall',
  'low-rainfall',
  'community-adjacent',
  'urban-heat-island',
] as const;

export type SectorSignal = (typeof SECTOR_SIGNALS)[number];

// ─────────────────────────────────────────────────────────────────
// ProjectDescription — what an external caller passes in.
// ─────────────────────────────────────────────────────────────────

export const ProjectDescriptionSchema = z.object({
  /** Free-form prose, e.g. "we're building a railway from Dar es Salaam to Dodoma". */
  description: z.string().min(1),
  /** Optional structured signals (preferred when caller has them). */
  hints: z
    .object({
      projectTypes: z.array(z.enum(PROJECT_TYPES)).optional(),
      jurisdictions: z.array(z.enum(JURISDICTIONS)).optional(),
      biomes: z.array(z.enum(BIOMES)).optional(),
      signals: z.array(z.enum(SECTOR_SIGNALS)).optional(),
      /** Length km for linear assets; -1 if not applicable. */
      lengthKm: z.number().nonnegative().optional(),
      /** Site area hectares for point assets; -1 if not applicable. */
      areaHa: z.number().nonnegative().optional(),
      /** Indicative capex USD (millions); -1 if unknown. */
      capexUsdMillions: z.number().nonnegative().optional(),
    })
    .optional(),
});

export type ProjectDescription = z.infer<typeof ProjectDescriptionSchema>;

// ─────────────────────────────────────────────────────────────────
// ProjectProfile — classifier output, the matcher's input.
// ─────────────────────────────────────────────────────────────────

export interface ProjectProfile {
  readonly projectTypes: readonly ProjectType[];
  readonly jurisdictions: readonly Jurisdiction[];
  readonly biomes: readonly Biome[];
  readonly signals: readonly SectorSignal[];
  readonly lengthKm?: number;
  readonly areaHa?: number;
  readonly capexUsdMillions?: number;
  /** Classification confidence in [0, 1]. */
  readonly confidence: number;
  /** Free-form rationale string the classifier emits for explainability. */
  readonly rationale: string;
}

// ─────────────────────────────────────────────────────────────────
// GreenOpportunity — one of the 30+ canonical patterns.
// ─────────────────────────────────────────────────────────────────

export const OPPORTUNITY_CATEGORIES = [
  'renewable-energy',
  'biodiversity',
  'water',
  'circular-economy',
  'land-use',
  'transport-emissions',
  'energy-efficiency',
  'pollution-prevention',
  'climate-adaptation',
  'community',
] as const;

export type OpportunityCategory = (typeof OPPORTUNITY_CATEGORIES)[number];

export interface GreenOpportunity {
  readonly id: string;
  readonly title: string;
  readonly category: OpportunityCategory;
  /** 1-sentence description suitable for executive summary. */
  readonly oneLiner: string;
  /** Longer rationale: why this fits this project. */
  readonly rationale: string;
  /** Confidence/score in [0, 1] from the matcher. */
  readonly score: number;
  /** Estimated annual abatement, tCO2e/yr (best estimate, may be 0). */
  readonly estimatedTCO2ePerYear: number;
  /** Suggested SDG targets directly served. */
  readonly sdgTargets: readonly number[];
  /** Reference standards / frameworks. */
  readonly references: readonly string[];
}

// ─────────────────────────────────────────────────────────────────
// FinancingMatch — instrument ranking output.
// ─────────────────────────────────────────────────────────────────

export const FINANCING_INSTRUMENT_TYPES = [
  'green-bond',
  'social-bond',
  'sustainability-bond',
  'sustainability-linked-bond',
  'green-loan',
  'sustainability-linked-loan',
  'transition-finance',
  'concessional-debt',
  'grant',
  'equity',
  'guarantee',
  'blended-finance',
] as const;

export type FinancingInstrumentType = (typeof FINANCING_INSTRUMENT_TYPES)[number];

export interface FinancingInstrument {
  readonly id: string;
  readonly name: string;
  readonly type: FinancingInstrumentType;
  readonly sponsor: string;
  readonly authority: string;
  /** Regions where instrument is accessible. */
  readonly regions: readonly Jurisdiction[];
  /** Eligible project types. */
  readonly eligibleProjectTypes: readonly ProjectType[];
  /** Eligible categories (mapping into ICMA principle categories etc.). */
  readonly eligibleCategories: readonly OpportunityCategory[];
  /** Indicative tenor / rate range / etc. */
  readonly indicativeTerms: string;
  /** Authoritative reference document or URL. */
  readonly reference: string;
}

export interface FinancingMatch {
  readonly instrument: FinancingInstrument;
  /** Fit score in [0, 1]. */
  readonly score: number;
  /** Why this instrument fits this project. */
  readonly rationale: string;
  /** Surfaced eligibility gates that still need clearing. */
  readonly gatesToClear: readonly string[];
}

// ─────────────────────────────────────────────────────────────────
// CarbonProjectMatch — methodology match + volume + value.
// ─────────────────────────────────────────────────────────────────

export const CARBON_REGISTRIES = [
  'VCS',
  'GS',
  'CDM',
  'PACM',
  'CAR',
  'ACR',
  'PlanVivo',
  'Puro',
  'OTHER',
] as const;

export type CarbonRegistry = (typeof CARBON_REGISTRIES)[number];

export interface CarbonMethodology {
  readonly id: string;
  readonly registry: CarbonRegistry;
  readonly title: string;
  readonly projectTypes: readonly ProjectType[];
  /** Required biomes / signals for the methodology. */
  readonly requiredSignals: readonly SectorSignal[];
  readonly reference: string;
}

export interface CarbonProjectMatch {
  readonly methodology: CarbonMethodology;
  /** Estimated annual carbon volume, tCO2e/yr. */
  readonly estimatedTCO2ePerYear: number;
  /** Crediting period years. */
  readonly creditingPeriodYears: number;
  /** Forward credit value USD/tCO2e at issuance year. */
  readonly forwardValueUsdPerTon: number;
  /** Total estimated NPV (undiscounted, illustrative). */
  readonly estimatedLifetimeValueUsd: number;
  /** Eligibility gates remaining. */
  readonly gatesToClear: readonly string[];
}

// ─────────────────────────────────────────────────────────────────
// ImpactScore — SDG vector + co-benefit dims.
// ─────────────────────────────────────────────────────────────────

export interface ImpactScore {
  /** Bit-mask of SDG targets served (17 entries, value=count of times served). */
  readonly sdgVector: readonly number[];
  /** Weighted co-benefits score in [0, 1]. */
  readonly coBenefitsScore: number;
  /** Per-dimension breakdown. */
  readonly dimensions: {
    readonly sdgAlignment: number;
    readonly jobs: number;
    readonly health: number;
    readonly water: number;
    readonly gender: number;
  };
  /** Number of SDGs (out of 17) materially served. */
  readonly sdgCount: number;
}

// ─────────────────────────────────────────────────────────────────
// Veteran-expert report — what the advisor returns.
// ─────────────────────────────────────────────────────────────────

export interface VeteranExpertReport {
  readonly profile: ProjectProfile;
  readonly opportunities: readonly GreenOpportunity[];
  readonly financing: readonly FinancingMatch[];
  readonly carbon: readonly CarbonProjectMatch[];
  readonly impact: ImpactScore;
  /** Natural-language synthesis paragraph (executive summary). */
  readonly narrative: string;
  /** Ranked top-N priorities with MCDA reasoning. */
  readonly priorities: readonly {
    readonly opportunityId: string;
    readonly rank: number;
    readonly mcdaScore: number;
    readonly reasoning: string;
  }[];
}

// ─────────────────────────────────────────────────────────────────
// MCDA prioritizer config — IRR vs. ESG vs. urgency weights.
// ─────────────────────────────────────────────────────────────────

export interface MCDAWeights {
  readonly irr: number;
  readonly esg: number;
  readonly urgency: number;
  /** Should sum to 1.0 — validated at runtime. */
}

export const DEFAULT_MCDA_WEIGHTS: MCDAWeights = {
  irr: 0.4,
  esg: 0.4,
  urgency: 0.2,
};

// ─────────────────────────────────────────────────────────────────
// LLM-synthesizer port — pure interface, NO direct LLM coupling.
//
// The advisor optionally calls an injected MultiLLMSynthesizer
// implementation from @bossnyumba/ai-copilot/providers. We do NOT
// import that here; we declare the shape it must satisfy.
// ─────────────────────────────────────────────────────────────────

export interface MultiLLMSynthesizerPort {
  synthesize(input: {
    readonly prompt: string;
    readonly context?: Record<string, unknown>;
  }): Promise<{ readonly answer: string; readonly confidence: number }>;
}
