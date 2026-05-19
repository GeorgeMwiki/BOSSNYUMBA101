/**
 * Shared types for the verification stack.
 */

/** Classes of factual claims CoVe needs to verify with different evidence sources. */
export type FactClass =
  | 'amount'
  | 'date'
  | 'party-name'
  | 'address'
  | 'statutory-ref'
  | 'general';

/** Action classes the pipeline gates on. */
export type ActionClass =
  | 'eviction'
  | 'large-disbursement'
  | 'kra-filing'
  | 'lease-termination'
  | 'public-review'
  | 'rent-reminder'
  | 'lease-renewal-offer'
  | 'complaint-response'
  | 'eviction-warning'
  | 'kra-filing-confirmation'
  | 'late-fee-compute'
  | 'rent-proration'
  | 'currency-convert'
  | 'arrears-compound'
  | 'kra-mri-compute'
  | 'other';

/** Verdict emitted by any verification module. */
export type Verdict = 'pass' | 'fail' | 'defer' | 'flag';

/** A factual claim extracted from a draft. */
export interface FactualClaim {
  readonly id: string;
  readonly text: string;
  readonly factClass: FactClass;
  /** Where in the draft this claim was found (character offset). */
  readonly offset?: number;
}

/** Outcome of a single claim's verification. */
export interface ClaimVerification {
  readonly claimId: string;
  readonly claim: string;
  readonly questions: ReadonlyArray<string>;
  readonly answers: ReadonlyArray<string>;
  readonly verified: boolean;
  readonly confidence: number;
  readonly rationale: string;
}

/** Result of running CoVe. */
export interface VerifiedDraft {
  readonly originalDraft: string;
  readonly revisedDraft: string;
  readonly factClass: FactClass;
  readonly claims: ReadonlyArray<FactualClaim>;
  readonly verifications: ReadonlyArray<ClaimVerification>;
  readonly verdict: Verdict;
  readonly unverifiedClaims: ReadonlyArray<string>;
  readonly elapsedMs: number;
}

/** Self-Refine critic verdict for a single iteration. */
export interface SelfRefineCritique {
  readonly iteration: number;
  readonly toneScore: number;
  readonly factualPrecisionScore: number;
  readonly jurisdictionAppropriatenessScore: number;
  readonly clarityScore: number;
  readonly lengthScore: number;
  readonly overall: number;
  readonly accepted: boolean;
  readonly feedback: string;
}

/** Result of running Self-Refine. */
export interface RefinedMessage {
  readonly initialDraft: string;
  readonly finalDraft: string;
  readonly iterations: ReadonlyArray<SelfRefineCritique>;
  readonly accepted: boolean;
  readonly verdict: Verdict;
  readonly elapsedMs: number;
}

/** Constitutional gate verdict. */
export interface ConstitutionalGateResult {
  readonly verdict: Verdict;
  readonly required: true;
  readonly violations: ReadonlyArray<{
    readonly ruleId: string;
    readonly description: string;
    readonly severity: 'low' | 'medium' | 'high' | 'critical';
  }>;
  readonly overallScore: number;
  readonly elapsedMs: number;
  readonly deferred: boolean;
}

/** Self-Consistency sample. */
export interface ConsistencySample {
  readonly index: number;
  readonly rawValue: number;
  readonly normalisedValue: number;
}

/** Result of running Self-Consistency. */
export interface ConsistencyResult {
  readonly value: number;
  readonly confidence: number;
  readonly samples: ReadonlyArray<ConsistencySample>;
  readonly n: number;
  readonly winningCount: number;
  readonly verdict: Verdict;
  readonly elapsedMs: number;
}

/** Debate persona positions in a single round. */
export interface DebatePosition {
  readonly persona: DebatePersona;
  readonly round: number;
  readonly position: string;
  readonly recommendation: DebateRecommendation;
  readonly confidence: number;
}

export type DebatePersona = 'Legal' | 'Empathy' | 'Financial' | 'PropertyManager';

export type DebateRecommendation = 'proceed' | 'block' | 'modify' | 'escalate';

/** Result of running Multi-Agent Debate. */
export interface DebateResult {
  readonly decision: 'unanimous' | 'majority' | 'split' | 'no-consensus';
  readonly recommendation: DebateRecommendation;
  readonly positions: ReadonlyArray<DebatePosition>;
  readonly rounds: number;
  readonly verdict: Verdict;
  readonly elapsedMs: number;
  readonly rationale: string;
}

/** Pipeline aggregate result. */
export interface VerificationResult {
  readonly action: PipelineAction;
  readonly verdict: Verdict;
  readonly verifiedDraft: VerifiedDraft | null;
  readonly refinedMessage: RefinedMessage | null;
  readonly constitutional: ConstitutionalGateResult | null;
  readonly consistency: ConsistencyResult | null;
  readonly debate: DebateResult | null;
  readonly skipped: ReadonlyArray<string>;
  readonly elapsedMs: number;
}

/** Input action shape for the pipeline. */
export interface PipelineAction {
  readonly id: string;
  readonly tenantId: string | null;
  readonly actionClass: ActionClass;
  /** True for destructive irreversible actions. */
  readonly destructive: boolean;
  /** Optional tenant-facing message draft to refine. */
  readonly messageDraft?: string;
  /** Optional fact-laden draft to run CoVe on. */
  readonly factualDraft?: string;
  /** Optional fact class hint (default 'general'). */
  readonly factClass?: FactClass;
  /** Optional numeric value (and recomputation hint) for self-consistency. */
  readonly numericValue?: number;
  readonly numericPrompt?: string;
  /** Optional context for debate / constitutional review. */
  readonly context?: Readonly<Record<string, unknown>>;
}
