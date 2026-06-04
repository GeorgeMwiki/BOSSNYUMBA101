/**
 * Blind-review pipeline — type contracts and boundary schemas.
 *
 * Implements a Turing-style indistinguishability test for marginal
 * real-estate decisions (lease / rent / deposit). N senior property
 * managers blind-classify each of ~100 anonymised rationales as
 * AI-authored (Mr. Mwikila, the brain layer within BossNyumba) or
 * human-authored. The bar is `accuracy <= 0.55` — at or below 55 percent
 * reviewer accuracy is statistically indistinguishable from chance at
 * n=100 (95 percent CI ~+/-9.8 percentage points), which we treat as
 * "the AI is judged at parity with a senior property manager".
 *
 * All domain types are readonly; the zod schemas at the bottom validate
 * the request and numeric inputs at the package boundary.
 *
 * Citations (2024-2026):
 *   - ReConcile (Chen et al, ACL 2024) round-table multi-agent debate.
 *   - Hu et al ICML 2025, "Theory of Mind Benchmarks are Broken for LLMs".
 *   - AGENCYBENCH 2025 long-horizon coherence.
 *   - Anthropic Constitutional AI (Bai et al, 2022) perspective rotation.
 *
 * @module @bossnyumba/blind-review/types
 */

import { z } from 'zod';

export type DecisionAuthor = 'ai' | 'human';

/** The marginal real-estate decision families this panel reviews. */
export type LeaseDecisionDomain = 'lease' | 'rent' | 'deposit';

export type LeaseDecisionOutcome = 'approve' | 'reject' | 'request_more_info';

/**
 * Structured snapshot of the factors a real-estate decision weighed, PII
 * stripped. Free-form object so the reviewer UI can render whatever fields
 * a domain produced.
 */
export type LeaseDecisionSnapshot = Readonly<Record<string, unknown>>;

export interface MarginalDecisionRecord {
  readonly id: string;
  /** Anonymised application / case id. */
  readonly caseId: string;
  readonly domain: LeaseDecisionDomain;
  readonly decision: LeaseDecisionOutcome;
  /** Owner-facing rationale, anonymised. */
  readonly rationale: string;
  /** Structured decision snapshot. PII stripped. */
  readonly snapshot: LeaseDecisionSnapshot;
  /** Ground truth, hidden from reviewers. */
  readonly author: DecisionAuthor;
  /** ISO year only, to prevent reverse-identification. */
  readonly decidedAtIsoYear: string;
  /** Broad property-type bucket to prevent reverse-id. */
  readonly propertyTypeBucket: string;
  /** Broad region bucket to prevent reverse-id. */
  readonly regionBucket: string;
}

export interface ReviewerAssignment {
  readonly reviewerId: string;
  readonly recordIds: ReadonlyArray<string>;
}

export interface ReviewerVerdict {
  readonly reviewerId: string;
  readonly recordId: string;
  readonly guess: DecisionAuthor;
  readonly confidence: number; // 0..1
  readonly rationale?: string;
}

export interface BlindReviewDataset {
  readonly id: string;
  readonly createdAtMs: number;
  readonly aiRecords: ReadonlyArray<MarginalDecisionRecord>;
  readonly humanRecords: ReadonlyArray<MarginalDecisionRecord>;
  readonly totalSize: number;
}

export interface ConfusionMatrix {
  readonly aiCorrectlyIdentified: number;
  readonly humanCorrectlyIdentified: number;
  readonly aiMisidentifiedAsHuman: number;
  readonly humanMisidentifiedAsAi: number;
}

export interface BlindReviewReport {
  readonly datasetId: string;
  readonly totalReviews: number;
  readonly accuracy: number;
  readonly indistinguishable: boolean;
  readonly perReviewer: ReadonlyArray<{
    readonly reviewerId: string;
    readonly accuracy: number;
    readonly nReviews: number;
  }>;
  readonly confusionMatrix: ConfusionMatrix;
  readonly markdown: string;
  readonly passed: boolean;
}

/** Default indistinguishability bar. */
export const INDISTINGUISHABILITY_BAR = 0.55;

/** Default deterministic seed for replayable runs. */
export const DEFAULT_SEED = 20260603;

// ---------------------------------------------------------------------------
// Boundary schemas (validate untrusted input at the facade edge)
// ---------------------------------------------------------------------------

/**
 * Numeric-input schema. The panel size / seed arrive as plain numbers from
 * an untrusted caller (a CI step, a regulator-drill request body), so we
 * clamp them to sane finite bounds before the pipeline runs.
 */
export const panelSizeSchema = z
  .number()
  .int()
  .min(2)
  .max(10_000);

export const seedSchema = z.number().int();

/**
 * Request schema for the wired facade. `reviewerIds` must be a non-empty
 * list of distinct, non-empty strings. Optional knobs are validated when
 * present and omitted otherwise (exact-optional friendly).
 */
export const runBlindReviewRequestSchema = z
  .object({
    limit: panelSizeSchema.optional(),
    seed: seedSchema.optional(),
    reviewerIds: z
      .array(z.string().min(1))
      .min(1)
      .refine((ids) => new Set(ids).size === ids.length, {
        message: 'reviewerIds must be distinct',
      })
      .optional(),
    title: z.string().min(1).optional(),
    runId: z.string().min(1).optional(),
    issuedAtIso: z.string().min(1).optional(),
  })
  .strict();

/** Inferred request type (all keys optional). */
export type RunBlindReviewRequest = z.infer<typeof runBlindReviewRequestSchema>;
